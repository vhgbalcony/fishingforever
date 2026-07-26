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
  fightProgress: number
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
    set({
      phase: 'underwater_fight',
      fightProgress: 0,
      pendingLengthCm: lengthCm,
      pendingFishScale: scale,
      message: `掛かった！ ${sizeHint}`,
    })
  },

  missHook: () => {
    if (get().phase !== 'float_sinking') return
    clearTimers()
    set({
      phase: 'idle',
      message: '逃した… 場所や狙いを変えて再キャストもアリ',
      activeSpecies: null,
      pendingLengthCm: null,
      pendingFishScale: 1,
      biteProgress: 0,
      castPoint: null,
      castZone: null,
    })
  },

  tickFight: (dt: number) => {
    const { phase, activeSpecies, fightProgress } = get()
    if (phase !== 'underwater_fight' || !activeSpecies) return
    const next = Math.min(1, fightProgress + dt / activeSpecies.fightSec)
    set({ fightProgress: next })
    if (next >= 1) get().finishFight()
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
