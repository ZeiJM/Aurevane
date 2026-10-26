import 'server-only'

import { createSelectedCharacterRpc } from './selected-character-rpc'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

import {
  isMasterPanelRole,
  MASTER_PANEL_CAPABILITIES,
  isMasterPanelRoleDefaultsRoles,
  type MasterPanelRoleDefaults,
  type SaveMasterPanelRoleDefaultsInput,
  isMasterPanelSpecialCapability,
  type SetCharacterStaffAccessInput,
  type MasterPanelAccessRecord,
  type MasterPanelAccountReference,
  type MasterPanelRole,
  type MasterPanelSpecialCapability,
  type MasterPanelStaffAccessStore,
  type MasterPanelStaffSummary,
} from './staff-access'

type RpcError = { readonly code?: string; readonly message?: string }
type RpcResult = { readonly data: unknown; readonly error: RpcError | null }
export type StaffAccessRpc = (
  functionName: string,
  parameters: Readonly<Record<string, unknown>>,
) => PromiseLike<RpcResult>

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function oneRow(data: unknown): JsonObject | null {
  if (data === null || (Array.isArray(data) && data.length === 0)) return null
  return Array.isArray(data) && data.length === 1 && isObject(data[0]) ? data[0] : null
}

function positiveBigintAsNumber(value: unknown): number | null {
  if (Number.isSafeInteger(value) && (value as number) > 0) return value as number
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function parseRoles(value: unknown): readonly MasterPanelRole[] | null {
  if (!Array.isArray(value) || !value.every(isMasterPanelRole)) return null
  if (new Set(value).size !== value.length) return null
  return value
}

function parseSpecialCapabilities(value: unknown): readonly MasterPanelSpecialCapability[] | null {
  if (!Array.isArray(value) || !value.every(isMasterPanelSpecialCapability)) return null
  if (new Set(value).size !== value.length) return null
  return value
}

function parseAccessRow(row: JsonObject, expectedUserId?: string): MasterPanelAccessRecord | null {
  const accessVersion = positiveBigintAsNumber(row.access_version)
  const roles = parseRoles(row.roles)
  const specialCapabilities = parseSpecialCapabilities(row.special_capabilities)
  const effectiveCapabilities = row.effective_capabilities
  if (
    !Array.isArray(effectiveCapabilities) ||
    !effectiveCapabilities.every((value) => MASTER_PANEL_CAPABILITIES.includes(value)) ||
    new Set(effectiveCapabilities).size !== effectiveCapabilities.length ||
    (!roles?.includes('game-owner') && effectiveCapabilities.includes('staff.manage'))
  )
    return null
  if (
    typeof row.user_id !== 'string' ||
    (expectedUserId !== undefined && row.user_id !== expectedUserId) ||
    accessVersion === null ||
    roles === null ||
    specialCapabilities === null
  ) {
    return null
  }

  return {
    userId: row.user_id,
    accessVersion,
    roles,
    specialCapabilities,
    effectiveCapabilities,
  }
}

function parseRoleDefaults(value: unknown): MasterPanelRoleDefaults {
  if (!isObject(value)) return invalidPayload()
  const revision = positiveBigintAsNumber(value.revision)
  if (!revision || !isMasterPanelRoleDefaultsRoles(value.roles)) return invalidPayload()
  return { revision, roles: value.roles }
}

function parseStaffList(data: unknown): readonly MasterPanelStaffSummary[] {
  if (!Array.isArray(data)) invalidPayload()
  return (data as unknown[]).map((value) => {
    if (!isObject(value)) return invalidPayload()
    const roles = parseRoles(value.roles),
      specialCapabilities = parseSpecialCapabilities(value.specialCapabilities)
    const accessVersion = positiveBigintAsNumber(value.accessVersion)
    if (
      typeof value.userId !== 'string' ||
      (value.email !== null && typeof value.email !== 'string') ||
      (value.characterId !== null && typeof value.characterId !== 'string') ||
      (value.characterName !== null && typeof value.characterName !== 'string') ||
      !['active', 'expired', 'revoked', 'unavailable', 'needs-binding', 'owner'].includes(
        String(value.status),
      ) ||
      (value.expiresAt !== null &&
        (typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt)))) ||
      !roles ||
      !specialCapabilities ||
      accessVersion === null
    )
      return invalidPayload()
    return {
      userId: value.userId,
      email: value.email,
      characterId: value.characterId,
      characterName: value.characterName,
      status: value.status,
      expiresAt: value.expiresAt,
      accessVersion,
      roles,
      specialCapabilities,
    } as MasterPanelStaffSummary
  })
}
function invalidPayload(): never {
  throw new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'The server returned an invalid Staff & Access record.',
  )
}

