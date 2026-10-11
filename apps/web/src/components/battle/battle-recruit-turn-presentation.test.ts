import { describe, expect, it } from 'vitest'
import type { BattleSessionView } from '@/server/battle/battle-session-service'
import type { RecruitTurnView } from '@/server/battle/battle-recruit-ai-service'
import { describeRecruitTurn } from './battle-experience'

const recruitId = 'recruit:weon'
function view(turnNumber = 2): BattleSessionView {
  return {
    snapshot: {
      tactical: {
        battle: {
          lifecycle: 'active',
          turnNumber,
          currentTurn: {
            combatantId: turnNumber === 2 ? recruitId : 'character:zei',
            actionState: 'ready',
            movementSpent: 0,
          },
          combatants: [
            {
              id: recruitId,
              hp: 100,
              mp: 100,
              temporaryResources: [{ key: 'pv1f.action-economy', current: 100, maximum: 100 }],
            },
          ],
        },
        placements: [{ combatantId: recruitId, position: { x: 1, y: 1 }, facing: 'north' }],
      },
      statusState: [],
    },
  } as unknown as BattleSessionView
}
function narrate(
  before: BattleSessionView,
  after: BattleSessionView,
  reasons: RecruitTurnView['decisions'][number]['reason'][],
): string {
  return describeRecruitTurn(
    before,
    after,
    reasons.map((reason) => ({ combatantId: recruitId, reason, utility: 0 })),
    recruitId,
    'Weon',
    new Map(),
  )
}

describe('Recruit turn notice', () => {
  it.each(['face-threat', 'safe-end-turn'] as const)(
    'describes a completed %s-only turn as idle instead of reporting facing',
    (reason) => {
      expect(narrate(view(), view(3), [reason])).toBe('Weon stands around and does nothing.')
    },
  )
  it.each(['legal-damage', 'close-distance', 'guard-survival', 'recover-survival'] as const)(
    'keeps facing progression when %s occurred even without a visible result',
    (reason) => {
      const notice = narrate(view(), view(3), [reason, 'face-threat'])
      expect(notice).not.toContain('stands around')
      expect(notice).toContain('finished facing north')
    },
  )
  it('does not invent idle narration for an ongoing, unknown or already acted turn', () => {
    expect(narrate(view(), view(), ['face-threat'])).not.toContain('stands around')
    expect(narrate(view(), view(3), [])).not.toContain('stands around')
    const before = view()
    before.snapshot.tactical.battle.combatants[0].temporaryResources = [
      { key: 'pv1f.action-economy', current: 70, maximum: 100 },
    ]
    expect(narrate(before, view(3), ['face-threat'])).not.toContain('stands around')
    const moved = view()
    moved.snapshot.tactical.battle.currentTurn!.movementSpent = 1
    expect(narrate(moved, view(3), ['face-threat'])).not.toContain('stands around')
    const attacked = view()
    attacked.snapshot.tactical.battle.currentTurn!.actionState = 'spent'
    expect(narrate(attacked, view(3), ['face-threat'])).not.toContain('stands around')
    const legacy = view()
    legacy.snapshot.tactical.battle.combatants[0].temporaryResources = []
    expect(narrate(legacy, view(3), ['face-threat'])).not.toContain('stands around')
  })
})
