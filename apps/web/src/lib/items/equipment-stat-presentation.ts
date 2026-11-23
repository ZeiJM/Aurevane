import type { CombatBonusStat } from '@aurevane/game-core/combat/combat-stat-bonuses'
import { evaluateAbilityRequirements } from '@aurevane/game-core/combat/combat-requirements'
import {
  EQUIPMENT_POSITIONS,
  type EquipmentPosition,
  type ItemCatalogue,
  type ItemInventorySnapshot,
} from '@aurevane/game-core/character/item-inventory'
import type { DerivedStatId, DerivedStatValue } from '@aurevane/game-core/character/derived-stats'
import type { RuntimeItemDefinition } from '@aurevane/game-core/content/items'

export interface ItemStatBonus {
  readonly stat: CombatBonusStat
  readonly amount: number
  readonly conditional: boolean
}

/** Public passive atoms shared by the profile and inventory comparison. */
export function itemStatBonuses(item: RuntimeItemDefinition): readonly ItemStatBonus[] {
  if (!item.enabled) return []
  return (item.ability?.behaviors ?? []).flatMap((behavior) =>
    behavior.activation !== 'ongoing' || behavior.mode !== 'modifier'
      ? []
      : behavior.effects.flatMap(({ payload }) =>
          payload.type !== 'stat-bonus'
            ? []
            : [
                {
                  stat: payload.stat,
                  amount: payload.amount,
                  conditional: !evaluateAbilityRequirements(behavior.requirements, {}),
                },
              ],
        ),
  )
}

/** Proven unconditional changes; Evasion additionally requires its authoritative character base. */
export function equipmentStatChanges(
  current: readonly EquipmentStatBonus[] | null | undefined,
  removals: readonly EquipmentPosition[],
  additions: readonly ItemStatBonus[] = [],
  baseEvasion?: number,
  includeUnchanged = false,
): readonly { stat: CombatBonusStat; amount: number }[] {
  if (!current) return []
  const amounts = new Map<CombatBonusStat, number>()
  const affected = [
    ...current
      .filter((source) => removals.includes(source.position))
      .map((source) => ({ ...source, amount: -source.amount })),
    ...additions,
  ]
  for (const bonus of affected) {
    // Evasion is compared as a capped total below rather than a raw contribution.
    if (bonus.conditional || bonus.stat === 'evasion') continue
    const amount = (amounts.get(bonus.stat) ?? 0) + bonus.amount
    if (!Number.isSafeInteger(amount))
      throw new RangeError('Equipment stat change exceeds safe integer range.')
    amounts.set(bonus.stat, amount)
  }
  if (Number.isSafeInteger(baseEvasion) && baseEvasion! >= 0 && baseEvasion! <= 10000) {
    const total = (sources: readonly ItemStatBonus[]) =>
      sources
        .filter((bonus) => bonus.stat === 'evasion' && !bonus.conditional)
        .reduce((sum, bonus) => sum + bonus.amount, 0)
    const before = adjustedEquipmentStatValue(baseEvasion!, total(current), true)
    const after = adjustedEquipmentStatValue(
      baseEvasion!,
      total([...current.filter((bonus) => !removals.includes(bonus.position)), ...additions]),
      true,
    )
    if (!Number.isSafeInteger(after - before))
      throw new RangeError('Equipment stat change exceeds safe integer range.')
    if (affected.some((bonus) => bonus.stat === 'evasion' && !bonus.conditional))
      amounts.set('evasion', after - before)
  }
  return [...amounts]
    .filter(([, amount]) => includeUnchanged || amount !== 0)
    .map(([stat, amount]) => ({ stat, amount }))
}

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
    if (!item || item.schemaVersion !== 2) return []
    return itemStatBonuses(item).map((bonus) => ({
      itemId: item.id,
      itemName: item.name,
      position,
      ...bonus,
    }))
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
  // Match effectiveCombatStatProfile: equipment is added after Core-derived caps.
  const value = adjustedEquipmentStatValue(base.value, total, base.id === 'evasion')
  return { stat: { ...base, value }, delta: value - base.value, sources }
}

function adjustedEquipmentStatValue(base: number, total: number, evasion: boolean): number {
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(base + total))
    throw new RangeError('Equipment stat total exceeds safe integer range.')
  return evasion ? Math.min(10000, base + total) : base + total
}
