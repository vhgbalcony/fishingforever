import type { StreamZone } from './world'
import type { FishSpecies, LifeStage } from './types'

/** はじまりキャンプ — 第1弾の清流魚 */
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
    /** これ未満は幼魚扱い */
    juvenileMaxCm: 14,
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
    juvenileMaxCm: 13,
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
    juvenileMaxCm: 16,
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
    juvenileMaxCm: 7,
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
    juvenileMaxCm: 11,
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
    juvenileMaxCm: 6,
  },
]

export const ZONE_WEIGHTS: Record<StreamZone, Record<string, number>> = {
  upper: {
    yamame: 34,
    amago: 28,
    nijimasu: 12,
    oikawa: 6,
    ugui: 8,
    kajika: 12,
  },
  middle: {
    yamame: 18,
    amago: 16,
    nijimasu: 22,
    oikawa: 16,
    ugui: 16,
    kajika: 12,
  },
  lower: {
    yamame: 8,
    amago: 6,
    nijimasu: 14,
    oikawa: 28,
    ugui: 30,
    kajika: 14,
  },
}

export const LIFE_STAGE_LABEL: Record<LifeStage, string> = {
  juvenile: '幼魚',
  adult: '成魚',
  trophy: '大物',
}

export function getSpecies(id: string): FishSpecies | undefined {
  return FISH_SPECIES.find((f) => f.id === id)
}

export function estimateWeightG(lengthCm: number, weightFactor: number): number {
  const w = weightFactor * lengthCm ** 3
  return Math.round(w)
}

export function rollLengthCm(species: FishSpecies): number {
  const t = (Math.random() + Math.random() + Math.random()) / 3
  const delta = (t - 0.5) * 2 * species.lengthVariance
  const raw = species.avgLengthCm + delta
  // たまに一回り大きい個体
  const big = Math.random() < 0.08 ? 1.15 + Math.random() * 0.2 : 1
  return Math.round(raw * big * 10) / 10
}

export function getLifeStage(
  species: FishSpecies,
  lengthCm: number,
): LifeStage {
  if (lengthCm < species.juvenileMaxCm) return 'juvenile'
  if (lengthCm >= species.avgLengthCm * 1.25) return 'trophy'
  return 'adult'
}

/** 平均に対する表示スケール（水中・釣果） */
export function fishDisplayScale(
  species: FishSpecies,
  lengthCm: number,
): number {
  const ratio = lengthCm / species.avgLengthCm
  return Math.min(1.45, Math.max(0.42, ratio))
}

export function pickRandomSpecies(zone: StreamZone = 'middle'): FishSpecies {
  const weights = ZONE_WEIGHTS[zone]
  let total = 0
  for (const s of FISH_SPECIES) {
    total += weights[s.id] ?? 1
  }
  let r = Math.random() * total
  for (const s of FISH_SPECIES) {
    r -= weights[s.id] ?? 1
    if (r <= 0) return s
  }
  return FISH_SPECIES[0]!
}
