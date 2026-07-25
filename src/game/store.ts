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
import { computeCastLanding, isNearWater } from './world'

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

export type CastPoint = { x: number; y: number }

interface GameState {
  phase: GamePhase
  season: Season
  timeOfDay: TimeOfDay
  locationName: string

  /** プレイヤー位置（画面%）、向き */
  playerX: number
  playerY: number
  facingRight: boolean
  castPoint: CastPoint | null
  nearWater: boolean

  activeSpecies: FishSpecies | null
  biteProgress: number
  fightProgress: number
  lastCatch: CaughtFish | null
  message: string
  encyclopedia: Record<string, EncyclopediaEntry>
  /** 見た目: イラスト or ピクセル */
  artStyle: ArtStyle

  startGame: () => void
  setPlayerPose: (x: number, y: number, facingRight: boolean) => void
  cast: () => void
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

const DEFAULT_X = 28
const DEFAULT_Y = 18

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'title',
  season: 'spring',
  timeOfDay: 'morning',
  locationName: 'はじまりキャンプ',
  playerX: DEFAULT_X,
  playerY: DEFAULT_Y,
  facingRight: true,
  castPoint: null,
  nearWater: isNearWater(DEFAULT_Y),
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
    playerPose.x = DEFAULT_X
    playerPose.y = DEFAULT_Y
    playerPose.facingRight = true
    set({
      phase: 'idle',
      playerX: DEFAULT_X,
      playerY: DEFAULT_Y,
      facingRight: true,
      castPoint: null,
      nearWater: isNearWater(DEFAULT_Y),
      message: 'WASDで移動。水際でスペース／キャスト',
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
    const near = isNearWater(y)
    const { phase, nearWater } = get()
    if (
      near === nearWater &&
      Math.abs(get().playerX - x) < 1.2 &&
      Math.abs(get().playerY - y) < 1.2
    ) {
      if (Math.random() > 0.96) {
        set({ playerX: x, playerY: y, facingRight })
      }
      return
    }
    const patch: Partial<GameState> = {
      playerX: x,
      playerY: y,
      facingRight,
      nearWater: near,
    }
    if (phase === 'idle' && near !== nearWater) {
      patch.message = near
        ? '水際だ。スペースかボタンでキャスト'
        : 'WASDで移動。水際まで歩いてキャスト'
    }
    set(patch)
  },

  cast: () => {
    const { phase, nearWater, facingRight } = get()
    if (phase !== 'idle') return
    if (!nearWater) {
      set({ message: 'もっと水際に近づいてからキャストして' })
      return
    }
    clearTimers()
    const landing = computeCastLanding(
      playerPose.x,
      playerPose.y,
      facingRight,
      0.65 + Math.random() * 0.25,
    )
    set({
      phase: 'casting',
      castPoint: landing,
      message: 'キャスト…',
      activeSpecies: null,
      biteProgress: 0,
      fightProgress: 0,
    })
  },

  finishCast: () => {
    if (get().phase !== 'casting') return
    set({
      phase: 'waiting_float',
      message: 'ウキを注視して… アタリを待て（WASDで移動可）',
    })
    const delay = 2000 + Math.random() * 3000
    biteTimer = setTimeout(() => {
      get().triggerBite()
    }, delay)
  },

  triggerBite: () => {
    if (get().phase !== 'waiting_float') return
    const species = pickRandomSpecies()
    set({
      phase: 'float_sinking',
      activeSpecies: species,
      biteProgress: 0,
      message: `アタリ！ ${species.name}か…？ 今だ、アワセろ！`,
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
      message: `${activeSpecies.name}が掛かった！ 引きを楽しもう`,
    })
  },

  missHook: () => {
    if (get().phase !== 'float_sinking') return
    clearTimers()
    set({
      phase: 'idle',
      message: '逃した… 場所を変えて再キャストもアリ',
      activeSpecies: null,
      biteProgress: 0,
      castPoint: null,
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
    set({
      phase: 'idle',
      message: 'WASDで移動。水際でスペース／キャスト',
      activeSpecies: null,
      lastCatch: null,
      fightProgress: 0,
      biteProgress: 0,
      castPoint: null,
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
