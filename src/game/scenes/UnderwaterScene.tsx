import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store'

function FightingFish() {
  const species = useGameStore((s) => s.activeSpecies)
  const fightProgress = useGameStore((s) => s.fightProgress)
  const group = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!group.current || !species) return
    const t = clock.elapsedTime
    // 引きで左右に暴れる
    const thrash = (1 - fightProgress) * 0.8 + 0.2
    group.current.position.x = Math.sin(t * 3.2) * 0.9 * thrash
    group.current.position.y = Math.sin(t * 2.1) * 0.35 * thrash
    group.current.position.z = -1.2 + fightProgress * 1.4
    group.current.rotation.y = Math.sin(t * 2.5) * 0.5 * thrash
    group.current.rotation.z = Math.sin(t * 4) * 0.2 * thrash
    // ヒレっぽくスケール微動
    const pulse = 1 + Math.sin(t * 10) * 0.03
    group.current.scale.setScalar(0.85 + species.avgLengthCm / 80)
    group.current.scale.x *= pulse
  })

  if (!species) return null

  return (
    <group ref={group}>
      {/* 胴体 */}
      <mesh castShadow>
        <sphereGeometry args={[0.35, 16, 12]} />
        <meshStandardMaterial
          color={species.color}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
      {/* 頭側を少し尖らせる */}
      <mesh position={[0.28, 0, 0]} castShadow>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color={species.color} roughness={0.35} />
      </mesh>
      {/* 尾びれ */}
      <mesh position={[-0.38, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[0.18, 0.28, 4]} />
        <meshStandardMaterial color={species.accentColor} flatShading />
      </mesh>
      {/* 背びれ */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <coneGeometry args={[0.08, 0.2, 4]} />
        <meshStandardMaterial color={species.accentColor} />
      </mesh>
      {/* 目 */}
      <mesh position={[0.4, 0.08, 0.12]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.4, 0.08, -0.12]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* ライン */}
      <mesh position={[0.5, 0.05, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 2.5, 4]} />
        <meshBasicMaterial color="#ddd" transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

function Bubbles() {
  const refs = useRef<THREE.Mesh[]>([])
  const seeds = useMemo(
    () =>
      Array.from({ length: 24 }, () => ({
        x: (Math.random() - 0.5) * 6,
        y: Math.random() * 4 - 1,
        z: (Math.random() - 0.5) * 4,
        s: 0.02 + Math.random() * 0.05,
        sp: 0.2 + Math.random() * 0.5,
      })),
    [],
  )

  useFrame((_, dt) => {
    refs.current.forEach((m, i) => {
      if (!m) return
      const seed = seeds[i]!
      m.position.y += seed.sp * dt
      if (m.position.y > 3) m.position.y = -1.5
    })
  })

  return (
    <group>
      {seeds.map((s, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) refs.current[i] = el
          }}
          position={[s.x, s.y, s.z]}
        >
          <sphereGeometry args={[s.s, 6, 6]} />
          <meshBasicMaterial color="#a8e6ff" transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function CausticsPlane() {
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (mat.current) {
      mat.current.opacity = 0.08 + Math.sin(clock.elapsedTime * 1.5) * 0.04
    }
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.8, 0]}>
      <planeGeometry args={[12, 12]} />
      <meshBasicMaterial ref={mat} color="#7fd4c8" transparent opacity={0.1} />
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
      <color attach="background" args={['#0a3d42']} />
      <fog attach="fog" args={['#0a3d42', 4, 16]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 8, 2]} intensity={0.9} color="#b8f0e8" />
      <pointLight position={[0, 2, 1]} intensity={0.6} color="#4ecdc4" />
      {/* 水中ボリューム感 */}
      <mesh>
        <sphereGeometry args={[20, 16, 16]} />
        <meshBasicMaterial color="#0d4f55" side={THREE.BackSide} />
      </mesh>
      <CausticsPlane />
      <Bubbles />
      <FightingFish />
      {/* 川底 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#3a3528" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[(i - 1.5) * 1.2, -1.85, -1 + (i % 2) * 0.8]}
          castShadow
        >
          <dodecahedronGeometry args={[0.2 + i * 0.05]} />
          <meshStandardMaterial color="#6a6558" flatShading />
        </mesh>
      ))}
    </>
  )
}
