import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from, images } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  images: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc, from }) }))
vi.mock('@/server/character/character-profile-display-service', () => ({
  loadPublicCharacterProfileImageMap: images,
}))

import { listCharacterPresenceDirectory, listOnlineCharacters } from './character-presence-service'

const roster = Array.from({ length: 1001 }, (_, index) => ({
  character_id: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  character_name: `Adventurer ${String(index).padStart(4, '0')}`,
  character_level: 1,
  last_seen_at: '2026-10-05T18:00:00Z',
  is_online: true,
}))

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockImplementation(async (name: string, args?: { p_character_ids: string[] }) => ({
    error: null,
    data:
      name === 'get_character_public_active_disciplines_v1'
        ? args!.p_character_ids.slice(0, 1000).map((id) => ({
            character_id: id,
            primary_discipline_id: 'vanguard',
            secondary_discipline_id: 'lifebinder',
          }))
        : roster,
  }))
  from.mockImplementation(() => ({
    select: (columns: string) => ({
      in: async (_column: string, ids: string[]) => {
        // Model the gateway request-line limit and Data API's default row limit.
        const queryLength = `/rest/v1/characters?select=${columns}&id=in.(${ids.join(',')})`.length
        if (queryLength > 8192) return { data: null, error: { code: '414' } }
        return {
          error: null,
          data: ids.slice(0, 1000).map((id) => ({
            id,
            xp: Number(id.slice(-12)),
            portrait_ref: 'portrait.starter.wayfarer-01',
            personal_title: 'Keeper',
            user_id: 'private-account-sentinel',
          })),
        }
      },
    }),
  }))
  images.mockImplementation(async (ids: string[]) => {
    if (ids.join(',').length > 8192) throw new Error('414')
    return new Map(ids.map((id) => [id, '/media/public-portrait.webp']))
  })
})

describe('large public character rosters', () => {
  it.each([
    ['online', listOnlineCharacters],
    ['directory', listCharacterPresenceDirectory],
  ] as const)(
    'hydrates every supplied identity in the %s view within gateway and row limits',
    async (_view, list) => {
      const rows = await list()
      expect(rows).toHaveLength(1001)
      for (const [index, row] of rows.entries()) {
        expect(row).toMatchObject({
          xp: index,
          portraitRef: 'portrait.starter.wayfarer-01',
          disciplineId: 'vanguard',
          secondaryDisciplineId: 'lifebinder',
          personalTitle: 'Keeper',
          imageUrl: '/media/public-portrait.webp',
        })
        expect(row).not.toHaveProperty('user_id')
      }
    },
  )
})
