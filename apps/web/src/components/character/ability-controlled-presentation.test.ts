import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { skillEffectInstantTiming } from './skill-detail-presentation'
import { expect, it } from 'vitest'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { abilityBehaviorInformation } from './ability-detail-presentation'

it('reports Controlled as manual whole-action timing rather than an automatic delayed packet', () => {
  const ability = defaultBasicSkills().find((skill) => skill.id === 'unarmed.basic')!.ability
  const behavior = parseAbilityDefinition({
    ...ability,
    behaviors: ability.behaviors.map((behavior) => ({
      ...behavior,
      effects: behavior.effects.map((effect) => ({ ...effect, timing: 'controlled' })),
    })),
  }).behaviors[0]!
  const information = abilityBehaviorInformation(behavior)
  expect(Object.fromEntries(information.rows).Effects).toContain('[Controlled]')
  expect(information.effectDescriptions[0]).not.toContain('whole selected action')
  expect(information.effectDescriptions[0]).not.toContain('legal release')
  expect(information.effectDescriptions[0]).not.toContain('global round boundaries later')
})

it.each(['controlled', 'delayed'] as const)(
  'reports %s Rewind in a Controlled action with the prime-position anchor',
  (timing) => {
    const base = defaultBasicSkills().find((skill) => skill.id === 'unarmed.basic')!.ability
      .behaviors[0]!
    const behavior = parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [
        {
          ...base,
          classification: 'utility',
          attackFamily: undefined,
          targeting: {
            ...base.targeting!,
            kind: 'self',
            teamPolicy: 'self',
            friendlyFire: 'allies-only',
            minimumRange: 0,
            maximumRange: 0,
          },
          effects: [
            {
              id: 'gate',
              timing: 'controlled',
              payload: { type: 'healing', recipient: 'actor', amount: 1 },
            },
            {
              id: 'rewind',
              timing,
              payload: {
                type: 'return-to-turn-start',
                recipient: 'actor',
                anchorMode: 'cast-position',
              },
            },
          ],
        },
      ],
    }).behaviors[0]!
    const information = abilityBehaviorInformation(behavior)
    expect(information.effectDescriptions[1]).toContain('where this Skill was primed')
    expect(information.effectDescriptions[1]).not.toContain('tile captured when cast')
    expect(information.effectDescriptions[1]).toContain('Rooted prevents the return')
  },
)

it('reports the prime tile when Controlled comes from the pinned tag default', () => {
  const base = defaultBasicSkills().find((skill) => skill.id === 'unarmed.basic')!.ability
    .behaviors[0]!
  const behavior = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        classification: 'utility',
        attackFamily: undefined,
        targeting: {
          ...base.targeting!,
          kind: 'self',
          teamPolicy: 'self',
          friendlyFire: 'allies-only',
          minimumRange: 0,
          maximumRange: 0,
        },
        effects: [
          {
            id: 'rewind',
            payload: {
              type: 'return-to-turn-start',
              recipient: 'actor',
              anchorMode: 'cast-position',
            },
          },
        ],
      },
    ],
  }).behaviors[0]!
  const report = abilityBehaviorInformation(behavior, {
    timingPolicy: { version: 12, modes: { 'return-to-turn-start': 'controlled' } },
  })
  expect(report.effectDescriptions[0]).toContain('where this Skill was primed')
  expect(Object.fromEntries(report.rows).Effects).toContain('[Controlled]')
})

it('compact timing labels expose Controlled for a configured tag', () => {
  expect(
    skillEffectInstantTiming(
      { type: 'healing', recipient: 'actor', amount: 1 },
      { version: 12, modes: { healing: 'controlled' } },
    ),
  ).toBe('Controlled')
})

it('reports the authored Summon ceiling against the summoner Basic Attack', () => {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
  const profile = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
  const behavior = {
    ...base,
    effects: [
      {
        id: 'companion',
        payload: {
          type: 'summon' as const,
          recipient: 'selected-tile' as const,
          profile: { ...profile, potencyBasisPoints: 4000 },
        },
      },
    ],
  }
  const report = abilityBehaviorInformation(behavior)
  expect(report.effectDescriptions[0]).toContain('40%')
  expect(report.effectDescriptions[0]).toContain(
    'summoner’s normal noncritical Basic Attack damage against the same target, before Barrier',
  )
  expect(report.effectDescriptions[0]).toContain('Repeated hits share this limit')
})
