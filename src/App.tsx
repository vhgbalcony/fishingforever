import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { SurfaceScene } from './game/scenes/SurfaceScene'
import { UnderwaterScene } from './game/scenes/UnderwaterScene'
import { useGameStore } from './game/store'
import { CatchResult } from './game/ui/CatchResult'
import { HUD } from './game/ui/HUD'
import './App.css'
import * as THREE from 'three'

function GameCanvas() {
  const phase = useGameStore((s) => s.phase)
  const underwater =
    phase === 'underwater_fight' || phase === 'catch_result'

  return (
    <Canvas
      shadows
      camera={{ position: [0.4, 4.2, 2.0], fov: 48, near: 0.1, far: 100 }}
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.08,
      }}
    >
      <Suspense fallback={null}>
        {underwater ? <UnderwaterScene /> : <SurfaceScene />}
      </Suspense>
    </Canvas>
  )
}

function useInputBindings() {
  const phase = useGameStore((s) => s.phase)
  const cast = useGameStore((s) => s.cast)
  const tryHook = useGameStore((s) => s.tryHook)
  const dismissResult = useGameStore((s) => s.dismissResult)
  const startGame = useGameStore((s) => s.startGame)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // WASD は移動用なのでスペース／Enter のみアクション
      if (e.code !== 'Space' && e.code !== 'Enter') return
      // 入力欄などはない前提
      e.preventDefault()
      if (phase === 'title') startGame()
      else if (phase === 'idle') cast()
      else if (phase === 'float_sinking') tryHook()
      else if (phase === 'catch_result') dismissResult()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, cast, tryHook, dismissResult, startGame])
}

export default function App() {
  useInputBindings()

  return (
    <div className="app-root">
      <GameCanvas />
      <HUD />
      <CatchResult />
    </div>
  )
}
