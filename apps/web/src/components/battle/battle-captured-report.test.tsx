import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { abilityBehaviorInformation } from '../character/ability-detail-presentation'
import { BattleSkillParameters } from './battle-skill-parameters'
import {
  battleCapturedActionCost,
  battleCapturedControlledAvailability,
} from './battle-captured-action-cost'

const definition = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
const legacy = {
  definition,
  id: definition.id,
  name: 'Pinned Skill',
  apCost: 15,
  mpCost: 0,
  minimumRange: 1,
  maximumRange: 1,
  targetKind: 'unit' as const,
  targetTeamPolicy: 'enemy' as const,
  tags: [],
  effectDescriptions: ['Wrong legacy explanation'],
  requirementDescriptions: ['Wrong legacy prerequisite'],
}
function report() {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
  return abilityBehaviorInformation({
    ...base,
    costs: [
      { resource: 'ap', amount: 7 },
      { resource: 'mp', amount: 3 },
      { resource: 'hp', amount: 2 },
    ],
    cooldown: { key: 'precise', ownerTurns: 3 },
    requirements: {
      kind: 'resource-state',
      subject: 'owner',
      resource: 'mp',
      comparison: 'at-least',
      amount: 3,
    },
    activationLimits: ['once-per-round'],
    targeting: { ...base.targeting!, maximumRange: 4 },
    effects: [
      { id: 'move', payload: { type: 'move', recipient: 'actor', maximumTiles: 2 } },
      {
        id: 'hit',
        timing: 'controlled',
        payload: { type: 'damage', recipient: 'primary-unit', amount: 13 },
      },
    ],
  })
}
it('renders all ten fields and effect/requirement/limit details from the captured group instead of its old legacy envelope', () => {
  const captured = report()
  const before = JSON.stringify({ captured, legacy })
  const html = renderToStaticMarkup(
    <BattleSkillParameters skill={legacy} capturedReport={captured} />,
  )
  expect([...html.matchAll(/<dt>(.*?)<\/dt>/g)].map((match) => match[1])).toEqual([
    'Skill Type',
    'Cost',
    'Cooldown',
    'Requirements',
    'Effects',
    'Range',
    'Target',
    'Target Method',
    'Target Elevation',
    'Line of Sight',
  ])
  expect(html).toContain('<dt>Cost</dt><dd>7 AP / 3 MP / 2 HP</dd>')
  expect(html).toContain('<dt>Cooldown</dt><dd>3 turns</dd>')
  expect(html.replace(/<[^>]*>/gu, '')).toContain('MP [≥ 3] [Self]')
  expect(html).toContain('<dt>Range</dt><dd>4</dd>')
  expect(html).toContain('data-compact-effect-label="true">Move</strong>')
  expect(html).toContain('data-compact-effect-magnitude="true">[13]</span>')
  expect(html).toContain('data-compact-effect-timing="true">[Controlled]</span>')
  expect(html).toContain('Once per round')
  expect(html).not.toContain('Wrong legacy')
  expect(html).not.toContain('15 AP')
  expect(JSON.stringify({ captured, legacy })).toBe(before)
})
it('carries the chosen report through payment selection and shows an honest choice state for ambiguous groups', () => {
  const a = report(),
    b = { ...report(), effects: [] }
  const target = definition.target
  const choices = [
    { ownerCombatantId: 'actor', actionId: definition.id, behaviorId: 'a', target, report: a },
    { ownerCombatantId: 'actor', actionId: definition.id, behaviorId: 'b', target, report: b },
  ]
  const picked = battleCapturedActionCost(choices, [], { ap: 100, mp: 20, hp: 20 }, 'b')
  expect(picked.report).toBe(b)
  const ambiguous = battleCapturedActionCost(choices, [], { ap: 100, mp: 20, hp: 20 })
  expect(ambiguous.report).toBeNull()
  const html = renderToStaticMarkup(
    <BattleSkillParameters
      skill={legacy}
      capturedReport={ambiguous.report}
      costLabel={ambiguous.costLabel}
    />,
  )
  expect(html).toContain('<dt>Effects</dt><dd>Choose action</dd>')
  expect(html).not.toContain('Wrong legacy')
  expect(html).not.toContain('data-compact-skill-effect')
})

it('uses pinned elemental history for captured descriptions instead of current defaults', () => {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
  const fire = {
    ...base,
    effects: [
      {
        id: 'hit',
        payload: {
          type: 'damage' as const,
          recipient: 'primary-unit' as const,
          amount: 13,
          element: 'fire' as const,
        },
      },
    ],
  }
  const old = abilityBehaviorInformation(fire, {
    effectContext: { legacyElemental: true, explicitElemental: false },
  })
  expect(old.effectDescriptions[0]).toContain('Positive fire damage removes Wet and Frozen')
  const current = abilityBehaviorInformation(fire, {
    effectContext: { legacyElemental: false, explicitElemental: true },
  })
  expect(current.effectDescriptions[0]).not.toContain('removes Wet and Frozen')
})
it('preserves the actual default Instant timing of typed elemental companions in the same captured group', () => {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
  const information = abilityBehaviorInformation(
    {
      ...base,
      effects: [
        {
          id: 'hit',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 13, element: 'water' },
        },
        {
          id: 'wet',
          payload: {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: 'wet',
            durationTurns: 2,
            stacks: 1,
          },
        },
      ],
    },
    {
      timingPolicy: { version: 4, modes: {} },
      effectContext: { legacyElemental: false, explicitElemental: true },
    },
  )
  expect(information.effects[1]!.parts.timing).toBe('Instant')
})

it('keeps the ability artwork Primed when no action or another action is selected', () => {
  const choices = [
    {
      actionId: definition.id,
      behaviorId: 'a',
      target: definition.target,
      controlled: { phase: 'primed' as const, canPrime: false, canCancel: true },
    },
    { actionId: definition.id, behaviorId: 'b', target: definition.target },
  ]
  for (const selected of [undefined, 'a', 'b', 'missing']) {
    expect(battleCapturedControlledAvailability(choices, selected).controlledPrimed).toBe(true)
  }
  expect(battleCapturedControlledAvailability(choices.slice(1)).controlledPrimed).toBe(false)
})
