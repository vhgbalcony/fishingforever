import { create } from 'zustand'
import type { ArtStyle } from './artAssets'
import {
  estimateWeightG,
  fishDisplayScale,
  getLifeStage,
  getSpecies,
  pickRandomSpecies,
  rollLengthCm,
} from './fishData'
import type {
  CaughtFish,
  EncyclopediaEntry,
  FightMode,
  FishSpecies,
  GamePhase,
  Season,
  TimeOfDay,
} from './types'
import { playerPose } from './playerPose'
import {
  canCastTo,
  clampCastTarget,
  clampWalk,
  defaultAim,
  getStreamZone,
  isNearWater,
  MAP,
  type Point,
  type StreamZone,
  ZONE_LABEL,
} from './world'

const ENCYCLOPEDIA_KEY = 'fishingforever-encyclopedia'
const ART_STYLE_KEY = 'fishingforever-art-style'

function loadArtStyle(): ArtStyle {
  try {
    const raw = localStorage.getItem(ART_STYLE_KEY)
    if (raw === 'pixel' || raw === 'illustration') return raw
  } catch {
    /* ignore */
  }
  return 'illustration'
}

function saveArtStyle(style: ArtStyle) {
  try {
    localStorage.setItem(ART_STYLE_KEY, style)
  } catch {
    /* ignore */
  }
}

function loadEncyclopedia(): Record<string, EncyclopediaEntry> {
  try {
    const raw = localStorage.getItem(ENCYCLOPEDIA_KEY)
    if (raw) return JSON.parse(raw) as Record<string, EncyclopediaEntry>
  } catch {
    /* ignore */
  }
  return {}
}

