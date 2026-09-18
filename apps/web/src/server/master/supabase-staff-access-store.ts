import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

import {
  isMasterPanelRole,
  isMasterPanelSpecialCapability,
  type DelegatedMasterPanelRole,
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
    const access = parseAccessRow(value)
    if (!access || (value.email !== null && typeof value.email !== 'string')) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The server returned an invalid Master Panel staff record.',
      )
    }
    return { ...access, email: value.email as string | null }
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
  if (
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
    throw new AurevaneError('INVALID_REQUEST', 'That Master Panel authority change is not allowed.', {
      cause: error,
    })
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

  async resolveAccountByEmail(
    actorUserId: string,
    email: string,
  ): Promise<MasterPanelAccountReference | null> {
    const { data, error } = await this.#rpc('resolve_master_panel_account_v1', {
      p_actor_user_id: actorUserId,
      p_email: email,
    })
    if (error) mapRpcError(error)
    const row = oneRow(data)
    if (!row) return null
    if (
      typeof row.user_id !== 'string' ||
      typeof row.email !== 'string' ||
      row.email.toLowerCase() !== email.toLowerCase()
    ) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The server returned an invalid Master Panel account lookup.',
      )
    }
    return { userId: row.user_id, email: row.email }
  }

  async grantRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note: string
  }): Promise<number> {
    const { data, error } = await this.#rpc('grant_master_panel_role_v1', {
      p_actor_user_id: input.actorUserId,
      p_target_user_id: input.targetUserId,
      p_role: input.role,
      p_note: input.note,
    })
    if (error) mapRpcError(error)
    return requiredVersion(data)
  }

  async revokeRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note: string
  }): Promise<number> {
    const { data, error } = await this.#rpc('revoke_master_panel_role_v1', {
      p_actor_user_id: input.actorUserId,
      p_target_user_id: input.targetUserId,
      p_role: input.role,
      p_note: input.note,
    })
    if (error) mapRpcError(error)
    return requiredVersion(data)
  }

  async grantCapability(input: {
    actorUserId: string
    targetUserId: string
    capability: MasterPanelSpecialCapability
    note: string
  }): Promise<number> {
    const { data, error } = await this.#rpc('grant_master_panel_capability_v1', {
      p_actor_user_id: input.actorUserId,
      p_target_user_id: input.targetUserId,
      p_capability: input.capability,
      p_note: input.note,
    })
    if (error) mapRpcError(error)
    return requiredVersion(data)
  }

  async revokeCapability(input: {
    actorUserId: string
    targetUserId: string
    capability: MasterPanelSpecialCapability
    note: string
  }): Promise<number> {
    const { data, error } = await this.#rpc('revoke_master_panel_capability_v1', {
      p_actor_user_id: input.actorUserId,
      p_target_user_id: input.targetUserId,
      p_capability: input.capability,
      p_note: input.note,
    })
    if (error) mapRpcError(error)
    return requiredVersion(data)
  }
}

export function createSupabaseMasterPanelStaffAccessStore(): RpcMasterPanelStaffAccessStore {
  const client = createSupabaseAdminClient()
  return new RpcMasterPanelStaffAccessStore(
    (functionName, parameters) =>
      client.rpc(functionName, parameters) as unknown as PromiseLike<RpcResult>,
  )
}
