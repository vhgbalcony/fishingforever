/** マップ境界・水際の定義（ワールド座標） */

export const MAP = {
  /** 歩行可能エリア（岸） */
  walkMinX: -9.5,
  walkMaxX: 9.5,
  walkMinZ: -10.5,
  /** 水際より手前まで */
  walkMaxZ: -2.35,
  /** 水面の Z 範囲 */
  waterMinZ: -2.1,
  waterMaxZ: 9,
  waterMinX: -12,
  waterMaxX: 12,
  /** キャスト到達距離 */
  castMinDist: 2.2,
  castMaxDist: 6.5,
  playerSpeed: 3.6,
  playerRadius: 0.35,
  /** 水際に近いとキャスト可能 */
  castShoreZ: -2.8,
} as const

export function clampWalk(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.min(MAP.walkMaxX, Math.max(MAP.walkMinX, x)),
    z: Math.min(MAP.walkMaxZ, Math.max(MAP.walkMinZ, z)),
  }
}

export function isNearWater(z: number): boolean {
  return z >= MAP.castShoreZ
}

/** プレイヤー位置・向きからウキの着水点を計算 */
export function computeCastLanding(
  px: number,
  pz: number,
  yaw: number,
  power = 0.7,
): { x: number; z: number; y: number } {
  const dist =
    MAP.castMinDist + (MAP.castMaxDist - MAP.castMinDist) * power
  // 正面は -Z が後ろ、プレイヤーは yaw=0 で +Z（水）向きにする
  let x = px + Math.sin(yaw) * dist
  let z = pz + Math.cos(yaw) * dist
  // 水面上にクランプ
  x = Math.min(MAP.waterMaxX, Math.max(MAP.waterMinX, x))
  z = Math.min(MAP.waterMaxZ, Math.max(MAP.waterMinZ + 0.4, z))
  // 岸側に落ちたら水側へ押し出す
  if (z < MAP.waterMinZ + 0.5) z = MAP.waterMinZ + 1.2
  return { x, z, y: 0.06 }
}
