import { EQUIPMENT_POSITIONS } from '@aurevane/game-core/character/item-inventory'
import type { CharacterItemsView } from '@/server/character/character-items-service'
import { positionNames } from './item-equipment-preview'
export function itemSupportOptions(view: CharacterItemsView) {
  return EQUIPMENT_POSITIONS.flatMap((position) => {
    const stack = view.stacks.find((s) => s.id === view.equipment[position]),
      item = stack?.item,
      binding = item?.actions.support
    if (!item?.enabled || !binding) return []
    return [
      {
        key: `${position}.${item.id}.${binding.behaviorId}`,
        label: `${binding.name} · ${positionNames[position]}`,
        item,
        selection: {
          kind: 'equipment' as const,
          position,
          itemId: item.id,
          behaviorId: binding.behaviorId,
        },
      },
    ]
  })
}
