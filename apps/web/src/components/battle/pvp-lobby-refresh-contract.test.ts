import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { PVP_MAP_SIZES, pvpMapProfile } from '../../lib/battle/pvp-map-presentation'

const here = dirname(fileURLToPath(import.meta.url))

function readLocalFile(name: string): string {
  return readFileSync(join(here, name), 'utf8')
}

describe('PvP lobby presentation and refresh contract', () => {
  it('presents all three AI-sized maps while retaining existing medium and large wire values', () => {
    expect(PVP_MAP_SIZES).toEqual(['small', 'medium', 'large'])
    expect(PVP_MAP_SIZES.map((size) => pvpMapProfile(size).description)).toEqual([
      'Small · 9×7',
      'Medium · 12×7',
      'Large · 15×7',
    ])
  })

  it('restores a waiting lobby from session storage after a page refresh', () => {
    const launch = readLocalFile('battle-launch.tsx')

    expect(launch).toContain("'aurevane:pvp-lobby-id'")
    expect(launch).toContain('sessionStorage.getItem(PVP_LOBBY_SESSION_STORAGE_KEY)')
    expect(launch).toContain('fetch(`/api/pvp/lobbies/${encodeURIComponent(restoredLobbyId)}`')
    expect(launch).toContain("if (body.lobby.status !== 'waiting')")
    expect(launch).toContain('sessionStorage.setItem(PVP_LOBBY_SESSION_STORAGE_KEY, lobby.lobbyId)')
    expect(launch).toContain('onLeave={dismissPvpLobby}')
  })

  it('restores an existing joined lobby before replaying a join-link request', () => {
    const launch = readLocalFile('battle-launch.tsx')

    expect(launch).toContain('function joinFromInitialKey()')
    expect(launch).not.toContain('if (initialJoinKey || restoreAttempted.current)')
  })
})
