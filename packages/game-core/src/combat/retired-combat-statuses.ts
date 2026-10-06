const RETIRED_COMBAT_STATUS_IDS = new Set([
  'regeneration',
  'hastened',
  'delayed',
  'borrowed-hour',
  'summoned',
  'marked',
])

export function isRetiredCombatStatusId(id: string): boolean {
  return RETIRED_COMBAT_STATUS_IDS.has(id)
}

export function assertCurrentCombatStatusId(id: string): void {
  if (isRetiredCombatStatusId(id))
    throw new TypeError(`Retired combat status ${id} is unsupported.`)
}
