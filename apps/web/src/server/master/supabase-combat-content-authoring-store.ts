import type {
  CombatContentListPage,
  CompleteCombatContentRecord,
  CompleteCombatContentWrite,
} from '@aurevane/db/combat-content'
import 'server-only'
import { combatContentCategory } from '../combat/combat-content-categories'
import { parseStoredStatusDefinition } from '../combat/combat-standalone-content'
import { isCombatContentKind, parseCompleteCombatContentRecord } from './combat-content-record'

import { createSelectedCharacterRpc } from './selected-character-rpc'

import {
  CombatContentConflictError,
  type CombatContentDefinition,
  type CombatContentDraftRecord,
  type CombatContentKind,
  type CombatContentVersionRecord,
  type PublishCombatContentInput,
  type SaveCombatContentDraftInput,
} from '@aurevane/db/combat-content'
import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { assertCombatCatalogueTimingCompatible } from '@/server/combat/combat-catalogue-timing-compatibility'
import {
  RpcPublishedCombatContentSource,
  resolveCombatContentCatalogueSnapshot,
} from '@/server/combat/combat-content-resolver'
import { builtinCombatContentDefinition } from './combat-content-builtin-index'
import { builtinCombatContentVersionFloor } from './combat-content-version-floor'

import type {
  CombatContentAuthoringStore,
  MasterPanelOperatorRole,
} from './combat-content-authoring-service'

type RpcError = { readonly code?: string; readonly message?: string }
type RpcResult = { readonly data: unknown; readonly error: RpcError | null }
export type CombatAuthoringRpc = (
  functionName: string,
  parameters: Readonly<Record<string, unknown>>,
) => PromiseLike<RpcResult>

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function positiveBigintAsNumber(value: unknown): number | null {
  if (positiveInteger(value)) return value
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function combatContentKind(value: unknown): CombatContentKind | null {
  return combatContentCategory(value)?.storedKind ?? null
}

function oneRow(data: unknown): JsonObject | null {
  if (data === null || (Array.isArray(data) && data.length === 0)) return null
  return Array.isArray(data) && data.length === 1 && isObject(data[0]) ? data[0] : null
}

function parseDefinition(value: unknown): CombatContentDefinition | null {
  return isObject(value) ? (structuredClone(value) as CombatContentDefinition) : null
}

function parseDraftRow(data: unknown): CombatContentDraftRecord | null {
  const row = oneRow(data)
  if (!row) return null
  const kind = combatContentKind(row.content_kind)
  const definition = parseDefinition(row.definition)
  const baseVersion = row.base_version === null ? null : row.base_version
  const draftVersion = positiveBigintAsNumber(row.draft_version)
  if (
    !requiredString(row.content_key) ||
    !kind ||
    !definition ||
    (baseVersion !== null && !positiveInteger(baseVersion)) ||
    draftVersion === null ||
    !requiredString(row.updated_by) ||
    !requiredString(row.updated_at)
  ) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The server returned an invalid combat draft.',
    )
  }
  return {
    contentKey: row.content_key,
    contentKind: kind,
    definition,
    baseVersion,
    draftVersion,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }
}

function parseVersionRow(row: unknown): CombatContentVersionRecord | null {
  if (!isObject(row)) return null
  const kind = combatContentKind(row.content_kind)
  const definition = parseDefinition(row.definition)
  if (
    !requiredString(row.id) ||
    !requiredString(row.content_key) ||
    !kind ||
    !positiveInteger(row.content_version) ||
    !definition ||
    !requiredString(row.published_by) ||
    !requiredString(row.published_at)
  ) {
    return null
  }
  return {
    id: row.id,
    contentKey: row.content_key,
    contentKind: kind,
    contentVersion: row.content_version,
    definition,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
  }
}

function parseSingleVersion(data: unknown): CombatContentVersionRecord | null {
  const row = oneRow(data)
  if (!row) return null
  const parsed = parseVersionRow(row)
  if (!parsed) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The server returned invalid published combat content.',
    )
  }
  return parsed
}

function parseVersionList(data: unknown): readonly CombatContentVersionRecord[] {
  if (!Array.isArray(data)) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The server returned invalid combat content history.',
    )
  }
  const parsed = data.map(parseVersionRow)
  if (parsed.some((row) => row === null)) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The server returned invalid combat content history.',
    )
  }
  return parsed as CombatContentVersionRecord[]
}

