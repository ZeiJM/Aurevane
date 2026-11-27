import type { PaintedPlayerLook } from './appearance-painted-wardrobe'

type Palette = readonly [
  cloth: PaintedPlayerLook['clothColor'],
  gear: PaintedPlayerLook['gearColor'],
  accent: NonNullable<PaintedPlayerLook['hairAccent']>,
  eye: PaintedPlayerLook['eyeColor'],
  otherEye?: NonNullable<PaintedPlayerLook['secondEye']>,
]

type Ensemble = Readonly<{
  title: string
  group: string
  hair: readonly PaintedPlayerLook['hairstyle'][]
  coat: PaintedPlayerLook['outerwear']
  gear: PaintedPlayerLook['gear']
  setting: PaintedPlayerLook['backdrop']
  palettes: readonly [Palette, Palette, Palette]
  scar?: PaintedPlayerLook['scar']
  headwear?: PaintedPlayerLook['headwear']
  facewear?: PaintedPlayerLook['facewear']
  build?: PaintedPlayerLook['bodyFrame']
}>

export const appearanceEnsembles: readonly Ensemble[] = [
  {
    title: 'Shieldline Bastion',
    group: 'Discipline-inspired',
    hair: ['crop', 'tightbun', 'braid', 'sidepart'],
    coat: 'brigandine',
    gear: 'sword',
    setting: 'steps',
    scar: 'jaw',
    build: 'strong',
    palettes: [
      ['midnight', 'gold', 'ash', 'gray'],
      ['oxblood', 'pewter', 'copper', 'amber'],
      ['cedar', 'walnut', 'honey', 'green'],
    ],
  },
  {
    title: 'Raven Nightveil',
    group: 'Discipline-inspired',
    hair: ['tightbun', 'sidepart', 'crop', 'braid'],
    coat: 'hooded',
    gear: 'rope',
    setting: 'umbral',
    scar: 'lip',
    build: 'lean',
    palettes: [
      ['ink', 'pewter', 'silver', 'violet'],
      ['wine', 'walnut', 'copper', 'rose'],
      ['lagoon', 'silver', 'teal', 'jade'],
    ],
  },
  {
    title: 'Tempest Stormsinger',
    group: 'Discipline-inspired',
    hair: ['quiff', 'curlsweep', 'lowpony', 'ropebraid'],
    coat: 'hawkmantle',
    gear: 'journal',
    setting: 'starfall',
    palettes: [
      ['denim', 'silver', 'silver', 'blue', 'gold'],
      ['violet', 'pewter', 'lilac', 'violet', 'cobalt'],
      ['lagoon', 'gold', 'teal', 'jade', 'amber'],
    ],
  },
  {
    title: 'Lattice Chronist',
    group: 'Discipline-inspired',
    hair: ['sidepart', 'crown', 'tightbun', 'crop'],
    coat: 'brocade',
    gear: 'girdle',
    headwear: 'crescentcirclet',
    setting: 'astral',
    palettes: [
      ['ivory', 'gold', 'platinum', 'gold', 'violet'],
      ['plum', 'silver', 'lilac', 'rose', 'gray'],
      ['midnight', 'pewter', 'silver', 'cobalt', 'gold'],
    ],
  },
  {
    title: 'Cinder Vanguard',
    group: 'Guards and riders',
    hair: ['crop', 'warrior', 'coronet', 'coils'],
    coat: 'brigandine',
    gear: 'sword',
    setting: 'ember',
    scar: 'brow',
    palettes: [
      ['rust', 'walnut', 'copper', 'amber'],
      ['denim', 'pewter', 'ash', 'gray'],
      ['moss', 'leather', 'honey', 'green'],
    ],
  },
  {
    title: 'Silverlake Warden',
    group: 'Guards and riders',
    hair: ['sidepart', 'loosebraid', 'quiff', 'tightbun'],
    coat: 'brigandine',
    gear: 'sword',
    setting: 'silverlake',
    palettes: [
      ['lagoon', 'silver', 'silver', 'jade', 'gold'],
      ['oxblood', 'gold', 'honey', 'amber', 'violet'],
      ['midnight', 'pewter', 'ash', 'blue', 'hazel'],
    ],
  },
  {
    title: 'Highpass Rider',
    group: 'Guards and riders',
    hair: ['shag', 'lowpony', 'curlsweep', 'ropebraid'],
    coat: 'quilted',
    gear: 'rope',
    setting: 'northernpass',
    scar: 'temple',
    palettes: [
      ['clay', 'leather', 'ginger', 'hazel'],
      ['cedar', 'gold', 'silver', 'blue'],
      ['pewter', 'walnut', 'ash', 'green'],
    ],
  },
  {
    title: 'Crownroad Lancer',
    group: 'Guards and riders',
    hair: ['feather', 'halo', 'pony', 'sidepart'],
    coat: 'hawkmantle',
    gear: 'sword',
    setting: 'crownroad',
    scar: 'cheek',
    palettes: [
      ['garnet', 'ochre', 'copper', 'brown'],
      ['denim', 'pewter', 'flax', 'cobalt'],
      ['olive', 'leather', 'ash', 'hazel'],
    ],
  },
  {
    title: 'Deepwater Cartographer',
    group: 'Scouts and travelers',
    hair: ['coils', 'sidepart', 'bun', 'lowpony'],
    coat: 'compass',
    gear: 'mapcase',
    setting: 'asterwake',
    palettes: [
      ['lagoon', 'gold', 'teal', 'blue', 'amber'],
      ['midnight', 'pewter', 'silver', 'violet', 'jade'],
      ['wine', 'ochre', 'rosewood', 'rose', 'gold'],
    ],
  },
  {
    title: 'Gildroot Pathfinder',
    group: 'Scouts and travelers',
    hair: ['longbraid', 'curls', 'halo', 'quiff'],
    coat: 'pine',
    gear: 'journal',
    setting: 'gildroot',
    palettes: [
      ['cedar', 'leather', 'honey', 'green'],
      ['ochre', 'walnut', 'ginger', 'gold'],
      ['fern', 'linen', 'ash', 'hazel'],
    ],
  },
  {
    title: 'Glasswind Runner',
    group: 'Scouts and travelers',
    hair: ['crop', 'sidepony', 'tightbun', 'doublenot'],
    coat: 'scarf',
    gear: 'rope',
    setting: 'glasswind',
    scar: 'bridge',
    palettes: [
      ['straw', 'walnut', 'flax', 'amber'],
      ['lagoon', 'leather', 'teal', 'jade'],
      ['clay', 'linen', 'copper', 'brown'],
    ],
  },
  {
    title: 'Winterpass Outrider',
    group: 'Scouts and travelers',
    hair: ['layers', 'fishtail', 'curlsweep', 'topknot'],
    coat: 'shearling',
    gear: 'bedroll',
    setting: 'frost',
    palettes: [
      ['rain', 'pewter', 'silver', 'gray'],
      ['rust', 'walnut', 'honey', 'amber'],
      ['cream', 'leather', 'ash', 'violet'],
    ],
  },
  {
    title: 'Lunar Archivist',
    group: 'Scholars and artisans',
    hair: ['coronet', 'curtain', 'loosebun', 'sidepart'],
    coat: 'brocade',
    gear: 'girdle',
    setting: 'lunar',
    palettes: [
      ['plum', 'silver', 'lilac', 'violet', 'rose'],
      ['midnight', 'gold', 'platinum', 'gray', 'blue'],
      ['cedar', 'pewter', 'ash', 'jade', 'hazel'],
    ],
  },
  {
    title: 'Lanternhall Artificer',
    group: 'Scholars and artisans',
    hair: ['sidepart', 'tightbun', 'crop', 'crown'],
    coat: 'quilted',
    gear: 'utility',
    facewear: 'scholarlenses',
    setting: 'lanternhall',
    scar: 'browarch',
    palettes: [
      ['clay', 'ochre', 'copper', 'gold'],
      ['pewter', 'walnut', 'ash', 'blue'],
      ['olive', 'gold', 'honey', 'hazel'],
    ],
  },
  {
    title: 'Orchard Apothecary',
    group: 'Scholars and artisans',
    hair: ['ringlets', 'bun', 'ropebraid', 'loosequiff'],
    coat: 'hooded',
    gear: 'potions',
    setting: 'orchard',
    palettes: [
      ['wine', 'shell', 'rosewood', 'green'],
      ['moss', 'linen', 'honey', 'hazel'],
      ['violet', 'pewter', 'lilac', 'violet'],
    ],
  },
  {
    title: 'Starvault Astrologer',
    group: 'Scholars and artisans',
    hair: ['softwave', 'pageboy', 'brushed', 'loosebraid'],
    coat: 'brocade',
    gear: 'journal',
    setting: 'starvault',
    scar: 'cheekstar',
    palettes: [
      ['ink', 'silver', 'silver', 'cobalt', 'violet'],
      ['ivory', 'gold', 'honey', 'gold', 'gray'],
      ['violet', 'pewter', 'ocean', 'rose', 'blue'],
    ],
  },
]
