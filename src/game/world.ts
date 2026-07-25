/** アイソメ風マップ座標（画面%）。原点は左上、Y が大きいほど手前（下） */

export type StreamZone = 'upper' | 'middle' | 'lower'

export type Point = { x: number; y: number }

/**
 * bg-iso-camp 想定レイアウト:
 * - 上流: 左上の滝・狭い谷
 * - 中流: 中央の橋まわり
 * - 下流: 右下の広い砂利浜
 * - 歩行: テント周りの草原〜川沿いの砂利
 */
export const MAP = {
  walkMinX: 18,
  walkMaxX: 72,
  walkMinY: 38,
  walkMaxY: 86,
  playerSpeed: 24,
  /** 川からの距離がこの以内なら「水際」 */
  shoreDistance: 16,
  castMaxDist: 28,
  castMinDist: 5,
  water: {
    /** 上流→下流の中心線 */
    spine: [
      { x: 22, y: 20 },
      { x: 30, y: 28 },
      { x: 38, y: 36 },
      { x: 48, y: 44 },
      { x: 58, y: 54 },
      { x: 70, y: 66 },
      { x: 82, y: 78 },
    ] as Point[],
    halfWidth: 10,
  },
  /** スポーン（テント前） */
  spawn: { x: 40, y: 62 } as Point,
} as const

export const ZONE_LABEL: Record<StreamZone, string> = {
  upper: '上流',
  middle: '中流',
  lower: '下流',
}

export function clampWalk(x: number, y: number): Point {
  return {
    x: Math.min(MAP.walkMaxX, Math.max(MAP.walkMinX, x)),
    y: Math.min(MAP.walkMaxY, Math.max(MAP.walkMinY, y)),
  }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function nearestOnRiver(p: Point): {
  point: Point
  distance: number
  t: number
} {
  const spine = MAP.water.spine
  let best = { point: spine[0]!, distance: Infinity, t: 0 }
  let total = 0
  for (let i = 0; i < spine.length - 1; i++) {
    total += dist(spine[i]!, spine[i + 1]!)
  }
  let walked = 0
  for (let i = 0; i < spine.length - 1; i++) {
    const a = spine[i]!
    const b = spine[i + 1]!
    const segLen = dist(a, b) || 1
    const dx = b.x - a.x
    const dy = b.y - a.y
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (segLen * segLen)),
    )
    const proj = { x: a.x + dx * t, y: a.y + dy * t }
    const d = dist(p, proj)
    if (d < best.distance) {
      const along = total > 0 ? (walked + t * segLen) / total : 0
      best = { point: proj, distance: d, t: along }
    }
    walked += segLen
  }
  return best
}

export function isInWater(p: Point): boolean {
  return nearestOnRiver(p).distance <= MAP.water.halfWidth
}

/** 水際（歩行帯のうち川に近い） */
export function isNearWater(p: Point): boolean {
  const { distance } = nearestOnRiver(p)
  return (
    distance <= MAP.shoreDistance && distance >= MAP.water.halfWidth * 0.25
  )
}

export function getStreamZone(p: Point): StreamZone {
  const { t } = nearestOnRiver(p)
  if (t < 0.34) return 'upper'
  if (t < 0.67) return 'middle'
  return 'lower'
}

export function canCastTo(from: Point, target: Point): boolean {
  if (!isInWater(target)) return false
  if (!isNearWater(from)) return false
  const d = dist(from, target)
  return d >= MAP.castMinDist && d <= MAP.castMaxDist
}

export function clampCastTarget(from: Point, target: Point): Point {
  let { x, y } = target
  const near = nearestOnRiver({ x, y })
  if (near.distance > MAP.water.halfWidth) {
    const pull = MAP.water.halfWidth / (near.distance || 1)
    x = near.point.x + (x - near.point.x) * pull * 0.9
    y = near.point.y + (y - near.point.y) * pull * 0.9
  }
  const d = dist(from, { x, y })
  if (d > MAP.castMaxDist && d > 0.01) {
    const s = MAP.castMaxDist / d
    x = from.x + (x - from.x) * s
    y = from.y + (y - from.y) * s
  } else if (d < MAP.castMinDist && d > 0.01) {
    const s = MAP.castMinDist / d
    x = from.x + (x - from.x) * s
    y = from.y + (y - from.y) * s
  }
  const again = nearestOnRiver({ x, y })
  if (again.distance > MAP.water.halfWidth) {
    return { x: again.point.x, y: again.point.y }
  }
  return { x, y }
}

export function defaultAim(from: Point): Point {
  const toward = nearestOnRiver(from).point
  const dx = toward.x - from.x
  const dy = toward.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const reach = MAP.castMinDist + (MAP.castMaxDist - MAP.castMinDist) * 0.55
  return clampCastTarget(from, {
    x: from.x + (dx / len) * reach,
    y: from.y + (dy / len) * reach,
  })
}
