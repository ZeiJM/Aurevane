import { useState, type Dispatch, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BattleSessionView } from '@/server/battle/battle-session-service'
import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, useState: vi.fn(actual.useState) }
})
// Render the real open dialog without mounting browser portals or starting clock requests.
vi.mock('react-dom', () => ({ createPortal: (children: ReactNode) => children }))
import { PvpBattleQualityControls } from './pvp-battle-quality-controls'

const battle = {
  battleSessionId: 'session',
  snapshot: { tactical: { battle: { lifecycle: 'active', turnNumber: 1 } } },
} as unknown as BattleSessionView
const metadata: PvpBattleMetadata = {
  lobbyId: 'lobby',
  mode: '1v1',
  battleKey: 'key',
  localCharacterId: 'local',
  participants: [],
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

function render(origin?: PvpBattleMetadata['origin']) {
  vi.stubGlobal('document', { body: {} })
  // Keep the four preceding clock/battle/error state hooks real; open only the dialog.
  for (let index = 0; index < 4; index += 1) {
    vi.mocked(useState).mockImplementationOnce(
      (initial?: unknown): [unknown, Dispatch<unknown>] => [
        typeof initial === 'function' ? initial() : initial,
        vi.fn(),
      ],
    )
  }
  vi.mocked(useState).mockImplementationOnce(() => [true, vi.fn()])
  return renderToStaticMarkup(
    <PvpBattleQualityControls
      battleSessionId="session"
      initialBattle={battle}
      metadata={{ ...metadata, origin }}
    />,
  )
}

describe('PvP surrender encounter caption', () => {
  it.each([
    ['world', 'World Encounter · PvP'],
    ['battle-hall', 'Battle Hall · PvP'],
    [undefined, 'PvP'],
  ] as const)('renders the canonical %s origin without inventing provenance', (origin, caption) => {
    const markup = render(origin)
    expect(markup).toContain(`<span>${caption}</span>`)
    if (origin !== 'battle-hall') expect(markup).not.toContain('Battle Hall')
    if (origin !== 'world') expect(markup).not.toContain('World Encounter')
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('Surrender this battle?')
    expect(markup).toContain('Surrendering ends the battle immediately as a loss.')
    expect(markup).toContain('committed battle history remains available for review.')
    expect(markup).toContain('Stay in Battle')
    expect(markup).toContain('Confirm Surrender')
  })
})
