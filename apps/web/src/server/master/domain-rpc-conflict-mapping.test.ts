import { expect, it, vi } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('./selected-character-rpc', () => ({ createSelectedCharacterRpc: (call: unknown) => call }))
vi.mock('./staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => ({ requireCapability: async () => {} }),
}))
import { RpcMasterPanelStaffAccessStore } from './supabase-staff-access-store'
import { RpcEventAuthoringStore } from './supabase-event-authoring-store'
import { createSupabaseEventOperationsStore } from './supabase-event-operations-store'
import { createServerMasterPlayersService } from './players-server'
import { createSupabaseBattleSessionRepository } from '../battle/supabase-battle-session-repository'
import { toServerErrorResponse } from '../http/error-response'
it.each(['40001', 'PT409'])(
  'all code-based domain adapters preserve actual HTTP409 for %s',
  async (code) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: 'DOMAIN_CONFLICT' } })
    const calls = [
      () => new RpcMasterPanelStaffAccessStore(rpc).resolveIdentity('owner', 'Chosen'),
      () => new RpcEventAuthoringStore(rpc, 'owner').readDraft('event.test'),
      () => createSupabaseEventOperationsStore().listRuns('owner'),
      () => createServerMasterPlayersService().search('owner', 'Chosen'),
    ]
    for (const call of calls) {
      const error = await call().catch((error: unknown) => error)
      expect(error).toMatchObject({ code: 'STALE_VERSION' })
      expect(toServerErrorResponse(error).status).toBe(409)
    }
    rpc.mockResolvedValue({ data: null, error: { code, message: 'BATTLE_VERSION_STALE:7' } })
    const battleError = await createSupabaseBattleSessionRepository()
      .findBattleSession('owner', 'battle')
      .catch((error: unknown) => error)
    expect(battleError).toMatchObject({ code: 'STALE_VERSION', currentVersion: 7 })
    expect(toServerErrorResponse(battleError).status).toBe(409)
  },
)
it('unrelated SQL errors retain the existing persistence classification', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'statement timeout' } })
  await expect(
    new RpcEventAuthoringStore(rpc, 'owner').readDraft('event.test'),
  ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
})
