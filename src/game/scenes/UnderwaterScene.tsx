import { Environment, SoftShadows } from '@react-three/drei'
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
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    return g
  }, [])
  const lineRef = useRef<THREE.Line>(null)

  useFrame(({ clock }) => {
    if (!group.current || !species) return
    const t = clock.elapsedTime
    const thrash = (1 - fightProgress) * 0.88 + 0.12
    const x = Math.sin(t * 3.0) * 1.0 * thrash
    const y = -0.15 + Math.sin(t * 2.1) * 0.3 * thrash
    const z = -1.5 + fightProgress * 1.6
    group.current.position.set(x, y, z)
    group.current.rotation.set(
      Math.sin(t * 2.0) * 0.15 * thrash,
      Math.PI + Math.sin(t * 2.3) * 0.55 * thrash,
      Math.sin(t * 3.6) * 0.25 * thrash,
    )
    const s = 0.95 + species.avgLengthCm / 68
    group.current.scale.setScalar(s)

    if (lineRef.current) {
      const pos = lineGeo.attributes.position as THREE.BufferAttribute
      // 口元
      const mx = x + Math.cos(group.current.rotation.y) * 0.35
      const my = y + 0.05
      const mz = z + Math.sin(group.current.rotation.y) * 0.35
      pos.setXYZ(0, mx, my + 2.2, mz)
      pos.setXYZ(1, mx, my, mz)
      pos.needsUpdate = true
    }
  })

  if (!species) return null

  return (
    <>
      <group ref={group}>
        <FishModel
          speciesId={species.id}
          finWave={0.9}
          scale={1.05}
        />
      </group>
      <line ref={lineRef as never} geometry={lineGeo}>
        <lineBasicMaterial color="#d5e4e4" transparent opacity={0.4} />
      </line>
    </>
  )
}

function Bubbles() {
  const group = useRef<THREE.Group>(null)
  const seeds = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        x: (Math.random() - 0.5) * 7,
        y: Math.random() * 4 - 1.5,
        z: (Math.random() - 0.5) * 5,
        s: 0.015 + Math.random() * 0.045,
        sp: 0.16 + Math.random() * 0.5,
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
        seed.x + Math.sin(performance.now() * 0.001 + seed.phase) * 0.12
      if (child.position.y > 2.6) child.position.y = -1.8
    })
  })

  return (
    <group ref={group}>
      {seeds.map((s) => (
        <mesh key={s.i} position={[s.x, s.y, s.z]}>
          <sphereGeometry args={[s.s, 12, 12]} />
          <meshPhysicalMaterial
            color="#c8f4ff"
            transparent
            opacity={0.32}
            roughness={0.05}
            transmission={0.55}
            thickness={0.25}
            ior={1.33}
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
    light.current.position.x = Math.sin(t * 0.7) * 1.6
    light.current.position.z = Math.cos(t * 0.5) * 1.3
    light.current.intensity = 1.4 + Math.sin(t * 2.4) * 0.4
  })
  return (
    <spotLight
      ref={light}
      position={[0, 5, 0]}
      angle={0.8}
      penumbra={0.75}
      intensity={1.5}
      color="#c8fff2"
      castShadow
      distance={20}
    />
  )
}

function RiverBed() {
  const bedGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(22, 16, 64, 48)
    const pos = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const n =
        Math.sin(v.x * 0.7) * 0.09 +
        Math.cos(v.y * 0.9) * 0.07 +
        Math.sin(v.x * 2.2 + v.y * 1.4) * 0.035
      v.z = n
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])

  const pebbles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        p: [
          (i % 9) * 1.05 - 4.2 + (i % 3) * 0.12,
          -1.93 + (i % 5) * 0.01,
          ((i * 3) % 8) * 0.65 - 2.4,
        ] as [number, number, number],
        s: 0.1 + (i % 6) * 0.045,
        seed: i + 20,
        c: i % 3 === 0 ? '#6a6558' : i % 3 === 1 ? '#7a7264' : '#5c564c',
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
          color="#3a3428"
          roughness={0.95}
          metalness={0.02}
          flatShading
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0.15]} position={[0.4, -1.96, 0.3]}>
        <planeGeometry args={[9, 3.5]} />
        <meshStandardMaterial color="#5a4e3a" transparent opacity={0.5} roughness={1} />
      </mesh>
      {pebbles.map((p, i) => (
        <RiverRock key={i} position={p.p} scale={p.s} seed={p.seed} color={p.c} />
      ))}
      {[-2.2, -0.4, 1.4, 3.0].map((x, i) => (
        <group key={i} position={[x, -2.0, -1.3 + (i % 2) * 1.1]}>
          {[0, 1, 2, 3, 4].map((j) => (
            <mesh
              key={j}
              position={[Math.sin(j + i) * 0.07, 0.4 + j * 0.1, Math.cos(j) * 0.04]}
              rotation={[0.15 * j, j * 0.4, 0.1]}
            >
              <coneGeometry args={[0.035, 0.75 + j * 0.06, 5]} />
              <meshPhysicalMaterial
                color={j % 2 ? '#1a5a38' : '#247048'}
                roughness={0.7}
                transmission={0.05}
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
      mat.current.opacity = 0.07 + Math.sin(clock.elapsedTime * 1.7) * 0.04
    }
  })
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.55, 0]}>
      <planeGeometry args={[16, 12]} />
      <meshBasicMaterial
        ref={mat}
        color="#b8fff4"
        transparent
        opacity={0.09}
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
      <color attach="background" args={['#042e34']} />
      <fog attach="fog" args={['#063840', 3.2, 13]} />
      <Environment preset="night" environmentIntensity={0.25} />

      <ambientLight intensity={0.2} color="#6ec4ba" />
      <hemisphereLight args={['#a0f0e0', '#143028', 0.4]} />
      <directionalLight
        position={[3, 8, 2]}
        intensity={0.9}
        color="#d8fff6"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <CausticsLight />
      <pointLight position={[0, 0.4, 1]} intensity={0.45} color="#3ecfc4" />

      <mesh>
        <sphereGeometry args={[18, 28, 28]} />
        <meshBasicMaterial color="#05353c" side={THREE.BackSide} />
      </mesh>

      <SurfaceShimmer />
      <RiverBed />
      <Bubbles />
      <FightingFish />
    </>
  )
}
