import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store'

const shallowByTime = {
  morning: new THREE.Color('#3db8a8'),
  day: new THREE.Color('#1f8f88'),
  evening: new THREE.Color('#2d6a6e'),
} as const

const deepByTime = {
  morning: new THREE.Color('#0a3d42'),
  day: new THREE.Color('#062e32'),
  evening: new THREE.Color('#0c2830'),
} as const

/**
 * 深度グラデ＋波＋スペキュラの清流水面。
 * 物理屈折まではやらないが、おもちゃ感を抑えたリアル寄り。
 */
export function WaterSurface() {
  const timeOfDay = useGameStore((s) => s.timeOfDay)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uShallow: { value: shallowByTime.day.clone() },
      uDeep: { value: deepByTime.day.clone() },
      uSun: { value: new THREE.Vector3(0.4, 0.85, 0.25) },
    }),
    [],
  )

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
    uniforms.uShallow.value.lerp(shallowByTime[timeOfDay], 0.06)
    uniforms.uDeep.value.lerp(deepByTime[timeOfDay], 0.06)
    if (timeOfDay === 'morning') uniforms.uSun.value.set(0.6, 0.5, -0.4).normalize()
    else if (timeOfDay === 'evening') uniforms.uSun.value.set(-0.7, 0.25, -0.2).normalize()
    else uniforms.uSun.value.set(0.3, 0.9, 0.2).normalize()
  })

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 2.5]}
        receiveShadow
      >
        <planeGeometry args={[30, 24, 96, 72]} />
        <shaderMaterial
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          vertexShader={vert}
          fragmentShader={frag}
        />
      </mesh>
      {/* 深みの床色 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 2.8]}>
        <planeGeometry args={[30, 22]} />
        <meshStandardMaterial color="#071f22" roughness={1} />
      </mesh>
      {/* 水際フォーム帯 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, -1.7]}>
        <planeGeometry args={[28, 1.4, 32, 4]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          uniforms={{ uTime: uniforms.uTime }}
          vertexShader={foamVert}
          fragmentShader={foamFrag}
        />
      </mesh>
    </group>
  )
}

const vert = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vWave;

  void main() {
    vUv = uv;
    vec3 p = position;
    float w1 = sin(p.x * 0.45 + uTime * 1.25) * 0.04;
    float w2 = cos(p.y * 0.65 - uTime * 0.95) * 0.028;
    float w3 = sin((p.x * 1.3 + p.y * 0.9) + uTime * 1.7) * 0.012;
    float w4 = cos(p.x * 2.4 - p.y * 1.8 + uTime * 2.1) * 0.006;
    vWave = w1 + w2 + w3 + w4;
    p.z += vWave;

    // 簡易法線
    float dx = cos(p.x * 0.45 + uTime * 1.25) * 0.45 * 0.04
             + cos((p.x * 1.3 + p.y * 0.9) + uTime * 1.7) * 1.3 * 0.012;
    float dy = -sin(p.y * 0.65 - uTime * 0.95) * 0.65 * 0.028
             + cos((p.x * 1.3 + p.y * 0.9) + uTime * 1.7) * 0.9 * 0.012;
    vec3 n = normalize(vec3(-dx, -dy, 1.0));

    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const frag = /* glsl */ `
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uSun;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vWave;

  void main() {
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 N = normalize(vNormalW);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    // 画面奥＝深い（vUv.y が水の奥）
    float depth = smoothstep(0.15, 0.85, vUv.y);
    vec3 col = mix(uShallow, uDeep, depth * 0.85 + vWave * 2.0);

    // 太陽スペキュラ
    vec3 L = normalize(uSun);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 180.0);
    float spec2 = pow(max(dot(N, H), 0.0), 40.0) * 0.15;

    // きらめき
    float spark = sin(vWorld.x * 4.0 + uTime * 2.4) * sin(vWorld.z * 3.2 - uTime * 1.8);
    spark = smoothstep(0.78, 0.98, spark);

    col = mix(col, vec3(0.75, 0.92, 0.95), fres * 0.55);
    col += spec * vec3(1.0, 0.98, 0.9) * 0.85;
    col += spec2 * uShallow;
    col += spark * 0.4;

    float alpha = 0.78 + fres * 0.18 + spark * 0.06;
    gl_FragColor = vec4(col, clamp(alpha, 0.55, 0.94));
  }
`

const foamVert = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(p.x * 2.0 + uTime * 2.0) * 0.02;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const foamFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float edge = smoothstep(0.0, 0.45, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
    float n = sin(vUv.x * 40.0 + uTime * 3.0) * 0.5 + 0.5;
    float a = edge * (0.15 + n * 0.25);
    gl_FragColor = vec4(0.9, 0.95, 0.98, a);
  }
`
