import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { BattleSessionView } from '@/server/battle/battle-session-service'
import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
import { PvpBattleCompletionPanel } from './pvp-battle-completion-panel'

const battle = {
  battleSessionId: 'session',
  battleVersion: 1,
  snapshot: { tactical: { battle: { lifecycle: 'completed', round: 8, combatants: [] } } },
} as unknown as BattleSessionView
const metadata: PvpBattleMetadata = {
  lobbyId: 'lobby',
  mode: '1v1',
  battleKey: 'key',
  localCharacterId: 'local',
  participants: [],
}
function render(origin?: PvpBattleMetadata['origin'], returnTo?: 'world' | 'battle-hall') {
  return renderToStaticMarkup(
    <PvpBattleCompletionPanel
      initialBattle={battle}
      metadata={{ ...metadata, origin }}
      returnTo={returnTo}
    />,
  )
}
describe('participant completion return navigation', () => {
  it('returns a hinted World participant without claiming an encounter origin', () => {
    const markup = render(undefined, 'world')
    expect(markup).toContain('Return to World')
    expect(markup).toContain('the world')
    expect(markup).toMatch(/class="[^"]*eyebrow[^"]*">PvP Result<\/p>/)
    expect(markup).not.toContain('World Encounter')
    expect(markup).not.toContain('Battle Hall')
  })
  it.each([
    ['world', 'battle-hall', 'World Encounter', 'Return to World'],
    ['battle-hall', 'world', 'Battle Hall', 'Return to Battle Hall'],
  ] as const)(
    'keeps canonical %s origin ahead of a contradictory hint',
    (origin, hint, caption, label) => {
      const markup = render(origin, hint)
      expect(markup).toContain(caption)
      expect(markup).toContain(label)
    },
  )
  it('retains a Hall return for unhinted historical pages with a generic result caption', () => {
    const markup = render()
    expect(markup).toContain('Return to Battle Hall')
    expect(markup).toMatch(/class="[^"]*eyebrow[^"]*">PvP Result<\/p>/)
  })
})
