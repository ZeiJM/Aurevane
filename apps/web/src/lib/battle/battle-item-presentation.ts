import type { BattleBasicActionPresentation } from './battle-basic-actions'
import type { ItemPresentation } from '../items/item-presentation'
import type { EquipmentPosition } from '@aurevane/game-core/character/item-inventory'
import type { EquipmentActionRole } from '@aurevane/game-core/combat/combat-equipment'

/** Owner-only frozen presentation; no stack identity, acquisition data or private usage rows. */
export interface BattleItemPresentation extends BattleBasicActionPresentation {
  readonly role: EquipmentActionRole
  readonly position: EquipmentPosition
  readonly behaviorId: string
  readonly artworkSrc: string | null
  readonly item: ItemPresentation
  readonly remainingUses: number | null
  readonly maximumUsesPerBattle: number | null
  readonly unavailableReason: string | null
}
