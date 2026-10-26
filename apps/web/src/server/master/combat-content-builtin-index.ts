import 'server-only'
import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
} from '@aurevane/game-core/combat/mature-skills'
import {
  currentEssenceDefinitions,
  resolveEssenceForBuild,
} from '@aurevane/game-core/combat/essence'
import {
  currentResonanceDefinitions,
  resolveResonanceForPair,
} from '@aurevane/game-core/combat/resonance'
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
/** Index only mappings the actual current fallback selectors consume. Stage B
 * may replace these consumers; until then each mapping is a real dependency. */
export function builtinCombatContentSelectionManifest() {
  return [
    ...currentEssenceDefinitions()
      .filter((d) => resolveEssenceForBuild(d.sourceDisciplineId, null)?.essenceId === d.essenceId)
      .map((d) => ({
        kind: 'builtin-essence-selection',
        key: d.sourceDisciplineId,
        contentKey: d.essenceId,
      })),
    ...currentResonanceDefinitions()
      .filter((d) => resolveResonanceForPair(d.disciplinePair[0], d.disciplinePair[1])?.id === d.id)
      .map((d) => ({
        kind: 'builtin-resonance-selection',
        key: [...d.disciplinePair].sort().join('+'),
        contentKey: d.id,
      })),
  ].sort((a, b) => (a.contentKey < b.contentKey ? -1 : a.contentKey > b.contentKey ? 1 : 0))
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

/** Resolve only executable system snapshots, never a mutable publication or caller body. */
export function exactBuiltinCombatContentDefinition(
  kind: CombatContentKind,
  key: string,
  version: number,
): CombatContentDefinition | null {
  const current = builtinCombatContentDefinition(kind, key)
  if (!current) return null
  let definition: unknown = current.contentVersion === version ? current : null
  if (kind === 'skill' && !definition) definition = resolveMatureSkillVersion(key, version)
  if (kind === 'essence')
    definition = resolveEssenceForBuild(String(current.sourceDisciplineId), null, version)
  if (kind === 'resonance' && Array.isArray(current.disciplinePair))
    definition = resolveResonanceForPair(
      current.disciplinePair[0],
      current.disciplinePair[1],
      version,
    )
  if (!definition || typeof definition !== 'object') return null
  const value = definition as CombatContentDefinition
  if (value.contentVersion !== version || (kind === 'essence' ? value.essenceId : value.id) !== key)
    return null
  return structuredClone(value)
}
