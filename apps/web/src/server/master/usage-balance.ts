import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { UsageBalanceReport, BalanceOutcomes } from '@/master/usage-balance'
import type { MasterPanelStaffAccessService } from './staff-access'
function unavailable(): never {
  throw new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Usage & Balance could not be loaded. Try refreshing.',
  )
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return unavailable()
  return v as Record<string, unknown>
}
function count(v: unknown): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return unavailable()
  return v
}
function text(v: unknown): string {
  if (typeof v !== 'string' || !v || v.length > 160) return unavailable()
  return v
}
function date(v: unknown): string {
  const s = text(v)
  if (!Number.isFinite(Date.parse(s))) return unavailable()
  return s
}
function list<T>(v: unknown, max: number, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(v) || v.length > max) return unavailable()
  return v.map(parse)
}
function outcomes(v: unknown): BalanceOutcomes {
  const r = object(v)
  if (r.source !== 'pvp' && r.source !== 'pve-recruit') return unavailable()
  const result: BalanceOutcomes = {
    source: r.source,
    appearances: count(r.appearances),
    wins: count(r.wins),
    losses: count(r.losses),
    draws: count(r.draws),
  }
  if (result.appearances !== result.wins + result.losses + result.draws) return unavailable()
  return result
}
export function parseUsageBalanceReport(value: unknown, key: string): UsageBalanceReport {
  const r = object(value),
    c = object(r.current),
    coverage = object(r.coverage)
  if (
    r.contentKey !== key ||
    !['discipline', 'skill', 'unsupported'].includes(r.subjectKind as string) ||
    coverage.legacyHistoryAvailable !== false ||
    typeof coverage.rosterTruncated !== 'boolean' ||
    typeof coverage.battlesTruncated !== 'boolean'
  )
    return unavailable()
  const weekStartsAt = date(r.weekStartsAt),
    weekEndsAt = date(r.weekEndsAt)
  if (Date.parse(weekEndsAt) - Date.parse(weekStartsAt) !== 604800000) return unavailable()
  return {
    ...(r.availableWeeks === undefined
      ? {}
      : {
          availableWeeks: list(r.availableWeeks, 105, (v) => {
            const value = text(v)
            if (
              !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
              !Number.isFinite(Date.parse(value)) ||
              new Date(value).getUTCDay() !== 1 ||
              new Date(value).toISOString().slice(0, 10) !== value
            )
              return unavailable()
            return value
          }),
        }),
    contentKey: key,
    subjectKind: r.subjectKind as UsageBalanceReport['subjectKind'],
    asOf: date(r.asOf),
    weekStartsAt,
    weekEndsAt,
    current: {
      primaryPlayers: count(c.primaryPlayers),
      secondaryPlayers: count(c.secondaryPlayers),
      primaryCharacters: count(c.primaryCharacters),
      secondaryCharacters: count(c.secondaryCharacters),
      totalPlayers: count(c.totalPlayers),
      totalCharacters: count(c.totalCharacters),
    },
    skills: list(r.skills, 200, (v) => {
      const s = object(v)
      return {
        skillId: text(s.skillId),
        name: text(s.name),
        equippedPlayers: count(s.equippedPlayers),
        equippedCharacters: count(s.equippedCharacters),
        actualUses: count(s.actualUses),
        usedBattles: count(s.usedBattles),
      }
    }),
    weekly: list(r.weekly, 2, outcomes),
    pairs: list(r.pairs, 10, (v) => {
      const p = object(v)
      return {
        primary: text(p.primary),
        secondary: p.secondary === null ? null : text(p.secondary),
        players: count(p.players),
        characters: count(p.characters),
      }
    }),
    matchups: list(r.matchups, 10, (v) => ({ ...outcomes(v), opponent: text(object(v).opponent) })),
    coverage: {
      legacyHistoryAvailable: false,
      rosterTruncated: coverage.rosterTruncated,
      battlesTruncated: coverage.battlesTruncated,
      collectedBattles: count(coverage.collectedBattles),
      collectionStartedAt:
        coverage.collectionStartedAt === null ? null : date(coverage.collectionStartedAt),
    },
  }
}
export function createUsageBalanceService(
  access: Pick<MasterPanelStaffAccessService, 'requireCapability'>,
  rpc: (name: string, parameters: Record<string, unknown>) => Promise<unknown>,
) {
  return {
    async read(userId: string, contentKey: string, week?: string): Promise<UsageBalanceReport> {
      await access.requireCapability(userId, 'content.combat.author')
      if (contentKey.length > 160 || !/^[a-z0-9]+([._-][a-z0-9]+)*$/.test(contentKey))
        throw new AurevaneError('INVALID_REQUEST', 'Choose valid content to inspect.')
      if (
        week !== undefined &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(week) ||
          !Number.isFinite(Date.parse(week)) ||
          new Date(week).getUTCDay() !== 1 ||
          new Date(week).toISOString().slice(0, 10) !== week)
      )
        throw new AurevaneError('INVALID_REQUEST', 'Choose a collected UTC week.')
      const report = parseUsageBalanceReport(
        await rpc('read_master_usage_balance_week_v1', {
          p_actor_user_id: userId,
          p_content_key: contentKey,
          p_week_start: week ?? null,
        }),
        contentKey,
      )
      if (week && report.weekStartsAt.slice(0, 10) !== week) return unavailable()
      return report
    },
  }
}
export type UsageBalanceService = ReturnType<typeof createUsageBalanceService>
