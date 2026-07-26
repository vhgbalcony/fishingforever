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

/**
 * 体長抽選。
 * 以前は平均付近に寄る分布だけで、幼魚閾値未満がほぼ出なかったため
 * 約 28% は幼魚帯から明示的に出す。
 */
export function rollLengthCm(species: FishSpecies): number {
  // 幼魚帯（juvenileMaxCm 未満）
  if (Math.random() < 0.28) {
    const max = species.juvenileMaxCm * 0.97
    const min = Math.max(
      species.juvenileMaxCm * 0.42,
      species.avgLengthCm * 0.22,
      3,
    )
    const lo = Math.min(min, max * 0.85)
    const hi = Math.max(lo + 0.5, max)
    return Math.round((lo + Math.random() * (hi - lo)) * 10) / 10
  }

  // 成魚〜大物寄りの三角分布
  const t = (Math.random() + Math.random() + Math.random()) / 3
  const delta = (t - 0.5) * 2 * species.lengthVariance
  // 幼魚帯をまたがないよう下限を少し上げる
  const floor = species.juvenileMaxCm
  const raw = Math.max(floor, species.avgLengthCm + delta)
  const big = Math.random() < 0.08 ? 1.12 + Math.random() * 0.18 : 1
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

/**
 * 表示スケールは「種の平均比」ではなく「体長 cm の絶対値」基準。
 * 17cm ヤマメと 18cm オイカワが同程度の大きさに見えるようにする。
 * 基準: 20cm = 1.0
 */
export function fishDisplayScale(
  _species: FishSpecies,
  lengthCm: number,
): number {
  const REFERENCE_CM = 20
  const ratio = lengthCm / REFERENCE_CM
  return Math.min(1.55, Math.max(0.32, ratio))
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