function mapRpcError(error: RpcError): never {
  const message = error.message ?? ''
  if (
    error.code === '0A000' &&
    /COMBAT_CONTENT_(COMPLETE_RECORD_REQUIRED|SAVED_REVISION_REQUIRED|RESTORE_TO_DRAFT_REQUIRED)/u.test(
      message,
    )
  )
    throw new AurevaneError(
      'INVALID_REQUEST',
      'This operation requires the complete saved-record workflow. Refresh the content editor before continuing.',
    )
  if (
    /COMBAT_CONTENT_(RECORD_CONFLICT|REQUEST_CONFLICT|IDENTITY_CONFLICT|ADMISSION_RETRY)/u.test(
      message,
    )
  )
    throw new AurevaneError(
      'STALE_VERSION',
      'Content changed. Refresh and review the complete record before retrying.',
    )
  const inputMessages: Readonly<Record<string, string>> = {
    COMBAT_CONTENT_BUILTIN_SELECTION_DEPENDENCY:
      'This content is still selected by an existing Discipline or Discipline pair. Its selection must be replaced before archive is available.',
    COMBAT_CONTENT_DEPENDENCIES:
      'This content is still in use. Review Used by before changing its lifecycle.',
    COMBAT_CONTENT_ARCHIVED:
      'A referenced record is archived. Restore and publish it before adding new references.',
    COMBAT_CONTENT_BASIC_DUPLICATE_UNSUPPORTED:
      'Basic actions keep reserved identities and cannot be duplicated as ordinary Skills.',
    COMBAT_CONTENT_ESSENTIAL: 'This essential Basic action cannot be archived.',
    COMBAT_CONTENT_SOURCE_IMMUTABLE:
      'An existing Skill’s intrinsic source Discipline cannot change. Create a separate Skill instead.',
    COMBAT_CONTENT_LINK_LIMIT: 'A Discipline can link at most 256 Skills.',
    COMBAT_CONTENT_RESTORE_REQUIRED:
      'Restore an immutable version to a fresh draft before publishing archived content.',
    COMBAT_CONTENT_NOT_FOUND: 'The content record could not be found. Refresh the content list.',
  }
  if (error.code === '22023')
    throw new AurevaneError(
      'INVALID_REQUEST',
      inputMessages[message] ?? 'The content request contains unsupported or invalid fields.',
    )
  if (message.includes('COMBAT_CONTENT_CATALOGUE_CONFLICT'))
    throw new AurevaneError(
      'STALE_VERSION',
      'Combat content or timing changed. Refresh before publishing again.',
    )
  if (message.includes('COMBAT_CONTENT_DRAFT_VERSION_CONFLICT')) {
    throw new CombatContentConflictError(
      'COMBAT_CONTENT_DRAFT_VERSION_CONFLICT',
      'The combat-content draft changed before this save.',
    )
  }
  if (message.includes('COMBAT_CONTENT_BASE_VERSION_CONFLICT')) {
    throw new CombatContentConflictError(
      'COMBAT_CONTENT_BASE_VERSION_CONFLICT',
      'The published combat-content base changed before this publish.',
    )
  }
  if (message.includes('COMBAT_CONTENT_VERSION_NOT_FOUND')) {
    throw new CombatContentConflictError(
      'COMBAT_CONTENT_VERSION_NOT_FOUND',
      'The requested combat-content version does not exist.',
    )
  }
  if (error.code === '42501' || message.includes('MASTER_PANEL_OPERATOR_REQUIRED')) {
    throw new AurevaneError(
      'FORBIDDEN',
      'Master Panel combat authoring is not available to this account.',
      { cause: error },
    )
  }
  throw new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Master Panel combat content is unavailable right now.',
    { cause: error },
  )
}

export class RpcCombatContentAuthoringStore implements CombatContentAuthoringStore {
  readonly #rpc: CombatAuthoringRpc
  readonly #actorUserId: string

  constructor(rpc: CombatAuthoringRpc, actorUserId: string) {
    this.#rpc = rpc
    this.#actorUserId = actorUserId
  }