function saveEncyclopedia(data: Record<string, EncyclopediaEntry>) {
  try {
    localStorage.setItem(ENCYCLOPEDIA_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export type CastPoint = Point

/** 体長による弱い補正（種の pullPower が本体。同種の大きい個体が少しキツい） */
function sizeFightMod(species: FishSpecies, lengthCm: number | null): number {
  if (lengthCm == null) return 1
  const r = lengthCm / species.avgLengthCm
  return Math.min(1.18, Math.max(0.88, 0.72 + r * 0.28))
}

function effectivePower(species: FishSpecies, lengthCm: number | null): number {
  return Math.max(0.4, species.pullPower * sizeFightMod(species, lengthCm))
}

/** 暴れ時間（秒）— 引きが強いほど長め */
function runDurationSec(
  species: FishSpecies,
  lengthCm: number | null,
): number {
  const p = effectivePower(species, lengthCm)
  return (1.15 + species.fightSec * 0.06) * (0.85 + p * 0.2) + Math.random() * 0.4
}

/** 休憩の猶予（秒）— 引きが強いほど短い */
function restDurationSec(
  species: FishSpecies,
  lengthCm: number | null,
): number {
  const p = effectivePower(species, lengthCm)
  const base = 2.15 / Math.sqrt(p)
  return Math.min(2.6, Math.max(0.85, base + Math.random() * 0.35))
}

/**
 * ヒット直後の寄せ（0〜1）。中心 ~0.20。
 * 引きが弱い種・小さめ個体ほどやや有利。
 */
function initialFightProgress(
  species: FishSpecies,
  lengthCm: number | null,
): number {
  const p = effectivePower(species, lengthCm)
  const base = 0.28 - p * 0.07
  const jitter = (Math.random() - 0.5) * 0.06
  return Math.min(0.36, Math.max(0.11, base + jitter))
}

/** 休み中に長押ししているときの寄せ速度（/秒） */
function restPullRatePerSec(
  species: FishSpecies,
  lengthCm: number | null,
): number {
  const p = effectivePower(species, lengthCm)
  // おおよそ 2〜5 秒相当の長押しで満タン付近（休みの合間に分割）
  return 0.28 / p
}

/** 暴れ中に長押ししているときの減り速度（/秒）。すぐ離せば軽い傷で済む */
function wrongHoldRatePerSec(
  species: FishSpecies,
  lengthCm: number | null,
): number {
  const p = effectivePower(species, lengthCm)
  // オイカワ寄り: ゆっくり減 / ニジマス: 短押しでも危険
  return 0.1 + p * 0.32
}

/** 休みを丸ごと逃したときの減り */
function restMissSlip(
  species: FishSpecies,
  lengthCm: number | null,
  progress: number,
): number {
  const p = effectivePower(species, lengthCm)
  return Math.min(0.14, 0.04 + progress * 0.08 * p)
}

function resetFightFields() {
  return {
    activeSpecies: null as FishSpecies | null,
    pendingLengthCm: null as number | null,
    pendingFishScale: 1,
    fightProgress: 0,
    fightMode: 'running' as FightMode,
    fightModeTimer: 0,
    fightModeDuration: 1,
    pullHeld: false,
    biteProgress: 0,
    castPoint: null as CastPoint | null,
    castZone: null as StreamZone | null,
  }
}

/** 危険メッセージのスパム防止 */
let lastDangerMsgAt = 0

interface GameState {
  phase: GamePhase
  season: Season
  timeOfDay: TimeOfDay
  locationName: string

  playerX: number
  playerY: number
  facingRight: boolean
  aimX: number
  aimY: number
  castPoint: CastPoint | null
  nearWater: boolean
  aimZone: StreamZone
  castZone: StreamZone | null

  activeSpecies: FishSpecies | null
  /** ヒット確定時に抽選した体長（水中サイズ表示用） */
  pendingLengthCm: number | null
  /** 表示スケール 0.4〜1.45 */
  pendingFishScale: number
  biteProgress: number
  /** 0〜1 寄せ具合。ヒット時は約0.2から。1で釣り上げ、<0で逃げ */
  fightProgress: number
  /** 暴れてる / 休んでる */
  fightMode: FightMode
  /** 現在モードの残り秒 */
  fightModeTimer: number
  /** 現在モードの長さ（秒・メーター用） */
  fightModeDuration: number
  /** 引くボタン／Space を長押し中か */
  pullHeld: boolean
  lastCatch: CaughtFish | null
  message: string
  encyclopedia: Record<string, EncyclopediaEntry>
  artStyle: ArtStyle

  startGame: () => void
  setPlayerPose: (x: number, y: number, facingRight: boolean) => void
  setAim: (x: number, y: number) => void
  cast: () => void
  castAt: (x: number, y: number) => void
  finishCast: () => void
  triggerBite: () => void
  tryHook: () => void
  missHook: () => void
  tickFight: (dt: number) => void
  /** 長押し開始／終了（原作は引っ張り＝押し続け） */
  setPullHeld: (held: boolean) => void
  /** @deprecated 互換: 押した瞬間だけ。長押しは setPullHeld を使う */
  pullLine: () => void
  /** 寄せがマイナス → 逃げて岸へ */
  escapeFight: () => void
  finishFight: () => void
  keepCatch: () => void
  releaseCatch: () => void
  dismissResult: () => void
  setBiteProgress: (p: number) => void
  cycleTimeOfDay: () => void
  setArtStyle: (style: ArtStyle) => void
  setMessage: (msg: string) => void
  canMove: () => boolean
}

let biteTimer: ReturnType<typeof setTimeout> | null = null
let sinkTimer: ReturnType<typeof setTimeout> | null = null

function clearTimers() {
  if (biteTimer) clearTimeout(biteTimer)
  if (sinkTimer) clearTimeout(sinkTimer)
  biteTimer = null
  sinkTimer = null
}

const DEFAULT = MAP.spawn
const initialAim = defaultAim(DEFAULT)

function registerEncyclopedia(
  encyclopedia: Record<string, EncyclopediaEntry>,
  catchData: CaughtFish,
): Record<string, EncyclopediaEntry> {
  const prev = encyclopedia[catchData.speciesId]
  const entry: EncyclopediaEntry = {
    speciesId: catchData.speciesId,
    timesCaught: (prev?.timesCaught ?? 0) + 1,
    maxLengthCm: Math.max(prev?.maxLengthCm ?? 0, catchData.lengthCm),
    firstCaughtAt: prev?.firstCaughtAt ?? Date.now(),
  }
  return { ...encyclopedia, [catchData.speciesId]: entry }
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'title',
  season: 'spring',
  timeOfDay: 'morning',
  locationName: 'はじまりキャンプ',
  playerX: DEFAULT.x,
  playerY: DEFAULT.y,
  facingRight: true,
  aimX: initialAim.x,
  aimY: initialAim.y,
  castPoint: null,
  nearWater: isNearWater(DEFAULT),
  aimZone: getStreamZone(initialAim),
  castZone: null,
  activeSpecies: null,
  pendingLengthCm: null,
  pendingFishScale: 1,
  biteProgress: 0,
  fightProgress: 0,
  fightMode: 'running',
  fightModeTimer: 0,
  fightModeDuration: 1,
  pullHeld: false,
  lastCatch: null,
  message: '',
  encyclopedia: loadEncyclopedia(),
  artStyle: loadArtStyle(),

  canMove: () => {
    const p = get().phase
    return p === 'idle' || p === 'waiting_float'
  },

  startGame: () => {
    clearTimers()
    const spawn = clampWalk(DEFAULT.x, DEFAULT.y)
    playerPose.x = spawn.x
    playerPose.y = spawn.y
    playerPose.facingRight = true
    const aim = defaultAim(spawn)
    set({
      phase: 'idle',
      playerX: spawn.x,
      playerY: spawn.y,
      facingRight: true,
      aimX: aim.x,
      aimY: aim.y,
      aimZone: getStreamZone(aim),
      castPoint: null,
      castZone: null,
      nearWater: isNearWater(spawn),
      message:
        '上流→中流→下流を縦に探索。川は橋で渡れる。水際でクリック／スペースでキャスト',
      activeSpecies: null,
      pendingLengthCm: null,
      pendingFishScale: 1,
      lastCatch: null,
      fightProgress: 0,
      fightMode: 'running',
      fightModeTimer: 0,
      fightModeDuration: 1,
      pullHeld: false,
      biteProgress: 0,
    })
  },

  setPlayerPose: (x, y, facingRight) => {
    playerPose.x = x
    playerPose.y = y
    playerPose.facingRight = facingRight
    const pos = { x, y }
    const near = isNearWater(pos)
    const aim = clampCastTarget(pos, { x: get().aimX, y: get().aimY })
    const aimZone = getStreamZone(aim)
    const { phase, nearWater } = get()

    const patch: Partial<GameState> = {
      playerX: x,
      playerY: y,
      facingRight,
      nearWater: near,
      aimX: aim.x,
      aimY: aim.y,
      aimZone,
    }

    if (phase === 'idle' && near !== nearWater) {
      patch.message = near
        ? `水際（${ZONE_LABEL[aimZone]}）。川をクリックで狙いキャスト`
        : '川は泳げないよ。対岸は橋を渡って。岸沿いで釣り'
    }
    set(patch)
  },

  setAim: (x, y) => {
    const from = { x: playerPose.x, y: playerPose.y }
    const aim = clampCastTarget(from, { x, y })
    set({
      aimX: aim.x,
      aimY: aim.y,
      aimZone: getStreamZone(aim),
    })
  },

  cast: () => {
    const { phase, nearWater, aimX, aimY } = get()
    if (phase !== 'idle') return
    const from = { x: playerPose.x, y: playerPose.y }
    if (!nearWater) {
      set({ message: 'もっと水際に近づいてからキャストして' })
      return
    }
    const landing = clampCastTarget(from, { x: aimX, y: aimY })
    if (!canCastTo(from, landing)) {
      set({
        message: 'そこには届かない… 近づくか、狙いを変えてみて',
      })
      return
    }
    clearTimers()
    const zone = getStreamZone(landing)
    set({
      phase: 'casting',
      castPoint: landing,
      castZone: zone,
      message: `${ZONE_LABEL[zone]}へキャスト…`,
      activeSpecies: null,
      pendingLengthCm: null,
      pendingFishScale: 1,
      biteProgress: 0,
      fightProgress: 0,
      fightMode: 'running',
      fightModeTimer: 0,
      fightModeDuration: 1,
      pullHeld: false,
    })
  },

  castAt: (x, y) => {
    const { phase, nearWater } = get()
    if (phase !== 'idle') return
    if (!nearWater) {
      set({ message: 'もっと水際に近づいてからキャストして' })
      return
    }
    get().setAim(x, y)
    get().cast()
  },

  finishCast: () => {
    if (get().phase !== 'casting') return
    const zone = get().castZone
    set({
      phase: 'waiting_float',
      message: zone
        ? `${ZONE_LABEL[zone]}でウキ待ち… アタリに備えよう`
        : 'ウキを注視して… アタリを待て',
    })
    const delay = 2000 + Math.random() * 3000
    biteTimer = setTimeout(() => {
      get().triggerBite()
    }, delay)
  },

  triggerBite: () => {
    if (get().phase !== 'waiting_float') return
    const zone = get().castZone ?? 'middle'
    const species = pickRandomSpecies(zone)
    set({
      phase: 'float_sinking',
      activeSpecies: species,
      biteProgress: 0,
      message: 'アタリ！！ 今だ、アワセろ！',
    })
    sinkTimer = setTimeout(() => {
      if (get().phase === 'float_sinking') get().missHook()
    }, species.hookWindowSec * 1000)
  },

  tryHook: () => {
    const { phase, activeSpecies, biteProgress } = get()
    if (phase !== 'float_sinking' || !activeSpecies) return
    clearTimers()
    if (biteProgress < 0.08) {
      set({
        phase: 'waiting_float',
        message: '早すぎ… もう一度待て',
        activeSpecies: null,
        biteProgress: 0,
      })
      const delay = 1500 + Math.random() * 2500
      biteTimer = setTimeout(() => get().triggerBite(), delay)
      return
    }
    const lengthCm = rollLengthCm(activeSpecies)
    const scale = fishDisplayScale(activeSpecies, lengthCm)
    // scale は 20cm=1.0 の絶対値。ヒントも体長 cm 基準
    const sizeHint =
      lengthCm < activeSpecies.juvenileMaxCm
        ? '小さな引き… 幼魚かも'
        : lengthCm >= activeSpecies.avgLengthCm * 1.2
          ? 'ずしり重い！'
          : '引きを楽しもう…'
    const runSec = runDurationSec(activeSpecies, lengthCm)
    const startProgress = initialFightProgress(activeSpecies, lengthCm)
    lastDangerMsgAt = 0
    set({
      phase: 'underwater_fight',
      fightProgress: startProgress,
      fightMode: 'running',
      fightModeTimer: runSec,
      fightModeDuration: runSec,
      pullHeld: false,
      pendingLengthCm: lengthCm,
      pendingFishScale: scale,
      message: `掛かった！ ${sizeHint} 休み中に長押しで寄せよう（暴れ中はすぐ離せ）`,
    })
  },

  missHook: () => {
    if (get().phase !== 'float_sinking') return
    clearTimers()
    set({
      phase: 'idle',
      message: '逃した… 場所や狙いを変えて再キャストもアリ',
      ...resetFightFields(),
    })
  },

  tickFight: (dt: number) => {
    const {
      phase,
      activeSpecies,
      fightMode,
      fightModeTimer,
      fightProgress,
      pullHeld,
      pendingLengthCm,
    } = get()
    if (phase !== 'underwater_fight' || !activeSpecies) return

    // —— 長押し中の寄せ／ペナルティ ——
    if (pullHeld) {
      if (fightMode === 'resting') {
        const gain =
          restPullRatePerSec(activeSpecies, pendingLengthCm) * dt
        const next = fightProgress + gain
        if (next >= 1) {
          get().finishFight()
          return
        }
        set({
          fightProgress: next,
          message:
            next >= 0.75
              ? 'いいぞ、寄せてる…！ 長押しキープ'
              : next >= 0.4
                ? '寄せてる… 離さず引こう'
                : 'ラインを寄せてる…',
        })
      } else {
        // 暴れ中に押し続け → 減る。すぐ離せば軽傷
        const loss =
          wrongHoldRatePerSec(activeSpecies, pendingLengthCm) * dt
        const next = fightProgress - loss
        if (next < 0) {
          get().escapeFight()
          return
        }
        const now = performance.now()
        if (now - lastDangerMsgAt > 420) {
          lastDangerMsgAt = now
          set({
            fightProgress: next,
            message:
              next < 0.12
                ? '離して！！ ラインが持つまい…'
                : next < 0.22
                  ? 'まだ暴れてる！ すぐ離せ！'
                  : '無理引き中… すぐ離そう',
          })
        } else {
          set({ fightProgress: next })
        }
      }
    }

    // —— 暴れ ↔ 休み の時間経過 ——
    const { fightModeTimer: timerNow, fightProgress: progNow, fightMode: modeNow } =
      get()
    if (get().phase !== 'underwater_fight') return

    const nextTimer = timerNow - dt
    if (nextTimer > 0) {
      set({ fightModeTimer: nextTimer })
      return
    }

    if (modeNow === 'running') {
      const restSec = restDurationSec(activeSpecies, pendingLengthCm)
      set({
        fightMode: 'resting',
        fightModeTimer: restSec,
        fightModeDuration: restSec,
        message: pullHeld
          ? '休んだ！ そのまま長押しで寄せよう'
          : '疲れて休んだ！ 長押しで引け！',
      })
      return
    }

    // 休み終了 → また暴れる（休み逃しは減るが 0 未満にはしない）
    const slip = restMissSlip(activeSpecies, pendingLengthCm, progNow)
    const runSec = runDurationSec(activeSpecies, pendingLengthCm)
    const after = Math.max(0, progNow - slip)
    set({
      fightMode: 'running',
      fightModeTimer: runSec,
      fightModeDuration: runSec,
      fightProgress: after,
      message: pullHeld
        ? 'また走った！ すぐ離して待て！'
        : 'また走り出した… 次の休みを待て',
    })
  },

  setPullHeld: (held) => {
    const { phase } = get()
    if (phase !== 'underwater_fight') {
      if (get().pullHeld) set({ pullHeld: false })
      return
    }
    set({ pullHeld: held })
    if (!held && get().fightMode === 'running') {
      // 離したとき、少し安心メッセージ
      const p = get().fightProgress
      if (p >= 0 && p < 0.35) {
        set({ message: '離した。休みを待とう…' })
      }
    }
  },

  pullLine: () => {
    // 互換: クリック一発でも「短く押した」扱いに近づける
    const { phase } = get()
    if (phase !== 'underwater_fight') return
    get().setPullHeld(true)
    // 次フレーム以降 tick が効く。ボタンは pointer で up を取る想定
  },

  escapeFight: () => {
    if (get().phase !== 'underwater_fight') return
    clearTimers()
    const name = get().activeSpecies?.name ?? '魚'
    const aim = defaultAim({ x: playerPose.x, y: playerPose.y })
    set({
      phase: 'idle',
      message: `${name}に逃げられた。落ち着いて再キャスト！`,
      ...resetFightFields(),
      aimX: aim.x,
      aimY: aim.y,
      aimZone: getStreamZone(aim),
      lastCatch: null,
    })
  },

  finishFight: () => {
    const { activeSpecies, pendingLengthCm } = get()
    if (!activeSpecies) return
    const lengthCm = pendingLengthCm ?? rollLengthCm(activeSpecies)
    const weightG = estimateWeightG(lengthCm, activeSpecies.weightFactor)
    const lifeStage = getLifeStage(activeSpecies, lengthCm)
    const catchData: CaughtFish = {
      speciesId: activeSpecies.id,
      name: activeSpecies.name,
      lengthCm,
      weightG,
      lifeStage,
      caughtAt: Date.now(),
    }

    set({
      phase: 'catch_result',
      lastCatch: catchData,
      message: '釣り上げた！',
      fightProgress: 1,
      fightMode: 'resting',
      fightModeTimer: 0,
      fightModeDuration: 1,
      pullHeld: false,
    })
  },

  keepCatch: () => {
    const { lastCatch, encyclopedia } = get()
    if (!lastCatch) return
    const nextEnc = registerEncyclopedia(encyclopedia, lastCatch)
    saveEncyclopedia(nextEnc)
    const aim = defaultAim({ x: playerPose.x, y: playerPose.y })
    set({
      phase: 'idle',
      encyclopedia: nextEnc,
      message:
        lastCatch.lifeStage === 'juvenile'
          ? 'キープした。幼魚はリリース推奨だよ'
          : '図鑑に記録した！ WASDで探索',
      ...resetFightFields(),
      lastCatch: null,
      aimX: aim.x,
      aimY: aim.y,
      aimZone: getStreamZone(aim),
    })
  },

  releaseCatch: () => {
    const { lastCatch } = get()
    if (!lastCatch) return
    const aim = defaultAim({ x: playerPose.x, y: playerPose.y })
    const note =
      lastCatch.lifeStage === 'juvenile'
        ? '幼魚をリリースした。また大きくなってね'
        : `${lastCatch.name}をリリースした`
    set({
      phase: 'idle',
      message: note,
      ...resetFightFields(),
      lastCatch: null,
      aimX: aim.x,
      aimY: aim.y,
      aimZone: getStreamZone(aim),
    })
  },

  dismissResult: () => {
    // 互換: スペースはキープ扱い
    get().keepCatch()
  },

  setBiteProgress: (p: number) => set({ biteProgress: p }),

  cycleTimeOfDay: () => {
    const order: TimeOfDay[] = ['morning', 'day', 'evening']
    const i = order.indexOf(get().timeOfDay)
    set({ timeOfDay: order[(i + 1) % order.length]! })
  },

  setArtStyle: (style) => {
    saveArtStyle(style)
    set({ artStyle: style })
  },

  setMessage: (msg: string) => set({ message: msg }),
}))

export function speciesLabel(id: string): string {
  return getSpecies(id)?.name ?? id
}
