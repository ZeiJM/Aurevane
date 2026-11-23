import { PAINTED_ACTORS } from './appearance-painted-catalog.generated'
import { PAINTED_FIELD_SKIN_MASKS } from './appearance-painted-masks.generated'
import { PINE_SCOUT_FIELD_SKIN, PINE_SCOUT_SPRITE } from './appearance-painted-player.generated'

export const PAINTED_PLAYER_SPRITES = { ...PAINTED_ACTORS, pinescout: PINE_SCOUT_SPRITE }
export const PAINTED_PLAYER_FIELD_SKIN_MASKS = {
  ...PAINTED_FIELD_SKIN_MASKS,
  pinescout: PINE_SCOUT_FIELD_SKIN,
}
