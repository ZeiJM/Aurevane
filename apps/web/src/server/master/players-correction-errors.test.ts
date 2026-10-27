import { expect, it, vi } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('./selected-character-rpc', () => ({ createSelectedCharacterRpc: (call: unknown) => call }))
vi.mock('./staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => ({ requireCapability: async () => {} }),
}))
import { createServerMasterPlayersService } from './players-server'
it.each([
  ['CHARACTER_ATTRIBUTE_POINT_POOL_EXCEEDED', 'exceeds the personal point pool'],
  ['CHARACTER_ATTRIBUTE_BELOW_PRIMARY_BASE', 'below the fixed Primary Discipline base'],
  ['CHARACTER_ATTRIBUTE_DISCIPLINE_CAP_EXCEEDED', 'exceeds a Primary focus or nonfocus cap'],
  ['PLAYER_XP_RANGE_INVALID', 'XP exceeds the current progression cycle'],
])(
  'explains the actual authoritative source correction rejection: %s',
  async (message, expected) => {
    rpc.mockResolvedValue({ data: null, error: { code: '22023', message } })
    await expect(createServerMasterPlayersService().search('owner', 'Storm')).rejects.toThrow(
      expected,
    )
  },
)
