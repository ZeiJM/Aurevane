import { describe, expect, it } from 'vitest'

import { DEFAULT_COMBAT_KEYBINDS } from './combat-controls'
import { parsePlayerProfilePersistenceRow } from './profile'

describe('player profile persistence validation', () => {
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
