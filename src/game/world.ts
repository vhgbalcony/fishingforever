/** 2.5D 画面座標（%）。X=左右、Y=奥行き（大きいほど川寄り・画面上寄り） */

export const MAP = {
  walkMinX: 12,
  walkMaxX: 58,
  /** 岸の奥側（キャンプ寄り・画面下） */
  walkMinY: 8,
  /** 水際近くまで */
  walkMaxY: 42,
  /** これ以上 Y が大きいとキャスト可能 */
  castShoreY: 28,
  playerSpeed: 28, // % / 秒
  castMinDist: 12,
  castMaxDist: 28,
  /** ウキが落ちる水域（画面%） */
  waterMinX: 38,
  waterMaxX: 88,
  waterMinY: 38,
  waterMaxY: 62,
} as const

export function clampWalk(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(MAP.walkMaxX, Math.max(MAP.walkMinX, x)),
    y: Math.min(MAP.walkMaxY, Math.max(MAP.walkMinY, y)),
  }
}

export function isNearWater(y: number): boolean {
  return y >= MAP.castShoreY
}

/** プレイヤー位置からウキ着水点（画面%）を計算 */
export function computeCastLanding(
  px: number,
  py: number,
  facingRight: boolean,
  power = 0.7,
): { x: number; y: number } {
  const dist =
    MAP.castMinDist + (MAP.castMaxDist - MAP.castMinDist) * power
  const dir = facingRight ? 1 : 0.35
  let x = px + dist * dir + 8
  let y = py + dist * 0.55 + 10
  x = Math.min(MAP.waterMaxX, Math.max(MAP.waterMinX, x))
  y = Math.min(MAP.waterMaxY, Math.max(MAP.waterMinY, y))
  return { x, y }
}
