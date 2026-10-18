import {
  executeCombatAction,
  endCombatTurn,
  type CombatActionDefinition,
} from '@aurevane/game-core/combat/actions'
import { selectCurrentFinalFacing } from '@aurevane/game-core/combat/board'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  parseAbilityDefinition,
  type AbilityEffect,
} from '@aurevane/game-core/combat/combat-definition'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
import { SkillDetails } from './skill-details'
import { SkillParameters } from './skill-parameters'
import { skillEffectDescription } from './skill-detail-presentation'

const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
function definition(
  payload: AbilityEffect['payload'],
  timing: AbilityEffect['timing'] = 'instant',
) {
  return parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        classification: 'utility',
        attackFamily: undefined,
        effects: [{ id: 'read', timing, payload }],
      },
    ],
  })
}
const cases: readonly [string, AbilityEffect['payload'], string][] = [
  [
    'attached Move',
    { type: 'move', recipient: 'actor', maximumTiles: 7 },
    'remaining Movement and Jump',
  ],
  [
    'Push',
    { type: 'displace', recipient: 'primary-unit', direction: 'push', distance: 3 },
    'away from you',
  ],
  [
    'Pull',
    { type: 'displace', recipient: 'primary-unit', direction: 'pull', distance: 4 },
    'toward you',
  ],
  ['Heal', { type: 'healing', recipient: 'primary-unit', amount: 17 }, 'Restore HP'],
  [
    'Barrier',
    { type: 'barrier-change', recipient: 'actor', amount: 19 },
    'damage-absorbing Barrier',
  ],
  [
    'MP Restore',
    { type: 'resource-change', resource: 'mp', recipient: 'actor', delta: 11 },
    'Restore MP',
  ],
  [
    'MP Drain',
    { type: 'resource-change', resource: 'mp', recipient: 'primary-unit', delta: -13 },
    'Remove MP',
  ],
  [
    'HP Recovery',
    {
      type: 'percentage-recovery',
      recipient: 'actor',
      resource: 'hp',
      percentageBasisPoints: 2300,
    },
    'maximum when this Skill is used',
  ],
  [
    'MP Recovery',
    {
      type: 'percentage-recovery',
      recipient: 'actor',
      resource: 'mp',
      percentageBasisPoints: 2900,
    },
    'maximum when this Skill is used',
  ],
  [
    'Reveal',
    { type: 'sensory', recipient: 'primary-unit', revealedDurationOwnerTurnStarts: 2 },
    'successful hit against Covert',
  ],
]
it.each(cases)(
  'keeps %s values in Effects and uses a plain canonical explanation',
  (name, payload, rule) => {
    const ability = definition(payload)
    const before = JSON.stringify(ability)
    const report = abilityBehaviorInformation(ability.behaviors[0]!)
    expect(report.effectDescriptions[0]).toContain(rule)
    expect(report.effectDescriptions[0]).not.toMatch(/\d/)
    const expectedFacts: Record<string, object> = {
      'attached Move': { magnitude: '7' },
      Push: { magnitude: '3' },
      Pull: { magnitude: '4' },
      Heal: { magnitude: '17' },
      Barrier: { magnitude: '19' },
      'MP Restore': { magnitude: '11' },
      'MP Drain': { magnitude: '13' },
      'HP Recovery': { magnitude: '23%' },
      'MP Recovery': { magnitude: '29%' },
      Reveal: { details: [{ label: 'Revealed', value: '2 owner-turn starts' }] },
    }
    expect(report.effects[0]!.parts).toMatchObject(expectedFacts[name]!)
    expect(Object.fromEntries(report.rows).Effects).toMatch(/\[/)
    expect(JSON.stringify(ability)).toBe(before)
  },
)

it.each([
  { type: 'healing', recipient: 'actor', amount: 17, ticks: 3 },
  { type: 'resource-change', resource: 'mp', recipient: 'actor', delta: 11, ticks: 3 },
  {
    type: 'percentage-recovery',
    recipient: 'actor',
    resource: 'hp',
    percentageBasisPoints: 2300,
    ticks: 3,
  },
] satisfies AbilityEffect['payload'][])(
  'reports captured $type applications and their exact clock in structured Effects',
  (payload) => {
    const report = abilityBehaviorInformation(definition(payload).behaviors[0]!)
    expect(report.effects[0]!.parts).toMatchObject({
      details: [
        { label: 'Applications', value: '3' },
        { label: 'First', value: 'On activation' },
        { label: 'Then', value: 'End of each recipient turn that starts after activation' },
      ],
    })
    expect(Object.fromEntries(report.rows).Effects).toContain('[Applications: 3]')
    expect(report.effectDescriptions[0]).not.toMatch(/\d/)
    expect(report.effectDescriptions[0]).toMatch(/cannot.*revive/iu)
  },
)
it('reports Reveal expiry in owner-turn starts instead of inventing ordinary turn-end duration', () => {
  const report = abilityBehaviorInformation(definition(cases[9]![1]).behaviors[0]!)
  expect(report.effects[0]!.parts).toMatchObject({
    details: [{ label: 'Revealed', value: '2 owner-turn starts' }],
  })
  expect(Object.fromEntries(report.rows).Effects).toContain('[Revealed: 2 owner-turn starts]')
})
it('keeps native Move terrain pricing distinct from attached Move', () => {
  const basic = defaultBasicSkills().find((row) => row.execution.kind === 'basic-move')!
  const report = abilityBehaviorInformation(basic.ability.behaviors[0]!, { basic })
  expect(Object.fromEntries(report.rows).Cost).toContain('per traversal point')
  expect(report.effectDescriptions[0]).toContain('Jump')
  expect(report.effectDescriptions[0]).not.toContain('included in the Skill cost')
  expect(report.effectDescriptions[0]).not.toMatch(/\d/)
})
it('keeps delayed and Controlled timing in Effects rather than repeating it in prose', () => {
  expect(
    abilityBehaviorInformation(definition(cases[3]![1], 'delayed').behaviors[0]!)
      .effectDescriptions[0],
  ).not.toContain('two global round boundaries later')
  expect(
    abilityBehaviorInformation(definition(cases[3]![1], 'controlled').behaviors[0]!)
      .effectDescriptions[0],
  ).not.toContain('Invalid releases retain the prime')
})
it('preserves legacy numeric recovery explanations and captured old policy behavior', () => {
  expect(
    skillEffectDescription({ type: 'healing', recipient: 'actor', amount: 17, ticks: 3 }),
  ).toContain('17 HP')
  const old = abilityBehaviorInformation(definition(cases[8]![1]).behaviors[0]!, {
    effectContext: { legacyHealingDown: true },
  })
  expect(old.effectDescriptions[0]).toContain('maximum when this Skill is used')
  expect(old.effectDescriptions[0]).not.toContain('Healing Down adjustment')
})
it('renders exact structured facts through actual local/public readers and preserves authored prose', () => {
  const payload: AbilityEffect['payload'] = {
    type: 'healing',
    recipient: 'actor',
    amount: 17,
    ticks: 3,
  }
  const ability = definition(payload)
  const skill = {
    ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
    ability,
    effectDescriptions: undefined,
  }
  const before = JSON.stringify(skill)
  for (const node of [
    <SkillDetails key="details" skill={skill} />,
    <SkillParameters key="public" skill={projectPublicCombat(skill)} />,
  ]) {
    const html = renderToStaticMarkup(node)
    expect(html).toMatch(/data-compact-effect-detail="Applications">\s*\[Applications: 3\]<\/span>/)
    expect(html).toContain('data-compact-effect-magnitude="true">[17]</span>')
    const prose = html.match(/aria-label="Effect explanations">([\s\S]*?)<\/ul>/)![1]!
    expect(prose).not.toContain('17')
    expect(prose).not.toContain('3')
    expect(prose).toMatch(/cannot.*revive/iu)
  }
  expect(
    renderToStaticMarkup(
      <AbilityDefinitionParameters
        definition={ability}
        effectDescriptions={['Owner explanation <kept> 31.']}
      />,
    ),
  ).toContain('Owner explanation &lt;kept&gt; 31.')
  expect(JSON.stringify(skill)).toBe(before)
})

it.each([1, 2, 4])('preserves the exact %i-application recovery schedule', (ticks) => {
  const payload: AbilityEffect['payload'] = {
    type: 'percentage-recovery',
    recipient: 'primary-unit',
    resource: 'mp',
    percentageBasisPoints: 3700,
    ticks,
  }
  const report = abilityBehaviorInformation(definition(payload).behaviors[0]!)
  expect(report.effects[0]!.parts.magnitude).toBe('37%')
  if (ticks === 1) expect(report.effects[0]!.parts.details).toBeUndefined()
  else
    expect(report.effects[0]!.parts.details?.[0]).toEqual({
      label: 'Applications',
      value: String(ticks),
    })
  expect(report.effects[0]!.parts.duration).toBeNull()
})

it.each(['actor', 'ally'] as const)(
  'matches the actual %s recovery clock in report and reader',
  (targetId) => {
    for (const payload of [
      { type: 'healing', recipient: 'primary-unit', amount: 17, ticks: 3 },
      { type: 'resource-change', recipient: 'primary-unit', resource: 'mp', delta: 11, ticks: 3 },
      {
        type: 'percentage-recovery',
        recipient: 'primary-unit',
        resource: 'hp',
        percentageBasisPoints: 3700,
        ticks: 3,
      },
    ] satisfies AbilityEffect['payload'][]) {
      const current = percentageDotEncounter()
      const action: CombatActionDefinition = {
        id: 'reader-recovery-clock',
        version: 1,
        sourceType: 'test',
        tags: [],
        requirements: [],
        cost: { mp: 0, spendsAction: false },
        target: {
          kind: 'unit',
          teamPolicy: 'any',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 4,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          friendlyFire: 'all-units',
        },
        effects: [nativeCombatTagPayload(payload)],
      }
      let state = executeCombatAction(
        current,
        action,
        { kind: 'unit', combatantId: targetId },
        { statuses: [] },
      ).state
      expect(state.effectState?.ongoingRecovery).toHaveLength(1)
      expect(state.effectState!.ongoingRecovery[0]!.remainingFutureTicks).toBe(2)
      expect(state.effectState!.ongoingRecovery[0]!.skipCurrentOwnerTurnEnd === true).toBe(
        targetId === 'actor',
      )
      const end = () => {
        state = endCombatTurn(
          { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
          { statuses: [] },
        ).state
      }
      end()
      expect(state.effectState!.ongoingRecovery[0]!.remainingFutureTicks).toBe(2)
      let turns = 0
      while (state.tactical.battle.currentTurn?.combatantId !== targetId && turns++ < 5) end()
      expect(state.tactical.battle.currentTurn?.combatantId).toBe(targetId)
      end()
      expect(state.effectState!.ongoingRecovery[0]!.remainingFutureTicks).toBe(1)
      const ability = definition(payload)
      const report = abilityBehaviorInformation(ability.behaviors[0]!)
      expect(Object.fromEntries(report.rows).Effects).toContain(
        '[Then: End of each recipient turn that starts after activation]',
      )
      expect(renderToStaticMarkup(<AbilityDefinitionParameters definition={ability} />)).toContain(
        'End of each recipient turn that starts after activation',
      )
    }
  },
)
