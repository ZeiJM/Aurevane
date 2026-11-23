import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
import { BattleCompletionPanel } from './battle-completion-panel'

function result(origin?: 'npc' | 'realm') {
  const battle = {
    snapshot: {
      ...(origin ? { worldBattleOrigin: origin } : {}),
      arenaNpc: { name: 'Fixture opponent' },
      statBridge: {
        combatants: [
          {
            provenance: {
              kind: 'scenario',
              sourceId: 'scenario:p2-7-recruit:duel-yard:recruit-sparring:high',
            },
          },
        ],
      },
      tactical: {
        width: 9,
        height: 7,
        battle: { lifecycle: 'completed', round: 2, combatants: [] },
      },
    },
  } as unknown as BattleSessionView
  return renderToStaticMarkup(<BattleCompletionPanel battle={battle} />)
}

it.each(['npc', 'realm'] as const)(
  'returns the player to the World after a %s encounter',
  (origin) => {
    const markup = result(origin)
    expect(markup).toContain('Return to World')
    expect(markup).not.toContain('Rematch')
    expect(markup).not.toContain('Claim Mastery')
    expect(markup).not.toContain('Battle Hall')
  },
)

it('retains ordinary Battle Hall result and rematch actions', () => {
  const markup = result()
  expect(markup).toContain('Return to Battle Hall')
  expect(markup).toContain('Rematch Fixture opponent')
})
