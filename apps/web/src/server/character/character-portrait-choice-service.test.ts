import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
import {
  loadCharacterPortraitChoice,
  setCharacterDefaultPortrait,
} from './character-portrait-choice-service'
const input = {
  userId: 'user',
  characterId: 'character',
  portraitRef: 'portrait.adventure.male-01',
}
beforeEach(() => mocks.rpc.mockReset())
describe('repeatable default portrait authority', () => {
  it('validates the default catalogue before sending any mutation', async () => {
    await expect(
      setCharacterDefaultPortrait({ ...input, portraitRef: 'portrait.forged' }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('requires a durable receipt and sends only authenticated owner intent', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ portrait_ref: input.portraitRef, changed_at: '2026-10-03T00:00:00Z' }],
      error: null,
    })
    await expect(setCharacterDefaultPortrait(input)).resolves.toEqual({
      available: true,
      portraitRef: input.portraitRef,
      changedAt: '2026-10-03T00:00:00Z',
    })
    expect(mocks.rpc).toHaveBeenCalledWith('set_character_default_portrait_v1', {
      p_user_id: 'user',
      p_character_id: 'character',
      p_portrait_ref: input.portraitRef,
    })
  })
  it('accepts a same-choice no-op receipt before the first change', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ portrait_ref: input.portraitRef, changed_at: null }],
      error: null,
    })
    await expect(setCharacterDefaultPortrait(input)).resolves.toEqual({
      available: true,
      portraitRef: input.portraitRef,
      changedAt: null,
    })
  })
  it('accepts repeated choices including a return to a prior portrait', async () => {
    for (const portraitRef of [
      input.portraitRef,
      'portrait.adventure.female-12',
      input.portraitRef,
    ]) {
      mocks.rpc.mockResolvedValueOnce({
        data: [{ portrait_ref: portraitRef, changed_at: '2026-10-29T00:00:00Z' }],
        error: null,
      })
      await expect(setCharacterDefaultPortrait({ ...input, portraitRef })).resolves.toMatchObject({
        available: true,
        portraitRef,
      })
    }
    expect(mocks.rpc).toHaveBeenCalledTimes(3)
  })
  it.each([
    { data: [] },
    { data: [{ portrait_ref: 'portrait.forged', changed_at: null }] },
    { data: [{ portrait_ref: 'portrait.adventure.female-12', changed_at: null }] },
  ])('rejects an absent or mismatched database receipt: %j', async ({ data }) => {
    mocks.rpc.mockResolvedValue({ data, error: null })
    await expect(setCharacterDefaultPortrait(input)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  })
  it('rejects foreign and deleted characters', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'CHARACTER_NOT_PLAYABLE' } })
    await expect(setCharacterDefaultPortrait(input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('fails closed while the migration is unavailable without breaking other settings', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'missing function' } })
    await expect(loadCharacterPortraitChoice('user', 'character')).resolves.toEqual({
      available: false,
      portraitRef: null,
      changedAt: null,
    })
    await expect(setCharacterDefaultPortrait(input)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  })
})
