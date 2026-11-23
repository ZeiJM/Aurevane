// These IDs are appended to catalog 1; none may be repurposed once published.
export const WARDROBE_CUTS = [
  'bolero',
  'gown',
  'brigandine',
  'poncho',
  'frock',
  'overalls',
  'cuirass',
  'rainsmock',
  'capote',
  'waistcoat',
  'lamellar',
  'kaftan',
  'doublet',
  'greatcloak',
  'hauberk',
  'splitrobe',
  'jackcoat',
  'mailskirt',
  'tabard',
  'surcoat',
] as const

export type WardrobeCut = (typeof WARDROBE_CUTS)[number]

export const WARDROBE_CUT_LABELS: Record<WardrobeCut, string> = {
  bolero: 'Short bolero',
  gown: 'Bell gown',
  brigandine: 'Studded brigandine',
  poncho: 'Fringed poncho',
  frock: 'Tailed frock coat',
  overalls: 'Belted overalls',
  cuirass: 'Ridge cuirass',
  rainsmock: 'Belted rain smock',
  capote: 'One-shoulder capote',
  waistcoat: 'Layered waistcoat',
  lamellar: 'Lamellar harness',
  kaftan: 'Wrapped kaftan',
  doublet: 'Peplum doublet',
  greatcloak: 'Full greatcloak',
  hauberk: 'Ringmail hauberk',
  splitrobe: 'Split-panel robe',
  jackcoat: 'High-shoulder jack',
  mailskirt: 'Armor and mail skirt',
  tabard: 'Long tabard',
  surcoat: 'Crossed-panel surcoat',
}

export function appearanceClothingConflict({
  coat,
  accessory,
  sleeves,
}: {
  coat: string
  accessory: string
  sleeves: string
}): string | null {
  if (
    accessory === 'satchel' &&
    (coat === 'mantle' || coat === 'poncho' || coat === 'capote' || coat === 'greatcloak')
  ) {
    return 'This shoulder layer covers the satchel strap.'
  }
  if (
    sleeves === 'puffed' &&
    (coat === 'plate' ||
      coat === 'brigandine' ||
      coat === 'cuirass' ||
      coat === 'lamellar' ||
      coat === 'jackcoat')
  ) {
    return 'These shoulder guards need close or split sleeves.'
  }
  return null
}
