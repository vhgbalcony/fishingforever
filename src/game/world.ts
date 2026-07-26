/** 縦長マルチパネルマップ座標。原点は左上、Y が大きいほど下流（手前） */

export type StreamZone = 'upper' | 'middle' | 'lower'

export type Point = { x: number; y: number }

/**
 * はじまりキャンプ — 縦3パネル構成
 * - 上流 (y 0–33): 滝・源流
 * - 中流 (y 33–67): キャンプ・橋
 * - 下流 (y 67–100): 砂利浜・開けた河原
 *
 * x,y はマップ全体に対する %（0–100）。
 * 見た目は3枚の正方形パネルを縦に連結。
 */
export const MAP = {
  /** 歩行外枠 */
  walkMinX: 8,
  walkMaxX: 92,
  walkMinY: 4,
  walkMaxY: 96,
  playerSpeed: 16,
  /**
   * ビューに対するマップ拡大率。
   * 横はほぼ画面幅、縦は3パネル分スクロール探索。
   */
  mapScaleX: 1.08,
  mapScaleY: 2.85,
  shoreDistance: 12,
  castMaxDist: 12,
  castMinDist: 2.5,
  /** パネル境界（y%）。ゾーン判定用 */
  panelBounds: {
    upperEnd: 33.4,
    middleEnd: 66.7,
  },
  water: {
    /** 上→下へ流れる川心。中心付近を緩やかに蛇行 */
    spine: [
      { x: 48, y: 5 },
      { x: 50, y: 12 },
      { x: 46, y: 22 },
      { x: 52, y: 30 },
      { x: 49, y: 38 },
      { x: 54, y: 46 },
      { x: 48, y: 54 },
      { x: 52, y: 62 },
      { x: 47, y: 70 },
      { x: 53, y: 78 },
      { x: 50, y: 86 },
      { x: 48, y: 94 },
    ] as Point[],
    /** 川幅（これ以内は水域＝歩行不可。橋は例外） */
    halfWidth: 5.5,
  },
  /**
   * 橋の歩行帯（中流パネル）。中心 + 半径
   */
  bridges: [
    { x: 50, y: 44, radius: 6 },
    { x: 50, y: 58, radius: 6 },
  ] as { x: number; y: number; radius: number }[],
  /** 中流キャンプ岸辺（左岸・水際） */
  spawn: { x: 42, y: 52 } as Point,
} as const

/** 互換: 旧 mapScale 参照用（縦スケールを返す） */
export const MAP_SCALE_COMPAT = MAP.mapScaleY

export const ZONE_LABEL: Record<StreamZone, string> = {
  upper: '上流',
  middle: '中流',
  lower: '下流',
}

/** マップ% 上のユークリッド距離（歩行・水域判定用） */
function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * 画面上の見た目に近い距離（縦長スケール込み）。
 * キャスト距離の体感を横移動と揃える。
 */
function distScreen(a: Point, b: Point): number {
  const yScale = MAP.mapScaleY / MAP.mapScaleX
  return Math.hypot(a.x - b.x, (a.y - b.y) * yScale)
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
  if (isInWater(target) || nearestOnRiver(target).distance <= MAP.water.halfWidth) {
    const n = nearestOnRiver(target)
    const dx = target.x - n.point.x
    const dy = target.y - n.point.y
    const len = Math.hypot(dx, dy) || 1
    const push = MAP.water.halfWidth + 1.0
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
    distance <= MAP.shoreDistance && distance >= MAP.water.halfWidth * 0.3
  )
}

/** パネル位置＋川沿い位置でゾーン判定（上流/中流/下流） */
export function getStreamZone(p: Point): StreamZone {
  if (p.y < MAP.panelBounds.upperEnd) return 'upper'
  if (p.y < MAP.panelBounds.middleEnd) return 'middle'
  return 'lower'
}

export function canCastTo(from: Point, target: Point): boolean {
  const river = nearestOnRiver(target)
  if (river.distance > MAP.water.halfWidth) return false
  if (isOnBridge(target)) return false
  if (!isNearWater(from)) return false
  const d = distScreen(from, target)
  return d >= MAP.castMinDist && d <= MAP.castMaxDist
}

export function clampCastTarget(from: Point, target: Point): Point {
  let { x, y } = target
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
  const d = distScreen(from, { x, y })
  if (d > MAP.castMaxDist && d > 0.01) {
    const yScale = MAP.mapScaleY / MAP.mapScaleX
    const dx = x - from.x
    const dy = (y - from.y) * yScale
    const len = Math.hypot(dx, dy) || 1
    const s = MAP.castMaxDist / len
    x = from.x + dx * s
    y = from.y + (dy * s) / yScale
  } else if (d < MAP.castMinDist && d > 0.01) {
    const yScale = MAP.mapScaleY / MAP.mapScaleX
    const dx = x - from.x
    const dy = (y - from.y) * yScale
    const len = Math.hypot(dx, dy) || 1
    const s = MAP.castMinDist / len
    x = from.x + dx * s
    y = from.y + (dy * s) / yScale
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
  const reach = MAP.castMinDist + (MAP.castMaxDist - MAP.castMinDist) * 0.55
  const yScale = MAP.mapScaleY / MAP.mapScaleX
  const dirLen = Math.hypot(dx, dy * yScale) || 1
  return clampCastTarget(from, {
    x: from.x + (dx / dirLen) * reach,
    y: from.y + ((dy * yScale) / dirLen) * (reach / yScale),
  })
}

/**
 * カメラ位置をクランプして、拡大マップの端で画面外（見切れ・余白）が出ないようにする。
 */
export function clampCamera(
  x: number,
  y: number,
  scaleX: number = MAP.mapScaleX,
  scaleY: number = MAP.mapScaleY,
): Point {
  const marginX = 50 / scaleX
  const marginY = 50 / scaleY
  return {
    x: Math.min(100 - marginX, Math.max(marginX, x)),
    y: Math.min(100 - marginY, Math.max(marginY, y)),
  }
}
