import * as THREE from 'three'

export type FishVisualProfile = {
  /** 頭〜尾の相対長 */
  bodyLength: number
  /** 胴の厚み */
  bodyHeight: number
  /** 横幅 */
  bodyWidth: number
  baseColor: string
  bellyColor: string
  accentColor: string
  /** ヤマメ斑点 / アマゴ朱点 など */
  pattern: 'parr' | 'red_spots' | 'rainbow' | 'cyprinid_blue' | 'plain' | 'sculpin'
  /** 体型: マス型 / コイ科細長 / 底生扁平 */
  morph: 'salmonid' | 'minnow' | 'sculpin'
  finDarkness: number
}

const PROFILES: Record<string, FishVisualProfile> = {
  yamame: {
    bodyLength: 1,
    bodyHeight: 1,
    bodyWidth: 0.95,
    baseColor: '#c4a15a',
    bellyColor: '#f0e6c8',
    accentColor: '#4a3420',
    pattern: 'parr',
    morph: 'salmonid',
    finDarkness: 0.35,
  },
  amago: {
    bodyLength: 0.95,
    bodyHeight: 1.02,
    bodyWidth: 0.95,
    baseColor: '#d2a06a',
    bellyColor: '#f5e8d0',
    accentColor: '#a03a28',
    pattern: 'red_spots',
    morph: 'salmonid',
    finDarkness: 0.3,
  },
  nijimasu: {
    bodyLength: 1.15,
    bodyHeight: 1.08,
    bodyWidth: 1,
    baseColor: '#8fbf9a',
    bellyColor: '#eef5e8',
    accentColor: '#e85d8a',
    pattern: 'rainbow',
    morph: 'salmonid',
    finDarkness: 0.25,
  },
  oikawa: {
    bodyLength: 0.75,
    bodyHeight: 0.85,
    bodyWidth: 0.8,
    baseColor: '#6aa8d8',
    bellyColor: '#e8f4ff',
    accentColor: '#ff6b9d',
    pattern: 'cyprinid_blue',
    morph: 'minnow',
    finDarkness: 0.2,
  },
  ugui: {
    bodyLength: 0.9,
    bodyHeight: 0.92,
    bodyWidth: 0.88,
    baseColor: '#9aa6b0',
    bellyColor: '#f2ebe4',
    accentColor: '#e8a0a0',
    pattern: 'plain',
    morph: 'minnow',
    finDarkness: 0.22,
  },
  kajika: {
    bodyLength: 0.65,
    bodyHeight: 0.7,
    bodyWidth: 1.25,
    baseColor: '#6b5b4a',
    bellyColor: '#c4b8a0',
    accentColor: '#3d3530',
    pattern: 'sculpin',
    morph: 'sculpin',
    finDarkness: 0.45,
  },
}

