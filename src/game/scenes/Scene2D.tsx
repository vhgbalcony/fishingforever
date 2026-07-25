import { useEffect, useRef } from 'react'
import { ART, fishArt } from '../artAssets'
import { playerPose } from '../playerPose'
import { useGameStore } from '../store'
import { clampWalk, MAP } from '../world'

function ShoreHint() {
  const nearWater = useGameStore((s) => s.nearWater)
  const phase = useGameStore((s) => s.phase)
  if (phase === 'title') return null
  return (
    <div className="shore-hint" aria-hidden>
      {nearWater ? '◎ 水際' : 'W で川へ近づく'}
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

/** 2.5Dイラスト版・はじまりキャンプ */
export function Scene2D() {
  const rootRef = useRef<HTMLDivElement>(null)
  const playerEl = useRef<HTMLImageElement>(null)
  const bobberEl = useRef<HTMLImageElement>(null)
  const camRef = useRef({ x: 0, y: 0 })

  const phase = useGameStore((s) => s.phase)
  const timeOfDay = useGameStore((s) => s.timeOfDay)
  const castPoint = useGameStore((s) => s.castPoint)
  const activeSpecies = useGameStore((s) => s.activeSpecies)
  const setPlayerPose = useGameStore((s) => s.setPlayerPose)
  const finishCast = useGameStore((s) => s.finishCast)
  const setBiteProgress = useGameStore((s) => s.setBiteProgress)
  const tickFight = useGameStore((s) => s.tickFight)

  const underwater = phase === 'underwater_fight' || phase === 'catch_result'
  const showBobber =
    !underwater &&
    castPoint &&
    (phase === 'casting' ||
      phase === 'waiting_float' ||
      phase === 'float_sinking')

  // キー入力
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

  // キャスト完了タイミング
  useEffect(() => {
    if (phase !== 'casting') return
    const t = window.setTimeout(() => finishCast(), 700)
    return () => clearTimeout(t)
  }, [phase, finishCast])

  // メインループ
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
        // W = 川寄り（Y+）、S = キャンプ寄り（Y-）
        if (KEYS.has('KeyW') || KEYS.has('ArrowUp')) dy += 1
        if (KEYS.has('KeyS') || KEYS.has('ArrowDown')) dy -= 1
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
        }
      }

      // カメラ（わずかなパララックス）
      const targetCamX = (playerPose.x - 40) * 0.18
      const targetCamY = (playerPose.y - 20) * 0.08
      camRef.current.x += (targetCamX - camRef.current.x) * 0.08
      camRef.current.y += (targetCamY - camRef.current.y) * 0.08
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

      // プレイヤーDOM直書き
      if (playerEl.current && !underwater) {
        // Y: ゲーム座標 0=下寄り, 大=川寄り → 画面 bottom%
        const bottom = 6 + playerPose.y * 0.55
        const left = playerPose.x
        const scale = 0.72 + playerPose.y * 0.004
        playerEl.current.style.left = `${left}%`
        playerEl.current.style.bottom = `${bottom}%`
        playerEl.current.style.transform = `translateX(-50%) scaleX(${
          playerPose.facingRight ? 1 : -1
        }) scale(${scale})`
        playerEl.current.style.zIndex = String(20 + Math.round(playerPose.y))
      }

      if (state.phase === 'float_sinking') {
        bite = Math.min(1, bite + dt / (state.activeSpecies?.hookWindowSec ?? 1.4))
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
        ? 'brightness(0.88) sepia(0.25) saturate(1.15)'
        : 'brightness(1) saturate(1)'

  if (underwater) {
    return (
      <div className="scene2d underwater" ref={rootRef}>
        <img
          className="scene2d-bg"
          src={ART.bgUnderwater}
          alt=""
          draggable={false}
        />
        <div className="water-rays" />
        {activeSpecies && (
          <img
            className="fight-fish"
            src={fishArt(activeSpecies.id)}
            alt={activeSpecies.name}
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
    <div className="scene2d" ref={rootRef} style={{ filter: timeFilter }}>
      <div className="scene2d-world">
        <img
          className="scene2d-bg"
          src={ART.bgCamp}
          alt="はじまりキャンプ"
          draggable={false}
        />
        {/* 川面のきらめき */}
        <div className="water-shimmer" aria-hidden />
        <img
          ref={playerEl}
          className="player-sprite"
          src={ART.player}
          alt="プレイヤー"
          draggable={false}
        />
        {showBobber && castPoint && (
          <img
            ref={bobberEl}
            className={`bobber-sprite ${
              phase === 'float_sinking' ? 'sinking' : 'bobbing'
            }`}
            src={ART.bobber}
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
              bottom: `${6 + playerPose.y * 0.55}%`,
              ['--cast-x' as string]: `${castPoint.x - playerPose.x}%`,
              ['--cast-y' as string]: `${
                100 - castPoint.y - (6 + playerPose.y * 0.55)
              }%`,
            }}
          />
        )}
      </div>
      <ShoreHint />
    </div>
  )
}
