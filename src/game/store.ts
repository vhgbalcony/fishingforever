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

/** 暴れ時間（秒）— 大きい魚ほど少し長い */
function runDurationSec(species: FishSpecies): number {
  return 1.35 + species.fightSec * 0.08 + Math.random() * 0.45
}

/** 休憩の猶予（秒）— この間に引く */
function restDurationSec(species: FishSpecies): number {
  return 1.7 + Math.min(1.1, species.hookWindowSec * 0.35) + Math.random() * 0.4
}

/** 1回の引きで進む量。fightSec が長いほど多く引く必要あり */
function pullGain(species: FishSpecies): number {
  // fightSec 5 → 約0.40（3回前後） / 10 → 約0.22（5回前後）
  return 1 / Math.max(2.4, species.fightSec / 2.15)
}

/**
 * ヒット直後の寄せ具合（0〜1）。中心はだいたい 0.20。
 * 小さい・扱いやすい魚ほどやや高め、大物ほど低め＋ブレ。
 */
function initialFightProgress(species: FishSpecies): number {
  const ease = (12 - species.fightSec) / 12 // 5→0.58 / 10→0.17
  const base = 0.14 + ease * 0.14 // おおよそ 0.16〜0.28
  const jitter = (Math.random() - 0.5) * 0.07
  return Math.min(0.34, Math.max(0.12, base + jitter))
}

/** 暴れ中に無理引きしたときの減り。2〜3回で危なくなる想定 */
function wrongPullPenalty(species: FishSpecies): number {
  return 0.085 + species.fightSec * 0.0055 + Math.random() * 0.035
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
    biteProgress: 0,
    castPoint: null as CastPoint | null,
    castZone: null as StreamZone | null,
  }
}

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
  /** 休み中＝寄せ / 暴れ中＝無理引きペナルティ */
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
    const runSec = runDurationSec(activeSpecies)
    const startProgress = initialFightProgress(activeSpecies)
    set({
      phase: 'underwater_fight',
      fightProgress: startProgress,
      fightMode: 'running',
      fightModeTimer: runSec,
      fightModeDuration: runSec,
      pendingLengthCm: lengthCm,
      pendingFishScale: scale,
      message: `掛かった！ ${sizeHint} 休んでから引こう（暴れ中は危険）`,
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
    const { phase, activeSpecies, fightMode, fightModeTimer, fightProgress } =
      get()
    if (phase !== 'underwater_fight' || !activeSpecies) return

    const nextTimer = fightModeTimer - dt
    if (nextTimer > 0) {
      set({ fightModeTimer: nextTimer })
      return
    }

    if (fightMode === 'running') {
      const restSec = restDurationSec(activeSpecies)
      set({
        fightMode: 'resting',
        fightModeTimer: restSec,
        fightModeDuration: restSec,
        message: '疲れて休んだ！ 今だ、引け！',
      })
      return
    }

    // 休憩しきった → また逃げる（引かなかった）。0未満にはしない
    const slip = Math.min(0.08, fightProgress * 0.12)
    const runSec = runDurationSec(activeSpecies)
    set({
      fightMode: 'running',
      fightModeTimer: runSec,
      fightModeDuration: runSec,
      fightProgress: Math.max(0, fightProgress - slip),
      message: 'また走り出した… 次の休みを待て',
    })
  },

  pullLine: () => {
    const { phase, activeSpecies, fightMode, fightProgress } = get()
    if (phase !== 'underwater_fight' || !activeSpecies) return

    // 暴れ中に無理引き → 寄せが減る。マイナスで逃げ
    if (fightMode === 'running') {
      const loss = wrongPullPenalty(activeSpecies)
      const next = fightProgress - loss
      if (next < 0) {
        get().escapeFight()
        return
      }
      const danger =
        next < 0.12
          ? '危うい…！ もう無理は禁物'
          : next < 0.22
            ? 'ラインが危ない！ 休むまで待て'
            : 'まだ暴れてる！ 寄せが戻った…'
      set({
        fightProgress: next,
        message: danger,
      })
      return
    }

    const gain = pullGain(activeSpecies) * (0.92 + Math.random() * 0.16)
    const next = Math.min(1, fightProgress + gain)
    if (next >= 1) {
      get().finishFight()
      return
    }

    // 寄せたあとすぐまた走る（駆け引きのリズム）
    const runSec =
      runDurationSec(activeSpecies) * (0.75 + Math.random() * 0.35)
    set({
      fightProgress: next,
      fightMode: 'running',
      fightModeTimer: runSec,
      fightModeDuration: runSec,
      message:
        next >= 0.7
          ? 'もう少し！ まだ走る…'
          : next >= 0.4
            ? '寄せた！ また走る…'
            : 'ラインを寄せた！ また暴れる…',
    })
  },

  escapeFight: () => {
    if (get().phase !== 'underwater_fight') return
    clearTimers()
    const aim = defaultAim({ x: playerPose.x, y: playerPose.y })
    set({
      phase: 'idle',
      message: 'バレた…逃げられてしまった。落ち着いて再キャスト！',
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
      activeSpecies: null,
      lastCatch: null,
      pendingLengthCm: null,
      pendingFishScale: 1,
      fightProgress: 0,
      fightMode: 'running',
      fightModeTimer: 0,
      fightModeDuration: 1,
      biteProgress: 0,
      castPoint: null,
      castZone: null,
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
      activeSpecies: null,
      lastCatch: null,
      pendingLengthCm: null,
      pendingFishScale: 1,
      fightProgress: 0,
      fightMode: 'running',
      fightModeTimer: 0,
      fightModeDuration: 1,
      biteProgress: 0,
      castPoint: null,
      castZone: null,
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
