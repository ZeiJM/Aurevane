import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  abilityBehaviorInformation,
  abilityRequirementDescription,
} from './ability-detail-presentation'
import {
  compactSkillEffectSummaryParts,
  skillRequirementDescription,
  skillRequirementsSummary,
} from './skill-detail-presentation'

const payload = {
  type: 'apply-status' as const,
  recipient: 'actor' as const,
  statusId: 'blindside',
  stacks: 1,
  durationTurns: 1,
}
const base = defaultBasicSkills()[0]!.ability.behaviors[0]!
it('omits only the single-turn duration of an instant effect', () => {
  expect(compactSkillEffectSummaryParts(payload, null).duration).toBeNull()
  expect(compactSkillEffectSummaryParts({ ...payload, durationTurns: 2 }, null).duration).toBe(
    '2 Turns',
  )
  expect(
    compactSkillEffectSummaryParts(payload, { version: 2, modes: { blindside: 'delayed' } })
      .duration,
  ).toBe('1 Turn')
  expect(
    compactSkillEffectSummaryParts(payload, { version: 2, modes: { blindside: 'controlled' } })
      .duration,
  ).toBe('1 Turn')
})
it('uses final canonical wrapper timing when hiding single-turn durations', () => {
  for (const timing of ['instant', 'delayed', 'controlled'] as const) {
    const report = abilityBehaviorInformation({
      ...base,
      effects: [{ id: 'blindside', timing, payload }],
    })
    expect(report.effects[0]!.parts.duration).toBe(
      timing === 'instant' ? null : timing === 'delayed' ? '1 Round' : '1 Turn',
    )
  }
})
it('uses modular action requirements without dropping the attack family or setup', () => {
  expect(
    abilityRequirementDescription({
      kind: 'all',
      children: [
        { kind: 'action', classification: 'attack', attackFamily: 'physical' },
        { kind: 'status-presence', subject: 'owner', statusId: 'guarded', present: true },
      ],
    }),
  ).toBe('(Attack [Physical] & Guard [Self])')
})

it.each(['frozen', 'wet', 'conductive'])(
  'omits an Instant single-turn %s duration after elemental clock formatting',
  (statusId) => {
    const report = abilityBehaviorInformation({
      ...base,
      effects: [{ id: statusId, timing: 'instant', payload: { ...payload, statusId } }],
    })
    expect(report.effects[0]!.parts.duration).toBeNull()
  },
)

it('keeps fallback requirements modular with explicit subjects and absence', () => {
  const requirements = [
    { kind: 'actor-status-present' as const, statusId: 'guarded' },
    { kind: 'actor-tag-absent' as const, tag: 'Wet' as const },
    { kind: 'target-status-present' as const, statusId: 'exposed' },
  ]
  expect(requirements.map(skillRequirementDescription)).toEqual([
    'Guard [Self]',
    'No Drenched [Self]',
    'Vulnerable [Target]',
  ])
  expect(skillRequirementsSummary({ requirements })).toBe(
    'Guard [Self], No Drenched [Self], Vulnerable [Target]',
  )
})

it('renders primed ability identity as a modular reference and preserves absence and subject', () => {
  expect(
    abilityRequirementDescription({
      kind: 'prime-presence',
      subject: 'owner',
      abilityId: 'chronist.rewind-step',
      present: true,
    }),
  ).toBe('Rewind Step [Primed] [Self]')
  expect(
    abilityRequirementDescription({
      kind: 'prime-presence',
      subject: 'triggering',
      abilityId: 'chronist.rewind-step',
      present: false,
    }),
  ).toBe('No Rewind Step [Primed] [Trigger]')
})
it('renders resource and event requirements as typed modules', () => {
  expect(
    abilityRequirementDescription({
      kind: 'resource-state',
      subject: 'selected',
      resource: 'hp',
      comparison: 'at-most',
      basisPoints: 3500,
    }),
  ).toBe('HP [≤ 35%] [Target]')
  expect(
    abilityRequirementDescription({
      kind: 'resource-state',
      subject: 'owner',
      resource: 'mp',
      comparison: 'at-least',
      amount: 3,
    }),
  ).toBe('MP [≥ 3] [Self]')
  expect(
    abilityRequirementDescription({
      kind: 'resource-threshold-crossing',
      subject: 'triggering',
      resource: 'hp',
      direction: 'below',
      thresholdBasisPoints: 3500,
    }),
  ).toBe('HP [Falls Below 35%] [Trigger]')
  expect(
    abilityRequirementDescription({
      kind: 'resource-threshold-crossing',
      subject: 'owner',
      resource: 'mp',
      direction: 'above',
      thresholdBasisPoints: 5000,
    }),
  ).toBe('MP [Rises Above 50%] [Self]')
  expect(
    abilityRequirementDescription({
      kind: 'event',
      phase: 'before',
      eventType: 'combat_action_used',
    }),
  ).toBe('Combat Action Used [Before]')
})
