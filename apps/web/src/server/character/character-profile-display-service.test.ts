import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ admin: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: mocks.admin }))

import { setCharacterProfileImage } from './character-profile-display-service'

const userId = '00000000-0000-4000-8000-000000000901'
const characterId = '00000000-0000-4000-8000-000000000902'

function slotRow() {
  return {
    id: characterId,
    user_id: userId,
    slot_index: 0,
    rules_version: 1,
    name: 'Portrait Tester',
    name_key: 'portraittester',
    presentation_id: 'androgynous',
    pronoun_preset_id: 'they_them',
    portrait_ref: 'portrait.starter.wayfarer-01',
    starter_appearance_ref: 'appearance.starter.roadworn',
    foundation_discipline_id: 'vanguard',
    might: 6,
    finesse: 6,
    vitality: 6,
    agility: 6,
    intellect: 6,
    resolve: 6,
    level: 1,
    xp: 0,
    progression_cycle: 1,
    created_at: '2026-09-01T00:00:00.000Z',
    cycle_started_at: '2026-09-01T00:00:00.000Z',
    last_active_at: '2026-09-01T00:00:00.000Z',
    deletion_requested_at: null as string | null,
    deletion_execute_after: null as string | null,
    reselect_available_at: null,
  }
}

describe('profile portrait write authority', () => {
  let slots: ReturnType<typeof slotRow>[]
  let slotsUnavailable: boolean
  let writeUnavailable: boolean
  let writes: Record<string, unknown>[]

  beforeEach(() => {
    slots = [slotRow()]
    slotsUnavailable = false
    writeUnavailable = false
    writes = []
    const deniedCharactersQuery = {
      select: () => deniedCharactersQuery,
      eq: () => deniedCharactersQuery,
      maybeSingle: async () => ({ data: null, error: { code: '42501' } }),
    }
    mocks.admin.mockReturnValue({
      rpc: async (name: string, args: { p_user_id: string }) => ({
        data: slots,
        error:
          slotsUnavailable || name !== 'get_character_slots_v2' || args.p_user_id !== userId
            ? { code: 'PERSISTENCE_UNAVAILABLE' }
            : null,
      }),
      from: (table: string) => {
        if (table === 'characters') return deniedCharactersQuery
        if (table !== 'character_profile_display') throw new Error('Unexpected table write')
        return {
          upsert: async (row: Record<string, unknown>, options: { onConflict: string }) => {
            if (options.onConflict !== 'character_id') throw new Error('Wrong portrait identity')
            writes.push(row)
            return { error: writeUnavailable ? { code: '42501' } : null }
          },
        }
      },
    })
  })

  it('saves an owned portrait using granted authority without a direct character-table read', async () => {
    await expect(
      setCharacterProfileImage({ userId, characterId, imageUrl: ' https://i.ibb.co/test.png ' }),
    ).resolves.toEqual({ imageUrl: 'https://i.ibb.co/test.png' })
    expect(writes).toEqual([
      {
        character_id: characterId,
        user_id: userId,
        image_url: 'https://i.ibb.co/test.png',
        updated_at: expect.any(String),
      },
    ])
  })

  it('persists clearing the portrait as null', async () => {
    await expect(setCharacterProfileImage({ userId, characterId, imageUrl: ' ' })).resolves.toEqual(
      { imageUrl: null },
    )
    expect(writes).toHaveLength(1)
    expect(writes[0].image_url).toBeNull()
  })

  it('does not write a portrait for a character outside the owned slots', async () => {
    slots = []
    await expect(
      setCharacterProfileImage({ userId, characterId, imageUrl: null }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(writes).toEqual([])
  })

  it('does not write a portrait for a character pending deletion', async () => {
    slots[0].deletion_requested_at = '2026-09-30T00:00:00.000Z'
    slots[0].deletion_execute_after = '2026-10-07T00:00:00.000Z'
    await expect(
      setCharacterProfileImage({ userId, characterId, imageUrl: null }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(writes).toEqual([])
  })

  it('does not write when ownership persistence is unavailable', async () => {
    slotsUnavailable = true
    await expect(
      setCharacterProfileImage({ userId, characterId, imageUrl: null }),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
    expect(writes).toEqual([])
  })

  it('reports a failed portrait write instead of reporting success', async () => {
    writeUnavailable = true
    await expect(
      setCharacterProfileImage({ userId, characterId, imageUrl: null }),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
    expect(writes).toHaveLength(1)
  })
})
