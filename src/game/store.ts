import { create } from 'zustand'
import type { ArtStyle } from './artAssets'
import {
  estimateWeightG,
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
  /** キャスト狙い位置（水上） */
  aimX: number
  aimY: number
  castPoint: CastPoint | null
  nearWater: boolean
  /** 狙い／着水のゾーン */
  aimZone: StreamZone
  castZone: StreamZone | null

  activeSpecies: FishSpecies | null
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
    playerPose.x = DEFAULT.x
    playerPose.y = DEFAULT.y
    playerPose.facingRight = true
    const aim = defaultAim(DEFAULT)
    set({
      phase: 'idle',
      playerX: DEFAULT.x,
      playerY: DEFAULT.y,
      facingRight: true,
      aimX: aim.x,
      aimY: aim.y,
      aimZone: getStreamZone(aim),
      castPoint: null,
      castZone: null,
      nearWater: isNearWater(DEFAULT),
      message:
        'WASDで移動。水際で川をクリックして狙い、スペースでキャスト',
      activeSpecies: null,
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
        ? `水際だ（${ZONE_LABEL[aimZone]}を狙える）。川をクリック／スペースでキャスト`
        : 'WASDで移動。川沿いまで歩いて狙いをつけよう'
    }
    set(patch)
  },

  setAim: (x, y) => {
    const from = { x: playerPose.x, y: playerPose.y }
    if (!isNearWater(from) && get().phase === 'idle') {
      // 水際以外では狙いだけ記憶（着水はクランプ）
    }
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
      // ネタバレ防止: 名前は出さない
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
    set({
      phase: 'underwater_fight',
      fightProgress: 0,
      // ネタバレ防止: 種名は釣果まで伏せる
      message: '掛かった！ 引きを楽しもう…',
    })
  },

  missHook: () => {
    if (get().phase !== 'float_sinking') return
    clearTimers()
    set({
      phase: 'idle',
      message: '逃した… 場所や狙いを変えて再キャストもアリ',
      activeSpecies: null,
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
    const { activeSpecies, encyclopedia } = get()
    if (!activeSpecies) return
    const lengthCm = rollLengthCm(activeSpecies)
    const weightG = estimateWeightG(lengthCm, activeSpecies.weightFactor)
    const catchData: CaughtFish = {
      speciesId: activeSpecies.id,
      name: activeSpecies.name,
      lengthCm,
      weightG,
      caughtAt: Date.now(),
    }

    const prev = encyclopedia[activeSpecies.id]
    const entry: EncyclopediaEntry = {
      speciesId: activeSpecies.id,
      timesCaught: (prev?.timesCaught ?? 0) + 1,
      maxLengthCm: Math.max(prev?.maxLengthCm ?? 0, lengthCm),
      firstCaughtAt: prev?.firstCaughtAt ?? Date.now(),
    }
    const nextEnc = { ...encyclopedia, [activeSpecies.id]: entry }
    saveEncyclopedia(nextEnc)

    set({
      phase: 'catch_result',
      lastCatch: catchData,
      encyclopedia: nextEnc,
      message: 'やった！',
      fightProgress: 1,
    })
  },

  dismissResult: () => {
    const aim = defaultAim({ x: playerPose.x, y: playerPose.y })
    set({
      phase: 'idle',
      message: 'WASDで移動。水際で川をクリック／スペースでキャスト',
      activeSpecies: null,
      lastCatch: null,
      fightProgress: 0,
      biteProgress: 0,
      castPoint: null,
      castZone: null,
      aimX: aim.x,
      aimY: aim.y,
      aimZone: getStreamZone(aim),
    })
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
