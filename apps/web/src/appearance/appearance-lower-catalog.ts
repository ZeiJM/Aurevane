export const LOWER_GARMENTS = [
  'wraps',
  'breeches',
  'wideleg',
  'kilt',
  'apron',
  'divided',
  'greaves',
  'shorts',
] as const

export type LowerGarment = (typeof LOWER_GARMENTS)[number]
export type LowerGarmentChoice = LowerGarment | 'original'

export const LOWER_GARMENT_LABELS: Readonly<Record<LowerGarmentChoice, string>> = {
  original: 'Original trousers',
  wraps: 'Wrapped leggings',
  breeches: 'Cuffed breeches',
  wideleg: 'Wide-leg trousers',
  kilt: 'Pleated kilt',
  apron: 'Asymmetric apron',
  divided: 'Divided overskirt',
  greaves: 'Armored greaves',
  shorts: 'Shorts and tall boots',
}

// Full-length, integrated and legacy painted shells would hide or intersect this layer.
const shortCuts: ReadonlySet<string> = new Set([
  'bolero',
  'brigandine',
  'cuirass',
  'waistcoat',
  'lamellar',
  'doublet',
  'jackcoat',
])

export function supportsLowerGarment(coat: string) {
  return shortCuts.has(coat)
}