export function getFishProfile(speciesId: string): FishVisualProfile {
  return PROFILES[speciesId] ?? PROFILES.yamame!
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

function noise2(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return n - Math.floor(n)
}

/** 種の特徴を焼き込んだディフューズ＋ラフネス相当のキャンバス */
export function createFishTexture(speciesId: string): {
  map: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
  profile: FishVisualProfile
} {
  const profile = getFishProfile(speciesId)
  const w = 512
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const base = hexToRgb(profile.baseColor)
  const belly = hexToRgb(profile.bellyColor)
  const accent = hexToRgb(profile.accentColor)

  // 縦グラデ: 背中→腹
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1)
    // 腹は下側
    const bellyT = Math.pow(Math.max(0, (t - 0.45) / 0.55), 1.2)
    const col = mix(base, belly, bellyT)
    // 微細なうろこノイズ
    for (let x = 0; x < w; x++) {
      const n = noise2(x * 0.08, y * 0.12) * 18 - 9
      const scale =
        Math.sin(x * 0.35 + y * 0.2) * Math.sin(x * 0.15 - y * 0.4) * 8
      const r = Math.min(255, Math.max(0, col[0] + n + scale))
      const g = Math.min(255, Math.max(0, col[1] + n + scale * 0.8))
      const b = Math.min(255, Math.max(0, col[2] + n * 0.7))
      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  // 側線
  ctx.strokeStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},0.35)`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(w * 0.12, h * 0.52)
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    const x = w * (0.12 + t * 0.7)
    const y = h * (0.52 + Math.sin(t * Math.PI * 2) * 0.02)
    ctx.lineTo(x, y)
  }
  ctx.stroke()

  if (profile.pattern === 'parr') {
    // ヤマメ: パーマーク（側帯の縦楕円暗斑）＋小黒点
    for (let i = 0; i < 9; i++) {
      const x = w * (0.18 + i * 0.07)
      const y = h * 0.48
      const grd = ctx.createRadialGradient(x, y, 2, x, y, 14)
      grd.addColorStop(0, 'rgba(40,28,16,0.55)')
      grd.addColorStop(1, 'rgba(40,28,16,0)')
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.ellipse(x, y, 10, 16, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(20,15,10,0.45)'
      ctx.beginPath()
      ctx.arc(
        w * (0.15 + noise2(i, 1) * 0.65),
        h * (0.25 + noise2(i, 2) * 0.35),
        1.2 + noise2(i, 3) * 1.5,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }

  if (profile.pattern === 'red_spots') {
    // アマゴ: 朱点＋パーマーク
    for (let i = 0; i < 8; i++) {
      const x = w * (0.2 + i * 0.07)
      ctx.fillStyle = 'rgba(50,35,20,0.4)'
      ctx.beginPath()
      ctx.ellipse(x, h * 0.48, 9, 14, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 28; i++) {
      const x = w * (0.18 + noise2(i, 4) * 0.6)
      const y = h * (0.3 + noise2(i, 5) * 0.35)
      ctx.fillStyle = `rgba(${accent[0]},${accent[1] * 0.5},${accent[2] * 0.4},0.85)`
      ctx.beginPath()
      ctx.arc(x, y, 2.5 + noise2(i, 6) * 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,200,160,0.35)'
      ctx.beginPath()
      ctx.arc(x - 0.5, y - 0.5, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (profile.pattern === 'rainbow') {
    // ニジマス: 虹色側帯＋黒点
    const bandY = h * 0.5
    for (let x = 0; x < w; x++) {
      const t = x / w
      const hueShift = Math.sin(t * Math.PI) 
      const r = 200 + hueShift * 40
      const g = 80 + Math.sin(t * 6) * 30
      const b = 140 + Math.cos(t * 4) * 50
      ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},0.45)`
      ctx.fillRect(x, bandY - 10, 1, 22)
    }
    // ピンクの縦帯強調
    const grd = ctx.createLinearGradient(0, bandY - 8, 0, bandY + 12)
    grd.addColorStop(0, 'rgba(255,100,150,0)')
    grd.addColorStop(0.5, 'rgba(232,93,138,0.55)')
    grd.addColorStop(1, 'rgba(255,100,150,0)')
    ctx.fillStyle = grd
    ctx.fillRect(w * 0.15, bandY - 10, w * 0.65, 24)

    for (let i = 0; i < 55; i++) {
      ctx.fillStyle = 'rgba(15,15,15,0.5)'
      ctx.beginPath()
      ctx.arc(
        w * (0.12 + noise2(i, 7) * 0.7),
        h * (0.22 + noise2(i, 8) * 0.45),
        1.5 + noise2(i, 9) * 2,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }

  if (profile.pattern === 'cyprinid_blue') {
    // オイカワ: 婚姻色の青と赤ライン
    ctx.fillStyle = 'rgba(40,120,200,0.35)'
    ctx.fillRect(0, h * 0.25, w, h * 0.35)
    ctx.strokeStyle = 'rgba(255,90,140,0.65)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(w * 0.15, h * 0.62)
    ctx.lineTo(w * 0.85, h * 0.58)
    ctx.stroke()
    // 縦帯
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(30,60,100,0.2)'
      ctx.fillRect(w * (0.25 + i * 0.08), h * 0.3, 6, h * 0.3)
    }
  }

  if (profile.pattern === 'plain') {
    // ウグイ: 控えめな縦条
    ctx.fillStyle = 'rgba(60,70,80,0.18)'
    ctx.fillRect(0, h * 0.42, w, h * 0.12)
    ctx.fillStyle = 'rgba(220,140,140,0.2)'
    ctx.fillRect(0, h * 0.55, w, h * 0.08)
  }

  if (profile.pattern === 'sculpin') {
    // カジカ: まだら・底生っぽい斑
    for (let i = 0; i < 35; i++) {
      const x = w * noise2(i, 10)
      const y = h * (0.2 + noise2(i, 11) * 0.55)
      const rw = 12 + noise2(i, 12) * 20
      const rh = 8 + noise2(i, 13) * 14
      ctx.fillStyle = `rgba(${30 + noise2(i,14)*40},${25+noise2(i,15)*30},${18},0.4)`
      ctx.beginPath()
      ctx.ellipse(x, y, rw, rh, noise2(i, 16), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 頭側をわずかに暗く
  const headG = ctx.createLinearGradient(0, 0, w * 0.25, 0)
  headG.addColorStop(0, 'rgba(0,0,0,0.15)')
  headG.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = headG
  ctx.fillRect(0, 0, w * 0.25, h)

  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.ClampToEdgeWrapping
  map.wrapT = THREE.ClampToEdgeWrapping
  map.anisotropy = 8

  // 簡易ラフネス: うろこで変化
  const rCanvas = document.createElement('canvas')
  rCanvas.width = 256
  rCanvas.height = 128
  const rctx = rCanvas.getContext('2d')!
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 256; x++) {
      const v = 140 + noise2(x * 0.5, y * 0.5) * 80
      rctx.fillStyle = `rgb(${v|0},${v|0},${v|0})`
      rctx.fillRect(x, y, 1, 1)
    }
  }
  const roughnessMap = new THREE.CanvasTexture(rCanvas)
  roughnessMap.wrapS = THREE.RepeatWrapping
  roughnessMap.wrapT = THREE.RepeatWrapping

  return { map, roughnessMap, profile }
}
