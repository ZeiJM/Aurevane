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
  return JSON.stringify(definition) !== JSON.stringify(editableDefinition(record))
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
