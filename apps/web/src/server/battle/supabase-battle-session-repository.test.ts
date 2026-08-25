import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}))

import { createSupabaseBattleSessionRepository } from './supabase-battle-session-repository'

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

describe('Supabase battle event history pagination', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('reads every persisted event page instead of truncating battle history at 100 events', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => eventRow(101 - index))
    rpc
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [eventRow(1)], error: null })

    const repository = createSupabaseBattleSessionRepository()
    const records = await repository.findBattleEvents(USER_ID, SESSION_ID, 100)

    expect(records).toHaveLength(101)
    expect(records[0]?.battleVersion).toBe(101)
    expect(records.at(-1)?.battleVersion).toBe(1)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenNthCalledWith(1, 'get_battle_events_v3', {
      p_user_id: USER_ID,
      p_battle_session_id: SESSION_ID,
      p_limit: 100,
      p_before_battle_version: null,
      p_before_event_index: null,
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'get_battle_events_v3', {
      p_user_id: USER_ID,
      p_battle_session_id: SESSION_ID,
      p_limit: 100,
      p_before_battle_version: 2,
      p_before_event_index: 0,
    })
  })

  it('stops after one page when the entire battle history fits in the first page', async () => {
    rpc.mockResolvedValueOnce({ data: [eventRow(2), eventRow(1)], error: null })

    const repository = createSupabaseBattleSessionRepository()
    const records = await repository.findBattleEvents(USER_ID, SESSION_ID, 100)

    expect(records.map((record) => record.battleVersion)).toEqual([2, 1])
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
