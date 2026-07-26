/** 2.5D アートパック（イラスト / ピクセル） */

export type ArtStyle = 'illustration' | 'pixel'

export type MapPanelId = 'upper' | 'middle' | 'lower'

export type ArtPack = {
  /** 縦連結マップパネル（上→中→下） */
  panels: Record<MapPanelId, string>
  /** 互換: 中流パネル */
  bgCamp: string
  bgUnderwater: string
  player: string
  bobber: string
  fish: Record<string, string>
}

const ILLUSTRATION: ArtPack = {
  panels: {
    upper: '/art/bg-panel-upper.jpg',
    middle: '/art/bg-panel-middle.jpg',
    lower: '/art/bg-panel-lower.jpg',
  },
  bgCamp: '/art/bg-panel-middle.jpg',
  bgUnderwater: '/art/bg-underwater.jpg',
  player: '/art/player.png',
  bobber: '/art/bobber.png',
  fish: {
    yamame: '/art/fish-yamame.png',
    amago: '/art/fish-amago.png',
    nijimasu: '/art/fish-nijimasu.png',
    oikawa: '/art/fish-oikawa.png',
    ugui: '/art/fish-ugui.png',
    kajika: '/art/fish-kajika.png',
  },
}

/** ピクセルはスプライトのみ差し替え。マップは縦パネルイラストを共用（探索体験優先） */
const PIXEL: ArtPack = {
  panels: {
    upper: '/art/bg-panel-upper.jpg',
    middle: '/art/bg-panel-middle.jpg',
    lower: '/art/bg-panel-lower.jpg',
  },
  bgCamp: '/art/bg-panel-middle.jpg',
  bgUnderwater: '/art/pixel/bg-underwater.jpg',
  player: '/art/pixel/player.png',
  bobber: '/art/pixel/bobber.png',
  fish: {
    yamame: '/art/pixel/fish-yamame.png',
    amago: '/art/pixel/fish-amago.png',
    nijimasu: '/art/pixel/fish-nijimasu.png',
    oikawa: '/art/pixel/fish-oikawa.png',
    ugui: '/art/pixel/fish-ugui.png',
    kajika: '/art/pixel/fish-kajika.png',
  },
}

export const ART_PACKS: Record<ArtStyle, ArtPack> = {
  illustration: ILLUSTRATION,
  pixel: PIXEL,
}

/** @deprecated 互換用 — getArt(style) を使う */
export const ART = ILLUSTRATION

export const PANEL_ORDER: MapPanelId[] = ['upper', 'middle', 'lower']

export function getArt(style: ArtStyle): ArtPack {
  return ART_PACKS[style] ?? ILLUSTRATION
}

export function fishArt(speciesId: string, style: ArtStyle = 'illustration'): string {
  const pack = getArt(style)
  return pack.fish[speciesId] ?? pack.fish.yamame
}

export const ART_STYLE_LABEL: Record<ArtStyle, string> = {
  illustration: 'イラスト',
  pixel: 'ピクセル',
}
