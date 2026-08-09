import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { fishArt, getArt, PANEL_ORDER } from '../artAssets'
import { playerPose } from '../playerPose'
import { useGameStore } from '../store'
import { clampCamera, clampWalk, MAP, ZONE_LABEL } from '../world'

function ShoreHint() {
  const nearWater = useGameStore((s) => s.nearWater)
  const phase = useGameStore((s) => s.phase)
  const aimZone = useGameStore((s) => s.aimZone)
  if (phase === 'title') return null
  return (
    <div className="shore-hint" aria-hidden>
      {nearWater
        ? `◎ 水際 · 狙い ${ZONE_LABEL[aimZone]}`
        : '川沿いへ近づく · WASDで上下に探索'}
    </div>
  )
}

const KEYS = new Set<string>()

function isMoveKey(code: string) {
  return (
    code === 'KeyW' ||
    code === 'KeyA' ||
    code === 'KeyS' ||
    code === 'KeyD' ||
    code === 'ArrowUp' ||
    code === 'ArrowDown' ||
    code === 'ArrowLeft' ||
    code === 'ArrowRight'
  )
}

/** アイソメ風 2.5D・縦3パネル（上流→中流→下流） */
export function Scene2D() {
  const rootRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const playerEl = useRef<HTMLImageElement>(null)
  const uwStripRef = useRef<HTMLDivElement>(null)
  const uwScrollRef = useRef(0)
  const camRef = useRef({ x: MAP.spawn.x, y: MAP.spawn.y })

  const phase = useGameStore((s) => s.phase)
  const timeOfDay = useGameStore((s) => s.timeOfDay)
  const castPoint = useGameStore((s) => s.castPoint)
  const activeSpecies = useGameStore((s) => s.activeSpecies)
  const artStyle = useGameStore((s) => s.artStyle)
  const aimX = useGameStore((s) => s.aimX)
  const aimY = useGameStore((s) => s.aimY)
  const nearWater = useGameStore((s) => s.nearWater)
  const pendingFishScale = useGameStore((s) => s.pendingFishScale)
  const fightMode = useGameStore((s) => s.fightMode)
  const pullHeld = useGameStore((s) => s.pullHeld)
  const setPlayerPose = useGameStore((s) => s.setPlayerPose)
  const setAim = useGameStore((s) => s.setAim)
  const castAt = useGameStore((s) => s.castAt)
  const finishCast = useGameStore((s) => s.finishCast)
  const setBiteProgress = useGameStore((s) => s.setBiteProgress)
  const tickFight = useGameStore((s) => s.tickFight)

  const art = getArt(artStyle)
  const isPixel = artStyle === 'pixel'
  const underwater = phase === 'underwater_fight' || phase === 'catch_result'
  const showBobber =
    !underwater &&
    castPoint &&
    (phase === 'casting' ||
      phase === 'waiting_float' ||
      phase === 'float_sinking')
  const showAim =
    !underwater &&
    nearWater &&
    (phase === 'idle' || phase === 'waiting_float')

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isMoveKey(e.code)) {
        e.preventDefault()
        KEYS.add(e.code)
      }
    }
    const up = (e: KeyboardEvent) => {
      KEYS.delete(e.code)
    }
    const blur = () => KEYS.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      KEYS.clear()
    }
  }, [])

  useEffect(() => {
    if (phase !== 'casting') return
    const t = window.setTimeout(() => finishCast(), 700)
    return () => clearTimeout(t)
  }, [phase, finishCast])

  // 水中入場: スクロールリセット
  useEffect(() => {
    if (phase === 'underwater_fight') {
      uwScrollRef.current = 0
    }
  }, [phase])

  /**
   * マップ復帰時のレイアウト修復。
   * 水中ストリップに付けた transform が React の DOM 再利用で
   * map-panels に残ると、釣り後にマップが画面外へ飛ぶ。
   */
  useLayoutEffect(() => {
    if (underwater) return
    const cam = clampCamera(playerPose.x, playerPose.y)
    camRef.current = { x: cam.x, y: cam.y }
    const root = rootRef.current
    const world = worldRef.current
    if (root) {
      root.style.transform = ''
      root.style.setProperty('--px', cam.x.toFixed(2))
      root.style.setProperty('--py', cam.y.toFixed(2))
      root.style.setProperty('--map-scale-x', String(MAP.mapScaleX))
      root.style.setProperty('--map-scale-y', String(MAP.mapScaleY))
    }
    if (world) {
      world.style.transform = ''
    }
  }, [underwater, phase])

  // ポインタ → マップ%（縦長 world 矩形基準）
  const clientToMap = (clientX: number, clientY: number) => {
    const el = worldRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100
    return { x, y }
  }

  useEffect(() => {
    if (underwater) return
    const onMove = (e: PointerEvent) => {
      const state = useGameStore.getState()
      if (state.phase !== 'idle' && state.phase !== 'waiting_float') return
      if (!state.nearWater) return
      const p = clientToMap(e.clientX, e.clientY)
      if (!p) return
      setAim(p.x, p.y)
    }
    const onClick = (e: PointerEvent) => {
      const state = useGameStore.getState()
      if (state.phase !== 'idle') return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('.overlay, button, .title-card, .result-card')) return
      const p = clientToMap(e.clientX, e.clientY)
      if (!p) return
      if (!state.nearWater) {
        useGameStore.getState().setMessage('水際まで歩いてから川を狙ってね')
        return
      }
      castAt(p.x, p.y)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onClick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onClick)
    }
  }, [underwater, setAim, castAt])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let bite = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const state = useGameStore.getState()
      // スマホ縦向きはややコンパクトなスケール
      const portrait =
        typeof window !== 'undefined' &&
        window.matchMedia('(max-aspect-ratio: 3/4)').matches
      const scaleX = portrait ? 1.02 : MAP.mapScaleX
      const scaleY = portrait ? 2.7 : MAP.mapScaleY
      // 縦に長い分、Y移動を見た目等速に近づける
      const ySpeedScale = scaleX / scaleY

      if (state.canMove()) {
        let dx = 0
        let dy = 0
        if (KEYS.has('KeyA') || KEYS.has('ArrowLeft')) dx -= 1
        if (KEYS.has('KeyD') || KEYS.has('ArrowRight')) dx += 1
        if (KEYS.has('KeyW') || KEYS.has('ArrowUp')) dy -= 1
        if (KEYS.has('KeyS') || KEYS.has('ArrowDown')) dy += 1
        if (dx !== 0 || dy !== 0) {
          const len = Math.hypot(dx, dy) || 1
          dx = (dx / len) * MAP.playerSpeed * dt
          dy = (dy / len) * MAP.playerSpeed * dt * ySpeedScale
          const from = { x: playerPose.x, y: playerPose.y }
          const next = clampWalk(
            playerPose.x + dx,
            playerPose.y + dy,
            from,
          )
          const facing =
            dx > 0.01 ? true : dx < -0.01 ? false : playerPose.facingRight
          playerPose.x = next.x
          playerPose.y = next.y
          playerPose.facingRight = facing
          setPlayerPose(next.x, next.y, facing)
        }
      }

      // カメラ: プレイヤー追従＋端クランプ（縦長スケール対応）
      const target = clampCamera(
        playerPose.x,
        playerPose.y,
        scaleX,
        scaleY,
      )
      camRef.current.x += (target.x - camRef.current.x) * 0.14
      camRef.current.y += (target.y - camRef.current.y) * 0.14
      const cam = clampCamera(
        camRef.current.x,
        camRef.current.y,
        scaleX,
        scaleY,
      )
      camRef.current.x = cam.x
      camRef.current.y = cam.y
      if (rootRef.current) {
        rootRef.current.style.setProperty('--px', cam.x.toFixed(2))
        rootRef.current.style.setProperty('--py', cam.y.toFixed(2))
        rootRef.current.style.setProperty('--map-scale-x', String(scaleX))
        rootRef.current.style.setProperty('--map-scale-y', String(scaleY))
      }

      if (playerEl.current && !underwater) {
        // 画面内の遠近感用。マップ全体 y ではなく「画面内の相対」で軽く変化
        const scale = 0.55 + (playerPose.y % 34) * 0.004
        playerEl.current.style.left = `${playerPose.x}%`
        playerEl.current.style.top = `${playerPose.y}%`
        playerEl.current.style.transform = `translate(-50%, -85%) scaleX(${
          playerPose.facingRight ? 1 : -1
        }) scale(${scale})`
        playerEl.current.style.zIndex = String(
          30 + Math.round(playerPose.y),
        )
      }

      if (state.phase === 'float_sinking') {
        bite = Math.min(
          1,
          bite + dt / (state.activeSpecies?.hookWindowSec ?? 1.4),
        )
        setBiteProgress(bite)
      } else {
        bite = 0
      }

      if (state.phase === 'underwater_fight') {
        tickFight(dt)
      }

      // 水中BGスクロール（3枚タイル・隙間なし）
      // 正の speed = 逃げ方向／負 = 寄せ。transform は -tileW+o で常に画面を埋める
      if (
        uwStripRef.current &&
        (state.phase === 'underwater_fight' || state.phase === 'catch_result')
      ) {
        let speed = 14
        if (state.phase === 'underwater_fight') {
          if (state.fightMode === 'running') {
            speed = state.pullHeld ? -55 : 150
          } else {
            speed = state.pullHeld ? -52 : 8
          }
        } else {
          speed = 12
        }
        uwScrollRef.current += speed * dt
        const first = uwStripRef.current.firstElementChild as HTMLElement | null
        const tileW =
          first?.offsetWidth ||
          uwStripRef.current.scrollWidth / 3 ||
          window.innerWidth ||
          800
        if (tileW > 1) {
          let o = uwScrollRef.current % tileW
          if (o < 0) o += tileW
          uwScrollRef.current = o
          uwStripRef.current.style.transform = `translate3d(${-tileW + o}px, 0, 0)`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [setPlayerPose, setBiteProgress, tickFight, underwater])

  const timeFilter =
    timeOfDay === 'morning'
      ? 'brightness(1.05) saturate(1.08)'
      : timeOfDay === 'evening'
        ? 'brightness(0.88) sepia(0.22) saturate(1.12)'
        : 'brightness(1) saturate(1)'

  const sceneClass = `scene2d iso tall-map${isPixel ? ' style-pixel' : ' style-illustration'}${
    underwater ? ' underwater' : ''
  }`

  if (underwater) {
    const uwClass =
      phase === 'underwater_fight'
        ? fightMode === 'running'
          ? pullHeld
            ? 'uw-pulling-run'
            : 'uw-running'
          : pullHeld
            ? 'uw-pulling-rest'
            : 'uw-resting'
        : 'uw-landed'
    return (
      <div
        className={`${sceneClass} ${uwClass}`}
        ref={rootRef}
        key="scene-underwater"
      >
        <div className="uw-bg-viewport" aria-hidden>
          <div className="uw-bg-strip" ref={uwStripRef}>
            <img src={art.bgUnderwater} alt="" draggable={false} />
            <img src={art.bgUnderwater} alt="" draggable={false} />
            <img src={art.bgUnderwater} alt="" draggable={false} />
          </div>
        </div>
        <div className="water-rays" />
        {activeSpecies && (
          <img
            className={
              phase === 'underwater_fight'
                ? `fight-fish mystery ${fightMode === 'running' ? 'thrashing' : 'resting'}`
                : 'fight-fish mystery landed'
            }
            src={fishArt(activeSpecies.id, artStyle)}
            alt="掛かった魚"
            draggable={false}
            style={
              {
                // 博物画の余白対策（水中は控えめ。釣果カードは別係数）
                ['--fish-scale']: String(
                  pendingFishScale * (isPixel ? 1 : 1.12),
                ),
              } as CSSProperties
            }
          />
        )}
        <div className="bubble b1" />
        <div className="bubble b2" />
        <div className="bubble b3" />
        <div className="bubble b4" />
        <div className="bubble b5" />
      </div>
    )
  }

  return (
    <div
      className={sceneClass}
      ref={rootRef}
      key="scene-surface"
      style={{ filter: timeFilter }}
    >
      <div className="scene2d-world" ref={worldRef}>
        <div className="map-panels" aria-hidden>
          {PANEL_ORDER.map((id) => (
            <img
              key={id}
              className={`map-panel map-panel-${id}`}
              src={art.panels[id]}
              alt=""
              draggable={false}
            />
          ))}
        </div>
        <div className="water-shimmer iso-shimmer" aria-hidden />

        {showAim && (
          <div
            className="aim-reticle"
            style={{ left: `${aimX}%`, top: `${aimY}%` }}
            aria-hidden
          >
            <span className="aim-ring" />
            <span className="aim-cross" />
          </div>
        )}

        <img
          ref={playerEl}
          className="player-sprite iso-player"
          src={art.player}
          alt="プレイヤー"
          draggable={false}
        />

        {showBobber && castPoint && (
          <img
            className={`bobber-sprite iso-bobber ${
              phase === 'float_sinking' ? 'sinking' : 'bobbing'
            }`}
            src={art.bobber}
            alt="ウキ"
            draggable={false}
            style={{
              left: `${castPoint.x}%`,
              top: `${castPoint.y}%`,
            }}
          />
        )}

        {phase === 'casting' && castPoint && (
          <div
            className="cast-arc"
            style={{
              left: `${playerPose.x}%`,
              top: `${playerPose.y}%`,
              ['--cast-x' as string]: `${castPoint.x - playerPose.x}%`,
              ['--cast-y' as string]: `${castPoint.y - playerPose.y}%`,
            }}
          />
        )}
      </div>
      <ShoreHint />
    </div>
  )
}
