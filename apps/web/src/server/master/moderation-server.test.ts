import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const state = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: state.rpc }) }))
vi.mock('./selected-character-rpc', () => ({ createSelectedCharacterRpc: (rpc: unknown) => rpc }))
vi.mock('./staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => ({ requireCapability: async () => ({}) }),
}))
import { createServerMasterModerationService } from './moderation-server'
it.each(['PT409', '40001'])(
  'maps %s to a caller-resolvable conflict without exposing SQL',
  async (code) => {
    state.rpc.mockResolvedValue({ data: null, error: { code, message: 'private SQL' } })
    await expect(
      createServerMasterModerationService().read('staff', 'target'),
    ).rejects.toMatchObject({
      code: 'STALE_VERSION',
      publicMessage: 'This ban changed. Refresh the player before trying again.',
    })
  },
)
