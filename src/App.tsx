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
  const setPullHeld = useGameStore((s) => s.setPullHeld)
  const dismissResult = useGameStore((s) => s.dismissResult)
  const startGame = useGameStore((s) => s.startGame)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return
      e.preventDefault()
      if (e.repeat) {
        // 長押しの key-repeat は無視（setPullHeld は初回のみ）
        return
      }
      if (phase === 'title') startGame()
      else if (phase === 'idle') cast()
      else if (phase === 'float_sinking') tryHook()
      else if (phase === 'underwater_fight') setPullHeld(true)
      else if (phase === 'catch_result') dismissResult() // キープ
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return
      if (phase === 'underwater_fight') {
        e.preventDefault()
        setPullHeld(false)
      }
    }
    const onBlur = () => setPullHeld(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      setPullHeld(false)
    }
  }, [phase, cast, tryHook, setPullHeld, dismissResult, startGame])
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
