import type { CompleteCombatContentRecord, CombatContentKind } from '@aurevane/db/combat-content'
import {
  isNoncombatContentKind,
  parseNoncombatContentDefinition,
} from '@aurevane/game-core/content/authored-content'
import { AurevaneError } from '@aurevane/game-core/errors'
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0
const string = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.trim() === v
export const isCombatContentKind = (v: unknown): v is CombatContentKind =>
  ['skill', 'essence', 'resonance', 'status', 'effect-profile'].includes(v as string) ||
  isNoncombatContentKind(v)
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
      !value.links.every(string) ||
      !Array.isArray(value.usedBy) ||
      !value.usedBy.every((v) => object(v) && string(v.kind) && string(v.key))
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
    const definition = (v: unknown) => {
      if (!object(v)) throw new TypeError('Invalid definition.')
      if (isNoncombatContentKind(value.contentKind)) {
        const parsed = parseNoncombatContentDefinition(value.contentKind, v)
        if (parsed.id !== value.contentKey) throw new TypeError('Invalid definition identity.')
      } else if ((value.contentKind === 'essence' ? v.essenceId : v.id) !== value.contentKey)
        throw new TypeError('Invalid definition identity.')
    }
    if (value.draft !== null) {
      const d = value.draft
      if (
        !object(d) ||
        !integer(d.draftVersion) ||
        (d.baseVersion !== null && !integer(d.baseVersion)) ||
        !string(d.updatedBy) ||
        !string(d.updatedAt) ||
        (d.restoredFrom !== null && !integer(d.restoredFrom)) ||
        (d.restoredBy !== null && !string(d.restoredBy))
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
      if (v.restoredFrom !== null && !integer(v.restoredFrom))
        throw new TypeError('Invalid restore attribution.')
      definition(v.definition)
    }
    if (value.lifecycle === 'archived' && value.current !== null)
      throw new TypeError('Archived current pointer.')
    return structuredClone(value) as unknown as CompleteCombatContentRecord
  } catch (cause) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The server returned an invalid complete content record.',
      { cause },
    )
  }
}
