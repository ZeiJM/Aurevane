import { activeCombatContentForAuthoring } from '@/lib/combat-ability-authoring-compatibility'
import { currentCombatTagName } from '@aurevane/game-core/combat/combat-effect-identities'
import type {
  CombatContentDefinition,
  CompleteCombatContentRecord,
} from '@aurevane/db/combat-content'
import { postCombatContentAuthoring } from './combat-content-client'
import { skillAccuracyForAuthoring } from '@/lib/skill-accuracy-authoring'
import { combatContentForAuthoring } from '@/lib/combat-content-for-authoring'
export function editableDefinition(
  record: CompleteCombatContentRecord,
): CombatContentDefinition | null {
  const definition =
    record.draft?.definition ?? record.current?.definition ?? record.builtinDefinition ?? null
  return definition ? combatContentForAuthoring(record.contentKind, definition) : null
}
/** Persisted JSON object key order is irrelevant; array order and authored values are not. */
function sameContentValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (
    !left ||
    !right ||
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    Array.isArray(left) !== Array.isArray(right)
  )
    return false
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false
    for (let index = 0; index < left.length; index++)
      if (
        !sameContentValue(
          left[index] === undefined ? null : left[index],
          right[index] === undefined ? null : right[index],
        )
      )
        return false
    return true
  }
  const a = left as Record<string, unknown>,
    b = right as Record<string, unknown>
  const keys = Object.keys(a).filter((key) => a[key] !== undefined)
  return (
    keys.length === Object.keys(b).filter((key) => b[key] !== undefined).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameContentValue(a[key], b[key]))
  )
}
export function recordIsDirty(
  record: CompleteCombatContentRecord,
  definition: CombatContentDefinition,
): boolean {
  const editable = (value: CombatContentDefinition | null) => {
    if (!value) return null
    const next = {
      ...skillAccuracyForAuthoring(
        record.contentKind,
        activeCombatContentForAuthoring(record.contentKind, value),
      ),
    }
    delete next.contentVersion
    if (
      typeof next.essenceId === 'string' &&
      next.skill &&
      typeof next.skill === 'object' &&
      !Array.isArray(next.skill)
    ) {
      const skill = { ...(next.skill as Record<string, unknown>) }
      delete skill.contentVersion
      next.skill = skill
    }
    return next
  }
  return !sameContentValue(
    editable(combatContentForAuthoring(record.contentKind, definition)),
    editable(
      record.draft?.definition ?? record.current?.definition ?? record.builtinDefinition ?? null,
    ),
  )
}
export function savedPublicationCommand(
  record: CompleteCombatContentRecord,
  definition: CombatContentDefinition,
) {
  if (!record.draft || recordIsDirty(record, definition))
    throw new Error('Save your complete changes before publishing.')
  return {
    action: 'publish',
    contentKey: record.contentKey,
    expectedDraftVersion: record.draft.draftVersion,
    expectedBaseVersion: record.draft.baseVersion,
  }
}
export async function contentRecordCommand<T>(command: Record<string, unknown>): Promise<T> {
  return postCombatContentAuthoring<T>({ operation: 'record', command })
}

export function contentRecordName(definition: CombatContentDefinition): string {
  if (typeof definition.name === 'string' && definition.name.trim())
    return currentCombatTagName(String(definition.tagId ?? ''), definition.name)
  const id = String(definition.id ?? definition.essenceId ?? 'Content')
  return (id.includes('.') ? id.slice(id.indexOf('.') + 1) : id)
    .split(/[._-]/u)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function contentCommitNotice(message: string, corrections: readonly string[] = []): string {
  const changes = [...new Set(corrections)]
  return changes.length ? `${message} Adjusted: ${changes.join(' ')}` : message
}
