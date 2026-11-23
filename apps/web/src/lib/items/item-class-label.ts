/** Player-facing labels; persisted Item class identities remain unchanged. */
export function itemClassLabel(value: string): string {
  if (value === 'hand-armor') return 'Gloves'
  if (value === 'battle-item') return 'Consumable'
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** Inventory tab classes; stable persistence keys are not renamed. */
export function itemCategoryLabel(value: string): string {
  const labels: Record<string, string> = {
    gear: 'Gear',
    'battle-items': 'Consumables',
    materials: 'Materials',
    general: 'General',
    event: 'Event',
    companion: 'Companion',
  }
  return labels[value] ?? itemClassLabel(value)
}
