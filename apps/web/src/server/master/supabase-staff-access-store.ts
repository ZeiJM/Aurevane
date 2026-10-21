import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { selectedStaffRpcParameters } from './selected-staff-actor'

import {
  isMasterPanelRole,
  isMasterPanelSpecialCapability,
  type CharacterAccessAssignment,
  type CharacterAccessRevocation,
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
  if (
    typeof row.user_id !== 'string' ||
    typeof row.character_id !== 'string' ||
    (expectedUserId !== undefined && row.user_id !== expectedUserId) ||
    accessVersion === null ||
    roles === null ||
    specialCapabilities === null
  ) {
    return null
  }

  return {
    userId: row.user_id,
    characterId: row.character_id as string,
    accessVersion,
    roles,
    specialCapabilities,
  }
}

function parseStaffList(data: unknown): readonly MasterPanelStaffSummary[] {
  if (!Array.isArray(data)) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The server returned an invalid Master Panel staff list.',
    )
  }

  return data.map((value) => {
    if (!isObject(value)) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The server returned an invalid Master Panel staff record.',
      )
    }
    const access = parseAccessRow({ ...value, character_id: value.character_id ?? 'unbound' })
    if (!access || (value.email !== null && typeof value.email !== 'string')) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The server returned an invalid Master Panel staff record.',
      )
    }
    if (
      !['owner', 'active', 'expired', 'revoked', 'needs-binding'].includes(String(value.status)) ||
      (value.character_id !== null && typeof value.character_id !== 'string') ||
      (value.character_name !== null && typeof value.character_name !== 'string') ||
      (value.expires_at !== null &&
        (typeof value.expires_at !== 'string' || !Number.isFinite(Date.parse(value.expires_at))))
    ) {
      throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Invalid staff character state.')
    }
    return {
      ...access,
      characterId: value.character_id as string | null,
      characterName: value.character_name as string | null,
      email: value.email as string | null,
      status: value.status as MasterPanelStaffSummary['status'],
      expiresAt: value.expires_at as string | null,
    }
  })
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
  if (error.code === '40001') {
    throw new AurevaneError('STALE_VERSION', 'Staff access changed. Refresh and try again.')
  }
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
    const { data, error } = await this.#rpc('read_master_panel_access_v1', {
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

  async listStaff(actorUserId: string): Promise<readonly MasterPanelStaffSummary[]> {
    const { data, error } = await this.#rpc('list_master_panel_staff_v1', {
      p_actor_user_id: actorUserId,
    })
    if (error) mapRpcError(error)
    return parseStaffList(data)
  }

  async resolveAccounts(
    actorUserId: string,
    query: string,
  ): Promise<readonly MasterPanelAccountReference[]> {
    const { data, error } = await this.#rpc('resolve_master_panel_accounts_v2', {
      p_actor_user_id: actorUserId,
      p_query: query,
    })
    if (error) mapRpcError(error)
    if (!Array.isArray(data))
      throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Invalid identity lookup.')
    return data.map((row: unknown) => {
      if (
        !isObject(row) ||
        typeof row.user_id !== 'string' ||
        typeof row.email !== 'string' ||
        !Array.isArray(row.characters) ||
        !row.characters.every(
          (c: unknown) =>
            isObject(c) &&
            typeof c.id === 'string' &&
            typeof c.name === 'string' &&
            typeof c.playable === 'boolean',
        )
      ) {
        throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Invalid linked character lookup.')
      }
      return {
        userId: row.user_id,
        email: row.email,
        characters: row.characters as unknown as MasterPanelAccountReference['characters'],
      }
    })
  }

  async setCharacterAccess(input: CharacterAccessAssignment): Promise<number> {
    const { data, error } = await this.#rpc('set_master_panel_character_access_v2', {
      p_actor_user_id: input.actorUserId,
      p_target_character_id: input.targetCharacterId,
      p_roles: input.roles,
      p_capabilities: input.specialCapabilities,
      p_days: input.days,
      p_bind_legacy: input.bindLegacy,
      p_expected_access_version: input.expectedAccessVersion,
    })
    if (error) mapRpcError(error)
    return requiredVersion(data)
  }

  async revokeLegacyAccess(input: {
    actorUserId: string
    targetUserId: string
    expectedAccessVersion: number | null
  }): Promise<number> {
    const { data, error } = await this.#rpc('revoke_master_panel_legacy_access_v2', {
      p_actor_user_id: input.actorUserId,
      p_target_user_id: input.targetUserId,
      p_expected_access_version: input.expectedAccessVersion,
    })
    if (error) mapRpcError(error)
    return requiredVersion(data)
  }

  async revokeCharacterAccess(input: CharacterAccessRevocation): Promise<number> {
    const { data, error } = await this.#rpc('revoke_master_panel_character_access_v2', {
      p_actor_user_id: input.actorUserId,
      p_target_character_id: input.targetCharacterId,
      p_expected_access_version: input.expectedAccessVersion,
    })
    if (error) mapRpcError(error)
    return requiredVersion(data)
  }
}

export function createSupabaseMasterPanelStaffAccessStore(): RpcMasterPanelStaffAccessStore {
  const client = createSupabaseAdminClient()
  return new RpcMasterPanelStaffAccessStore(
    (functionName, parameters) =>
      selectedStaffRpcParameters(parameters).then((verified) =>
        client.rpc(functionName, verified),
      ) as unknown as PromiseLike<RpcResult>,
  )
}
