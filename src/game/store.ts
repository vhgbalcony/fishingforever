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

interface GameState {
  phase: GamePhase
  season: Season
  timeOfDay: TimeOfDay
  locationName: string

  /** 現在ヒット候補／ファイト中の魚種 */
  activeSpecies: FishSpecies | null
  /** ウキ沈みからの経過（0〜1 で猶予内） */
  biteProgress: number
  /** ファイト進捗 0〜1 */
  fightProgress: number
  /** 直近の釣果 */
  lastCatch: CaughtFish | null
  /** メッセージ（HUD） */
  message: string
  /** 図鑑 */
  encyclopedia: Record<string, EncyclopediaEntry>

  startGame: () => void
  cast: () => void
  /** casting 完了後にウキ待ちへ */
  finishCast: () => void
  /** アタリ発生（内部／デモ用） */
  triggerBite: () => void
  /** アワセ入力 */
  tryHook: () => void
  missHook: () => void
  /** ファイト進行 */
  tickFight: (dt: number) => void
  finishFight: () => void
  dismissResult: () => void
  setBiteProgress: (p: number) => void
  cycleTimeOfDay: () => void
  setMessage: (msg: string) => void
}

let biteTimer: ReturnType<typeof setTimeout> | null = null
let sinkTimer: ReturnType<typeof setTimeout> | null = null

function clearTimers() {
  if (biteTimer) clearTimeout(biteTimer)
  if (sinkTimer) clearTimeout(sinkTimer)
  biteTimer = null
  sinkTimer = null
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'title',
  season: 'spring',
  timeOfDay: 'morning',
  locationName: 'はじまりキャンプ',
  activeSpecies: null,
  biteProgress: 0,
  fightProgress: 0,
  lastCatch: null,
  message: '',
  encyclopedia: loadEncyclopedia(),

  startGame: () => {
    clearTimers()
    set({
      phase: 'idle',
      message: 'スペース／クリックでキャスト',
      activeSpecies: null,
      lastCatch: null,
      fightProgress: 0,
      biteProgress: 0,
    })
  },

  cast: () => {
    const { phase } = get()
    if (phase !== 'idle') return
    clearTimers()
    set({
      phase: 'casting',
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
      message: 'ウキを注視して… アタリを待て',
    })
    // 2〜5 秒後にアタリ
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
    // 猶予超過でミス
    sinkTimer = setTimeout(() => {
      if (get().phase === 'float_sinking') get().missHook()
    }, species.hookWindowSec * 1000)
  },

  tryHook: () => {
    const { phase, activeSpecies, biteProgress } = get()
    if (phase !== 'float_sinking' || !activeSpecies) return
    clearTimers()
    // 沈み始め直後は少し甘い／終盤も可（MVPはほぼ成功寄り）
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
      message: '逃した… もう一度キャストしよう',
      activeSpecies: null,
      biteProgress: 0,
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
      message: 'スペース／クリックでキャスト',
      activeSpecies: null,
      lastCatch: null,
      fightProgress: 0,
      biteProgress: 0,
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
