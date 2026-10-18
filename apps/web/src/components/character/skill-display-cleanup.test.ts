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
