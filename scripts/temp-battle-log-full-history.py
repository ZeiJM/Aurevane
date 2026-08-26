from pathlib import Path

service = Path('apps/web/src/server/battle/battle-log-service.ts')
text = service.read_text()
old = "import type { BattleEventRecord, BattleEventRepository } from '@aurevane/db/battle-session'"
new = """import type {
  BattleEventCursor,
  BattleEventRecord,
  BattleEventRepository,
} from '@aurevane/db/battle-session'"""
if old not in text:
    raise SystemExit('battle-log-service import anchor not found')
text = text.replace(old, new, 1)
if 'const BATTLE_LOG_LIMIT = 100' not in text:
    raise SystemExit('battle-log limit anchor not found')
text = text.replace('const BATTLE_LOG_LIMIT = 100', 'const BATTLE_LOG_PAGE_SIZE = 100', 1)

context_anchor = """  for (const entry of oldestFirst) {
    if (entry.eventType === 'round_started') turnNumber = null
    if (entry.round !== null) round = entry.round
    if (entry.turnNumber !== null) turnNumber = entry.turnNumber
    context.set(eventKey(entry), {
      round: entry.round ?? round,
      turnNumber: entry.turnNumber ?? turnNumber,
    })
  }

  return entries.map((entry) => {
"""
context_replacement = """  for (const entry of oldestFirst) {
    if (entry.eventType === 'round_started') turnNumber = null
    if (entry.round !== null) round = entry.round
    if (entry.turnNumber !== null) turnNumber = entry.turnNumber
    context.set(eventKey(entry), {
      round: entry.round ?? round,
      turnNumber: entry.turnNumber ?? turnNumber,
    })
  }

  let nextRound: number | null = null
  for (let index = oldestFirst.length - 1; index >= 0; index -= 1) {
    const entry = oldestFirst[index]
    if (!entry) continue
    const key = eventKey(entry)
    const resolved = context.get(key)
    if (!resolved) continue
    if (resolved.round !== null) {
      nextRound = resolved.round
      continue
    }
    if (nextRound !== null) context.set(key, { ...resolved, round: nextRound })
  }

  return entries.map((entry) => {
"""
if context_anchor not in text:
    raise SystemExit('battle context anchor not found')
text = text.replace(context_anchor, context_replacement, 1)

service_anchor = """export function createBattleLogService(repository: BattleEventRepository): BattleLogService {
  return {
    async getLog(userId, battleSessionId) {
      const records = await repository.findBattleEvents(userId, battleSessionId, BATTLE_LOG_LIMIT)
      return buildBattleLogView(battleSessionId, records)
    },
  }
}
"""
service_replacement = """export async function collectBattleEventHistory(
  fetchPage: (
    pageSize: number,
    before?: BattleEventCursor,
  ) => Promise<readonly BattleEventRecord[]>,
): Promise<BattleEventRecord[]> {
  const records: BattleEventRecord[] = []
  const seen = new Set<string>()
  let before: BattleEventCursor | undefined

  while (true) {
    const page = await fetchPage(BATTLE_LOG_PAGE_SIZE, before)
    if (page.length === 0) break

    for (const record of page) {
      const key = `${record.battleVersion}:${record.eventIndex}`
      if (seen.has(key)) continue
      seen.add(key)
      records.push(record)
    }

    if (page.length < BATTLE_LOG_PAGE_SIZE) break
    const oldest = page.at(-1)
    if (!oldest) break
    const nextBefore: BattleEventCursor = {
      battleVersion: oldest.battleVersion,
      eventIndex: oldest.eventIndex,
    }
    if (
      before?.battleVersion === nextBefore.battleVersion &&
      before.eventIndex === nextBefore.eventIndex
    ) {
      throw new Error('Battle event history pagination did not advance.')
    }
    before = nextBefore
  }

  return records
}

export function createBattleLogService(repository: BattleEventRepository): BattleLogService {
  return {
    async getLog(userId, battleSessionId) {
      const records = await collectBattleEventHistory((pageSize, before) =>
        before
          ? repository.findBattleEvents(userId, battleSessionId, pageSize, before)
          : repository.findBattleEvents(userId, battleSessionId, pageSize),
      )
      return buildBattleLogView(battleSessionId, records)
    },
  }
}
"""
if service_anchor not in text:
    raise SystemExit('battle log service anchor not found')
text = text.replace(service_anchor, service_replacement, 1)
service.write_text(text)

