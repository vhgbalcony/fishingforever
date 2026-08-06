/** ウキ釣り MVP のゲーム状態 */
export type GamePhase =
  | 'title'
  | 'idle'
  | 'casting'
  | 'waiting_float'
  | 'float_sinking'
  | 'underwater_fight'
  | 'catch_result'

/** 水中ファイト最小：逃げる ↔ 休む（休むときだけ引ける） */
export type FightMode = 'running' | 'resting'

export type TimeOfDay = 'morning' | 'day' | 'evening'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type LifeStage = 'juvenile' | 'adult' | 'trophy'

export interface FishSpecies {
  id: string
  name: string
  /** 平均体長 cm */
  avgLengthCm: number
  /** 体長のばらつき */
  lengthVariance: number
  /** 重量推定用係数（簡易） */
  weightFactor: number
  /** ウキ沈み〜アワセの猶予（秒） */
  hookWindowSec: number
  /** ファイト時間の目安（秒）— 寄せに要する体感の長さ */
  fightSec: number
  /**
   * 引きの強さ（種の難易度の芯）。
   * 低いほど休み長め・ミスに甘い / 高いほど休み短・無理押し即死寄り。
   * 体長トロフィーとは別軸。
   */
  pullPower: number
  color: string
  accentColor: string
  /** これ未満は幼魚 */
  juvenileMaxCm: number
}

export interface CaughtFish {
  speciesId: string
  name: string
  lengthCm: number
  weightG: number
  lifeStage: LifeStage
  caughtAt: number
  /** リリースしたか（記録用） */
  released?: boolean
}

export interface EncyclopediaEntry {
  speciesId: string
  timesCaught: number
  maxLengthCm: number
  firstCaughtAt: number | null
}
