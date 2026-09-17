import type { CombatStatusInstance } from '@aurevane/game-core/combat/actions'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { BattleActionPreview as ActionPreview } from '@/server/battle/battle-preview-service'
import type { BattleLogEntry } from '@/server/battle/battle-log-service'

import { skillEffectDescription } from '../character/skill-detail-presentation'
import { BattleActionPreview } from './battle-action-preview'
import { BattleCombatantEffects } from './battle-combatant-effects'
import { buildBattleLogPresentation } from './battle-log-presentation'
import type { BattleSkillForecastPresentation } from './battle-runtime'

function status(statusId: string, remainingOwnerTurnStarts = 2): CombatStatusInstance {
  return {
    statusId,
    statusVersion: 1,
    stacks: 1,
    remainingOwnerTurnStarts,
    sourceCombatantId: 'character:zei',
  }
}

function logEntry(overrides: Partial<BattleLogEntry>): BattleLogEntry {
  return {
    battleVersion: 9,
    eventIndex: 0,
    occurredAt: '2026-09-17T18:00:00.000Z',
    eventType: 'hidden_combat_action',
    message: 'Wayfarer performed an action.',
    messageTemplate: '{actor} performed an action.',
    templateValues: {},
    actorCombatantId: 'character:zei',
    targetCombatantId: null,
    actionId: null,
    actionLabel: null,
    round: 3,
    turnNumber: 6,
    kind: 'offense',
    headline: 'Action',
    tone: 'neutral',
    facts: [],
    ...overrides,
  }
}

function sentence(segments: readonly { text: string }[]): string {
  return segments.map((segment) => segment.text).join('')
}

const sensorySkill: BattleSkillForecastPresentation = {
  id: 'test.sensory',
  name: 'Unmask',
  apCost: 40,
  mpCost: 3,
  targetKind: 'unit',
  targetTeamPolicy: 'enemy',
  minimumRange: 1,
  maximumRange: 3,
  tags: ['Enemy', 'Single', 'Sensory'],
  effectDescriptions: [
    skillEffectDescription({
      type: 'sensory',
      recipient: 'primary-unit',
      revealedDurationOwnerTurnStarts: 2,
    }),
  ],
  requirementDescriptions: [],
}

const revealedPreview: ActionPreview = {
  kind: 'action',
  legal: true,
  actionId: sensorySkill.id,
  actorId: 'character:zei',
  primaryCombatantId: 'character:storm',
  affectedTiles: [],
  affectedCombatantIds: ['character:storm'],
  projectedEffects: [],
  projectedStatuses: [],
  projectedEvents: [],
  mpCost: 3,
  actionEconomyCost: 80,
  actionEconomyBefore: 100,
  actionEconomyAfter: 20,
  hitChanceBasisPoints: null,
  defenseKind: null,
  defenseRating: null,
  mitigatedBaseDamage: null,
  issues: [],
  spendsAction: true,
}

describe('CSR-4 battle presentation acceptance', () => {
  it('presents entitled Covert and public Revealed with their true polarity and effects', () => {
    const covert = renderToStaticMarkup(
      <BattleCombatantEffects name="Zei" statuses={[status('covert', 3)]} />,
    )
    expect(covert).toContain('Covert')
    expect(covert).toContain('3 turns remaining')
    expect(covert).toContain('data-battle-effect-kind="Buff"')
    expect(covert).toContain('positive')
    expect(covert).toContain('Opposing')
    expect(covert).not.toContain('untargetable')

    const revealed = renderToStaticMarkup(
      <BattleCombatantEffects name="Storm" statuses={[status('revealed', 2)]} />,
    )
    expect(revealed).toContain('Revealed')
    expect(revealed).toContain('2 turns remaining')
    expect(revealed).toContain('data-battle-effect-kind="Debuff"')
    expect(revealed).toContain('Skill AP')
    expect(revealed).toContain('Covert')
  })

  it('keeps the generic hidden-action beat when a public Reveal consequence shares the command', () => {
    const rounds = buildBattleLogPresentation(
      [
        logEntry({}),
        logEntry({
          eventIndex: 1,
          eventType: 'status_applied',
          message: 'Storm gained Revealed.',
          messageTemplate: '{target} gained {status}.',
          templateValues: { status: 'Revealed', statusChange: 'APPLIED' },
          actorCombatantId: 'character:zei',
          targetCombatantId: 'character:storm',
          kind: 'status',
          headline: 'Revealed',
          tone: 'warning',
          facts: [
            { label: 'Revealed', tone: 'warning' },
            { label: '2 turns', tone: 'neutral' },
          ],
        }),
      ],
      {
        combatantNames: {
          'character:zei': 'Zei',
          'character:storm': 'Storm',
        },
      },
    )

    const action = rounds[0]?.actions[0]
    expect(sentence(action?.primary ?? [])).toBe('Zei performed an action.')
    expect(sentence(action?.secondary ?? [])).toBe('↳ Storm suffers Revealed · 2 turns')
    expect(action?.details).toEqual([])
    expect(JSON.stringify(action)).not.toContain('test.sensory')
    expect(JSON.stringify(action)).not.toMatch(/\b(?:hit|miss|AP|MP)\b/iu)
  })

  it('shows the Sensory conditional without turning preview into a Covert-state oracle', () => {
    const selection = renderToStaticMarkup(
      <BattleActionPreview preview={null} pending={false} skill={sensorySkill} />,
    )
    const effectDetails = sensorySkill.effectDescriptions.join(' ')

    expect(selection).toContain('Sensory')
    expect(selection).toContain('Skill details')
    expect(effectDetails).toContain('On a successful hit against Covert')
    expect(effectDetails).toContain('Revealed for 2 owner-turn starts')
    expect(effectDetails).not.toContain('currently Covert')
    expect(effectDetails).not.toContain('target is Covert')

    const exact = renderToStaticMarkup(
      <BattleActionPreview preview={revealedPreview} pending={false} skill={sensorySkill} />,
    )
    expect(exact).toContain('80 AP')
    expect(exact).toContain('20 AP left')
    expect(exact).toContain('3 MP')
    expect(exact).not.toContain('currently Covert')
    expect(exact).not.toContain('target is Covert')
  })
})
