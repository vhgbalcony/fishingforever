import { fishArt } from '../artAssets'
import { getSpecies } from '../fishData'
import { useGameStore } from '../store'

export function CatchResult() {
  const phase = useGameStore((s) => s.phase)
  const lastCatch = useGameStore((s) => s.lastCatch)
  const encyclopedia = useGameStore((s) => s.encyclopedia)
  const artStyle = useGameStore((s) => s.artStyle)
  const dismissResult = useGameStore((s) => s.dismissResult)

  if (phase !== 'catch_result' || !lastCatch) return null

  const species = getSpecies(lastCatch.speciesId)
  const entry = encyclopedia[lastCatch.speciesId]
  const isNewRecord =
    entry && entry.timesCaught > 0 && entry.maxLengthCm === lastCatch.lengthCm
  const isFirst = entry?.timesCaught === 1

  return (
    <div className="overlay result-screen">
      <div className="result-card">
        <p className="result-kicker">GET!</p>
        <h2>{lastCatch.name}</h2>

        <div
          className={`fish-preview illustrated${artStyle === 'pixel' ? ' pixel' : ''}`}
          style={{
            background: `radial-gradient(circle at 30% 30%, ${species?.accentColor ?? '#fff'}33, ${species?.color ?? '#888'}55)`,
          }}
        >
          <img
            className="fish-art"
            src={fishArt(lastCatch.speciesId, artStyle)}
            alt={lastCatch.name}
            draggable={false}
          />
        </div>

        <div className="stats">
          <div>
            <span className="stat-label">体長</span>
            <span className="stat-value">{lastCatch.lengthCm.toFixed(1)} cm</span>
          </div>
          <div>
            <span className="stat-label">重量</span>
            <span className="stat-value">
              {lastCatch.weightG >= 1000
                ? `${(lastCatch.weightG / 1000).toFixed(2)} kg`
                : `${lastCatch.weightG} g`}
            </span>
          </div>
        </div>

        {isFirst && <p className="badge">図鑑 初登録！</p>}
        {isNewRecord && !isFirst && <p className="badge">自己最長！</p>}
        <p className="hint" style={{ marginBottom: '0.75rem' }}>
          正体がわかった！
        </p>

        <button type="button" className="btn primary" onClick={dismissResult}>
          岸に戻る
        </button>
      </div>
    </div>
  )
}
