import { SoftShadows } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FishModel } from '../meshes/FishModel'
import { RiverRock } from '../meshes/EnvironmentKit'
import { useGameStore } from '../store'

function FightingFish() {
  const species = useGameStore((s) => s.activeSpecies)
  const fightProgress = useGameStore((s) => s.fightProgress)
  const group = useRef<THREE.Group>(null)
  const lineRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!group.current || !species) return
    const t = clock.elapsedTime
    const thrash = (1 - fightProgress) * 0.85 + 0.15
    group.current.position.x = Math.sin(t * 3.1) * 0.95 * thrash
    group.current.position.y = -0.1 + Math.sin(t * 2.2) * 0.32 * thrash
    group.current.position.z = -1.4 + fightProgress * 1.55
    group.current.rotation.y =
      Math.PI + Math.sin(t * 2.4) * 0.55 * thrash
    group.current.rotation.z = Math.sin(t * 3.8) * 0.22 * thrash
    group.current.rotation.x = Math.sin(t * 2.0) * 0.12 * thrash
    const s = 0.9 + species.avgLengthCm / 70
    group.current.scale.setScalar(s)

    if (lineRef.current) {
      // 口元から上へ向かうライン
      lineRef.current.position.set(
        group.current.position.x + 0.35 * Math.cos(group.current.rotation.y),
        group.current.position.y + 0.15,
        group.current.position.z + 0.35 * Math.sin(group.current.rotation.y),
      )
    }
  })

  if (!species) return null

  return (
    <>
      <group ref={group}>
        <FishModel
          color={species.color}
          accentColor={species.accentColor}
          finWave={0.85}
          scale={1}
        />
      </group>
      <mesh ref={lineRef}>
        <cylinderGeometry args={[0.006, 0.006, 3.5, 5]} />
        <meshBasicMaterial color="#dfe8e8" transparent opacity={0.4} />
      </mesh>
    </>
  )
}

function Bubbles() {
  const group = useRef<THREE.Group>(null)
  const seeds = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        x: (Math.random() - 0.5) * 7,
        y: Math.random() * 4 - 1.5,
        z: (Math.random() - 0.5) * 5,
        s: 0.018 + Math.random() * 0.05,
        sp: 0.18 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        i,
      })),
    [],
  )

  useFrame((_, dt) => {
    if (!group.current) return
    group.current.children.forEach((child, i) => {
      const seed = seeds[i]!
      child.position.y += seed.sp * dt
      child.position.x =
        seed.x + Math.sin(performance.now() * 0.001 + seed.phase) * 0.15
      if (child.position.y > 2.8) child.position.y = -1.8
    })
  })

  return (
    <group ref={group}>
      {seeds.map((s) => (
        <mesh key={s.i} position={[s.x, s.y, s.z]}>
          <sphereGeometry args={[s.s, 10, 10]} />
          <meshPhysicalMaterial
            color="#c8f0ff"
            transparent
            opacity={0.35}
            roughness={0.1}
            transmission={0.4}
            thickness={0.2}
          />
        </mesh>
      ))}
    </group>
  )
}

function CausticsLight() {
  const light = useRef<THREE.SpotLight>(null)
  useFrame(({ clock }) => {
    if (!light.current) return
    const t = clock.elapsedTime
    light.current.position.x = Math.sin(t * 0.7) * 1.5
    light.current.position.z = Math.cos(t * 0.5) * 1.2
    light.current.intensity = 1.2 + Math.sin(t * 2.2) * 0.35
  })
  return (
    <spotLight
      ref={light}
      position={[0, 4.5, 0]}
      angle={0.75}
      penumbra={0.7}
      intensity={1.3}
      color="#b8fff0"
      castShadow
      distance={18}
    />
  )
}

function RiverBed() {
  const bedGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(22, 16, 48, 32)
    const pos = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const n =
        Math.sin(v.x * 0.7) * 0.08 +
        Math.cos(v.y * 0.9) * 0.06 +
        Math.sin(v.x * 2.1 + v.y) * 0.03
      v.z = n
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])

  const pebbles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        p: [
          (i % 8) * 1.1 - 3.8 + (i % 3) * 0.15,
          -1.92 + (i % 5) * 0.01,
          ((i * 3) % 7) * 0.7 - 2.2,
        ] as [number, number, number],
        s: 0.12 + (i % 5) * 0.05,
        seed: i + 20,
        c: i % 2 === 0 ? '#6a6558' : '#7a7264',
      })),
    [],
  )

  return (
    <group>
      <mesh
        geometry={bedGeo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -2.0, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color="#3d382c"
          roughness={0.95}
          metalness={0.02}
          flatShading
        />
      </mesh>
      {/* 砂の筋 */}
      <mesh rotation={[-Math.PI / 2, 0, 0.2]} position={[0.5, -1.97, 0.4]}>
        <planeGeometry args={[8, 3]} />
        <meshStandardMaterial
          color="#5a4f3c"
          transparent
          opacity={0.55}
          roughness={1}
        />
      </mesh>
      {pebbles.map((p, i) => (
        <RiverRock
          key={i}
          position={p.p}
          scale={p.s}
          seed={p.seed}
          color={p.c}
        />
      ))}
      {/* 水草 */}
      {[-2, -0.5, 1.2, 2.8].map((x, i) => (
        <group key={i} position={[x, -2.0, -1.5 + (i % 2) * 1.2]}>
          {[0, 1, 2, 3].map((j) => (
            <mesh
              key={j}
              position={[
                Math.sin(j) * 0.08,
                0.35 + j * 0.12,
                Math.cos(j) * 0.05,
              ]}
              rotation={[0.2, j, 0.15 * j]}
            >
              <coneGeometry args={[0.04, 0.7 + j * 0.08, 5]} />
              <meshStandardMaterial
                color={j % 2 ? '#1f5c3a' : '#2a7048'}
                roughness={0.8}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function SurfaceShimmer() {
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (mat.current) {
      mat.current.opacity = 0.08 + Math.sin(clock.elapsedTime * 1.6) * 0.04
    }
  })
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.6, 0]}>
      <planeGeometry args={[16, 12]} />
      <meshBasicMaterial
        ref={mat}
        color="#a8fff0"
        transparent
        opacity={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export function UnderwaterScene() {
  const tickFight = useGameStore((s) => s.tickFight)

  useFrame((_, dt) => {
    tickFight(dt)
  })

  return (
    <>
      <SoftShadows size={12} samples={8} focus={0.5} />
      <color attach="background" args={['#06353a']} />
      <fog attach="fog" args={['#0a454c', 3.5, 14]} />

      <ambientLight intensity={0.25} color="#7ec8c0" />
      <hemisphereLight args={['#9ef0e0', '#1a3a30', 0.45]} />
      <directionalLight
        position={[3, 8, 2]}
        intensity={0.85}
        color="#d4fff4"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <CausticsLight />
      <pointLight position={[0, 0.5, 1]} intensity={0.4} color="#4ecdc4" />

      {/* 水中ドーム */}
      <mesh>
        <sphereGeometry args={[18, 24, 24]} />
        <meshBasicMaterial color="#074046" side={THREE.BackSide} />
      </mesh>

      <SurfaceShimmer />
      <RiverBed />
      <Bubbles />
      <FightingFish />
    </>
  )
}
