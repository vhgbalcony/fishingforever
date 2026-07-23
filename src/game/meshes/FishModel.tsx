import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createFishTexture, getFishProfile } from '../fishTextures'

export type FishModelProps = {
  speciesId: string
  color?: string
  accentColor?: string
  scale?: number
  finWave?: number
  castShadow?: boolean
}

/**
 * 種ごとの体型・模様テクスチャを持つリアル寄り魚。
 * 写真スキャンではないが、特徴（斑点・虹帯・扁平など）を反映。
 */
export function FishModel({
  speciesId,
  scale = 1,
  finWave = 0.6,
  castShadow = true,
}: FishModelProps) {
  const root = useRef<THREE.Group>(null)
  const tailRef = useRef<THREE.Mesh>(null)
  const dorsalRef = useRef<THREE.Mesh>(null)
  const pL = useRef<THREE.Mesh>(null)
  const pR = useRef<THREE.Mesh>(null)

  const profile = useMemo(() => getFishProfile(speciesId), [speciesId])
  const tex = useMemo(() => createFishTexture(speciesId), [speciesId])

  const bodyGeo = useMemo(
    () => createBodyGeometry(profile.morph, profile.bodyHeight, profile.bodyWidth),
    [profile],
  )
  const finGeo = useMemo(() => createFinGeometry(profile.morph), [profile.morph])
  const tailGeo = useMemo(() => createTailGeometry(profile.morph), [profile.morph])

  const bodyMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      map: tex.map,
      roughnessMap: tex.roughnessMap,
      roughness: 0.32,
      metalness: 0.08,
      clearcoat: 0.65,
      clearcoatRoughness: 0.28,
      sheen: 0.35,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(profile.accentColor),
      envMapIntensity: 1.1,
    })
    if (profile.pattern === 'rainbow') {
      m.iridescence = 0.35
      m.iridescenceIOR = 1.3
      m.iridescenceThicknessRange = [100, 400]
    }
    return m
  }, [tex, profile])

  const finMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(profile.baseColor).multiplyScalar(
          1 - profile.finDarkness * 0.4,
        ),
        roughness: 0.45,
        metalness: 0.05,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        transmission: 0.08,
        thickness: 0.15,
      }),
    [profile],
  )

  useLayoutEffect(() => {
    return () => {
      bodyGeo.dispose()
      finGeo.dispose()
      tailGeo.dispose()
      bodyMat.dispose()
      finMat.dispose()
      tex.map.dispose()
      tex.roughnessMap.dispose()
    }
  }, [bodyGeo, finGeo, tailGeo, bodyMat, finMat, tex])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const wave = Math.sin(t * 10) * 0.4 * finWave
    if (tailRef.current) tailRef.current.rotation.y = wave * 1.2
    if (dorsalRef.current) dorsalRef.current.rotation.z = wave * 0.12
    if (pL.current) pL.current.rotation.z = 0.5 + wave * 0.55
    if (pR.current) pR.current.rotation.z = -0.5 - wave * 0.55
    if (root.current) {
      root.current.rotation.y = Math.sin(t * 5) * 0.05 * finWave
    }
  })

  const s =
    scale *
    profile.bodyLength *
    (profile.morph === 'sculpin' ? 0.95 : profile.morph === 'minnow' ? 0.85 : 1)

  return (
    <group scale={s}>
      <group ref={root}>
        <mesh
          geometry={bodyGeo}
          material={bodyMat}
          castShadow={castShadow}
          receiveShadow
          rotation={[0, 0, Math.PI / 2]}
        />

        {/* 背びれ */}
        <mesh
          ref={dorsalRef}
          geometry={finGeo}
          material={finMat}
          position={profile.morph === 'sculpin' ? [-0.05, 0.12, 0] : [-0.02, 0.17, 0]}
          rotation={[0, 0, -0.12]}
          scale={
            profile.morph === 'sculpin'
              ? [1.1, 0.7, 1]
              : profile.morph === 'minnow'
                ? [0.7, 0.85, 0.7]
                : [0.95, 1.15, 0.95]
          }
          castShadow={castShadow}
        />

        {/* 尻びれ */}
        <mesh
          geometry={finGeo}
          material={finMat}
          position={[-0.1, -0.13, 0]}
          rotation={[Math.PI, 0, 0.18]}
          scale={[0.5, 0.5, 0.5]}
        />

        {/* 胸びれ */}
        <mesh
          ref={pL}
          geometry={finGeo}
          material={finMat}
          position={[0.1, -0.02, profile.morph === 'sculpin' ? 0.18 : 0.13]}
          rotation={[1.0, 0.35, 0.5]}
          scale={profile.morph === 'sculpin' ? [0.7, 0.55, 0.7] : [0.48, 0.45, 0.48]}
        />
        <mesh
          ref={pR}
          geometry={finGeo}
          material={finMat}
          position={[0.1, -0.02, profile.morph === 'sculpin' ? -0.18 : -0.13]}
          rotation={[-1.0, -0.35, -0.5]}
          scale={profile.morph === 'sculpin' ? [0.7, 0.55, 0.7] : [0.48, 0.45, 0.48]}
        />

        {/* 尾 */}
        <mesh
          ref={tailRef}
          geometry={tailGeo}
          material={finMat}
          position={[-0.44, 0, 0]}
          castShadow={castShadow}
        />

        {/* 目 — ガラス質 */}
        <Eye position={[0.3, 0.045, 0.095]} />
        <Eye position={[0.3, 0.045, -0.095]} mirror />
      </group>
    </group>
  )
}