  async getOperatorRole(userId: string): Promise<MasterPanelOperatorRole | null> {
    const { data, error } = await this.#rpc('read_master_panel_operator_v1', {
      p_user_id: userId,
    })
    if (error) mapRpcError(error)
    const row = oneRow(data)
    if (!row) return null
    if (
      row.user_id !== userId ||
      row.enabled !== true ||
      (row.role !== 'owner' && row.role !== 'content-staff')
    ) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The server returned an invalid Master Panel operator record.',
      )
    }
    return row.role
  }

  async readRecord(contentKey: string): Promise<CompleteCombatContentRecord | null> {
    const { data, error } = await this.#rpc('read_combat_content_record_v1', {
      p_actor_user_id: this.#actorUserId,
      p_content_key: contentKey,
    })
    if (error) mapRpcError(error)
    if (data === null) return null
    const record = parseCompleteCombatContentRecord(data)
    if (record.builtin && !record.current && record.lifecycle !== 'archived') {
      const definition = builtinCombatContentDefinition(record.contentKind, record.contentKey)
      if (!definition || definition.contentVersion !== record.builtin.contentVersion)
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'The builtin identity index does not match this server catalogue.',
        )
      return { ...record, builtinDefinition: definition }
    }
    return record
  }
  async listRecords(input: {
    kind?: CombatContentKind
    lifecycle?: string
    search?: string
    after?: string
    limit?: number
  }): Promise<CombatContentListPage> {
    const { data, error } = await this.#rpc('list_combat_content_records_v1', {
      p_actor_user_id: this.#actorUserId,
      p_kind: input.kind ?? null,
      p_lifecycle: input.lifecycle ?? null,
      p_search: input.search ?? null,
      p_after: input.after ?? null,
      p_limit: input.limit ?? 30,
    })
    if (error) mapRpcError(error)
    if (
      !isObject(data) ||
      !Array.isArray(data.records) ||
      data.records.length > (input.limit ?? 30) ||
      (data.nextCursor !== null && !requiredString(data.nextCursor)) ||
      data.records.some(
        (row) =>
          !isObject(row) ||
          !requiredString(row.contentKey) ||
          !isCombatContentKind(row.contentKind) ||
          !['draft', 'active', 'archived'].includes(String(row.lifecycle)) ||
          !positiveInteger(row.revision),
      )
    )
      throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The content list is invalid.')
    return data as unknown as CombatContentListPage
  }
  async writeRecord(
    contentKey: string,
    command: CompleteCombatContentWrite,
  ): Promise<CompleteCombatContentRecord> {
    if (command.action === 'create') {
      const blocker = combatContentCategory(command.contentKind, contentKey)?.authoringBlocker
      if (blocker) throw new AurevaneError('INVALID_REQUEST', blocker.message)
    }
    if (command.action === 'create' && command.contentKind === 'status')
      parseStoredStatusDefinition(command.definition)
    if (
      command.action === 'save' ||
      command.action === 'duplicate' ||
      command.action === 'restore'
    ) {
      const source = await this.readRecord(
        command.action === 'duplicate' ? command.sourceKey : contentKey,
      )
      const blocker =
        source && combatContentCategory(source.contentKind, source.contentKey)!.authoringBlocker
      if (blocker) throw new AurevaneError('INVALID_REQUEST', blocker.message)
      if (source?.contentKind === 'status' && command.action === 'save')
        parseStoredStatusDefinition(command.definition)
      if (source?.contentKind === 'status' && command.action === 'restore') {
        // The displayed history is bounded. Validate the exact immutable source, not
        // just those recent entries, before SQL can commit it as the editable draft.
        const { data, error } = await this.#rpc('read_combat_content_version_v1', {
          p_content_key: contentKey,
          p_content_kind: 'status',
          p_content_version: command.sourceVersion,
        })
        if (error) mapRpcError(error)
        const historical = parseSingleVersion(data)
        if (!historical)
          throw new AurevaneError(
            'INVALID_REQUEST',
            'That historical Status version does not exist. Choose an available version.',
          )
        if (
          historical.contentKey !== contentKey ||
          historical.contentKind !== 'status' ||
          historical.contentVersion !== command.sourceVersion
        )
          throw new AurevaneError(
            'PERSISTENCE_UNAVAILABLE',
            'The server returned a different historical Status version.',
          )
        try {
          const definition = parseStoredStatusDefinition(historical.definition)
          if (
            definition.id !== contentKey ||
            (definition.contentVersion !== undefined &&
              definition.contentVersion !== historical.contentVersion)
          )
            throw new TypeError('Invalid historical Status identity.')
        } catch (cause) {
          throw new AurevaneError(
            'INVALID_REQUEST',
            'This historical Status version is unsupported for restoration. Choose a supported version or edit the current draft; the original history is retained.',
            { cause },
          )
        }
        // The mutation below still receives the caller's original expectedRevision.
      }
    }
    const { data, error } = await this.#rpc('write_combat_content_record_v1', {
      p_actor_user_id: this.#actorUserId,
      p_content_key: contentKey,
      p_command: command,
    })
    if (error) mapRpcError(error)
    return parseCompleteCombatContentRecord(data)
  }
  async publishSaved(
    record: Pick<CompleteCombatContentRecord, 'contentKey'>,
    expectedDraftVersion: number,
    expectedBaseVersion: number | null,
  ): Promise<CompleteCombatContentRecord> {
    const saved = await this.readRecord(record.contentKey)
    if (
      !saved?.draft ||
      saved.draft.draftVersion !== expectedDraftVersion ||
      saved.draft.baseVersion !== expectedBaseVersion
    )
      throw new AurevaneError(
        'STALE_VERSION',
        'Save and review the current draft before publishing.',
      )
    const descriptor = combatContentCategory(saved.contentKind, saved.contentKey)!
    if (descriptor.publicationBlocker) {
      if (!descriptor.authoringBlocker) descriptor.parseAuthoring(saved.draft.definition)
      throw new AurevaneError('INVALID_REQUEST', descriptor.publicationBlocker.message)
    }
    const floor = Math.max(
      saved.versionFloor,
      builtinCombatContentVersionFloor(saved.contentKind, saved.contentKey) ?? 0,
    )
    const token = await this.#validatePublication(saved.contentKey, saved.contentKind, {
      id: 'prospective',
      contentKey: saved.contentKey,
      contentKind: saved.contentKind,
      contentVersion: Number(saved.draft.definition.contentVersion ?? 1),
      definition: saved.draft.definition,
      publishedBy: this.#actorUserId,
      publishedAt: 'prospective',
    })
    const { data, error } = await this.#rpc('publish_saved_combat_content_v1', {
      p_actor_user_id: this.#actorUserId,
      p_content_key: saved.contentKey,
      p_expected_draft_version: expectedDraftVersion,
      p_expected_base_version: expectedBaseVersion,
      p_expected_catalogue_token: token,
      p_version_floor: floor || null,
    })
    if (error) mapRpcError(error)
    return parseCompleteCombatContentRecord(data)
  }

  async findDraft(contentKey: string): Promise<CombatContentDraftRecord | null> {
    const { data, error } = await this.#rpc('read_combat_content_draft_v1', {
      p_actor_user_id: this.#actorUserId,
      p_content_key: contentKey,
    })
    if (error) mapRpcError(error)
    return parseDraftRow(data)
  }

  async saveDraft(input: SaveCombatContentDraftInput): Promise<CombatContentDraftRecord> {
    this.#assertActor(input.actorUserId)
    const { data, error } = await this.#rpc('save_combat_content_draft_v1', {
      p_actor_user_id: input.actorUserId,
      p_content_key: input.contentKey,
      p_content_kind: input.contentKind,
      p_definition: input.definition,
      p_base_version: input.baseVersion,
      p_expected_draft_version: input.expectedDraftVersion,
    })
    if (error) mapRpcError(error)
    const row = parseDraftRow(data)
    if (!row) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The server did not return the saved combat draft.',
      )
    }
    return row
  }

  async publish(input: PublishCombatContentInput): Promise<CombatContentVersionRecord> {
    this.#assertActor(input.actorUserId)
    if (
      input.versionFloor !== undefined &&
      input.versionFloor !== null &&
      (!Number.isSafeInteger(input.versionFloor) || input.versionFloor < 1)
    )
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Publication version floor must be a positive integer.',
      )
    const floor = Math.max(
      input.versionFloor ?? 0,
      builtinCombatContentVersionFloor(input.contentKind, input.contentKey) ?? 0,
    )
    const token = await this.#validatePublication(input.contentKey, input.contentKind, {
      id: 'prospective',
      contentKey: input.contentKey,
      contentKind: input.contentKind,
      contentVersion: positiveInteger(input.definition.contentVersion)
        ? (input.definition.contentVersion as number)
        : 1,
      definition: input.definition,
      publishedBy: input.actorUserId,
      publishedAt: '',
    })
    const { data, error } = await this.#rpc('publish_combat_content_v3', {
      p_actor_user_id: input.actorUserId,
      p_content_key: input.contentKey,
      p_content_kind: input.contentKind,
      p_definition: input.definition,
      p_expected_base_version: input.expectedBaseVersion,
      p_expected_catalogue_token: token,
      p_version_floor: floor || null,
    })
    if (error) mapRpcError(error)
    const row = parseSingleVersion(data)
    if (!row) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The server did not return the published combat version.',
      )
    }
    return row
  }

  async findPublished(
    contentKey: string,
    contentKind: CombatContentKind = 'skill',
  ): Promise<CombatContentVersionRecord | null> {
    const { data, error } = await this.#rpc('read_current_combat_content_v1', {
      p_content_key: contentKey,
      p_content_kind: contentKind,
    })
    if (error) mapRpcError(error)
    return parseSingleVersion(data)
  }

  async listPublishedVersions(contentKey: string): Promise<readonly CombatContentVersionRecord[]> {
    const { data, error } = await this.#rpc('list_combat_content_versions_v1', {
      p_actor_user_id: this.#actorUserId,
      p_content_key: contentKey,
    })
    if (error) mapRpcError(error)
    return parseVersionList(data)
  }

  async setCurrentPublication(
    contentKey: string,
    version: number | null,
    actorUserId: string,
    contentKind: CombatContentKind = 'skill',
  ): Promise<void> {
    this.#assertActor(actorUserId)
    const target =
      version === null
        ? null
        : (await this.listPublishedVersions(contentKey)).find(
            (row) => row.contentKind === contentKind && row.contentVersion === version,
          )
    if (target === undefined)
      throw new CombatContentConflictError(
        'COMBAT_CONTENT_VERSION_NOT_FOUND',
        'The requested combat-content version does not exist.',
      )
    const token = await this.#validatePublication(contentKey, contentKind, target)
    const { error } = await this.#rpc('set_combat_content_publication_v2', {
      p_actor_user_id: actorUserId,
      p_content_key: contentKey,
      p_content_kind: contentKind,
      p_target_version: version,
      p_expected_catalogue_token: token,
    })
    if (error) mapRpcError(error)
  }

  async #validatePublication(
    contentKey: string,
    contentKind: CombatContentKind,
    target: CombatContentVersionRecord | null,
  ): Promise<string> {
    const blocker = combatContentCategory(contentKind, contentKey)?.publicationBlocker
    if (target && blocker) throw new AurevaneError('INVALID_REQUEST', blocker.message)
    const snapshot = await new RpcPublishedCombatContentSource(this.#rpc).readCatalogueSnapshot()
    if (
      snapshot.publications.some(
        (row) => row.contentKey === contentKey && row.contentKind !== contentKind,
      )
    )
      throw new AurevaneError('INVALID_REQUEST', 'A published content identity cannot change kind.')
    const publications = snapshot.publications.filter((row) => row.contentKey !== contentKey)
    if (target) publications.push(target)
    assertCombatCatalogueTimingCompatible(
      resolveCombatContentCatalogueSnapshot({
        ...snapshot,
        publications,
        archivedKeys: target
          ? snapshot.archivedKeys?.filter((key) => key !== contentKey)
          : snapshot.archivedKeys,
      }),
    )
    return snapshot.token
  }

  #assertActor(actorUserId: string): void {
    if (actorUserId !== this.#actorUserId) {
      throw new AurevaneError('FORBIDDEN', 'Master Panel actor context changed unexpectedly.')
    }
  }
}

export function createSupabaseCombatContentAuthoringStore(
  actorUserId: string,
): RpcCombatContentAuthoringStore {
  const client = createSupabaseAdminClient()
  return new RpcCombatContentAuthoringStore(
    createSelectedCharacterRpc(
      (functionName, parameters) =>
        client.rpc(functionName, parameters) as unknown as PromiseLike<RpcResult>,
    ),
    actorUserId,
  )
}
