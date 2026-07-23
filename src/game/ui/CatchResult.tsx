import { getSpecies } from '../fishData'
import { useGameStore } from '../store'

export function CatchResult() {
  const phase = useGameStore((s) => s.phase)
  const lastCatch = useGameStore((s) => s.lastCatch)
  const encyclopedia = useGameStore((s) => s.encyclopedia)
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
          className="fish-preview"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${species?.accentColor ?? '#fff'}44, ${species?.color ?? '#888'}cc)`,
          }}
        >
          <div className="fish-silhouette" style={{ background: species?.color }} />
          <div className="fish-shine" />
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

        <button type="button" className="btn primary" onClick={dismissResult}>
          岸に戻る
        </button>
      </div>
    </div>
  )
}