function Eye({
  position,
  mirror,
}: {
  position: [number, number, number]
  mirror?: boolean
}) {
  const zSign = mirror ? -1 : 1
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.042, 16, 16]} />
        <meshPhysicalMaterial
          color="#f4f1e6"
          roughness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>
      <mesh position={[0.018, 0.004, 0.008 * zSign]}>
        <sphereGeometry args={[0.02, 14, 14]} />
        <meshStandardMaterial color="#1a120c" roughness={0.25} />
      </mesh>
      <mesh position={[0.026, 0.01, 0.012 * zSign]}>
        <sphereGeometry args={[0.007, 10, 10]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function createBodyGeometry(
  morph: 'salmonid' | 'minnow' | 'sculpin',
  heightMul: number,
  widthMul: number,
) {
  const points: THREE.Vector2[] = []
  const segments = 36
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const y = 0.42 - t * 0.88
    let r = Math.sin(Math.pow(t, 0.82) * Math.PI) * 0.195 * heightMul
    if (morph === 'minnow') {
      r *= 0.82
      // より細長い
    }
    if (morph === 'sculpin') {
      // 頭でっかち・尾細い
      r = Math.sin(Math.pow(Math.min(t * 1.3, 1), 0.7) * Math.PI) * 0.22 * heightMul
      if (t < 0.25) r *= 1.25
      if (t > 0.55) r *= 0.75
    }
    if (t < 0.1) r *= 0.3 + (t / 0.1) * 0.7
    if (t > 0.82) r *= Math.max(0.06, (1 - t) / 0.18)
    r = Math.max(r, 0.01)
    points.push(new THREE.Vector2(r, y))
  }
  const geo = new THREE.LatheGeometry(points, 32)
  // 横幅をスケール（扁平 or 通常）
  geo.scale(1, 1, widthMul)
  // UV を長手方向に割り当て直す
  const uv = geo.attributes.uv
  const pos = geo.attributes.position
  for (let i = 0; i < uv.count; i++) {
    const py = pos.getY(i)
    const u = THREE.MathUtils.clamp((0.42 - py) / 0.88, 0, 1)
    const v = uv.getY(i)
    uv.setXY(i, u, v)
  }
  geo.computeVertexNormals()
  return geo
}

function createFinGeometry(morph: 'salmonid' | 'minnow' | 'sculpin') {
  const shape = new THREE.Shape()
  if (morph === 'sculpin') {
    shape.moveTo(0, 0)
    shape.lineTo(0.12, 0.08)
    shape.quadraticCurveTo(0.05, 0.22, -0.02, 0.28)
    shape.quadraticCurveTo(-0.06, 0.12, -0.05, 0.02)
    shape.lineTo(0, 0)
  } else {
    shape.moveTo(0, 0)
    shape.quadraticCurveTo(0.09, 0.2, 0.02, 0.34)
    shape.quadraticCurveTo(-0.03, 0.2, -0.045, 0.04)
    shape.lineTo(0, 0)
  }
  const geo = new THREE.ShapeGeometry(shape, 12)
  geo.center()
  return geo
}

function createTailGeometry(morph: 'salmonid' | 'minnow' | 'sculpin') {
  const shape = new THREE.Shape()
  if (morph === 'minnow') {
    shape.moveTo(0, 0)
    shape.lineTo(-0.06, 0.14)
    shape.quadraticCurveTo(-0.02, 0, -0.06, -0.14)
    shape.lineTo(0, 0)
  } else if (morph === 'sculpin') {
    shape.moveTo(0, 0)
    shape.lineTo(-0.1, 0.12)
    shape.lineTo(-0.04, 0)
    shape.lineTo(-0.1, -0.12)
    shape.lineTo(0, 0)
  } else {
    // マス型のやや凹んだ尾
    shape.moveTo(0, 0)
    shape.lineTo(-0.1, 0.2)
    shape.quadraticCurveTo(-0.04, 0.05, -0.05, 0)
    shape.quadraticCurveTo(-0.04, -0.05, -0.1, -0.2)
    shape.lineTo(0, 0)
  }
  return new THREE.ShapeGeometry(shape, 14)
}
