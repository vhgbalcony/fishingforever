import { Cloud, Environment, Sky, SoftShadows } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  CampTent,
  GrassClump,
  RiverBank,
  RiverRock,
  StylizedTree,
} from '../meshes/EnvironmentKit'
import { Player } from '../meshes/Player'
import { WaterSurface } from '../meshes/WaterSurface'
import { playerPose } from '../playerPose'
import { useGameStore } from '../store'

const skyParams = {
  morning: {
    sunPos: [40, 12, -20] as [number, number, number],
    turbidity: 3.5,
    rayleigh: 2.0,
    mie: 0.0035,
  },
  day: {
    sunPos: [20, 42, 10] as [number, number, number],
    turbidity: 2.2,
    rayleigh: 1.05,
    mie: 0.0025,
  },
  evening: {
    sunPos: [-30, 4, -10] as [number, number, number],
    turbidity: 7.5,
    rayleigh: 2.6,
    mie: 0.01,
  },
} as const

function FollowCamera() {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3())
  const desired = useRef(new THREE.Vector3())

  useFrame((_, dt) => {
    const phase = useGameStore.getState().phase
    if (
      phase === 'title' ||
      phase === 'underwater_fight' ||
      phase === 'catch_result'
    ) {
      return
    }
    const px = playerPose.x
    const pz = playerPose.z
    desired.current.set(px + 0.2, 4.2, pz + 7.2)
    camera.position.lerp(desired.current, 1 - Math.pow(0.02, dt))
    look.current.set(px, 0.6, pz - 0.5)
    camera.lookAt(look.current)
  })

  return null
}

function FloatBobber() {
  const phase = useGameStore((s) => s.phase)
  const biteProgress = useGameStore((s) => s.biteProgress)
  const setBiteProgress = useGameStore((s) => s.setBiteProgress)
  const castPoint = useGameStore((s) => s.castPoint)
  const group = useRef<THREE.Group>(null)
  const lineRef = useRef<THREE.Line>(null)

  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(6), 3),
    )
    return g
  }, [])

  useFrame((_, dt) => {
    if (!group.current || !castPoint) return
    const baseY = castPoint.y

    if (phase === 'waiting_float') {
      const t = performance.now() * 0.003
      group.current.position.set(
        castPoint.x + Math.sin(t * 0.4) * 0.03,
        baseY + Math.sin(t) * 0.03,
        castPoint.z,
      )
      group.current.rotation.set(0, 0, Math.sin(t * 0.8) * 0.06)
    } else if (phase === 'float_sinking') {
      const next = Math.min(1, biteProgress + dt / 1.4)
      setBiteProgress(next)
      group.current.position.set(
        castPoint.x,
        baseY - next * 0.4,
        castPoint.z,
      )
      group.current.rotation.z = next * 0.5
      group.current.rotation.x = next * 0.2
    } else if (phase === 'casting') {
      const t = (performance.now() * 0.001) % 1
      const sx = playerPose.x
      const sz = playerPose.z
      const ex = castPoint.x
      const ez = castPoint.z
      const u = Math.min(1, t * 2.2)
      group.current.position.set(
        sx + (ex - sx) * u,
        0.3 + Math.sin(u * Math.PI) * 1.4,
        sz + (ez - sz) * u,
      )
    }

    if (lineRef.current) {
      const pos = lineGeo.attributes.position as THREE.BufferAttribute
      const tipX = playerPose.x + Math.sin(playerPose.yaw) * 0.35
      const tipY = 1.9
      const tipZ = playerPose.z + Math.cos(playerPose.yaw) * 0.35
      const bx = group.current.position.x
      const by = group.current.position.y + 0.2
      const bz = group.current.position.z
      pos.setXYZ(0, tipX, tipY, tipZ)
      pos.setXYZ(1, bx, by, bz)
      pos.needsUpdate = true
      lineGeo.computeBoundingSphere()
    }
  })

  const show =
    castPoint &&
    (phase === 'waiting_float' ||
      phase === 'float_sinking' ||
      phase === 'casting')

  if (!show || !castPoint) return null

  return (
    <group>
      <line ref={lineRef as never} geometry={lineGeo}>
        <lineBasicMaterial color="#e8eeef" transparent opacity={0.45} />
      </line>
      <group ref={group} position={[castPoint.x, castPoint.y, castPoint.z]}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <sphereGeometry args={[0.055, 24, 24]} />
          <meshPhysicalMaterial
            color="#d6453d"
            roughness={0.22}
            clearcoat={0.7}
            clearcoatRoughness={0.15}
          />
        </mesh>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.018, 0.12, 12]} />
          <meshPhysicalMaterial color="#f4f0e4" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.26, 0]}>
          <sphereGeometry args={[0.02, 12, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.1, 0]}>
          <sphereGeometry args={[0.016, 10, 10]} />
          <meshStandardMaterial color="#6a6a72" metalness={0.65} roughness={0.3} />
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
        { p: [-5.0, 0.06, -5.5] as [number, number, number], s: 0.4, seed: 7, c: '#756f64' },
      ] as const,
    [],
  )

  const grass = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        p: [
          -8 + (i % 10) * 1.6 + (i % 3) * 0.15,
          0.02,
          -4.0 - (i % 5) * 0.7,
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
      <StylizedTree position={[-4.5, 0, -9.2]} scale={1.05} leafColor="#2a6034" />

      {rocks.map((r, i) => (
        <RiverRock key={i} position={r.p} scale={r.s} seed={r.seed} color={r.c} />
      ))}
      {grass.map((g, i) => (
        <GrassClump key={i} position={g.p} color={g.c} />
      ))}

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
    if (clock.elapsedTime - t0.current > 0.95) {
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
      <SoftShadows size={16} samples={10} focus={0.55} />
      <Sky
        sunPosition={sky.sunPos}
        turbidity={sky.turbidity}
        rayleigh={sky.rayleigh}
        mieCoefficient={sky.mie}
        mieDirectionalG={0.85}
      />
      <Environment preset="park" environmentIntensity={0.45} />
      <fog
        attach="fog"
        args={[timeOfDay === 'evening' ? '#c98b6a' : '#9ec4d4', 16, 55]}
      />

      <ambientLight intensity={timeOfDay === 'evening' ? 0.22 : 0.35} />
      <hemisphereLight
        args={[
          timeOfDay === 'evening' ? '#ffb07a' : '#d0e8ff',
          '#3a5a35',
          timeOfDay === 'day' ? 0.5 : 0.38,
        ]}
      />
      <directionalLight
        position={sky.sunPos}
        intensity={timeOfDay === 'evening' ? 1.15 : 1.65}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        color={timeOfDay === 'evening' ? '#ffc09a' : '#fff6ea'}
      />
      <pointLight position={[0, 0.6, 2]} intensity={0.3} color="#7fd4c8" distance={14} />

      {timeOfDay !== 'day' && (
        <Cloud
          position={[6, 9, -14]}
          opacity={0.3}
          speed={0.12}
          segments={10}
          bounds={[10, 1.5, 2]}
        />
      )}

      <WaterSurface />
      <BankDecor />
      <Player />
      <FloatBobber />
      <CastAnimation />
      <FollowCamera />
    </>
  )
}
