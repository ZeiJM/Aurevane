import { beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_COMBAT_KEYBINDS } from '@aurevane/validation/player/combat-controls'
import { loadPlayerCombatControls, savePlayerCombatControls } from './player-controls-service'

vi.mock('server-only', () => ({}))
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
const actor = { userId: '94e76093-e46b-4859-a01b-33c541d76fcf' }
const createdAt = '2026-08-16T00:10:00+00:00'
beforeEach(() => {
  rpc.mockReset()
})

it('normalizes old controls without a read write, and explicitly saves the complete account map', async () => {
  const old = {
    ...Object.fromEntries(
      Object.entries(DEFAULT_COMBAT_KEYBINDS).filter(([key]) => key !== 'modifiers'),
    ),
    inspect: { code: 'KeyM', shift: false },
  }
  const before = JSON.stringify(old)
  const bindings = await loadPlayerCombatControls(actor, {
    findByUserId: async () => ({ userId: actor.userId, createdAt, combatKeybinds: old }),
  })
  expect(bindings.inspect).toEqual({ code: 'KeyM', shift: false })
  expect(bindings.modifiers).toEqual({ code: 'KeyM', shift: true })
  expect(rpc).not.toHaveBeenCalled()
  expect(JSON.stringify(old)).toBe(before)
  rpc.mockImplementation(async (_name, input) => ({
    data: [
      { user_id: input.p_user_id, created_at: createdAt, combat_keybinds: input.p_combat_keybinds },
    ],
    error: null,
  }))
  expect(await savePlayerCombatControls(actor, bindings)).toEqual(bindings)
  expect(rpc).toHaveBeenCalledWith('save_player_combat_controls_v1', {
    p_user_id: actor.userId,
    p_combat_keybinds: bindings,
  })
})
it('rejects malformed and duplicate chords before persistence', async () => {
  await expect(
    savePlayerCombatControls(actor, {
      ...DEFAULT_COMBAT_KEYBINDS,
      modifiers: DEFAULT_COMBAT_KEYBINDS.cancel,
    }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  await expect(
    savePlayerCombatControls(actor, {
      ...DEFAULT_COMBAT_KEYBINDS,
      modifiers: { code: 'Bad Key!', shift: false },
    }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  expect(rpc).not.toHaveBeenCalled()
})
