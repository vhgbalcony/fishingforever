import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { SurfaceScene } from './game/scenes/SurfaceScene'
import { UnderwaterScene } from './game/scenes/UnderwaterScene'
import { useGameStore } from './game/store'
import { CatchResult } from './game/ui/CatchResult'
import { HUD } from './game/ui/HUD'
import './App.css'

function CameraRig({ underwater }: { underwater: boolean }) {
  const { camera } = useThree()
  useEffect(() => {
    if (underwater) {
      camera.position.set(0, 0.4, 3.2)
      camera.lookAt(0, 0, 0)
    } else {
      camera.position.set(0, 3.2, 7.5)
      camera.lookAt(0, 0.5, 0)
    }
  }, [underwater, camera])
  return null
}

function GameCanvas() {
  const phase = useGameStore((s) => s.phase)
  const underwater =
    phase === 'underwater_fight' || phase === 'catch_result'

  return (
    <Canvas
      shadows
      camera={{ position: [0, 3.2, 7.5], fov: 50, near: 0.1, far: 80 }}
      dpr={[1, 1.75]}
    >
      <CameraRig underwater={underwater} />
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
      if (e.code !== 'Space' && e.code !== 'Enter') return
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
