import { combatContentCategory } from '../combat/combat-content-categories'
import type { CompleteCombatContentRecord, CombatContentKind } from '@aurevane/db/combat-content'
import { AurevaneError } from '@aurevane/game-core/errors'
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0
const string = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.trim() === v
export const isCombatContentKind = (v: unknown): v is CombatContentKind =>
  combatContentCategory(v) !== null
export function parseCompleteCombatContentRecord(value: unknown): CompleteCombatContentRecord {
  try {
    if (
      !object(value) ||
      !string(value.contentKey) ||
      !isCombatContentKind(value.contentKind) ||
      !['draft', 'active', 'archived'].includes(value.lifecycle as string) ||
      !integer(value.revision) ||
      !Number.isSafeInteger(value.versionFloor) ||
      (value.versionFloor as number) < 0 ||
      !Array.isArray(value.history) ||
      value.history.length > 3 ||
      !Array.isArray(value.links) ||
      value.links.length > 256 ||
      !value.links.every(string) ||
      !Array.isArray(value.usedBy) ||
      value.usedBy.length > 100 ||
      (value.usedByTruncated !== undefined && typeof value.usedByTruncated !== 'boolean') ||
      !value.usedBy.every(
        (v) =>
          object(v) &&
          string(v.kind) &&
          string(v.key) &&
          (v.blocking === undefined || typeof v.blocking === 'boolean'),
      )
    )
      throw new TypeError('Invalid record identity.')
    for (const field of ['createdBy', 'createdAt'])
      if (value[field] !== null && !string(value[field]))
        throw new TypeError('Invalid record attribution.')
    if (
      value.builtin !== undefined &&
      value.builtin !== null &&
      (!object(value.builtin) ||
        !integer(value.builtin.contentVersion) ||
        !string(value.builtin.name))
    )
      throw new TypeError('Invalid builtin identity.')
    const descriptor = combatContentCategory(value.contentKind, value.contentKey)!
    const definition = (v: unknown) => descriptor.parseRetained(v, value.contentKey as string)
    if (value.draft !== null) {
      const d = value.draft
      if (
        !object(d) ||
        !integer(d.draftVersion) ||
        (d.baseVersion !== null && !integer(d.baseVersion)) ||
        !string(d.updatedBy) ||
        !string(d.updatedAt) ||
        (d.restoredFrom !== null && !integer(d.restoredFrom)) ||
        (d.restoredBy !== null && !string(d.restoredBy)) ||
        (d.restoredSource !== undefined &&
          d.restoredSource !== null &&
          d.restoredSource !== 'builtin')
      )
        throw new TypeError('Invalid draft.')
      definition(d.definition)
    }
    for (const v of [...value.history, ...(value.current === null ? [] : [value.current])]) {
      if (
        !object(v) ||
        !integer(v.contentVersion) ||
        !string(v.publishedBy) ||
        !string(v.publishedAt)
      )
        throw new TypeError('Invalid immutable version.')
      for (const field of ['authoredBy', 'authoredAt', 'restoredBy'])
        if (v[field] !== null && !string(v[field]))
          throw new TypeError('Invalid version attribution.')
      if (
        v.restoredSource !== undefined &&
        v.restoredSource !== null &&
        v.restoredSource !== 'builtin'
      )
        throw new TypeError('Invalid restore source.')
      if (v.restoredFrom !== null && !integer(v.restoredFrom))
        throw new TypeError('Invalid restore attribution.')
      definition(v.definition)
    }
    if (value.lifecycle === 'archived' && value.current !== null)
      throw new TypeError('Archived current pointer.')
    const record = structuredClone(value) as unknown as CompleteCombatContentRecord
    return descriptor.authoringBlocker
      ? { ...record, authoringBlocker: { ...descriptor.authoringBlocker } }
      : record
  } catch (cause) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The server returned an invalid complete content record.',
      { cause },
    )
  }
}
