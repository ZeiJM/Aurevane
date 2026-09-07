import { AETHERIST_DARK_FANTASY_ARTWORK_PART_1 } from './aetherist-dark-fantasy-artwork-1'
import { AETHERIST_DARK_FANTASY_ARTWORK_PART_2 } from './aetherist-dark-fantasy-artwork-2'
import { AETHERIST_DARK_FANTASY_ARTWORK_PART_3 } from './aetherist-dark-fantasy-artwork-3'
import { FARSTRIDER_DARK_FANTASY_ARTWORK_PART_1 } from './farstrider-dark-fantasy-artwork-1'
import { FARSTRIDER_DARK_FANTASY_ARTWORK_PART_2 } from './farstrider-dark-fantasy-artwork-2'
import { FARSTRIDER_DARK_FANTASY_ARTWORK_PART_3 } from './farstrider-dark-fantasy-artwork-3'
import { LIFEBINDER_DARK_FANTASY_ARTWORK } from './lifebinder-dark-fantasy-artwork'
import { RESONANCE_DARK_FANTASY_ARTWORK_PART_1 } from './resonance-dark-fantasy-artwork-1'
import { RESONANCE_DARK_FANTASY_ARTWORK_PART_2 } from './resonance-dark-fantasy-artwork-2'
import { RESONANCE_DARK_FANTASY_ARTWORK_PART_3 } from './resonance-dark-fantasy-artwork-3'
import { SHADEHAND_DARK_FANTASY_ARTWORK_PART_1 } from './shadehand-dark-fantasy-artwork-1'
import { SHADEHAND_DARK_FANTASY_ARTWORK_PART_2 } from './shadehand-dark-fantasy-artwork-2'
import { SHADEHAND_DARK_FANTASY_ARTWORK_PART_3 } from './shadehand-dark-fantasy-artwork-3'

export const DARK_FANTASY_COMBAT_ARTWORK = {
  ...LIFEBINDER_DARK_FANTASY_ARTWORK,
  ...FARSTRIDER_DARK_FANTASY_ARTWORK_PART_1,
  ...FARSTRIDER_DARK_FANTASY_ARTWORK_PART_2,
  ...FARSTRIDER_DARK_FANTASY_ARTWORK_PART_3,
  ...AETHERIST_DARK_FANTASY_ARTWORK_PART_1,
  ...AETHERIST_DARK_FANTASY_ARTWORK_PART_2,
  ...AETHERIST_DARK_FANTASY_ARTWORK_PART_3,
  ...SHADEHAND_DARK_FANTASY_ARTWORK_PART_1,
  ...SHADEHAND_DARK_FANTASY_ARTWORK_PART_2,
  ...SHADEHAND_DARK_FANTASY_ARTWORK_PART_3,
  ...RESONANCE_DARK_FANTASY_ARTWORK_PART_1,
  ...RESONANCE_DARK_FANTASY_ARTWORK_PART_2,
  ...RESONANCE_DARK_FANTASY_ARTWORK_PART_3,
} as const

export function darkFantasyCombatArtwork(artworkId: string): string | null {
  return DARK_FANTASY_COMBAT_ARTWORK[artworkId as keyof typeof DARK_FANTASY_COMBAT_ARTWORK] ?? null
}
