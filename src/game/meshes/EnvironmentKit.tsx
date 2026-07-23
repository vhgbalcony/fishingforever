import { useMemo } from 'react'
import * as THREE from 'three'

function pseudo(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** 多層コーン＋幹の木 */
export function StylizedTree({
  position,
  scale = 1,
  trunkColor = '#5a3d2a',
  leafColor = '#2f6b3a',
}: {
  position: [number, number, number]
  scale?: number
  trunkColor?: string
  leafColor?: string
}) {
  const leafs = useMemo(() => {
    const base = new THREE.Color(leafColor)
    return [
      { y: 1.55, r: 1.15, h: 1.5, color: base.getStyle() },
      {
        y: 2.15,
        r: 0.9,
        h: 1.25,
        color: base.clone().offsetHSL(0.02, 0.05, 0.06).getStyle(),
      },
      {
        y: 2.7,
        r: 0.6,
        h: 1.0,
        color: base.clone().offsetHSL(-0.01, 0.08, 0.1).getStyle(),
      },
    ]
  }, [leafColor])

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.12, 0.22, 1.5, 8]} />
        <meshStandardMaterial color={trunkColor} roughness={0.9} />
      </mesh>
      {leafs.map((l, i) => (
        <mesh key={i} position={[0, l.y, 0]} castShadow>
          <coneGeometry args={[l.r, l.h, 7]} />
          <meshStandardMaterial color={l.color} roughness={0.75} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** 丸みのある川石 */
export function RiverRock({
  position,
  scale = 1,
  color = '#7a756c',
  seed = 0,
}: {
  position: [number, number, number]
  scale?: number
  color?: string
  seed?: number
}) {
  const geo = useMemo(() => {
    const g = new THREE.DodecahedronGeometry(0.5, 1)
    const pos = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const n = 0.85 + pseudo(seed + i) * 0.3
      v.multiplyScalar(n)
      v.y *= 0.55 + pseudo(seed * 3 + i) * 0.25
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [seed])

  return (
    <mesh
      geometry={geo}
      position={position}
      scale={scale}
      rotation={[0, seed * 1.7, 0]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        roughness={0.92}
        metalness={0.05}
        flatShading
      />
    </mesh>
  )
}

/** 草の束 */
export function GrassClump({
  position,
  color = '#4a8f4a',
}: {
  position: [number, number, number]
  color?: string
}) {
  const blades = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        x: (pseudo(i + 2) - 0.5) * 0.25,
        z: (pseudo(i + 9) - 0.5) * 0.25,
        h: 0.25 + pseudo(i + 4) * 0.25,
        rot: (pseudo(i + 7) - 0.5) * 0.5,
      })),
    [],
  )

  return (
    <group position={position}>
      {blades.map((b, i) => (
        <mesh
          key={i}
          position={[b.x, b.h * 0.5, b.z]}
          rotation={[b.rot * 0.3, b.rot, b.rot * 0.2]}
          castShadow
        >
          <coneGeometry args={[0.03, b.h, 4]} />
          <meshStandardMaterial color={color} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** Aフレーム風テント */
export function CampTent({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <coneGeometry args={[1.35, 1.7, 4]} />
        <meshStandardMaterial color="#c45c26" roughness={0.7} flatShading />
      </mesh>
      {/* 入口の影 */}
      <mesh position={[0.55, 0.55, 0.55]} rotation={[0, Math.PI / 4, 0]}>
        <planeGeometry args={[0.9, 1.1]} />
        <meshStandardMaterial color="#5a2a12" side={THREE.DoubleSide} />
      </mesh>
      {/* 杭 */}
      {[
        [-1.1, 0.15, -0.6],
        [1.0, 0.15, -0.5],
        [-0.9, 0.15, 0.7],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.03, 0.04, 0.35, 6]} />
          <meshStandardMaterial color="#3d2a1a" />
        </mesh>
      ))}
    </group>
  )
}

/** うねりのある岸地形 */
export function RiverBank() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(22, 10, 40, 20)
    const pos = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      // local plane: x,y before rotation. After rot -90deg, y becomes world z-ish
      const shore = THREE.MathUtils.smoothstep(v.y, -1.5, 2.5)
      const bump =
        Math.sin(v.x * 0.45) * 0.12 +
        Math.cos(v.x * 0.9 + v.y) * 0.06 +
        pseudo(i) * 0.04
      v.z = shore * (0.35 + bump) // height after rotation
      // 水際を少し低く
      if (v.y > 2.0) v.z *= 0.35
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])

  return (
    <group>
      <mesh
        geometry={geo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, -5.2]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#5f8a4e" roughness={0.95} flatShading />
      </mesh>
      {/* 土の層 */}
      <mesh position={[0, -0.35, -5.5]} receiveShadow>
        <boxGeometry args={[24, 0.5, 9]} />
        <meshStandardMaterial color="#6b5344" roughness={1} />
      </mesh>
      {/* 水際の砂利帯 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, -2.6]}
        receiveShadow
      >
        <planeGeometry args={[20, 2.2]} />
        <meshStandardMaterial color="#9a9178" roughness={0.98} />
      </mesh>
    </group>
  )
}
