/** ウキ釣り MVP のゲーム状態 */
export type GamePhase =
  | 'title'
  | 'idle'
  | 'casting'
  | 'waiting_float'
  | 'float_sinking'
  | 'underwater_fight'
  | 'catch_result'

export type TimeOfDay = 'morning' | 'day' | 'evening'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

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
  /** ファイト時間の目安（秒） */
  fightSec: number
  color: string
  accentColor: string
}

export interface CaughtFish {
  speciesId: string
  name: string
  lengthCm: number
  weightG: number
  caughtAt: number
}

export interface EncyclopediaEntry {
  speciesId: string
  timesCaught: number
  maxLengthCm: number
  firstCaughtAt: number | null
}
