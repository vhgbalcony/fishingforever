import { Cloud, Sky, SoftShadows } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  CampTent,
  GrassClump,
  RiverBank,
  RiverRock,
  StylizedTree,
} from '../meshes/EnvironmentKit'
import { WaterSurface } from '../meshes/WaterSurface'
import { useGameStore } from '../store'

const skyParams = {
  morning: {
    sunPos: [40, 12, -20] as [number, number, number],
    turbidity: 4,
    rayleigh: 2.2,
    mie: 0.004,
  },
  day: {
    sunPos: [20, 40, 10] as [number, number, number],
    turbidity: 2.5,
    rayleigh: 1.2,
    mie: 0.003,
  },
  evening: {
    sunPos: [-30, 4, -10] as [number, number, number],
    turbidity: 8,
    rayleigh: 2.8,
    mie: 0.01,
  },
} as const

function FloatBobber() {
  const phase = useGameStore((s) => s.phase)
  const biteProgress = useGameStore((s) => s.biteProgress)
  const setBiteProgress = useGameStore((s) => s.setBiteProgress)
  const group = useRef<THREE.Group>(null)
  const lineRef = useRef<THREE.Mesh>(null)
  const baseY = 0.08
  const basePos = useMemo(() => new THREE.Vector3(0.35, baseY, 1.1), [])

  useFrame((_, dt) => {
    if (!group.current) return
    if (phase === 'waiting_float') {
      const t = performance.now() * 0.003
      group.current.position.y = baseY + Math.sin(t) * 0.035
      group.current.position.x = basePos.x + Math.sin(t * 0.4) * 0.04
      group.current.position.z = basePos.z
      group.current.rotation.set(0, 0, Math.sin(t * 0.8) * 0.08)
    } else if (phase === 'float_sinking') {
      const next = Math.min(1, biteProgress + dt / 1.4)
      setBiteProgress(next)
      group.current.position.set(
        basePos.x,
        baseY - next * 0.42,
        basePos.z,
      )
      group.current.rotation.z = next * 0.55
      group.current.rotation.x = next * 0.25
    } else if (phase === 'casting') {
      const t = performance.now() * 0.004
      group.current.position.set(
        Math.sin(t) * 0.8,
        1.5 + Math.cos(t) * 0.4,
        0.2,
      )
    } else {
      group.current.position.set(0, -12, 0)
    }

    if (lineRef.current) {
      const show =
        phase === 'waiting_float' ||
        phase === 'float_sinking' ||
        phase === 'casting'
      lineRef.current.visible = show
    }
  })

  const visible =
    phase === 'waiting_float' ||
    phase === 'float_sinking' ||
    phase === 'casting'

  if (!visible) return null

  return (
    <group>
      {/* 道糸 */}
      <mesh ref={lineRef} position={[0.1, 1.2, 2.5]}>
        <cylinderGeometry args={[0.004, 0.004, 3.2, 4]} />
        <meshBasicMaterial color="#e8e8e8" transparent opacity={0.35} />
      </mesh>
      <group ref={group} position={[basePos.x, baseY, basePos.z]}>
        {/* ウキ本体 — 棒ウキ風 */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <sphereGeometry args={[0.055, 20, 20]} />
          <meshPhysicalMaterial
            color="#e74c3c"
            roughness={0.25}
            clearcoat={0.6}
            clearcoatRoughness={0.2}
          />
        </mesh>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.018, 0.12, 10]} />
          <meshPhysicalMaterial color="#f7f3e8" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.26, 0]}>
          <sphereGeometry args={[0.02, 12, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
        </mesh>
        {/* 水下のオモリ感 */}
        <mesh position={[0, -0.12, 0]}>
          <sphereGeometry args={[0.018, 10, 10]} />
          <meshStandardMaterial
            color="#6a6a70"
            metalness={0.6}
            roughness={0.35}
          />
        </mesh>
      </group>
    </group>
  )
}

