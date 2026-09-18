import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

import {
  isMasterPanelRole,
  type DelegatedMasterPanelRole,
  type MasterPanelAccessRecord,
  type MasterPanelRole,
  type MasterPanelStaffAccessStore,
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
  if (!Array.isArray(value) || value.length === 0 || !value.every(isMasterPanelRole)) return null
  if (new Set(value).size !== value.length) return null
  return value
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
    message.includes('MASTER_PANEL_TARGET_NOT_FOUND') ||
    message.includes('MASTER_PANEL_NOTE_INVALID')
  ) {
    throw new AurevaneError('INVALID_REQUEST', 'That Master Panel role change is not allowed.', {
      cause: error,
    })
  }
  throw new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Master Panel staff access is unavailable right now.',
    { cause: error },
  )
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

    const accessVersion = positiveBigintAsNumber(row.access_version)
    const roles = parseRoles(row.roles)
    if (row.user_id !== userId || accessVersion === null || roles === null) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The server returned an invalid Master Panel access record.',
      )
    }

    return { userId, accessVersion, roles }
  }

  async grantRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note: string | null
  }): Promise<number> {
    const { data, error } = await this.#rpc('grant_master_panel_role_v1', {
      p_actor_user_id: input.actorUserId,
      p_target_user_id: input.targetUserId,
      p_role: input.role,
      p_note: input.note,
    })
    if (error) mapRpcError(error)
    const version = positiveBigintAsNumber(data)
    if (version === null) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The server returned an invalid Master Panel access version.',
      )
    }
    return version
  }

  async revokeRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note: string | null
  }): Promise<number> {
    const { data, error } = await this.#rpc('revoke_master_panel_role_v1', {
      p_actor_user_id: input.actorUserId,
      p_target_user_id: input.targetUserId,
      p_role: input.role,
      p_note: input.note,
    })
    if (error) mapRpcError(error)
    const version = positiveBigintAsNumber(data)
    if (version === null) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The server returned an invalid Master Panel access version.',
      )
    }
    return version
  }
}

export function createSupabaseMasterPanelStaffAccessStore(): RpcMasterPanelStaffAccessStore {
  const client = createSupabaseAdminClient()
  return new RpcMasterPanelStaffAccessStore(
    (functionName, parameters) =>
      client.rpc(functionName, parameters) as unknown as PromiseLike<RpcResult>,
  )
}
