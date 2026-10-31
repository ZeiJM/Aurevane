import { describe, expect, it, vi } from 'vitest'
import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import { previewEffect } from '@/components/character/skill-effect-preview'
import { skillEffectDescription } from '@/components/character/skill-detail-presentation'
import { effectTagDescription } from './combat-effect-descriptions'
import { battleEffectInformation } from '@/components/battle/battle-effect-information'
import type { BattlePresentedStatus } from './battle/battle-elevation-effects'
import { buildBattleLogView } from '@/server/battle/battle-log-service'
import { buildBattleChronicle } from '@/components/battle/battle-log-chronicle-model'
import { omitPendingBattlePayloads } from '@/server/battle/battle-live-viewer-projection'

vi.mock('server-only', () => ({}))

const payload = {
  type: 'reversal',
  recipient: 'actor',
  version: 1,
  family: 'mystic',
  reflectionBasisPoints: 12500,
  attackerMaxHpCapBasisPoints: 1800,
  defenderMaxHpCapBasisPoints: 2400,
} as unknown as MatureSkillEffectDefinition

describe('shared Reversal readers', () => {
  it('explains authored family and both caps with the fixed rules in compact and full reports', () => {
    const compact = previewEffect(payload)
    expect(compact.label).toBe('Reversal')
    expect(compact.magnitude).toBe('125% Mystic')
    const full = skillEffectDescription(payload)
    expect(full).toBe(compact.explanation)
    for (const fragment of [
      '18%',
      '24%',
      'Summons also obey their authored outgoing damage cap.',
      'front or side',
      'Rear',
      'one',
      'next actual turn',
      'Reveal',
      'Reversal Strain',
      'Basic Attack',
    ])
      expect(full).toContain(fragment)
    expect(effectTagDescription('reversal')).toContain('Controlled')
    expect(effectTagDescription('reveal')).toContain('armed Reversal')
    expect(effectTagDescription('reveal')).toContain('Invisible and Covert')
  })
  it.each(['reversal', 'reversal-strain'])(
    'explains synthetic %s without claiming a generic status lifetime',
    (statusId) => {
      const row = {
        statusId,
        statusVersion: 1,
        stacks: 1,
        sourceCombatantId: 'actor',
        remainingOwnerTurnStarts: 1,
        timingState: 'active',
        presentationDuration:
          statusId === 'reversal' ? 'until-reversal-ends' : 'next-complete-owner-turn',
        reversal:
          statusId === 'reversal'
            ? {
                family: 'mystic',
                reflectionBasisPoints: 12500,
                attackerMaxHpCapBasisPoints: 1800,
                defenderMaxHpCapBasisPoints: 2400,
              }
            : undefined,
      } as unknown as BattlePresentedStatus
      const report = battleEffectInformation(row)
      expect(report.label).toBe(statusId === 'reversal' ? 'Reversal' : 'Reversal Strain')
      expect(report.description).toContain('Basic Attack')
      expect(report.description).toContain('cannot be copied')
      expect(report.count).toBeNull()
      expect(report.description).not.toContain('Captured effect rules unavailable')
    },
  )
  it('strips the private ledger from all top-level public snapshots', () => {
    expect(
      omitPendingBattlePayloads({
        pendingEffects: [],
        visible: true,
        reversalState: { secret: 'private arm history' },
      }),
    ).toEqual({ visible: true })
  })
  it('renders actual prevention and return receipts in the shared Chronicle', () => {
    const events = [
      { event: 'reversal_prepared', actionId: 'mirror', combatantId: 'actor', family: 'mystic' },
      {
        event: 'reversal_triggered',
        actionId: 'mirror',
        combatantId: 'actor',
        attackerCombatantId: 'enemy',
        incomingActionId: 'enemy.attack',
        preventedDamage: 42,
        returnedDamage: 17,
      },
      { event: 'reversal_ended', actionId: 'mirror', combatantId: 'actor', reason: 'revealed' },
      { event: 'reversal_strain_ended', combatantId: 'actor' },
    ]
    const view = buildBattleLogView(
      'session',
      events.map((event, i) => ({
        battleVersion: i + 1,
        eventIndex: 0,
        createdAt: '2026-10-31T00:00:00Z',
        event,
      })),
    )
    expect(view.entries).toHaveLength(4)
    expect(view.entries[1]?.templateValues).toMatchObject({ prevented: '42', returned: '17' })
    expect(JSON.stringify(view)).not.toContain('incomingActionId')
    const chronicle = buildBattleChronicle(view.entries, {
      combatantNames: { actor: 'A', enemy: 'B' },
    })
    const outcomes = chronicle
      .flatMap((round) =>
        round.actors.flatMap((actor) =>
          actor.actions.flatMap((action) => action.outcomes.map((outcome) => outcome.text)),
        ),
      )
      .join(' ')
    expect(outcomes).toContain('42')
    expect(outcomes).toContain('17')
    expect(outcomes).toContain('Reversal Strain')
  })
})

it('describes Reveal disarming an independently armed Reversal in canonical reports', async () => {
  const { canonicalEffectExplanation } =
    await import('@/components/character/canonical-effect-explanation')
  const explanation = canonicalEffectExplanation(
    {
      type: 'sensory',
      recipient: 'primary-unit',
      revealedDurationOwnerTurnStarts: 2,
      increasedDamageTakenBasisPoints: 2000,
    },
    {},
  )
  expect(explanation?.description).toContain('armed Reversal')
  expect(explanation?.description).toContain('Reversal Strain')
})
