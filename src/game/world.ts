/** アイソメ風マップ座標（画面% = マップ全体の %）。原点は左上、Y が大きいほど手前 */

export type StreamZone = 'upper' | 'middle' | 'lower'

export type Point = { x: number; y: number }

/**
 * bg-iso-camp（広いマップ）想定:
 * - 上流: 左上の滝
 * - 中流: アーチ橋2本で対岸へ
 * - 下流: 右下の砂利浜
 * - 歩行: 両岸の草原＋橋。川本体は歩けない
 */
export const MAP = {
  /** マップ全体の歩行外枠（森の端まで探索） */
  walkMinX: 6,
  walkMaxX: 94,
  walkMinY: 10,
  walkMaxY: 92,
  playerSpeed: 22,
  /** ビューに対するマップ拡大率（大きいほどスクロール探索感） */
  mapScale: 1.65,
  shoreDistance: 14,
  castMaxDist: 26,
  castMinDist: 5,
  water: {
    spine: [
      { x: 16, y: 16 },
      { x: 24, y: 24 },
      { x: 34, y: 34 },
      { x: 44, y: 42 },
      { x: 54, y: 52 },
      { x: 64, y: 60 },
      { x: 74, y: 70 },
      { x: 86, y: 82 },
    ] as Point[],
    /** 川幅（これ以内は水域＝歩行不可。橋は例外） */
    halfWidth: 7.2,
  },
  /**
   * 橋の歩行帯（川をまたぐ廊下）。
   * 中心 + 半径でカプセル近似
   */
  bridges: [
    { x: 40, y: 37, radius: 7.5 }, // 上流寄りアーチ橋
    { x: 62, y: 56, radius: 7.5 }, // 下流寄りアーチ橋
  ] as { x: number; y: number; radius: number }[],
  spawn: { x: 28, y: 68 } as Point,
} as const

export const ZONE_LABEL: Record<StreamZone, string> = {
  upper: '上流',
  middle: '中流',
  lower: '下流',
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

export function isOnBridge(p: Point): boolean {
  for (const b of MAP.bridges) {
    if (dist(p, { x: b.x, y: b.y }) <= b.radius) return true
  }
  return false
}

export function isInWater(p: Point): boolean {
  if (isOnBridge(p)) return false
  return nearestOnRiver(p).distance <= MAP.water.halfWidth
}

/** 歩行可能か（外枠内・川でない or 橋） */
export function isWalkable(p: Point): boolean {
  if (
    p.x < MAP.walkMinX ||
    p.x > MAP.walkMaxX ||
    p.y < MAP.walkMinY ||
    p.y > MAP.walkMaxY
  ) {
    return false
  }
  if (isOnBridge(p)) return true
  if (nearestOnRiver(p).distance <= MAP.water.halfWidth) return false
  return true
}

/**
 * 移動先を歩行ルールでクランプ。
 * 川には入れない（橋以外）。軸スライドで壁すり抜け感を軽減。
 */
export function clampWalk(x: number, y: number, from?: Point): Point {
  const target = {
    x: Math.min(MAP.walkMaxX, Math.max(MAP.walkMinX, x)),
    y: Math.min(MAP.walkMaxY, Math.max(MAP.walkMinY, y)),
  }
  if (isWalkable(target)) return target
  if (from) {
    const onlyX = { x: target.x, y: from.y }
    if (isWalkable(onlyX)) return onlyX
    const onlyY = { x: from.x, y: target.y }
    if (isWalkable(onlyY)) return onlyY
    return from
  }
  // from なし: 水から押し出す
  if (isInWater(target) || nearestOnRiver(target).distance <= MAP.water.halfWidth) {
    const n = nearestOnRiver(target)
    const dx = target.x - n.point.x
    const dy = target.y - n.point.y
    const len = Math.hypot(dx, dy) || 1
    const push = MAP.water.halfWidth + 1.2
    const out = {
      x: n.point.x + (dx / len) * push,
      y: n.point.y + (dy / len) * push,
    }
    if (isWalkable(out)) return out
  }
  return target
}

/** 水際（岸からキャスト可能）。橋の上からも可 */
export function isNearWater(p: Point): boolean {
  if (isOnBridge(p)) return true
  const { distance } = nearestOnRiver(p)
  return (
    distance <= MAP.shoreDistance && distance >= MAP.water.halfWidth * 0.35
  )
}

export function getStreamZone(p: Point): StreamZone {
  const { t } = nearestOnRiver(p)
  if (t < 0.34) return 'upper'
  if (t < 0.67) return 'middle'
  return 'lower'
}

export function canCastTo(from: Point, target: Point): boolean {
  // 着水は「水」のみ（橋の上は着水不可）
  const river = nearestOnRiver(target)
  if (river.distance > MAP.water.halfWidth) return false
  if (isOnBridge(target)) return false
  if (!isNearWater(from)) return false
  const d = dist(from, target)
  return d >= MAP.castMinDist && d <= MAP.castMaxDist
}

export function clampCastTarget(from: Point, target: Point): Point {
  let { x, y } = target
  // 橋の上なら川心へ押し出す
  if (isOnBridge({ x, y })) {
    const n = nearestOnRiver({ x, y })
    x = n.point.x
    y = n.point.y
  }
  const near = nearestOnRiver({ x, y })
  if (near.distance > MAP.water.halfWidth) {
    const pull = MAP.water.halfWidth / (near.distance || 1)
    x = near.point.x + (x - near.point.x) * pull * 0.85
    y = near.point.y + (y - near.point.y) * pull * 0.85
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
