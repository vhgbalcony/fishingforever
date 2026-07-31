import { useEffect } from 'react'
import { Scene2D } from './game/scenes/Scene2D'
import { useGameStore } from './game/store'
import { CatchResult } from './game/ui/CatchResult'
import { HUD } from './game/ui/HUD'
import './App.css'

function useInputBindings() {
  const phase = useGameStore((s) => s.phase)
  const cast = useGameStore((s) => s.cast)
  const tryHook = useGameStore((s) => s.tryHook)
  const pullLine = useGameStore((s) => s.pullLine)
  const dismissResult = useGameStore((s) => s.dismissResult)
  const startGame = useGameStore((s) => s.startGame)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return
      e.preventDefault()
      if (phase === 'title') startGame()
      else if (phase === 'idle') cast()
      else if (phase === 'float_sinking') tryHook()
      else if (phase === 'underwater_fight') pullLine()
      else if (phase === 'catch_result') dismissResult() // キープ
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, cast, tryHook, pullLine, dismissResult, startGame])
}

export default function App() {
  useInputBindings()

  return (
    <div className="app-root">
      <Scene2D />
      <HUD />
      <CatchResult />
    </div>
  )
}
