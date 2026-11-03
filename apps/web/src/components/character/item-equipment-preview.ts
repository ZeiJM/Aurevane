import {
  EQUIPMENT_POSITIONS,
  type EquipmentPosition,
} from '@aurevane/game-core/character/item-inventory'
import type { ItemPresentation } from '@/lib/items/item-presentation'
import type { CharacterItemsView } from '@/server/character/character-items-service'
export const positionNames: Record<EquipmentPosition, string> = {
  head: 'Head',
  body: 'Body',
  pants: 'Pants',
  boots: 'Boots',
  'main-hand': 'Main Hand',
  'off-hand': 'Off Hand',
}
export type OwnedItem = CharacterItemsView['stacks'][number]
export function itemPositions(item: ItemPresentation): EquipmentPosition[] {
  if (!item.equipment) return []
  return item.equipment.slot === 'hand'
    ? item.equipment.hands === 2
      ? ['main-hand']
      : ['main-hand', 'off-hand']
    : [item.equipment.slot]
}
/** Explanatory projection only; the intent service remains authoritative. */
export function equipmentProposal(
  view: CharacterItemsView,
  stack: OwnedItem,
  position: EquipmentPosition,
  extra: readonly EquipmentPosition[],
) {
  const item = stack.item
  const requiredReplacements = EQUIPMENT_POSITIONS.filter((p) => {
    if (!view.equipment[p]) return false
    if (p === position) return view.equipment[p] !== stack.id
    if (item?.equipment?.hands === 2 && p === 'off-hand') return true
    if (position === 'off-hand' && p === 'main-hand')
      return view.stacks.find((s) => s.id === view.equipment[p])?.item?.equipment?.hands === 2
    return false
  })
  const removals = [...new Set([...requiredReplacements, ...extra])]
  const equipment = { ...view.equipment }
  for (const p of removals) delete equipment[p]
  equipment[position] = stack.id
  const otherUses = Object.entries(equipment).filter(
    ([p, id]) => p !== position && id === stack.id,
  ).length
  const qualityPoints =
    view.qualityPoints -
    removals.reduce(
      (n, p) => n + (view.stacks.find((s) => s.id === view.equipment[p])?.item?.qualityPoints ?? 0),
      0,
    ) +
    (view.equipment[position] === stack.id && !removals.includes(position)
      ? 0
      : (item?.qualityPoints ?? 0))
  const issue =
    !item || !item.enabled
      ? 'This current Item is unavailable for equipment.'
      : !itemPositions(item).includes(position)
        ? 'This Item does not fit this position.'
        : otherUses && (item.itemClass !== 'battle-item' || stack.quantity < otherUses + 1)
          ? 'Holding this stack in both hands requires two owned copies of a Battle Item.'
          : null
  return {
    requiredReplacements,
    removals,
    qualityPoints,
    shortage: Math.max(0, qualityPoints - 100),
    issue,
    equipment,
  }
}
export function itemThumbnail(src: string) {
  return /^\/media\/art\/items\/[^/]+\.webp$/.test(src)
    ? src.replace('/items/', '/items/thumbnails/')
    : src
}