function mapRpcError(error: RpcError): never {
  const message = error.message ?? ''
  if (
    error.code === '42501' ||
    message.includes('MASTER_PANEL_ACCESS_REQUIRED') ||
    message.includes('MASTER_PANEL_OWNER_REQUIRED')
  ) {
    throw new AurevaneError('FORBIDDEN', 'Master Panel access is not available to this account.', {
      cause: error,
    })
  }
  if (error.code === '40001' || error.code === 'PT409')
    throw new AurevaneError('STALE_VERSION', 'Refresh Staff & Access before editing again.')
  if (
    error.code === '22023' ||
    error.code === '23503' ||
    message.includes('MASTER_PANEL_ROLE_INVALID') ||
    message.includes('MASTER_PANEL_OWNER_ROLE_PROTECTED') ||
    message.includes('MASTER_PANEL_SELF_GRANT_FORBIDDEN') ||
    message.includes('MASTER_PANEL_SELF_CAPABILITY_GRANT_FORBIDDEN') ||
    message.includes('MASTER_PANEL_TARGET_NOT_FOUND') ||
    message.includes('MASTER_PANEL_CAPABILITY_INVALID') ||
    message.includes('MASTER_PANEL_ROOT_CAPABILITY_PROTECTED') ||
    message.includes('MASTER_PANEL_STAFF_ROLE_REQUIRED') ||
    message.includes('MASTER_PANEL_ROLE_REQUIRED_FOR_CAPABILITY') ||
    message.includes('MASTER_PANEL_REASON_REQUIRED') ||
    message.includes('MASTER_PANEL_ACCOUNT_EMAIL_INVALID')
  ) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'That Master Panel authority change is not allowed.',
      {
        cause: error,
      },
    )
  }
  throw new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Master Panel staff access is unavailable right now.',
    { cause: error },
  )
}

function requiredVersion(data: unknown): number {
  const version = positiveBigintAsNumber(data)
  if (version === null) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The server returned an invalid Master Panel access version.',
    )
  }
  return version
}

export class RpcMasterPanelStaffAccessStore implements MasterPanelStaffAccessStore {
  readonly #rpc: StaffAccessRpc

  constructor(rpc: StaffAccessRpc) {
    this.#rpc = rpc
  }

  async readAccess(userId: string): Promise<MasterPanelAccessRecord | null> {
    const { data, error } = await this.#rpc('read_master_panel_access_v2', {
      p_user_id: userId,
    })
    if (error) mapRpcError(error)
    const row = oneRow(data)
    if (!row) return null
    const parsed = parseAccessRow(row, userId)
    if (!parsed) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The server returned an invalid Master Panel access record.',
      )
    }
    return parsed
  }

  async readRoleDefaults(actorUserId: string): Promise<MasterPanelRoleDefaults> {
    const { data, error } = await this.#rpc('read_master_panel_role_defaults_v1', {
      p_actor_user_id: actorUserId,
    })
    if (error) mapRpcError(error)
    return parseRoleDefaults(data)
  }
  async saveRoleDefaults(
    input: SaveMasterPanelRoleDefaultsInput,
  ): Promise<MasterPanelRoleDefaults> {
    const { data, error } = await this.#rpc('save_master_panel_role_defaults_v1', {
      p_actor_user_id: input.actorUserId,
      p_expected_revision: input.expectedRevision,
      p_roles: input.roles,
    })
    if (error) mapRpcError(error)
    return parseRoleDefaults(data)
  }

  async listStaff(actorUserId: string): Promise<readonly MasterPanelStaffSummary[]> {
    const { data, error } = await this.#rpc('list_master_panel_staff_v2', {
      p_actor_user_id: actorUserId,
    })
    if (error) mapRpcError(error)
    return parseStaffList(data)
  }
  async resolveIdentity(
    actorUserId: string,
    query: string,
  ): Promise<MasterPanelAccountReference | null> {
    const { data, error } = await this.#rpc('resolve_master_panel_account_v2', {
      p_actor_user_id: actorUserId,
      p_query: query,
    })
    if (error) mapRpcError(error)
    if (data === null) return null
    if (
      !isObject(data) ||
      typeof data.userId !== 'string' ||
      typeof data.email !== 'string' ||
      !Array.isArray(data.characters)
    )
      return invalidPayload()
    const characters = data.characters.map((value) => {
      if (
        !isObject(value) ||
        typeof value.characterId !== 'string' ||
        typeof value.name !== 'string' ||
        typeof value.playable !== 'boolean'
      )
        return invalidPayload()
      return { characterId: value.characterId, name: value.name, playable: value.playable }
    })
    return { userId: data.userId, email: data.email, characters }
  }
  async setCharacterAccess(input: SetCharacterStaffAccessInput): Promise<number> {
    const { data, error } = await this.#rpc('set_master_panel_character_access_v2', {
      p_actor_user_id: input.actorUserId,
      p_target_user_id: input.targetUserId,
      p_target_character_id: input.targetCharacterId,
      p_roles: input.roles,
      p_special_capabilities: input.specialCapabilities,
      p_days: input.days,
      p_expected_version: input.expectedVersion,
      p_enabled: input.enabled,
    })
    if (error) mapRpcError(error)
    return requiredVersion(data)
  }
}

export function createSupabaseMasterPanelStaffAccessStore(): RpcMasterPanelStaffAccessStore {
  const client = createSupabaseAdminClient()
  return new RpcMasterPanelStaffAccessStore(
    createSelectedCharacterRpc(
      (functionName, parameters) =>
        client.rpc(functionName, parameters) as unknown as PromiseLike<RpcResult>,
    ),
  )
}
