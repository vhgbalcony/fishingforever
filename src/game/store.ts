import { create } from 'zustand'
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

export type CastPoint = { x: number; y: number; z: number }

interface GameState {
  phase: GamePhase
  season: Season
  timeOfDay: TimeOfDay
  locationName: string

  /** プレイヤー位置（XZ）、yaw（rad、0=+Z 水向き） */
  playerX: number
  playerZ: number
  playerYaw: number
  /** ウキ着水点 */
  castPoint: CastPoint | null
  nearWater: boolean

  activeSpecies: FishSpecies | null
  biteProgress: number
  fightProgress: number
  lastCatch: CaughtFish | null
  message: string
  encyclopedia: Record<string, EncyclopediaEntry>

  startGame: () => void
  setPlayerPose: (x: number, z: number, yaw: number) => void
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
  setMessage: (msg: string) => void
  /** 移動可能フェーズか */
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

const DEFAULT_X = 0
const DEFAULT_Z = -5.2
const DEFAULT_YAW = 0

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'title',
  season: 'spring',
  timeOfDay: 'morning',
  locationName: 'はじまりキャンプ',
  playerX: DEFAULT_X,
  playerZ: DEFAULT_Z,
  playerYaw: DEFAULT_YAW,
  castPoint: null,
  nearWater: isNearWater(DEFAULT_Z),
  activeSpecies: null,
  biteProgress: 0,
  fightProgress: 0,
  lastCatch: null,
  message: '',
  encyclopedia: loadEncyclopedia(),

  canMove: () => {
    const p = get().phase
    return p === 'idle' || p === 'waiting_float'
  },

  startGame: () => {
    clearTimers()
    playerPose.x = DEFAULT_X
    playerPose.z = DEFAULT_Z
    playerPose.yaw = DEFAULT_YAW
    set({
      phase: 'idle',
      playerX: DEFAULT_X,
      playerZ: DEFAULT_Z,
      playerYaw: DEFAULT_YAW,
      castPoint: null,
      nearWater: isNearWater(DEFAULT_Z),
      message: 'WASDで移動。水際でスペース／キャスト',
      activeSpecies: null,
      lastCatch: null,
      fightProgress: 0,
      biteProgress: 0,
    })
  },

  setPlayerPose: (x, z, yaw) => {
    playerPose.x = x
    playerPose.z = z
    playerPose.yaw = yaw
    const near = isNearWater(z)
    const { phase, nearWater } = get()
    // 位置は毎フレーム変えず、水際フラグとメッセージだけ React に通知
    if (near === nearWater && Math.abs(get().playerX - x) < 0.5) {
      // たまに同期（他UI用）
      if (Math.random() > 0.95) set({ playerX: x, playerZ: z, playerYaw: yaw })
      return
    }
    const patch: Partial<GameState> = {
      playerX: x,
      playerZ: z,
      playerYaw: yaw,
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
    const { phase, nearWater } = get()
    if (phase !== 'idle') return
    if (!nearWater) {
      set({ message: 'もっと水際に近づいてからキャストして' })
      return
    }
    clearTimers()
    const landing = computeCastLanding(
      playerPose.x,
      playerPose.z,
      playerPose.yaw,
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

  setMessage: (msg: string) => set({ message: msg }),
}))

export function speciesLabel(id: string): string {
  return getSpecies(id)?.name ?? id
}
