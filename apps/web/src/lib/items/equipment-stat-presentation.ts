import type { CombatBonusStat } from '@aurevane/game-core/combat/combat-stat-bonuses'
import { evaluateAbilityRequirements } from '@aurevane/game-core/combat/combat-requirements'
import {
  EQUIPMENT_POSITIONS,
  type EquipmentPosition,
  type ItemCatalogue,
  type ItemInventorySnapshot,
} from '@aurevane/game-core/character/item-inventory'
import type { DerivedStatId, DerivedStatValue } from '@aurevane/game-core/character/derived-stats'

export interface EquipmentStatBonus {
  readonly itemId: string
  readonly itemName: string
  readonly position: EquipmentPosition
  readonly stat: CombatBonusStat
  readonly amount: number
  /** Combat-only requirements cannot be assumed true on the roaming profile. */
  readonly conditional: boolean
}

/** Project a loadout already accepted by validateEquipmentLoadout; never expose private receipts. */
export function equipmentStatBonuses(
  snapshot: ItemInventorySnapshot,
  catalogue: ItemCatalogue,
): readonly EquipmentStatBonus[] {
  return EQUIPMENT_POSITIONS.flatMap((position) => {
    const stack = snapshot.stacks.find((row) => row.id === snapshot.equipment[position])
    const item = stack ? catalogue[stack.itemId] : undefined
    if (!item || item.schemaVersion !== 2 || !item.enabled) return []
    return (item.ability?.behaviors ?? []).flatMap((behavior) =>
      behavior.activation !== 'ongoing' || behavior.mode !== 'modifier'
        ? []
        : behavior.effects.flatMap(({ payload }) =>
            payload.type !== 'stat-bonus'
              ? []
              : [
                  {
                    itemId: item.id,
                    itemName: item.name,
                    position,
                    stat: payload.stat,
                    amount: payload.amount,
                    conditional: !evaluateAbilityRequirements(behavior.requirements, {}),
                  },
                ],
          ),
    )
  })
}

const statIds: Readonly<Record<CombatBonusStat, DerivedStatId>> = {
  movement: 'movement',
  jump: 'jump',
  'physical-power': 'physicalPower',
  'mystic-power': 'mysticPower',
  'physical-defense': 'armor',
  'mystic-defense': 'ward',
  evasion: 'evasion',
  initiative: 'initiative',
}

/** Profile projection only. Battle execution still uses its exact captured sources. */
export function equippedStatValue(base: DerivedStatValue, bonuses: readonly EquipmentStatBonus[]) {
  const sources = bonuses.filter((bonus) => statIds[bonus.stat] === base.id)
  const total = sources
    .filter((bonus) => !bonus.conditional)
    .reduce((sum, bonus) => sum + bonus.amount, 0)
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(base.value + total))
    throw new RangeError('Equipment stat total exceeds safe integer range.')
  // Match effectiveCombatStatProfile: equipment is added after Core-derived caps.
  const value = base.id === 'evasion' ? Math.min(10000, base.value + total) : base.value + total
  return { stat: { ...base, value }, delta: value - base.value, sources }
}