function BankDecor() {
  const rocks = useMemo(
    () =>
      [
        { p: [1.6, 0.08, -3.2] as [number, number, number], s: 0.55, seed: 1, c: '#8a8578' },
        { p: [2.4, 0.05, -3.8] as [number, number, number], s: 0.35, seed: 2, c: '#6f6a60' },
        { p: [-1.8, 0.06, -3.5] as [number, number, number], s: 0.45, seed: 3, c: '#7d786c' },
        { p: [0.4, 0.04, -2.9] as [number, number, number], s: 0.28, seed: 4, c: '#958f80' },
        { p: [-3.2, 0.08, -4.2] as [number, number, number], s: 0.6, seed: 5, c: '#6a655c' },
        { p: [4.2, 0.07, -4.0] as [number, number, number], s: 0.5, seed: 6, c: '#827c70' },
      ] as const,
    [],
  )

  const grass = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        p: [
          -7 + (i % 9) * 1.7 + (i % 3) * 0.2,
          0.02,
          -4.2 - (i % 4) * 0.55,
        ] as [number, number, number],
        c: i % 2 === 0 ? '#4a8f4a' : '#3f7a3f',
      })),
    [],
  )

  return (
    <group>
      <RiverBank />
      <CampTent position={[-3.2, 0, -6.4]} />
      <StylizedTree position={[-6.2, 0, -7.8]} scale={1.15} leafColor="#2d6a38" />
      <StylizedTree position={[5.2, 0, -7.2]} scale={0.95} leafColor="#356f3c" />
      <StylizedTree position={[7.4, 0, -8.5]} scale={1.25} leafColor="#275f32" />
      <StylizedTree position={[-8.0, 0, -6.5]} scale={0.85} leafColor="#3a7840" />
      <StylizedTree position={[2.2, 0, -8.8]} scale={0.7} leafColor="#2f6336" />

      {rocks.map((r, i) => (
        <RiverRock
          key={i}
          position={r.p}
          scale={r.s}
          seed={r.seed}
          color={r.c}
        />
      ))}
      {grass.map((g, i) => (
        <GrassClump key={i} position={g.p} color={g.c} />
      ))}

      {/* 簡易キャンプファイア跡 */}
      <group position={[-1.2, 0.05, -5.4]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i / 5) * Math.PI * 2) * 0.35,
              0.04,
              Math.sin((i / 5) * Math.PI * 2) * 0.35,
            ]}
            castShadow
          >
            <boxGeometry args={[0.22, 0.08, 0.1]} />
            <meshStandardMaterial color="#4a3428" roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.2, 0.22, 0.04, 10]} />
          <meshStandardMaterial color="#2a2218" />
        </mesh>
      </group>
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
  const sky = skyParams[timeOfDay]

  return (
    <>
      <SoftShadows size={18} samples={10} focus={0.6} />
      <Sky
        sunPosition={sky.sunPos}
        turbidity={sky.turbidity}
        rayleigh={sky.rayleigh}
        mieCoefficient={sky.mie}
        mieDirectionalG={0.85}
      />
      <fog
        attach="fog"
        args={[
          timeOfDay === 'evening' ? '#c98b6a' : '#a8c9d8',
          14,
          48,
        ]}
      />

      <ambientLight intensity={timeOfDay === 'evening' ? 0.28 : 0.45} />
      <hemisphereLight
        args={[
          timeOfDay === 'evening' ? '#ffb07a' : '#cfe8ff',
          '#3d5c3a',
          timeOfDay === 'day' ? 0.55 : 0.4,
        ]}
      />
      <directionalLight
        position={sky.sunPos}
        intensity={timeOfDay === 'evening' ? 1.1 : 1.55}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={40}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        color={timeOfDay === 'evening' ? '#ffc09a' : '#fff5e6'}
      />
      {/* 水面の反射っぽいフィル */}
      <pointLight
        position={[0, 0.8, 2]}
        intensity={0.35}
        color="#7fd4c8"
        distance={12}
      />

      {timeOfDay !== 'day' && (
        <Cloud
          position={[6, 8, -12]}
          opacity={0.35}
          speed={0.15}
          segments={12}
          bounds={[8, 1.5, 2]}
        />
      )}

      <WaterSurface />
      <BankDecor />
      <FloatBobber />
      <CastAnimation />
    </>
  )
}
