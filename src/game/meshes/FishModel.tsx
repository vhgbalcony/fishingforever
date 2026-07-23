import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export type FishModelProps = {
  color: string
  accentColor: string
  /** 基準スケール（1 = 中型） */
  scale?: number
  /** ヒレのパタパタ量 0〜1 */
  finWave?: number
  castShadow?: boolean
}

/** 清流っぽいスタイルの魚メッシュ（プロシージャル） */
export function FishModel({
  color,
  accentColor,
  scale = 1,
  finWave = 0.6,
  castShadow = true,
}: FishModelProps) {
  const bodyRef = useRef<THREE.Group>(null)
  const tailRef = useRef<THREE.Mesh>(null)
  const dorsalRef = useRef<THREE.Mesh>(null)
  const pectoralL = useRef<THREE.Mesh>(null)
  const pectoralR = useRef<THREE.Mesh>(null)

  const bodyGeo = useMemo(() => createBodyGeometry(), [])
  const finGeo = useMemo(() => createFinGeometry(), [])
  const tailGeo = useMemo(() => createTailGeometry(), [])

  const bodyMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.28,
        metalness: 0.12,
        clearcoat: 0.55,
        clearcoatRoughness: 0.25,
        sheen: 0.4,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color(accentColor),
      }),
    [color, accentColor],
  )

  const accentMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: accentColor,
        roughness: 0.4,
        metalness: 0.05,
        side: THREE.DoubleSide,
      }),
    [accentColor],
  )

  const bellyMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color).lerp(new THREE.Color('#f2f0e6'), 0.55),
        roughness: 0.45,
        metalness: 0.05,
      }),
    [color],
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const wave = Math.sin(t * 9) * 0.35 * finWave
    if (tailRef.current) {
      tailRef.current.rotation.y = wave * 1.1
    }
    if (dorsalRef.current) {
      dorsalRef.current.rotation.z = wave * 0.15
    }
    if (pectoralL.current) {
      pectoralL.current.rotation.z = 0.45 + wave * 0.5
    }
    if (pectoralR.current) {
      pectoralR.current.rotation.z = -0.45 - wave * 0.5
    }
    if (bodyRef.current) {
      bodyRef.current.rotation.y = Math.sin(t * 4.5) * 0.04 * finWave
    }
  })

  return (
    <group scale={scale}>
      <group ref={bodyRef}>
        {/* 胴体 */}
        <mesh
          geometry={bodyGeo}
          material={bodyMat}
          castShadow={castShadow}
          rotation={[0, 0, Math.PI / 2]}
        />
        {/* 腹のハイライト帯 */}
        <mesh position={[0.02, -0.08, 0]} scale={[0.95, 0.42, 0.55]} castShadow={castShadow}>
          <sphereGeometry args={[0.22, 18, 12]} />
          <primitive object={bellyMat} attach="material" />
        </mesh>
        {/* 側線っぽいアクセント */}
        <mesh position={[0.02, 0.02, 0.12]} rotation={[0, 0, 0.1]}>
          <boxGeometry args={[0.55, 0.02, 0.01]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.55} />
        </mesh>
        <mesh position={[0.02, 0.02, -0.12]} rotation={[0, 0, -0.1]}>
          <boxGeometry args={[0.55, 0.02, 0.01]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.55} />
        </mesh>

        {/* 背びれ */}
        <mesh
          ref={dorsalRef}
          geometry={finGeo}
          material={accentMat}
          position={[-0.02, 0.16, 0]}
          rotation={[0, 0, -0.15]}
          scale={[0.9, 1.1, 0.9]}
          castShadow={castShadow}
        />
        {/* 尻びれ */}
        <mesh
          geometry={finGeo}
          material={accentMat}
          position={[-0.08, -0.14, 0]}
          rotation={[Math.PI, 0, 0.2]}
          scale={[0.55, 0.55, 0.55]}
          castShadow={castShadow}
        />
        {/* 胸びれ */}
        <mesh
          ref={pectoralL}
          geometry={finGeo}
          material={accentMat}
          position={[0.12, -0.02, 0.14]}
          rotation={[0.9, 0.4, 0.5]}
          scale={[0.45, 0.45, 0.45]}
          castShadow={castShadow}
        />
        <mesh
          ref={pectoralR}
          geometry={finGeo}
          material={accentMat}
          position={[0.12, -0.02, -0.14]}
          rotation={[-0.9, -0.4, -0.5]}
          scale={[0.45, 0.45, 0.45]}
          castShadow={castShadow}
        />
        {/* 尾びれ */}
        <mesh
          ref={tailRef}
          geometry={tailGeo}
          material={accentMat}
          position={[-0.42, 0, 0]}
          castShadow={castShadow}
        />

        {/* 目 */}
        <group position={[0.32, 0.05, 0.1]}>
          <mesh>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color="#f5f5f0" roughness={0.3} />
          </mesh>
          <mesh position={[0.02, 0.005, 0.01]}>
            <sphereGeometry args={[0.022, 10, 10]} />
            <meshStandardMaterial color="#101010" roughness={0.2} />
          </mesh>
          <mesh position={[0.028, 0.012, 0.015]}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
        <group position={[0.32, 0.05, -0.1]}>
          <mesh>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color="#f5f5f0" roughness={0.3} />
          </mesh>
          <mesh position={[0.02, 0.005, -0.01]}>
            <sphereGeometry args={[0.022, 10, 10]} />
            <meshStandardMaterial color="#101010" roughness={0.2} />
          </mesh>
          <mesh position={[0.028, 0.012, -0.015]}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function createBodyGeometry() {
  const points: THREE.Vector2[] = []
  for (let i = 0; i <= 28; i++) {
    const t = i / 28
    // y: 頭(+0.4) → 尾(-0.45)
    const y = 0.4 - t * 0.85
    // 横断面半径のエンベロープ（紡錘形）
    let r = Math.sin(Math.pow(t, 0.85) * Math.PI) * 0.2
    if (t < 0.12) r *= 0.35 + (t / 0.12) * 0.65
    if (t > 0.78) r *= Math.max(0.08, (1 - t) / 0.22)
    r = Math.max(r, 0.012)
    points.push(new THREE.Vector2(r, y))
  }
  const geo = new THREE.LatheGeometry(points, 24)
  geo.computeVertexNormals()
  return geo
}

function createFinGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.quadraticCurveTo(0.08, 0.18, 0.02, 0.32)
  shape.quadraticCurveTo(-0.02, 0.2, -0.04, 0.05)
  shape.lineTo(0, 0)
  const geo = new THREE.ShapeGeometry(shape, 8)
  geo.center()
  return geo
}

function createTailGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(-0.08, 0.18)
  shape.quadraticCurveTo(-0.02, 0.05, -0.08, -0.18)
  shape.lineTo(0, 0)
  const geo = new THREE.ShapeGeometry(shape, 10)
  return geo
}
