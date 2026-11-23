import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { MasterActivityFeed, MasterActivityEntry } from '@/master/activity-log'
import type { MasterPanelStaffAccessService } from './staff-access'

export function isActivityCursor(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9]\d{0,18}$/u.test(value) &&
    BigInt(value) <= 9223372036854775807n
  )
}
function unavailable(): never {
  throw new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'The activity log could not be loaded. Try refreshing.',
  )
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function text(value: unknown, max: number, empty = false): value is string {
  return typeof value === 'string' && value.length <= max && (empty || value.length > 0)
}
function timestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

export function parseMasterActivityFeed(value: unknown): MasterActivityFeed {
  if (
    !record(value) ||
    !timestamp(value.weekStartsAt) ||
    !timestamp(value.resetsAt) ||
    Date.parse(value.resetsAt) - Date.parse(value.weekStartsAt) !== 604800000 ||
    !Array.isArray(value.entries) ||
    value.entries.length > 100 ||
    (value.nextCursor !== null && !isActivityCursor(value.nextCursor))
  )
    unavailable()
  const entries: MasterActivityEntry[] = value.entries.map((entry: unknown) => {
    if (
      !record(entry) ||
      !isActivityCursor(entry.id) ||
      !timestamp(entry.occurredAt) ||
      !text(entry.actor, 120) ||
      !text(entry.action, 80) ||
      !text(entry.subject, 160) ||
      !text(entry.detail, 400, true)
    )
      unavailable()
    return {
      id: entry.id,
      occurredAt: entry.occurredAt,
      actor: entry.actor,
      action: entry.action,
      subject: entry.subject,
      detail: entry.detail,
    }
  })
  return {
    entries,
    weekStartsAt: value.weekStartsAt,
    resetsAt: value.resetsAt,
    nextCursor: value.nextCursor,
  }
}

export function createMasterActivityService(
  access: Pick<MasterPanelStaffAccessService, 'requireCapability'>,
  rpc: (name: string, parameters: Record<string, unknown>) => Promise<unknown>,
) {
  return {
    async read(userId: string, before: string | null = null): Promise<MasterActivityFeed> {
      await access.requireCapability(userId, 'activity.read')
      if (before !== null && !isActivityCursor(before))
        throw new AurevaneError('INVALID_REQUEST', 'Choose a valid activity page.')
      return parseMasterActivityFeed(
        await rpc('read_master_panel_activity_v1', {
          p_actor_user_id: userId,
          p_limit: 100,
          p_before_id: before,
        }),
      )
    },
  }
}
export type MasterActivityService = ReturnType<typeof createMasterActivityService>
