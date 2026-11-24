export const STUDIO_COLORS = {
  parchment: ['Warm Parchment', '#deccaa', '#aa906e', '#695849'],
  midnight: ['Midnight Blue', '#536879', '#2c4157', '#182737'],
  pinegreen: ['Forest Green', '#849580', '#496552', '#2b423a'],
  plumstudio: ['Dusky Plum', '#9d7f95', '#70556e', '#463544'],
  terracotta: ['Terracotta', '#cf9a7a', '#986c55', '#60483d'],
  pearl: ['Pearl Grey', '#dad7ce', '#a9a8a2', '#747a77'],
  garnetstudio: ['Garnet', '#ad8180', '#80565b', '#523a45'],
  tealstudio: ['Deep Teal', '#80a2a1', '#52777b', '#314e57'],
  amberstudio: ['Old Gold', '#d5b47b', '#a88953', '#655b42'],
  lavender: ['Lavender Mist', '#c2b7ce', '#918799', '#625d71'],
} as const
export type StudioColor = keyof typeof STUDIO_COLORS
export function studioColor(id: string) {
  return Object.hasOwn(STUDIO_COLORS, id) ? STUDIO_COLORS[id as StudioColor] : null
}
const studioLabels = Object.fromEntries(
  Object.entries(STUDIO_COLORS).map(([id, [name]]) => [id, name]),
) as Record<StudioColor, string>

export const APPEARANCE_BACKDROP_GROUPS = {
  'Studio colors': studioLabels,
  'Cosmic and Void': {
    astral: 'Cosmic Horizon',
    nebula: 'The Fallen Firmament',
    starvault: 'Starvault Observatory',
    lunar: 'Lunar Archive',
    orchard: 'The Unremembered Orchard',
    cinder: 'The Ruined Sun',
    meridian: 'The Drowned Meridian',
    silverlake: 'Silver Lake',
    violet: 'The Violet Recess',
    shattered: 'The Shattered Horizon',
    hourless: 'The Hourless Waste',
    moongateway: 'Moonlit Gateway',
    prestigesanctum: 'Crescent Sanctum',
  },
  'Wilds and Roads': {
    starfall: 'Starfall Highlands',
    verdant: 'Verdant Expanse',
    frost: 'Frostmere',
    ember: 'Emberreach',
    hollow: 'Hollow Coast',
    glasswind: 'Glasswind Desert',
    umbral: 'Umbral March',
    gildroot: 'Gildroot Grove',
    vigil: 'The Shadows’ Vigil',
    coastroad: 'Coastal Road',
    crownroad: 'Crown Road',
    easternmarch: 'Eastern March Road',
    emberroad: 'Ember Road',
    embervalley: 'Emberreach Valley',
    frostvalley: 'Frostmere Valley',
    glasswindoasis: 'Glasswind Oasis',
    highlandroad: 'Highland Road',
    hollowruins: 'Hollow Coast Ruins',
    northernpass: 'Northern Pass',
    oldcoast: 'Old Coast Road',
    caravan: 'Southern Caravan Road',
    starfallbasin: 'Starfall Basin',
    umbralroad: 'Umbral March Road',
    verdantvale: 'Verdant Vale',
  },
  'Settlements and Interiors': {
    crown: 'Aureth Crown',
    crownbasin: 'Crown Basin',
    asterwake: 'Asterwake Harbor',
    lanternharbor: 'Lantern Harbor',
    steps: 'The Thousand Steps',
    haven: 'The Haven',
    wayfarergate: 'Wayfarer’s Gate',
    citadel: 'Citadel at Dusk',
    enchantedarena: 'Enchanted Arena',
    lanternhall: 'Lantern Hall',
    archive: 'The Archive',
    battlehall: 'Battle Hall',
    cloister: 'Training Cloister',
  },
} as const

export const APPEARANCE_BACKDROPS = {
  ...studioLabels,
  ...APPEARANCE_BACKDROP_GROUPS['Cosmic and Void'],
  ...APPEARANCE_BACKDROP_GROUPS['Wilds and Roads'],
  ...APPEARANCE_BACKDROP_GROUPS['Settlements and Interiors'],
}

export type AppearanceBackdrop = Exclude<keyof typeof APPEARANCE_BACKDROPS, StudioColor>
