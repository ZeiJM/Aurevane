import { describe, expect, it } from 'vitest'

import { DEFAULT_COMBAT_KEYBINDS, parseCombatKeybindMap } from './combat-controls'
import { parsePlayerProfilePersistenceRow } from './profile'

describe('player profile persistence validation', () => {
  it('migrates persisted category-era controls before validating the account row', () => {
    const legacy = Object.fromEntries(
      Object.entries(DEFAULT_COMBAT_KEYBINDS).filter(
        ([action]) =>
          !['skill1', 'skill2', 'skill3', 'skill4', 'essence', 'supernatural'].includes(action),
      ),
    )
    Object.assign(legacy, {
      inspect: { code: 'Digit1', shift: false },
      move: { code: 'KeyM', shift: false },
      basicAttack: { code: 'Digit3', shift: false },
      guard: { code: 'Digit4', shift: false },
      recover: { code: 'Digit5', shift: false },
    })
    const parsed = parsePlayerProfilePersistenceRow({
      user_id: '94e76093-e46b-4859-a01b-33c541d76fcf',
      created_at: '2026-08-16T00:10:00+00:00',
      combat_keybinds: legacy,
    })
    expect(parsed?.combat_keybinds).toEqual(parseCombatKeybindMap(legacy))
    expect(parsed?.combat_keybinds.move).toEqual({ code: 'KeyM', shift: false })
    expect(parsed?.combat_keybinds.skill1).toEqual(DEFAULT_COMBAT_KEYBINDS.skill1)
    expect(
      parsePlayerProfilePersistenceRow({
        user_id: '94e76093-e46b-4859-a01b-33c541d76fcf',
        created_at: '2026-08-16T00:10:00+00:00',
        combat_keybinds: { ...legacy, move: { code: '$invalid', shift: false } },
      }),
    ).toBeNull()
  })
  it('accepts the exact private player profile read shape', () => {
    expect(
      parsePlayerProfilePersistenceRow({
        user_id: '94e76093-e46b-4859-a01b-33c541d76fcf',
        created_at: '2026-08-16T00:10:00+00:00',
      }),
    ).toEqual({
      user_id: '94e76093-e46b-4859-a01b-33c541d76fcf',
      created_at: '2026-08-16T00:10:00+00:00',
      combat_keybinds: DEFAULT_COMBAT_KEYBINDS,
    })
  })

  it('rejects malformed or expanded persistence rows', () => {
    expect(
      parsePlayerProfilePersistenceRow({
        user_id: 'not-a-uuid',
        created_at: 'yesterday',
      }),
    ).toBeNull()

    expect(
      parsePlayerProfilePersistenceRow({
        user_id: '94e76093-e46b-4859-a01b-33c541d76fcf',
        created_at: '2026-08-16T00:10:00+00:00',
        email: 'must-not-be-duplicated@example.com',
      }),
    ).toBeNull()
  })
})
