import { combatContentCategory } from '../combat/combat-content-categories'
import type {
  CombatContentDefinition,
  CombatContentKind,
  CombatContentSort,
} from '@aurevane/db/combat-content'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { CombatContentAuthoringService } from './combat-content-authoring-service'
import type { RpcCombatContentAuthoringStore } from './supabase-combat-content-authoring-store'
import { isCombatContentKind } from './combat-content-record'
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
function invalid(message: string): never {
  throw new AurevaneError('INVALID_REQUEST', message)
}
function key(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 160 ||
    !/^[a-z0-9]+([._-][a-z0-9]+)*$/u.test(value)
  )
    invalid('Choose a valid stable content identity.')
  return value
}
function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    invalid('Refresh the current record revision.')
  return value as number
}
function requestId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/u.test(value)
  )
    invalid('A valid operation request key is required.')
  return value
}
export function createCombatContentRecordCommand(
  store: RpcCombatContentAuthoringStore,
  service: CombatContentAuthoringService,
  actor: string,
) {
  const validate = (kind: CombatContentKind, definition: unknown): CombatContentDefinition => {
    const descriptor = combatContentCategory(kind)
    if (!descriptor) invalid('Choose a supported content category.')
    try {
      const parsed = descriptor.parseAuthoring(definition)
      if (descriptor.identityField !== null) key(parsed[descriptor.identityField])
      return parsed
    } catch (error) {
      invalid(error instanceof Error ? error.message : 'Invalid content definition.')
    }
  }

  return async (input: unknown): Promise<unknown> => {
    await service.requireOperator(actor)
    if (!object(input)) invalid('A content command is required.')
    const action = input.action
    const fields: Record<string, string[]> = {
      read: ['contentKey'],
      list: ['kind', 'category', 'lifecycle', 'search', 'after', 'limit', 'sort'],
      create: ['requestId', 'contentKind', 'definition', 'parentKey', 'expectedParentRevision'],
      duplicate: ['requestId', 'sourceKey', 'expectedSourceRevision'],
      save: ['contentKey', 'expectedRevision', 'definition'],
      restore: ['contentKey', 'expectedRevision', 'sourceVersion', 'sourceKind'],
      archive: ['contentKey', 'expectedRevision'],
      link: ['contentKey', 'expectedRevision', 'requestId', 'childKey'],
      unlink: ['contentKey', 'expectedRevision', 'requestId', 'childKey'],
      publish: ['contentKey', 'expectedDraftVersion', 'expectedBaseVersion'],
    }
    if (
      typeof action !== 'string' ||
      !fields[action] ||
      Object.keys(input).some((field) => field !== 'action' && !fields[action]!.includes(field))
    )
      invalid('Choose a supported complete-record command without extra fields.')
    if (action === 'read') return { record: await store.readRecord(key(input.contentKey)) }
    if (action === 'list') {
      if (
        input.category !== undefined &&
        !['basic', 'discipline-skill'].includes(String(input.category))
      )
        invalid('Choose a supported Skill filter.')
      if (input.category !== undefined && input.kind !== 'skill')
        invalid('Skill filters apply only to Skills.')
      if (
        input.sort !== undefined &&
        !['key-asc', 'key-desc', 'name-asc', 'name-desc'].includes(String(input.sort))
      )
        invalid('Choose a supported sort order.')
      if (input.after !== undefined && input.sort !== undefined) {
        try {
          if (typeof input.after !== 'string' || input.after.length > 1600) throw new Error()
          const cursor = JSON.parse(input.after)
          if (
            !object(cursor) ||
            cursor.sort !== input.sort ||
            typeof cursor.name !== 'string' ||
            cursor.name.length > 400 ||
            Object.keys(cursor).some((key) => !['sort', 'key', 'name'].includes(key))
          )
            throw new Error()
          key(cursor.key)
        } catch {
          invalid('Refresh the content list; this page cursor is invalid.')
        }
      }
      if (input.kind !== undefined && !isCombatContentKind(input.kind))
        invalid('Choose a supported category.')
      if (
        input.lifecycle !== undefined &&
        !['draft', 'active', 'archived'].includes(String(input.lifecycle))
      )
        invalid('Choose a supported lifecycle filter.')
      if (
        input.search !== undefined &&
        (typeof input.search !== 'string' || input.search.length > 160)
      )
        invalid('Use at most 160 search characters.')
      if (
        input.limit !== undefined &&
        (!Number.isSafeInteger(input.limit) ||
          (input.limit as number) < 1 ||
          (input.limit as number) > 100)
      )
        invalid('Use a page size from 1 to 100.')
      return store.listRecords({
        kind: input.kind as CombatContentKind | undefined,
        category: input.category as 'basic' | 'discipline-skill' | undefined,
        lifecycle: input.lifecycle as string | undefined,
        search: input.search as string | undefined,
        after:
          input.after === undefined
            ? undefined
            : input.sort === undefined
              ? key(input.after)
              : (input.after as string),
        sort: input.sort as CombatContentSort | undefined,
        limit: input.limit as number | undefined,
      })
    }
    if (action === 'create') {
      if (!isCombatContentKind(input.contentKind) || !object(input.definition))
        invalid('Choose a supported category and definition.')
      const request = requestId(input.requestId),
        // One presentation record per implemented handler; the request UUID remains the
        // independent idempotency key checked atomically by the existing store/SQL path.
        contentKey =
          input.contentKind === 'tag'
            ? `tag.${key(input.definition.tagId)}`
            : `${input.contentKind}.${request}`
      let definition: Record<string, unknown> = { ...input.definition, id: contentKey }
      if (input.contentKind === 'essence')
        definition = {
          ...definition,
          essenceId: contentKey,
          skill: { ...(object(definition.skill) ? definition.skill : {}), id: contentKey },
        }
      definition = validate(input.contentKind, definition)
      return {
        record: await store.writeRecord(contentKey, {
          action: 'create',
          requestId: request,
          contentKind: input.contentKind,
          definition,
          ...(input.parentKey === undefined
            ? {}
            : {
                parentKey: key(input.parentKey),
                expectedParentRevision: revision(input.expectedParentRevision),
              }),
        }),
      }
    }
    if (action === 'duplicate') {
      const source = await store.readRecord(key(input.sourceKey))
      if (!source) invalid('The source content does not exist.')
      if (source.contentKind === 'tag')
        invalid(
          'Tag presentation records cannot be duplicated. Create or edit the canonical Tag; new mechanics require an implemented handler.',
        )
      const blocker = combatContentCategory(source.contentKind, source.contentKey)!.authoringBlocker
      if (blocker) invalid(blocker.message)
      const request = requestId(input.requestId)
      return {
        record: await store.writeRecord(`${source.contentKind}.${request}`, {
          action: 'duplicate',
          requestId: request,
          sourceKey: source.contentKey,
          expectedSourceRevision: revision(input.expectedSourceRevision),
          ...(!source.draft && !source.current && source.builtinDefinition
            ? { sourceDefinition: source.builtinDefinition }
            : {}),
        }),
      }
    }
    const contentKey = key(input.contentKey)
    if (action === 'save' || action === 'publish') {
      const record = await store.readRecord(contentKey)
      if (!record) invalid('The content record does not exist.')
      if (action === 'publish')
        return {
          record: await store.publishSaved(
            record,
            revision(input.expectedDraftVersion),
            input.expectedBaseVersion === null ? null : revision(input.expectedBaseVersion),
          ),
        }
      return {
        record: await store.writeRecord(contentKey, {
          action: 'save',
          expectedRevision: revision(input.expectedRevision),
          definition: validate(record.contentKind, input.definition),
        }),
      }
    }
    const expectedRevision = revision(input.expectedRevision)
    if (action === 'archive')
      return { record: await store.writeRecord(contentKey, { action, expectedRevision }) }
    if (action === 'restore') {
      if (input.sourceKind !== undefined && input.sourceKind !== 'builtin')
        invalid('Choose an available restore source.')
      return {
        record: await store.writeRecord(contentKey, {
          action,
          expectedRevision,
          sourceVersion: revision(input.sourceVersion),
          ...(input.sourceKind === 'builtin' ? { sourceKind: 'builtin' as const } : {}),
        }),
      }
    }
    if (action === 'link' || action === 'unlink')
      return {
        record: await store.writeRecord(contentKey, {
          action,
          expectedRevision,
          childKey: key(input.childKey),
          requestId: requestId(input.requestId),
        }),
      }
    return invalid('Choose a supported content operation.')
  }
}
