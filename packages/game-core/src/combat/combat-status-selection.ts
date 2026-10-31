import type {
  CombatContentCatalog,
  CombatEffectDefinition,
  CombatStatusDefinition,
} from './actions'
import { PV1F_COMBAT_CONTENT } from './pv1f-combat-content'
import { combatStatusDetails } from './status-content'

export type StatusSelectionKind = 'buffs' | 'debuffs' | 'copy-buffs' | 'copy-debuffs'

/** A selection can narrow eligibility, never grant permission to copy a status. */
export function combatStatusIsCopyable(
  definition: CombatStatusDefinition,
  mode: 'amplify' | 'curse',
  elemental = false,
): boolean {
  const permitted =
    mode === 'amplify'
      ? definition.amplifyCopyable
      : (definition.curseCopyable ??
        (elemental && ['wet', 'frozen', 'conductive'].includes(definition.id)))
  return (
    permitted === true &&
    definition.polarity === (mode === 'amplify' ? 'positive' : 'negative') &&
    (definition.reactionClass === undefined ||
      ['ordinary', 'periodic', 'reactive'].includes(definition.reactionClass))
  )
}

export function selectableCombatStatusIds(kind: StatusSelectionKind): readonly string[] {
  return PV1F_COMBAT_CONTENT.statuses
    .filter((definition) => {
      if (kind === 'copy-buffs' || kind === 'copy-debuffs') {
        // Persistent DoTs carry their own per-application copy permission.
        if (kind === 'copy-debuffs' && ['burn', 'poison', 'bleed'].includes(definition.id))
          return true
        return combatStatusIsCopyable(definition, kind === 'copy-buffs' ? 'amplify' : 'curse', true)
      }
      return definition.polarity === (kind === 'buffs' ? 'positive' : 'negative')
    })
    .map((definition) => definition.id)
}

export function combatStatusSelectionSummary(
  ids: readonly string[],
  kind: StatusSelectionKind,
): string {
  const allowed = selectableCombatStatusIds(kind)
  return ids.length === allowed.length && allowed.every((id) => ids.includes(id))
    ? kind === 'buffs' || kind === 'copy-buffs'
      ? 'All Buffs'
      : 'All Debuffs'
    : [...new Set(ids.map((id) => combatStatusDetails(id).name))].join(', ')
}

/** New full Cleanse uses pinned polarity. Omitted mode retains captured historical rules. */
export function resolvedCombatRemovalStatusIds(
  effect: Extract<CombatEffectDefinition, { type: 'remove-status' }>,
  content: CombatContentCatalog = PV1F_COMBAT_CONTENT,
): readonly string[] {
  return effect.removalMode === 'all-debuffs'
    ? [
        ...new Set([
          ...content.statuses
            .filter((definition) => definition.polarity === 'negative')
            .map((definition) => definition.id),
          'burn',
          'poison',
          'bleed',
        ]),
      ]
    : effect.statusIds
}

export function validateCombatStatusSelection(ids: unknown, kind: StatusSelectionKind): void {
  const allowed = selectableCombatStatusIds(kind)
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > allowed.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !allowed.includes(id))
  )
    throw new TypeError('Choose one or more distinct eligible statuses of the matching polarity.')
}

/** The persisted polarity keeps an empty editor selection attached to its authored Tag. */
export function validateCombatRemovalSelection(effect: {
  readonly selectionKind?: unknown
  readonly removalMode?: unknown
  readonly statusIds?: unknown
}): void {
  if (effect.selectionKind === undefined) return
  if (
    effect.removalMode !== 'specified' ||
    (effect.selectionKind !== 'buffs' && effect.selectionKind !== 'debuffs')
  )
    throw new TypeError('Unsupported status removal selection.')
  validateCombatStatusSelection(effect.statusIds, effect.selectionKind)
}
