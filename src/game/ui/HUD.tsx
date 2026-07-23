import { FISH_SPECIES } from '../fishData'
import { useGameStore } from '../store'
import type { Season, TimeOfDay } from '../types'

const TIME_LABEL: Record<TimeOfDay, string> = {
  morning: '朝',
  day: '昼',
  evening: '夕',
}

const SEASON_LABEL: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
}

export function HUD() {
  const phase = useGameStore((s) => s.phase)
  const message = useGameStore((s) => s.message)
  const locationName = useGameStore((s) => s.locationName)
  const season = useGameStore((s) => s.season)
  const timeOfDay = useGameStore((s) => s.timeOfDay)
  const biteProgress = useGameStore((s) => s.biteProgress)
  const fightProgress = useGameStore((s) => s.fightProgress)
  const encyclopedia = useGameStore((s) => s.encyclopedia)
  const cast = useGameStore((s) => s.cast)
  const tryHook = useGameStore((s) => s.tryHook)
  const cycleTimeOfDay = useGameStore((s) => s.cycleTimeOfDay)
  const startGame = useGameStore((s) => s.startGame)

  if (phase === 'title') {
    return (
      <div className="overlay title-screen">
        <div className="title-card">
          <p className="title-kicker">清流の釣り体験</p>
          <h1>Fishingforever</h1>
          <p className="title-sub">はじまりキャンプ — ウキ釣りプロトタイプ</p>
          <button type="button" className="btn primary" onClick={startGame}>
            釣りをはじめる
          </button>
          <p className="hint">操作: クリック / スペース</p>
        </div>
      </div>
    )
  }

  const caughtCount = Object.values(encyclopedia).reduce(
    (n, e) => n + e.timesCaught,
    0,
  )
  const speciesFound = Object.keys(encyclopedia).length

  return (
    <div className="overlay hud">
      <header className="top-bar">
        <div>
          <strong>{locationName}</strong>
          <span className="meta">
            {SEASON_LABEL[season]}・{TIME_LABEL[timeOfDay]}
          </span>
        </div>
        <div className="meta">
          図鑑 {speciesFound}/{FISH_SPECIES.length}　釣果 {caughtCount}
        </div>
      </header>

      <div className="message-bar">{message}</div>

      {phase === 'float_sinking' && (
        <div className="bite-meter">
          <div className="bite-label">アワセのタイミング</div>
          <div className="meter-track">
            <div
              className="meter-fill bite"
              style={{ width: `${biteProgress * 100}%` }}
            />
          </div>
          <button type="button" className="btn danger" onClick={tryHook}>
            アワセる！
          </button>
        </div>
      )}

      {phase === 'underwater_fight' && (
        <div className="fight-meter">
          <div className="bite-label">ファイト中 — 鑑賞しよう</div>
          <div className="meter-track">
            <div
              className="meter-fill fight"
              style={{ width: `${fightProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      <footer className="bottom-bar">
        {(phase === 'idle' || phase === 'waiting_float') && (
          <button
            type="button"
            className="btn primary"
            onClick={cast}
            disabled={phase !== 'idle'}
          >
            {phase === 'idle' ? 'キャスト' : 'ウキ待ち…'}
          </button>
        )}
        {phase === 'casting' && (
          <span className="hint">キャスト中…</span>
        )}
        <button type="button" className="btn ghost" onClick={cycleTimeOfDay}>
          時間帯切替（仮）
        </button>
      </footer>
    </div>
  )
}
