/** 2.5Dイラストアセットのパス */

export const ART = {
  bgCamp: '/art/bg-camp.jpg',
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
  } as Record<string, string>,
} as const

export function fishArt(speciesId: string): string {
  return ART.fish[speciesId] ?? ART.fish.yamame
}
