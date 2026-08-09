import { fishArt } from '../artAssets'
import { fishDisplayScale, getSpecies, LIFE_STAGE_LABEL } from '../fishData'
import { useGameStore } from '../store'

export function CatchResult() {
  const phase = useGameStore((s) => s.phase)
  const lastCatch = useGameStore((s) => s.lastCatch)
  const encyclopedia = useGameStore((s) => s.encyclopedia)
  const artStyle = useGameStore((s) => s.artStyle)
  const keepCatch = useGameStore((s) => s.keepCatch)
  const releaseCatch = useGameStore((s) => s.releaseCatch)

  if (phase !== 'catch_result' || !lastCatch) return null

  const species = getSpecies(lastCatch.speciesId)
  const entry = encyclopedia[lastCatch.speciesId]
  const wouldBeFirst = !entry || entry.timesCaught === 0
  const wouldBeRecord =
    entry && lastCatch.lengthCm > (entry.maxLengthCm ?? 0)
  // 博物画アセットは余白が大きいので、イラスト時は表示を底上げ
  const artPad = artStyle === 'illustration' ? 1.75 : 1
  const scale = species
    ? Math.min(2.35, fishDisplayScale(species, lastCatch.lengthCm) * artPad)
    : artPad
  const stage = lastCatch.lifeStage
  const stageClass =
    stage === 'juvenile' ? 'stage-juvenile' : stage === 'trophy' ? 'stage-trophy' : 'stage-adult'

  return (
    <div className="overlay result-screen">
      <div className="result-card">
        <p className="result-kicker">GET!</p>
        <h2>{lastCatch.name}</h2>
        <p className={`life-stage-badge ${stageClass}`}>
          {LIFE_STAGE_LABEL[stage]}
        </p>

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
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
            }}
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

        {wouldBeFirst && (
          <p className="badge">キープすると図鑑 初登録！</p>
        )}
        {wouldBeRecord && !wouldBeFirst && (
          <p className="badge">キープで自己最長更新！</p>
        )}
        {stage === 'juvenile' && (
          <p className="release-hint">
            幼魚だよ。資源のためリリースがおすすめ
          </p>
        )}
        {stage === 'trophy' && (
          <p className="release-hint trophy">大物！ 図鑑に残す？</p>
        )}

        <div className="result-actions">
          <button type="button" className="btn primary" onClick={keepCatch}>
            キープする
          </button>
          <button type="button" className="btn ghost" onClick={releaseCatch}>
            リリースする
          </button>
        </div>
      </div>
    </div>
  )
}
