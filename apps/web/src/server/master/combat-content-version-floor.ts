import { defaultCombatTagDefinitions } from '@aurevane/game-core/combat/combat-tag-wording'
import 'server-only'
import type { CombatContentKind } from '@aurevane/db/combat-content'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { highestBuiltinMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { highestBuiltinEssenceVersion } from '@aurevane/game-core/combat/essence'
import { highestBuiltinResonanceVersion } from '@aurevane/game-core/combat/resonance'

/** Never take this allocation floor from an editor's mutable definition or current pointer. */
export function builtinCombatContentVersionFloor(
  kind: CombatContentKind,
  key: string,
): number | null {
  if (kind === 'tag')
    return defaultCombatTagDefinitions().find((tag) => tag.id === key)?.contentVersion ?? null
  if (kind === 'skill')
    return (
      defaultBasicSkills().find((row) => row.id === key)?.contentVersion ??
      highestBuiltinMatureSkillVersion(key)
    )
  if (kind === 'essence') return highestBuiltinEssenceVersion(key)
  if (kind === 'resonance') return highestBuiltinResonanceVersion(key)
  return null
}
