import { beforeEach, describe, expect, it, vi } from 'vitest'

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
