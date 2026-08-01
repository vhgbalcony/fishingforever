import { ART_STYLE_LABEL, type ArtStyle } from '../artAssets'
import { FISH_SPECIES } from '../fishData'
import { useGameStore } from '../store'
import type { Season, TimeOfDay } from '../types'
import { ZONE_LABEL } from '../world'

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

function ArtStylePicker({ compact = false }: { compact?: boolean }) {
  const artStyle = useGameStore((s) => s.artStyle)
  const setArtStyle = useGameStore((s) => s.setArtStyle)
  const styles: ArtStyle[] = ['illustration', 'pixel']

  return (
    <div
      className={`art-style-picker${compact ? ' compact' : ''}`}
      role="group"
      aria-label="画風"
    >
      {!compact && <span className="art-style-label">画風</span>}
      <div className="art-style-btns">
        {styles.map((s) => (
          <button
            key={s}
            type="button"
            className={`btn art-style-btn${artStyle === s ? ' active' : ''}`}
            onClick={() => setArtStyle(s)}
            aria-pressed={artStyle === s}
          >
            {ART_STYLE_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  )
}

export function HUD() {
  const phase = useGameStore((s) => s.phase)
  const message = useGameStore((s) => s.message)
  const locationName = useGameStore((s) => s.locationName)
  const season = useGameStore((s) => s.season)
  const timeOfDay = useGameStore((s) => s.timeOfDay)
  const biteProgress = useGameStore((s) => s.biteProgress)
  const fightProgress = useGameStore((s) => s.fightProgress)
  const fightMode = useGameStore((s) => s.fightMode)
  const fightModeTimer = useGameStore((s) => s.fightModeTimer)
  const fightModeDuration = useGameStore((s) => s.fightModeDuration)
  const encyclopedia = useGameStore((s) => s.encyclopedia)
  const nearWater = useGameStore((s) => s.nearWater)
  const aimZone = useGameStore((s) => s.aimZone)
  const castZone = useGameStore((s) => s.castZone)
  const artStyle = useGameStore((s) => s.artStyle)
  const cast = useGameStore((s) => s.cast)
  const tryHook = useGameStore((s) => s.tryHook)
  const pullLine = useGameStore((s) => s.pullLine)
  const cycleTimeOfDay = useGameStore((s) => s.cycleTimeOfDay)
  const startGame = useGameStore((s) => s.startGame)

  if (phase === 'title') {
    return (
      <div className="overlay title-screen">
        <div className="title-card">
          <p className="title-kicker">清流の釣り体験</p>
          <h1>Fishingforever</h1>
          <p className="title-sub">
            はじまりキャンプ — 広いマップを探索し、橋を渡って好きな岸からキャスト
          </p>
          <ArtStylePicker />
          <p className="style-preview-hint">
            いまの画風: <strong>{ART_STYLE_LABEL[artStyle]}</strong>
            （本編はイラスト推奨）
          </p>
          <button type="button" className="btn primary" onClick={startGame}>
            釣りをはじめる
          </button>
          <p className="hint">
            WASD 移動（川は橋のみ横断）／ 岸で川クリック or スペースでキャスト
          </p>
        </div>
      </div>
    )
  }

  const caughtCount = Object.values(encyclopedia).reduce(
    (n, e) => n + e.timesCaught,
    0,
  )
  const speciesFound = Object.keys(encyclopedia).length
  const zoneShown =
    castZone &&
    (phase === 'casting' ||
      phase === 'waiting_float' ||
      phase === 'float_sinking' ||
      phase === 'underwater_fight')
      ? castZone
      : aimZone

  return (
    <div className="overlay hud">
      <header className="top-bar">
        <div>
          <strong>{locationName}</strong>
          <span className="meta">
            {SEASON_LABEL[season]}・{TIME_LABEL[timeOfDay]}
            {nearWater ? ' ・水際' : ' ・岸'}
            {' · '}
            {ZONE_LABEL[zoneShown]}
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
        <div
          className={`fight-meter${
            fightMode === 'resting'
              ? ' can-pull'
              : fightProgress < 0.15
                ? ' is-running critical'
                : ' is-running'
          }`}
        >
          <div className="bite-label">
            {fightMode === 'running'
              ? '暴れている… 休むまで待て'
              : '休んだ！ 今だ、引け！'}
          </div>
          <div className="meter-track" title="寄せ具合">
            <div
              className={`meter-fill fight${
                fightProgress < 0.15
                  ? ' low'
                  : fightProgress < 0.28
                    ? ' mid'
                    : ''
              }`}
              style={{ width: `${Math.max(0, Math.min(1, fightProgress)) * 100}%` }}
            />
          </div>
          <p className="fight-pct" aria-live="polite">
            寄せ {Math.round(Math.max(0, fightProgress) * 100)}
            {fightProgress < 0.15 ? ' ⚠ 危険' : ''}
          </p>
          <div className="meter-track mode-track" title="いまの動き">
            <div
              className={`meter-fill mode ${fightMode}`}
              style={{
                width: `${
                  fightModeDuration > 0
                    ? Math.min(100, (fightModeTimer / fightModeDuration) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="fight-hint">
            {fightMode === 'running'
              ? '上：寄せ（0未満で逃げ）　暴れ中に引くと減る'
              : '上：寄せ具合　下：休み残り（Space / 引く）'}
          </p>
          <button
            type="button"
            className={`btn ${fightMode === 'resting' ? 'danger' : 'warn'}`}
            onClick={pullLine}
          >
            {fightMode === 'resting' ? '引く！' : '無理に引く（危険）'}
          </button>
        </div>
      )}

      <footer className="bottom-bar">
        {(phase === 'idle' || phase === 'waiting_float') && (
          <>
            <span className="hint">WASD 移動 · 川クリック</span>
            <button
              type="button"
              className="btn primary"
              onClick={cast}
              disabled={phase !== 'idle' || !nearWater}
              title={!nearWater ? '水際に近づいてください' : '狙いへキャスト'}
            >
              {phase === 'idle'
                ? nearWater
                  ? `キャスト（${ZONE_LABEL[aimZone]}）`
                  : '水際へ…'
                : 'ウキ待ち…'}
            </button>
          </>
        )}
        {phase === 'casting' && <span className="hint">キャスト中…</span>}
        <ArtStylePicker compact />
        <button type="button" className="btn ghost" onClick={cycleTimeOfDay}>
          時間帯切替
        </button>
      </footer>
    </div>
  )
}
