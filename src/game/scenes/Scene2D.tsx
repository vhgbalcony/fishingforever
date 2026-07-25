import { useEffect, useRef } from 'react'
import { fishArt, getArt } from '../artAssets'
import { playerPose } from '../playerPose'
import { useGameStore } from '../store'
import {
  clampWalk,
  defaultAim,
  isNearWater,
  MAP,
  ZONE_LABEL,
} from '../world'

function ShoreHint() {
  const nearWater = useGameStore((s) => s.nearWater)
  const phase = useGameStore((s) => s.phase)
  const aimZone = useGameStore((s) => s.aimZone)
  if (phase === 'title') return null
  return (
    <div className="shore-hint" aria-hidden>
      {nearWater
        ? `◎ 水際 · 狙い ${ZONE_LABEL[aimZone]}`
        : '川沿いへ近づく'}
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

/** アイソメ風 2.5D・はじまりキャンプ */
export function Scene2D() {
  const rootRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const playerEl = useRef<HTMLImageElement>(null)
  const camRef = useRef({ x: 0, y: 0 })

  const phase = useGameStore((s) => s.phase)
  const timeOfDay = useGameStore((s) => s.timeOfDay)
  const castPoint = useGameStore((s) => s.castPoint)
  const activeSpecies = useGameStore((s) => s.activeSpecies)
  const artStyle = useGameStore((s) => s.artStyle)
  const aimX = useGameStore((s) => s.aimX)
  const aimY = useGameStore((s) => s.aimY)
  const nearWater = useGameStore((s) => s.nearWater)
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

  // ポインタ → マップ%
  const clientToMap = (clientX: number, clientY: number) => {
    const el = worldRef.current ?? rootRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
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
      // UI 上のクリックは無視
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
          dy = (dy / len) * MAP.playerSpeed * dt
          const next = clampWalk(playerPose.x + dx, playerPose.y + dy)
          const facing =
            dx > 0.01 ? true : dx < -0.01 ? false : playerPose.facingRight
          playerPose.x = next.x
          playerPose.y = next.y
          playerPose.facingRight = facing
          setPlayerPose(next.x, next.y, facing)
          // 移動中もデフォルト狙いを川へ
          if (state.phase === 'idle' && isNearWater(next)) {
            const aim = defaultAim(next)
            if (
              Math.hypot(aim.x - state.aimX, aim.y - state.aimY) > 18
            ) {
              // 遠いときだけ自動補正（手動狙いを尊重）
            }
          }
        }
      }

      // カメラ追従（マップを広く見せる）
      const targetCamX = (playerPose.x - 50) * 0.35
      const targetCamY = (playerPose.y - 55) * 0.28
      camRef.current.x += (targetCamX - camRef.current.x) * 0.1
      camRef.current.y += (targetCamY - camRef.current.y) * 0.1
      if (rootRef.current) {
        rootRef.current.style.setProperty(
          '--cam-x',
          `${camRef.current.x.toFixed(2)}%`,
        )
        rootRef.current.style.setProperty(
          '--cam-y',
          `${camRef.current.y.toFixed(2)}%`,
        )
      }

      if (playerEl.current && !underwater) {
        const scale = 0.55 + playerPose.y * 0.0045
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

  const sceneClass = `scene2d iso${isPixel ? ' style-pixel' : ' style-illustration'}${
    underwater ? ' underwater' : ''
  }`

  if (underwater) {
    return (
      <div className={sceneClass} ref={rootRef}>
        <img
          className="scene2d-bg"
          src={art.bgUnderwater}
          alt=""
          draggable={false}
        />
        <div className="water-rays" />
        {activeSpecies && (
          <img
            className="fight-fish mystery"
            src={fishArt(activeSpecies.id, artStyle)}
            alt="掛かった魚"
            draggable={false}
          />
        )}
        <div className="bubble b1" />
        <div className="bubble b2" />
        <div className="bubble b3" />
      </div>
    )
  }

  return (
    <div className={sceneClass} ref={rootRef} style={{ filter: timeFilter }}>
      <div className="scene2d-world" ref={worldRef}>
        <img
          className="scene2d-bg"
          src={art.bgCamp}
          alt="はじまりキャンプ"
          draggable={false}
        />
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
