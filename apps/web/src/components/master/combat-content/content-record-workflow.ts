import type {
  CombatContentDefinition,
  CompleteCombatContentRecord,
} from '@aurevane/db/combat-content'
import { postCombatContentAuthoring } from './combat-content-client'
export function editableDefinition(
  record: CompleteCombatContentRecord,
): CombatContentDefinition | null {
  return record.draft?.definition ?? record.current?.definition ?? record.builtinDefinition ?? null
}
export function recordIsDirty(
  record: CompleteCombatContentRecord,
  definition: CombatContentDefinition,
): boolean {
  const editable = (value: CombatContentDefinition | null) => {
    if (!value) return null
    const next = { ...value }
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
  return (
    JSON.stringify(editable(definition)) !== JSON.stringify(editable(editableDefinition(record)))
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
  if (typeof definition.name === 'string' && definition.name.trim()) return definition.name
  const id = String(definition.id ?? definition.essenceId ?? 'Content')
  return (id.includes('.') ? id.slice(id.indexOf('.') + 1) : id)
    .split(/[._-]/u)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
