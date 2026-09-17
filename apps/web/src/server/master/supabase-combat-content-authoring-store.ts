import 'server-only'

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
  return value === 'skill' || value === 'status' || value === 'effect-profile' ? value : null
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
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The server returned an invalid combat draft.')
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
    const { data, error } = await this.#rpc('publish_combat_content_v1', {
      p_actor_user_id: input.actorUserId,
      p_content_key: input.contentKey,
      p_content_kind: input.contentKind,
      p_definition: input.definition,
      p_expected_base_version: input.expectedBaseVersion,
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

  async findPublished(contentKey: string): Promise<CombatContentVersionRecord | null> {
    const { data, error } = await this.#rpc('read_current_combat_content_v1', {
      p_content_key: contentKey,
      p_content_kind: 'skill',
    })
    if (error) mapRpcError(error)
    return parseSingleVersion(data)
  }

  async listPublishedVersions(
    contentKey: string,
  ): Promise<readonly CombatContentVersionRecord[]> {
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
  ): Promise<void> {
    this.#assertActor(actorUserId)
    const { error } = await this.#rpc('set_combat_content_publication_v1', {
      p_actor_user_id: actorUserId,
      p_content_key: contentKey,
      p_content_kind: 'skill',
      p_target_version: version,
    })
    if (error) mapRpcError(error)
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
    (functionName, parameters) =>
      client.rpc(functionName, parameters) as unknown as PromiseLike<RpcResult>,
    actorUserId,
  )
}