pvp = Path('apps/web/src/server/battle/pvp-battle-communication-service.ts')
text = pvp.read_text()
old = "import { buildBattleLogView, type BattleLogView } from './battle-log-service'"
new = """import {
  buildBattleLogView,
  collectBattleEventHistory,
  type BattleLogView,
} from './battle-log-service'"""
if old not in text:
    raise SystemExit('pvp battle log import anchor not found')
text = text.replace(old, new, 1)
old = """export async function getPvpBattleLog(
  userId: string,
  battleSessionId: string,
): Promise<BattleLogView> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('list_pvp_battle_events_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
    p_limit: 100,
  })
  if (error) mapRpcError(error)
  if (!Array.isArray(data)) throw unavailable('The battle log returned invalid data.')
  return buildBattleLogView(battleSessionId, data.map(parseEventRow))
}
"""
new = """export async function getPvpBattleLog(
  userId: string,
  battleSessionId: string,
): Promise<BattleLogView> {
  const supabase = createSupabaseAdminClient()
  const records = await collectBattleEventHistory(async (pageSize, before) => {
    const { data, error } = await supabase.rpc('list_pvp_battle_events_v2', {
      p_user_id: userId,
      p_battle_session_id: battleSessionId,
      p_limit: pageSize,
      p_before_battle_version: before?.battleVersion ?? null,
      p_before_event_index: before?.eventIndex ?? null,
    })
    if (error) mapRpcError(error)
    if (!Array.isArray(data)) throw unavailable('The battle log returned invalid data.')
    return data.map(parseEventRow)
  })
  return buildBattleLogView(battleSessionId, records)
}
"""
if old not in text:
    raise SystemExit('getPvpBattleLog anchor not found')
text = text.replace(old, new, 1)
pvp.write_text(text)

presentation = Path('apps/web/src/components/battle/battle-log-presentation.ts')
text = presentation.read_text()
old = "action.round === null ? 'recent' : `round:${action.round}`"
if old not in text:
    raise SystemExit('Recent presentation bucket anchor not found')
text = text.replace(old, "action.round === null ? 'battle' : `round:${action.round}`", 1)
presentation.write_text(text)

feed = Path('apps/web/src/components/battle/battle-log-feed.tsx')
text = feed.read_text()
old = "round.round === null ? 'Recent' : `Round ${round.round}`"
if old not in text:
    raise SystemExit('Recent feed label anchor not found')
text = text.replace(old, "round.round === null ? 'Battle' : `Round ${round.round}`", 1)
feed.write_text(text)

service_test = Path('apps/web/src/server/battle/battle-log-service.test.ts')
text = service_test.read_text()
addition = r'''

  it('pages through complete history, restores early round context, and never duplicates a page boundary', async () => {
    const newestPage = Array.from({ length: 100 }, (_, index) => ({
      battleVersion: 102 - index,
      eventIndex: 0,
      event: {
        event: 'combatant_moved',
        combatantId: 'character:player-1',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
        movementCost: 1,
      },
      createdAt: '2026-08-17T13:02:00.000Z',
    }))
    const findBattleEvents = vi.fn(
      async (
        _userId: string,
        _battleSessionId: string,
        _limit: number,
        before?: { battleVersion: number; eventIndex: number },
      ) => {
        if (!before) return newestPage
        expect(before).toEqual({ battleVersion: 3, eventIndex: 0 })
        return [
          newestPage.at(-1)!,
          {
            battleVersion: 2,
            eventIndex: 0,
            event: {
              event: 'turn_started',
              combatantId: 'character:player-1',
              round: 1,
              turnNumber: 1,
            },
            createdAt: '2026-08-17T12:01:00.000Z',
          },
          {
            battleVersion: 1,
            eventIndex: 0,
            event: { event: 'round_started', round: 1 },
            createdAt: '2026-08-17T12:00:00.000Z',
          },
        ]
      },
    )
    const repository: BattleEventRepository = { findBattleEvents }

    const result = await createBattleLogService(repository).getLog(USER_ID, SESSION_ID)

    expect(findBattleEvents).toHaveBeenCalledTimes(2)
    expect(findBattleEvents).toHaveBeenNthCalledWith(1, USER_ID, SESSION_ID, 100)
    expect(findBattleEvents).toHaveBeenNthCalledWith(2, USER_ID, SESSION_ID, 100, {
      battleVersion: 3,
      eventIndex: 0,
    })
    expect(result.entries.some((entry) => entry.battleVersion === 1)).toBe(true)
    expect(result.entries.filter((entry) => entry.battleVersion === 3)).toHaveLength(1)
    expect(result.entries.find((entry) => entry.battleVersion === 102)).toEqual(
      expect.objectContaining({ round: 1, turnNumber: 1 }),
    )
  })
'''
marker = '\n})\n'
position = text.rfind(marker)
if position == -1:
    raise SystemExit('battle-log-service test suite end not found')
