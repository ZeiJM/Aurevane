import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('authenticated shell performance boundaries', () => {
  it('does not duplicate the authenticated browser presence heartbeat during server rendering', () => {
    const shell = read('./authenticated-game-shell.tsx')
    expect(shell).not.toContain('touchCharacterPresence')
    expect(shell).not.toContain('countOnlineCharacters')
    expect(shell).toContain('<OnlinePresenceLink />')
    expect(shell).toContain('await getAuthenticatedActor()')
    expect(shell).toContain('getActiveBattleForUser(actor.userId)')
    expect(shell).toContain('getActiveSpectatingForUser(actor.userId)')
    expect(shell).toContain('loadSelectedCharacter(actor)')
  })

  it('retains the authenticated server-owned presence write and private response', () => {
    const route = read('../../app/api/presence/route.ts')
    expect(route).toContain('await getAuthenticatedActor()')
    expect(route).toContain('await loadSelectedCharacter(actor)')
    expect(route).toContain('await touchCharacterPresence(actor.userId, character.id)')
    expect(route).toContain('await countOnlineCharacters()')
    expect(route).toContain("'Cache-Control': 'private, no-store'")
  })
})
