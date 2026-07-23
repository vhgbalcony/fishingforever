import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store'

const skyByTime = {
  morning: '#87b8d8',
  day: '#5ba3d9',
  evening: '#e8a87c',
} as const

const waterByTime = {
  morning: '#3d8f8a',
  day: '#2a7a75',
  evening: '#3a6b68',
} as const

function FloatBobber() {
  const phase = useGameStore((s) => s.phase)
  const biteProgress = useGameStore((s) => s.biteProgress)
  const setBiteProgress = useGameStore((s) => s.setBiteProgress)
  const group = useRef<THREE.Group>(null)
  const baseY = 0.05

  useFrame((_, dt) => {
    if (!group.current) return
    if (phase === 'waiting_float') {
      const t = performance.now() * 0.003
      group.current.position.y = baseY + Math.sin(t) * 0.03
      group.current.position.x = Math.sin(t * 0.4) * 0.05
    } else if (phase === 'float_sinking') {
      const next = Math.min(1, biteProgress + dt / 1.4)
      setBiteProgress(next)
      group.current.position.y = baseY - next * 0.35
      group.current.rotation.z = next * 0.4
    } else if (phase === 'casting') {
      group.current.position.set(0, 2 + (1 - Math.min(1, performance.now())), 0)
    } else {
      group.current.position.set(0, -10, 0)
    }
  })

  if (phase !== 'waiting_float' && phase !== 'float_sinking' && phase !== 'casting') {
    return null
  }

  return (
    <group ref={group} position={[0.2, baseY, 0.5]}>
      {/* ウキ本体 */}
      <mesh position={[0, 0.08, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#e74c3c" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.1, 8]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  )
}

function WaterSurface() {
  const timeOfDay = useGameStore((s) => s.timeOfDay)
  const mesh = useRef<THREE.Mesh>(null)
  const color = waterByTime[timeOfDay]

  useFrame(({ clock }) => {
    if (!mesh.current) return
    mesh.current.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.02
  })

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[24, 24, 32, 32]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.88}
        roughness={0.15}
        metalness={0.1}
      />
    </mesh>
  )
}

function BankAndCamp() {
  return (
    <group>
      {/* 岸 */}
      <mesh position={[0, -0.2, -6]} receiveShadow>
        <boxGeometry args={[20, 0.5, 8]} />
        <meshStandardMaterial color="#5a7a4a" />
      </mesh>
      <mesh position={[0, 0.15, -5.5]} castShadow>
        <boxGeometry args={[18, 0.3, 4]} />
        <meshStandardMaterial color="#6b8f55" />
      </mesh>
      {/* 簡易テント */}
      <mesh position={[-3, 0.9, -6.2]} castShadow>
        <coneGeometry args={[1.1, 1.6, 4]} />
        <meshStandardMaterial color="#c45c26" flatShading />
      </mesh>
      {/* 簡易木 */}
      {[-6, 4, 7].map((x, i) => (
        <group key={i} position={[x, 0, -7.5 + (i % 2) * 0.5]}>
          <mesh position={[0, 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.2, 1.6, 6]} />
            <meshStandardMaterial color="#5c4033" />
          </mesh>
          <mesh position={[0, 2.1, 0]} castShadow>
            <sphereGeometry args={[0.9, 8, 8]} />
            <meshStandardMaterial color="#3d6b3d" flatShading />
          </mesh>
        </group>
      ))}
      {/* 石 */}
      <mesh position={[1.5, 0.15, -3.8]} castShadow>
        <dodecahedronGeometry args={[0.35]} />
        <meshStandardMaterial color="#888880" flatShading />
      </mesh>
    </group>
  )
}

function CastAnimation() {
  const phase = useGameStore((s) => s.phase)
  const finishCast = useGameStore((s) => s.finishCast)
  const done = useRef(false)
  const t0 = useRef(0)

  useFrame(({ clock }) => {
    if (phase !== 'casting') {
      done.current = false
      return
    }
    if (!done.current) {
      t0.current = clock.elapsedTime
      done.current = true
    }
    if (clock.elapsedTime - t0.current > 0.9) {
      finishCast()
      done.current = false
    }
  })

  return null
}

export function SurfaceScene() {
  const timeOfDay = useGameStore((s) => s.timeOfDay)
  const sky = skyByTime[timeOfDay]

  const fog = useMemo(
    () => new THREE.Fog(sky, 12, 40),
    [sky],
  )

  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[fog.color, fog.near, fog.far]} />
      <ambientLight intensity={timeOfDay === 'evening' ? 0.45 : 0.7} />
      <directionalLight
        position={[8, 14, 4]}
        intensity={timeOfDay === 'evening' ? 0.9 : 1.25}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <hemisphereLight
        args={[sky, '#3d5c3a', timeOfDay === 'day' ? 0.5 : 0.35]}
      />
      <WaterSurface />
      <BankAndCamp />
      <FloatBobber />
      <CastAnimation />
      {/* 水面下のわずかな色 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 2]}>
        <planeGeometry args={[24, 16]} />
        <meshBasicMaterial color="#1a4a48" transparent opacity={0.5} />
      </mesh>
    </>
  )
}