text = text[:position] + addition + text[position:]
service_test.write_text(text)

presentation_test = Path('apps/web/src/components/battle/battle-log-presentation.test.ts')
text = presentation_test.read_text()
addition = r'''

  it('uses a neutral Battle fallback rather than a Recent bucket for genuinely roundless events', () => {
    const rounds = buildBattleLogPresentation([entry({ round: null, turnNumber: null })], {
      combatantNames: names,
    })
    expect(rounds[0]?.key).toBe('battle')
    expect(rounds[0]?.round).toBeNull()
    expect(rounds.some((round) => round.key === 'recent')).toBe(false)
  })
'''
position = text.rfind(marker)
if position == -1:
    raise SystemExit('battle-log-presentation test suite end not found')
text = text[:position] + addition + text[position:]
presentation_test.write_text(text)

pvp_test = Path('apps/web/src/server/battle/pvp-battle-communication-service.test.ts')
pvp_test.write_text(r'''import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}))

import { getPvpBattleLog } from './pvp-battle-communication-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'

function eventRow(battleVersion: number) {
  return {
    battle_version: battleVersion,
    event_index: 0,
    event: { event: 'combatant_waited', combatantId: 'character:player-1' },
    created_at: '2026-08-25T16:00:00.000Z',
  }
}

describe('PvP battle communication history', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
  })

  it('pages the full spectator-visible battle history and does not fall back to the capped v1 read', async () => {
    const newestPage = Array.from({ length: 100 }, (_, index) => eventRow(102 - index))
    mocks.rpc.mockImplementation(async (functionName: string, params: Record<string, unknown>) => {
      expect(functionName).toBe('list_pvp_battle_events_v2')
      if (params.p_before_battle_version === null) {
        expect(params.p_before_event_index).toBeNull()
        return { data: newestPage, error: null }
      }
      expect(params.p_before_battle_version).toBe(3)
      expect(params.p_before_event_index).toBe(0)
      return { data: [eventRow(2), eventRow(1)], error: null }
    })

    const result = await getPvpBattleLog(USER_ID, SESSION_ID)

    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    expect(mocks.rpc.mock.calls.some(([name]) => name === 'list_pvp_battle_events_v1')).toBe(false)
    expect(result.entries.some((entry) => entry.battleVersion === 102)).toBe(true)
    expect(result.entries.some((entry) => entry.battleVersion === 1)).toBe(true)
  })
})
''')

docs = Path('docs/BATTLE_LOG_SYSTEM.md')
text = docs.read_text()
heading = '## Complete-history retention\n'
if heading not in text:
    text += r'''

## Complete-history retention

Battle Log history is the complete sanitized projection of the persisted battle event stream for the authorized battle, not a rolling recent-event window. Database reads remain bounded and keyset-paginated, while the server composes the pages before projection so early rounds do not disappear as a battle grows.

Numbered rounds remain available for the entire battle and keep the existing newest-first/collapsed presentation. A genuinely roundless prelude may use the neutral `Battle` grouping, but the renderer does not expose a synthetic `Recent` bucket. Participant and active-spectator reads follow the same retention rule without changing combat authority or exposing raw event internals.
'''
docs.write_text(text)

migration = Path('supabase/migrations/20260826003500_battle_log_full_history_pagination.sql')
text = migration.read_text()
old = """  if (p_before_battle_version is null) <> (p_before_event_index is null) then
    raise exception using errcode = '22023', message = 'BATTLE_EVENT_CURSOR_INVALID';
  end if;
"""
new = """  if (p_before_battle_version is null) <> (p_before_event_index is null)
    or coalesce(p_before_battle_version, 1) < 1
    or coalesce(p_before_event_index, 0) < 0 then
    raise exception using errcode = '22023', message = 'BATTLE_EVENT_CURSOR_INVALID';
  end if;
"""
if text.count(old) != 2:
    raise SystemExit('migration cursor validation anchors not found')
text = text.replace(old, new)
migration.write_text(text)
