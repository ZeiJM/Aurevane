import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function readLocalFile(name: string): string {
  return readFileSync(join(here, name), 'utf8')
}

describe('PvP lobby presentation and refresh contract', () => {
  it('uses Standard and Expanded as the player-facing PvP map size names', () => {
    const launch = readLocalFile('battle-launch.tsx')
    const lobby = readLocalFile('pvp-lobby-modal.tsx')

    expect(launch).toContain("{value === 'medium' ? 'Standard' : 'Expanded'}")
    expect(lobby).toContain("settings.mapSize === 'medium' ? 'Standard' : 'Expanded'")
    expect(lobby).toContain("['Map size', mapSizeLabel]")
  })

  it('keeps the existing medium and large wire values for backward compatibility', () => {
    const launch = readLocalFile('battle-launch.tsx')

    expect(launch).toContain("useState<PvpMapSize>('medium')")
    expect(launch).toContain("(['medium', 'large'] as const)")
  })

  it('restores a waiting lobby from session storage after a page refresh', () => {
    const launch = readLocalFile('battle-launch.tsx')

    expect(launch).toContain("'aurevane:pvp-lobby-id'")
    expect(launch).toContain('sessionStorage.getItem(PVP_LOBBY_SESSION_STORAGE_KEY)')
    expect(launch).toContain("fetch(`/api/pvp/lobbies/${encodeURIComponent(lobbyId)}`")
    expect(launch).toContain("if (body.lobby.status !== 'waiting')")
    expect(launch).toContain("sessionStorage.setItem(PVP_LOBBY_SESSION_STORAGE_KEY, lobby.lobbyId)")
    expect(launch).toContain('onLeave={dismissPvpLobby}')
  })
})
