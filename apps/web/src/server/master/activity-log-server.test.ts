import { expect, it, vi } from 'vitest'
const dependencies = vi.hoisted(() => ({ rpc: vi.fn(), access: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc: dependencies.rpc }),
}))
vi.mock('./staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => ({ requireCapability: dependencies.access }),
}))
import { createServerMasterActivityService } from './activity-log-server'

it('keeps the database RPC service-only and maps authority/persistence failure without leaking SQL', async () => {
  dependencies.access.mockResolvedValue({ roles: ['game-owner'] })
  dependencies.rpc.mockResolvedValue({
    data: null,
    error: { code: '42501', message: 'sensitive database error' },
  })
  await expect(createServerMasterActivityService().read('owner')).rejects.toMatchObject({
    code: 'FORBIDDEN',
  })
  dependencies.rpc.mockResolvedValue({
    data: null,
    error: { code: 'XX000', message: 'sensitive database error' },
  })
  await expect(createServerMasterActivityService().read('owner')).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
    publicMessage: 'The activity log could not be loaded. Try refreshing.',
  })
  const feed = {
    entries: [],
    weekStartsAt: '2026-10-26T00:00:00Z',
    resetsAt: '2026-11-02T00:00:00Z',
    nextCursor: null,
  }
  dependencies.rpc.mockResolvedValue({ data: feed, error: null })
  expect(await createServerMasterActivityService().read('owner')).toEqual(feed)
  expect(dependencies.rpc).toHaveBeenLastCalledWith('read_master_panel_activity_v1', {
    p_actor_user_id: 'owner',
    p_before_id: null,
    p_limit: 100,
  })
})
