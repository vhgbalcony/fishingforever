import type { FishSpecies } from './types'

/** はじまりキャンプ — 第1弾の清流魚（アユは後回し、イワナは渓流マップ用に除外） */
export const FISH_SPECIES: FishSpecies[] = [
  {
    id: 'yamame',
    name: 'ヤマメ',
    avgLengthCm: 22,
    lengthVariance: 8,
    weightFactor: 0.012,
    hookWindowSec: 1.4,
    fightSec: 8,
    color: '#c4a35a',
    accentColor: '#5c4030',
  },
  {
    id: 'amago',
    name: 'アマゴ',
    avgLengthCm: 20,
    lengthVariance: 7,
    weightFactor: 0.011,
    hookWindowSec: 1.3,
    fightSec: 7.5,
    color: '#d4a574',
    accentColor: '#8b4513',
  },
  {
    id: 'nijimasu',
    name: 'ニジマス',
    avgLengthCm: 28,
    lengthVariance: 10,
    weightFactor: 0.014,
    hookWindowSec: 1.2,
    fightSec: 10,
    color: '#7ec8a3',
    accentColor: '#e85d75',
  },
  {
    id: 'oikawa',
    name: 'オイカワ',
    avgLengthCm: 12,
    lengthVariance: 4,
    weightFactor: 0.008,
    hookWindowSec: 1.6,
    fightSec: 5,
    color: '#6eb5ff',
    accentColor: '#ff6b9d',
  },
  {
    id: 'ugui',
    name: 'ウグイ',
    avgLengthCm: 18,
    lengthVariance: 6,
    weightFactor: 0.01,
    hookWindowSec: 1.5,
    fightSec: 6,
    color: '#a8b5c4',
    accentColor: '#f0a0a0',
  },
  {
    id: 'kajika',
    name: 'カジカ',
    avgLengthCm: 10,
    lengthVariance: 3,
    weightFactor: 0.015,
    hookWindowSec: 1.8,
    fightSec: 5.5,
    color: '#6b5b4f',
    accentColor: '#3d3530',
  },
]

export function getSpecies(id: string): FishSpecies | undefined {
  return FISH_SPECIES.find((f) => f.id === id)
}

/** 簡易: 体長 cm → 重量 g（楕円体近似の係数） */
export function estimateWeightG(lengthCm: number, weightFactor: number): number {
  const w = weightFactor * lengthCm ** 3
  return Math.round(w)
}

export function rollLengthCm(species: FishSpecies): number {
  const t = (Math.random() + Math.random() + Math.random()) / 3 // 中央寄り
  const delta = (t - 0.5) * 2 * species.lengthVariance
  return Math.round((species.avgLengthCm + delta) * 10) / 10
}

export function pickRandomSpecies(): FishSpecies {
  const i = Math.floor(Math.random() * FISH_SPECIES.length)
  return FISH_SPECIES[i]!
}
