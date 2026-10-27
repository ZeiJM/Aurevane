import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { ModerationPlayer, ModerationRecord } from '@/master/moderation'
import type { MasterPanelStaffAccessService } from './staff-access'

export interface ModerationChange {
  targetUserId: string
  expectedRevision: string
  action: 'ban' | 'edit' | 'lift'
  reason: string
  minutes: number | null
  permanent: boolean
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function invalid(): never {
  throw new AurevaneError(
    'INVALID_REQUEST',
    'Choose a valid ban duration and enter a reason (1–1000 characters).',
  )
}
function unavailable(): never {
  throw new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Moderation returned an invalid record. Refresh and try again.',
  )
}
export function parseModerationRecord(value: unknown): ModerationRecord {
  if (
    !record(value) ||
    typeof value.userId !== 'string' ||
    typeof value.revision !== 'string' ||
    !/^[0-9a-f]{32}$/.test(value.revision) ||
    typeof value.active !== 'boolean' ||
    typeof value.permanent !== 'boolean' ||
    typeof value.protected !== 'boolean' ||
    (value.expiresAt !== null &&
      (typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt)))) ||
    !Array.isArray(value.history) ||
    value.history.length > 100 ||
    (value.nextCursor !== null &&
      (typeof value.nextCursor !== 'string' ||
        !/^[1-9]\d{0,18}$/.test(value.nextCursor) ||
        BigInt(value.nextCursor) > 9223372036854775807n)) ||
    (value.permanent && (!value.active || value.expiresAt !== null)) ||
    (value.active && !value.permanent && value.expiresAt === null) ||
    (!value.active && value.expiresAt !== null)
  )
    unavailable()
  const history = value.history.map((item: unknown) => {
    if (
      !record(item) ||
      typeof item.actor !== 'string' ||
      item.actor.length < 1 ||
      item.actor.length > 120 ||
      typeof item.id !== 'string' ||
      !/^\d{1,19}$/.test(item.id) ||
      typeof item.action !== 'string' ||
      !['ban', 'edit', 'lift'].includes(item.action) ||
      typeof item.reason !== 'string' ||
      item.reason.length > 1000 ||
      typeof item.occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(item.occurredAt)) ||
      typeof item.until !== 'string'
    )
      unavailable()
    return {
      id: item.id,
      actor: item.actor,
      action: item.action as 'ban' | 'edit' | 'lift',
      reason: item.reason,
      occurredAt: item.occurredAt,
      until: item.until,
    }
  })
  return {
    userId: value.userId,
    revision: value.revision,
    active: value.active,
    permanent: value.permanent,
    protected: value.protected,
    expiresAt: value.expiresAt,
    history,
    nextCursor: value.nextCursor as string | null,
  }
}
export function createMasterModerationService(
  access: Pick<MasterPanelStaffAccessService, 'requireCapability'>,
  rpc: (name: string, parameters: Record<string, unknown>) => Promise<unknown>,
) {
  async function call(userId: string, name: string, parameters: Record<string, unknown>) {
    await access.requireCapability(userId, 'moderation.manage')
    return rpc(name, { p_actor_user_id: userId, ...parameters })
  }
  return {
    async search(userId: string, query: string): Promise<ModerationPlayer[]> {
      if (query.trim().length < 2 || query.trim().length > 80) invalid()
      const value = await call(userId, 'search_master_moderation_players_v1', {
        p_query: query.trim(),
      })
      if (!Array.isArray(value) || value.length > 20) unavailable()
      return value.map((item: unknown) => {
        if (
          !record(item) ||
          typeof item.userId !== 'string' ||
          typeof item.characterId !== 'string' ||
          typeof item.name !== 'string' ||
          typeof item.protected !== 'boolean'
        )
          unavailable()
        return {
          userId: item.userId,
          characterId: item.characterId,
          name: item.name,
          protected: item.protected,
        }
      })
    },
    async read(
      userId: string,
      targetUserId: string,
      before: string | null = null,
    ): Promise<ModerationRecord> {
      if (
        before !== null &&
        (typeof before !== 'string' ||
          !/^[1-9]\d{0,18}$/.test(before) ||
          BigInt(before) > 9223372036854775807n)
      )
        invalid()
      return parseModerationRecord(
        await call(userId, 'read_master_moderation_v1', {
          p_target_user_id: targetUserId,
          p_before_id: before,
        }),
      )
    },
    async write(userId: string, change: ModerationChange): Promise<ModerationRecord> {
      if (
        !['ban', 'edit', 'lift'].includes(change.action) ||
        typeof change.reason !== 'string' ||
        !change.reason.trim() ||
        change.reason.trim().length > 1000 ||
        typeof change.expectedRevision !== 'string' ||
        !/^[0-9a-f]{32}$/.test(change.expectedRevision) ||
        typeof change.permanent !== 'boolean' ||
        (change.action !== 'lift' &&
          !change.permanent &&
          (!Number.isSafeInteger(change.minutes) ||
            Number(change.minutes) < 1 ||
            Number(change.minutes) > 52560000))
      )
        invalid()
      return parseModerationRecord(
        await call(userId, 'write_master_moderation_v1', {
          p_target_user_id: change.targetUserId,
          p_expected_revision: change.expectedRevision,
          p_action: change.action,
          p_reason: change.reason.trim(),
          p_minutes: change.minutes,
          p_permanent: change.permanent,
        }),
      )
    },
  }
}
export type MasterModerationService = ReturnType<typeof createMasterModerationService>
