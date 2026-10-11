import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { BattleSessionView } from '@/server/battle/battle-session-service'
import { BattleExperience } from './battle-experience'
import type { BattleRuntime } from './battle-runtime'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const battle = {
  battleSessionId: '33333333-3333-4333-8333-333333333333',
  battleVersion: 1,
  snapshot: {
    tactical: {
      width: 1,
      height: 1,
      tiles: [],
      terrains: [],
      placements: [],
      battle: { combatants: [], currentTurn: null, lifecycle: 'active' },
    },
    statBridge: { combatants: [] },
    statusState: [],
  },
} as unknown as BattleSessionView
const runtime: BattleRuntime = {
  kind: 'pve',
  playerName: 'Wayfarer',
  playerLevel: 1,
  playerPortraitAssetId: 'character.portrait.starter.wayfarer-01',
  playerProfileImageUrl: null,
}

function slotMarkup(supportActionId?: string) {
  const markup = renderToStaticMarkup(
    <BattleExperience
      initialBattle={battle}
      runtime={{ ...runtime, supportActionId } as BattleRuntime}
    />,
  )
  return markup.match(/<article[^>]*data-command-card="guard"[\s\S]*?<\/article>/)?.[0] ?? ''
}

describe('pinned battle Support Action slot', () => {
  it.each(['basic.recover', 'basic.recover.mp'])(
    'keeps Guard practice accessible in Guided Fundamentals with %s in slot 3',
    (supportActionId) => {
      const guided = {
        ...battle,
        snapshot: {
          ...battle.snapshot,
          statBridge: {
            combatants: [
              {
                combatantId: 'recruit',
                provenance: {
                  kind: 'scenario',
                  sourceId: 'scenario:p2-7-recruit:duel-yard:guided-fundamentals:easy',
                },
              },
            ],
          },
        },
      } as unknown as BattleSessionView
      const markup = renderToStaticMarkup(
        <BattleExperience
          initialBattle={guided}
          runtime={{ ...runtime, supportActionId } as BattleRuntime}
        />,
      )
      expect(markup).toContain('aria-label="Practice Guard, 30 AP"')
      expect(markup).toContain('data-command-card="guard"')
      expect(markup).toContain(
        supportActionId === 'basic.recover' ? 'HP Recovery, 50 AP' : 'MP Recovery, 50 AP',
      )
    },
  )

  it.each([
    ['basic.guard', 'Guard', '30 AP', '/media/skills/guard.webp'],
    ['basic.recover', 'HP Recovery', '50 AP', '/media/skills/hp-recovery.webp'],
    ['basic.recover.mp', 'MP Recovery', '50 AP', '/media/skills/mp-recovery.svg'],
  ])('renders %s in the existing slot 3', (id, label, cost, artwork) => {
    const markup = slotMarkup(id)
    expect(markup).toContain(`aria-label="${label}, ${cost}"`)
    expect(markup).toContain(`src="${artwork}"`)
    expect(markup).toContain('data-battle-command="guard"')
    expect(markup).toMatch(/data-battle-command-hotkey="true">3<\/span>/)
  })
  it('keeps Guard for legacy snapshots without a support field', () => {
    expect(slotMarkup()).toContain('aria-label="Guard, 30 AP"')
  })
})
