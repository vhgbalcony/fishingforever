import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { playerPose } from '../playerPose'
import { useGameStore } from '../store'
import { clampWalk, MAP } from '../world'

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
}

function bindKeys() {
  const down = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'w' || k === 'arrowup') keys.w = true
    if (k === 'a' || k === 'arrowleft') keys.a = true
    if (k === 's' || k === 'arrowdown') keys.s = true
    if (k === 'd' || k === 'arrowright') keys.d = true
  }
  const up = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'w' || k === 'arrowup') keys.w = false
    if (k === 'a' || k === 'arrowleft') keys.a = false
    if (k === 's' || k === 'arrowdown') keys.s = false
    if (k === 'd' || k === 'arrowright') keys.d = false
  }
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
  }
}

/**
 * 三人称のプレイヤー。
 * WASD: カメラ前方基準で移動（簡易）。
 * 見た目は「アウトドア装備の釣り人」スタイルヒューマノイド。
 */
export function Player() {
  const group = useRef<THREE.Group>(null)
  const bob = useRef(0)
  const phase = useGameStore((s) => s.phase)
  const setPlayerPose = useGameStore((s) => s.setPlayerPose)

  useEffect(() => bindKeys(), [])

  useFrame((state, dt) => {
    const canMove = phase === 'idle' || phase === 'waiting_float'
    let x = playerPose.x
    let z = playerPose.z
    let yaw = playerPose.yaw
    let moving = false

    if (canMove && group.current) {
      const cam = state.camera
      const forward = new THREE.Vector3()
      cam.getWorldDirection(forward)
      forward.y = 0
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1)
      forward.normalize()
      const right = new THREE.Vector3()
        .crossVectors(forward, new THREE.Vector3(0, 1, 0))
        .normalize()

      const input = new THREE.Vector3()
      if (keys.w) input.add(forward)
      if (keys.s) input.sub(forward)
      if (keys.a) input.sub(right)
      if (keys.d) input.add(right)

      if (input.lengthSq() > 0) {
        input.normalize()
        x += input.x * MAP.playerSpeed * dt
        z += input.z * MAP.playerSpeed * dt
        const clamped = clampWalk(x, z)
        x = clamped.x
        z = clamped.z
        yaw = Math.atan2(input.x, input.z)
        moving = true
      }

      bob.current = moving ? bob.current + dt * 10 : bob.current * 0.9
      setPlayerPose(x, z, yaw)
    }

    if (group.current) {
      const walkY = moving ? Math.abs(Math.sin(bob.current)) * 0.04 : 0
      group.current.position.set(playerPose.x, walkY, playerPose.z)
      const targetQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        playerPose.yaw,
      )
      group.current.quaternion.slerp(targetQuat, 1 - Math.pow(0.001, dt))
    }
  })

  if (phase === 'title') return null

  return (
    <group ref={group} position={[playerPose.x, 0, playerPose.z]}>
      {/* 影受け用 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[0.4, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} />
      </mesh>

      {/* 脚 */}
      <mesh position={[-0.1, 0.35, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.35, 4, 8]} />
        <meshStandardMaterial color="#2c3e2e" roughness={0.85} />
      </mesh>
      <mesh position={[0.1, 0.35, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.35, 4, 8]} />
        <meshStandardMaterial color="#2c3e2e" roughness={0.85} />
      </mesh>
      {/* 靴 */}
      <mesh position={[-0.1, 0.08, 0.04]} castShadow>
        <boxGeometry args={[0.12, 0.08, 0.22]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>
      <mesh position={[0.1, 0.08, 0.04]} castShadow>
        <boxGeometry args={[0.12, 0.08, 0.22]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>

      {/* 胴体（ベスト） */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.35, 6, 12]} />
        <meshStandardMaterial color="#3d5c45" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.9, 0.12]} castShadow>
        <boxGeometry args={[0.32, 0.35, 0.08]} />
        <meshStandardMaterial color="#c45c26" roughness={0.65} />
      </mesh>

      {/* 頭 */}
      <mesh position={[0, 1.28, 0]} castShadow>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshStandardMaterial color="#e0b090" roughness={0.55} />
      </mesh>
      {/* 帽子 */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.16, 0.1, 16]} />
        <meshStandardMaterial color="#5a4030" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 20]} />
        <meshStandardMaterial color="#5a4030" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* 腕＋竿 */}
      <mesh position={[0.22, 0.95, 0.05]} rotation={[0.3, 0, -0.4]} castShadow>
        <capsuleGeometry args={[0.05, 0.28, 4, 8]} />
        <meshStandardMaterial color="#e0b090" roughness={0.55} />
      </mesh>
      <mesh position={[-0.2, 0.95, 0.02]} rotation={[0.2, 0, 0.35]} castShadow>
        <capsuleGeometry args={[0.05, 0.28, 4, 8]} />
        <meshStandardMaterial color="#e0b090" roughness={0.55} />
      </mesh>
      {/* 釣竿 */}
      <group position={[0.28, 1.05, 0.15]} rotation={[-0.55, 0.2, -0.15]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.012, 0.02, 1.6, 8]} />
          <meshStandardMaterial color="#2a1810" roughness={0.5} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.006, 0.01, 0.5, 6]} />
          <meshStandardMaterial color="#d8d0c0" roughness={0.4} metalness={0.2} />
        </mesh>
        {/* リール */}
        <mesh position={[0.04, -0.35, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.04, 12]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}
