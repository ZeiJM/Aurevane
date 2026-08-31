import { describe, expect, it } from 'vitest'

import { pvpParticipantAccent } from './battle-combatant-colors'

describe('battle combatant identity accents', () => {
  it('keeps opposing teams in distinct non-semantic identity families', () => {
    expect(pvpParticipantAccent(0, 0, 2)).toBe('#78a9d1')
    expect(pvpParticipantAccent(1, 0, 2)).toBe('#b08ad0')
    expect(pvpParticipantAccent(0, 1, 2)).toBe('#8bb8de')
    expect(pvpParticipantAccent(1, 1, 2)).toBe('#bf9adb')
  })

  it('keeps a third team in its own identity family', () => {
    expect(pvpParticipantAccent(2, 0, 3)).toBe('#cf8ab8')
    expect(pvpParticipantAccent(2, 2, 3)).toBe('#b973a2')
  })
})
