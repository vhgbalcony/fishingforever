import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store'

const waterByTime = {
  morning: new THREE.Color('#4aa8a0'),
  day: new THREE.Color('#2f8f88'),
  evening: new THREE.Color('#3d6f72'),
} as const

const deepByTime = {
  morning: new THREE.Color('#164a4a'),
  day: new THREE.Color('#0f3d3d'),
  evening: new THREE.Color('#1a3338'),
} as const

/**
 * 頂点シェーダで波立つ水面。
 * 古いPCでも動く程度の解像度（64x64）。
 */
export function WaterSurface() {
  const timeOfDay = useGameStore((s) => s.timeOfDay)
  const mesh = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: waterByTime.day.clone() },
      uDeep: { value: deepByTime.day.clone() },
      uOpacity: { value: 0.86 },
    }),
    [],
  )

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
    const c = waterByTime[timeOfDay]
    const d = deepByTime[timeOfDay]
    uniforms.uColor.value.lerp(c, 0.08)
    uniforms.uDeep.value.lerp(d, 0.08)
  })

  return (
    <group>
      <mesh
        ref={mesh}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 1.2]}
        receiveShadow
      >
        <planeGeometry args={[28, 22, 64, 48]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          vertexShader={waterVert}
          fragmentShader={waterFrag}
        />
      </mesh>
      {/* 水の深さ感用の下層 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 1.5]}>
        <planeGeometry args={[28, 20]} />
        <meshStandardMaterial
          color="#0c2e30"
          roughness={1}
          metalness={0}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  )
}

const waterVert = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vWorld;

  void main() {
    vUv = uv;
    vec3 p = position;
    float w1 = sin(p.x * 0.55 + uTime * 1.4) * 0.045;
    float w2 = cos(p.y * 0.7 - uTime * 1.1) * 0.03;
    float w3 = sin((p.x + p.y) * 0.35 + uTime * 0.8) * 0.02;
    vWave = w1 + w2 + w3;
    p.z += vWave;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const waterFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uDeep;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vWorld;

  void main() {
    float fres = pow(1.0 - abs(normalize(cameraPosition - vWorld).y), 2.2);
    float spark = sin(vWorld.x * 3.0 + uTime * 2.0) * sin(vWorld.z * 2.5 - uTime * 1.6);
    spark = smoothstep(0.72, 0.98, spark);

    vec3 col = mix(uDeep, uColor, 0.55 + vWave * 4.0);
    col = mix(col, vec3(0.75, 0.95, 0.95), fres * 0.45);
    col += spark * 0.35;

    float alpha = uOpacity + fres * 0.12 + spark * 0.08;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));
  }
`
