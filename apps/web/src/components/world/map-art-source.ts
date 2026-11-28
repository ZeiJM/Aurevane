import animeAssets from './map-anime-assets.json'

const base = '/media/art/world/runtime/'
const anime = new Set(animeAssets)

/** Use the repainted atlas with the same cells and anchors as its original. */
export function worldMapArtSource(sheet: string) {
  return `${base}${anime.has(sheet) ? 'anime/' : ''}${sheet}`
}
