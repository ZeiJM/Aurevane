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
it.each([
  ['PLAYER_TELEPORT_FERRY', 'aboard a ferry'],
  ['PLAYER_TELEPORT_DESTINATION_BLOCKED', 'destination is unavailable or blocked'],
  ['PLAYER_BATTLE_ACTIVE', 'End the encounter safely'],
])('explains teleport rejection %s', async (message, expected) => {
  rpc.mockResolvedValue({ data: null, error: { code: '22023', message } })
  await expect(createServerMasterPlayersService().search('owner', 'Storm')).rejects.toThrow(
    expected,
  )
})
it('retains permission denial if selected-character access is revoked during geometry preparation', async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { code: '42501', message: 'MASTER_PANEL_PAGE_ACCESS_REQUIRED' },
  })
  await expect(
    createServerMasterPlayersService().teleport('owner', {
      characterId: 'target',
      expectedVersion: 1,
      requestKey: 'request',
      reason: 'Reviewed player recovery',
      destination: { map: 'mainland', sectorNumber: 28 * 128 + 62 + 1, x: 6, y: 4 },
    }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
it('returns a server-resolved row-major location label with exact privileged coordinates', async () => {
  rpc.mockResolvedValue({
    data: {
      characterId: 'target',
      fingerprint: 'f'.repeat(64),
      facts: {
        level: 1,
        xp: 0,
        cycle: 1,
        attributes: { might: 12, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
        build: { disciplineSkills: [], extensions: { essence: null, resonance: null } },
      },
      world: { version: 5, position: { sectorId: 'void:ivory-veil:1:1', x: 6, y: 4 } },
    },
    error: null,
  })
  const player = await createServerMasterPlayersService().read('owner', 'target')
  expect(player.world?.locationLabel).toBe('Sector34 · X:6 · Y:4')
})
