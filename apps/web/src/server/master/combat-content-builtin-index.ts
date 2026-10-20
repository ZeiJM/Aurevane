import 'server-only'
import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
import { builtinCombatContentVersionFloor } from './combat-content-version-floor'

/** Existing executable content remains the definition authority. SQL imports
 * only this identity/search/floor manifest, never invented publication history. */
export function builtinCombatContentEntries() {
  return [
    ...[...defaultBasicSkills(), ...latestEnabledMatureSkills()].map((definition) => ({
      contentKey: definition.id,
      contentKind: 'skill' as const,
      definition,
    })),
    ...currentEssenceDefinitions().map((definition) => ({
      contentKey: definition.essenceId,
      contentKind: 'essence' as const,
      definition,
    })),
    ...currentResonanceDefinitions().map((definition) => ({
      contentKey: definition.id,
      contentKind: 'resonance' as const,
      definition,
    })),
  ].sort((a, b) => (a.contentKey < b.contentKey ? -1 : a.contentKey > b.contentKey ? 1 : 0))
}
export function builtinCombatContentManifest() {
  return builtinCombatContentEntries().map(({ contentKey, contentKind, definition }) => ({
    contentKey,
    contentKind,
    name:
      'name' in definition
        ? definition.name
        : contentKey
            .split('.')
            .at(-1)!
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
    contentVersion: definition.contentVersion,
    versionFloor: builtinCombatContentVersionFloor(contentKind, contentKey)!,
    sourceDisciplineId: 'sourceDisciplineId' in definition ? definition.sourceDisciplineId : null,
  }))
}
export function builtinCombatContentDefinition(
  kind: CombatContentKind,
  key: string,
): CombatContentDefinition | null {
  const row = builtinCombatContentEntries().find(
    (row) => row.contentKind === kind && row.contentKey === key,
  )
  return row ? (structuredClone(row.definition) as unknown as CombatContentDefinition) : null
}
