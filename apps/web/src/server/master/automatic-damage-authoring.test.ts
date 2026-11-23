import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { createStatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import {
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  activateCombatAbility,
  evaluateCombatAbility,
  combatAbilityCommandContext,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import { combatDamageForAuthoring } from '@/lib/combat-damage-authoring'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import type { CombatContentDefinition } from '@aurevane/db/combat-content'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { combatContentCategory } from '../combat/combat-content-categories'
import { editableDefinition } from '@/components/master/combat-content/content-record-workflow'

function fixture(kind: 'skill' | 'essence' | 'resonance', family: 'physical' | 'mystic') {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
  const ability: AbilityDefinition = {
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        ...(kind === 'resonance'
          ? {
              activation: 'automatic' as const,
              requirements: {
                kind: 'event' as const,
                eventType: 'combat_action_used' as const,
                phase: 'after' as const,
              },
              automaticTarget: { subject: 'selected' as const },
            }
          : {}),
        attackFamily: family,
        costs: [{ resource: 'ap', amount: 50 }],
        effects: [
          {
            id: 'hit',
            payload: {
              type: 'damage',
              recipient: 'primary-unit',
              amount: 9,
              defenseKind: family === 'physical' ? 'ward' : 'armor',
              facingModifiersBasisPoints: { front: 15000, side: 17500, rear: 20000 },
              scaling: {
                source: family === 'physical' ? 'mystic-power' : 'physical-power',
                coefficientBasisPoints: 19999,
              },
            },
          },
        ],
      },
    ],
  }
  const skill = { ...resolveMatureSkillVersion('vanguard.forceful-strike')!, ability }
  const definition =
    kind === 'skill'
      ? skill
      : kind === 'essence'
        ? {
            ...currentEssenceDefinitions()[0]!,
            ability,
            skill: { ...currentEssenceDefinitions()[0]!.skill, ability },
          }
        : { ...currentResonanceDefinitions()[0]!, ability }
  return definition as unknown as CombatContentDefinition
}
function abilityOf(definition: CombatContentDefinition): AbilityDefinition {
  return definition.ability as AbilityDefinition
}

describe('automatic current damage authoring', () => {
  it.each(
    (['skill', 'essence', 'resonance'] as const).flatMap((kind) =>
      (['physical', 'mystic'] as const).map((family) => ({ kind, family })),
    ),
  )(
    'derives current $kind $family formula, retaining saved history exactly',
    ({ kind, family }) => {
      const definition = fixture(kind, family)
      const before = structuredClone(definition)
      const category = combatContentCategory(kind)!
      const authored = category.parseAuthoring(definition)
      expect(abilityOf(authored).behaviors[0]!.effects[0]!.payload).toMatchObject({
        type: 'damage',
        amount: 9,
        defenseKind: family === 'physical' ? 'armor' : 'ward',
        scaling: {
          source: family === 'physical' ? 'physical-power' : 'mystic-power',
          coefficientBasisPoints: 2500,
        },
      })
      expect(abilityOf(authored).behaviors[0]!.effects[0]!.payload).not.toHaveProperty(
        'facingModifiersBasisPoints',
      )
      expect(category.parseAuthoring(authored)).toEqual(authored)
      expect(
        category.parseRetained(definition, String(definition.essenceId ?? definition.id)),
      ).toEqual(before)
      expect(definition).toEqual(before)
    },
  )
  it('projects edited Physical/Mystic drafts for the actual editor and preview without changing saved history', () => {
    const definition = fixture('skill', 'mystic')
    const record = { contentKind: 'skill', current: { definition } } as Parameters<
      typeof editableDefinition
    >[0]
    const authored = editableDefinition(record)!
    expect(abilityOf(authored).behaviors[0]!.effects[0]!.payload).toMatchObject({
      defenseKind: 'ward',
      scaling: { source: 'mystic-power', coefficientBasisPoints: 2500 },
    })
    expect(abilityOf(definition).behaviors[0]!.effects[0]!.payload).toMatchObject({
      defenseKind: 'armor',
      scaling: { coefficientBasisPoints: 19999 },
    })
  })
})

it('requires an explicit family for ordinary canonical damage instead of retaining a hidden override', () => {
  const definition = fixture('skill', 'physical')
  const ability = abilityOf(definition)
  const { attackFamily: _family, ...behavior } = ability.behaviors[0]!
  void _family
  const value = {
    ...definition,
    ability: { ...ability, behaviors: [{ ...behavior, classification: 'utility' }] },
  }
  expect(() => combatContentCategory('skill')!.parseAuthoring(value)).toThrow(
    /Direct damage requires Attack classification/,
  )
})

it('keeps costs, Vengeance, self damage, periodic damage and Blindside percentages unchanged', () => {
  const definition = fixture('skill', 'physical')
  const ability = abilityOf(definition)
  const special = [
    {
      id: 'self',
      payload: {
        type: 'damage',
        recipient: 'actor',
        amount: 7,
        scaling: { source: 'mystic-power', coefficientBasisPoints: 0 },
      },
    },
    {
      id: 'vengeance',
      payload: {
        type: 'damage',
        recipient: 'primary-unit',
        amount: 0,
        vengeance: { conversionBasisPoints: 2500, maximumDamage: 40 },
      },
    },
    {
      id: 'dot',
      payload: {
        type: 'burn',
        recipient: 'primary-unit',
        durationTurns: 3,
        damageProfile: {
          kind: 'attack-percentage',
          basisPoints: 2500,
          decayBasisPointsPerTick: 500,
        },
      },
    },
    {
      id: 'blindside',
      payload: {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'blindside-vulnerability',
        stacks: 1,
        blindsideModifiersBasisPoints: { side: 17500, rear: 22500 },
      },
    },
  ]
  const value = {
    ...definition,
    ability: {
      ...ability,
      behaviors: [
        { ...ability.behaviors[0], costs: [{ resource: 'hp', amount: 5 }], effects: special },
      ],
    },
  }
  expect(combatDamageForAuthoring('skill', value)).toEqual(value)
})

it('keeps legacy true damage exact while native ordinary packets use the existing adapter formula', () => {
  const special = {
    type: 'damage',
    recipient: 'primary-unit',
    amount: 8,
    piercing: true,
    scaling: { source: 'physical-power', coefficientBasisPoints: 5000 },
  }
  const value = {
    id: 'skill.native',
    tags: ['attack', 'mystic'],
    effects: [
      {
        type: 'damage',
        recipient: 'primary-unit',
        amount: 7,
        defenseKind: 'armor',
        scaling: { source: 'physical-power', coefficientBasisPoints: 0 },
        facingModifiersBasisPoints: { front: 20000, side: 20000, rear: 20000 },
      },
      special,
    ],
  }
  expect(combatDamageForAuthoring('skill', value).effects).toEqual([
    { type: 'damage', recipient: 'primary-unit', amount: 7 },
    special,
  ])
})

it.each(['physical', 'mystic'] as const)(
  'settles %s Skill power/stats/Defense once and leaves a historical capture exact',
  (family) => {
    const definition = fixture('skill', family)
    const authored = combatContentCategory('skill')!.parseAuthoring(definition)
    const base = percentageDotEncounter()
    const state = preparePv1fTurnEconomy(
      createStatDrivenCombatEncounterState(
        base,
        base.statBridge.combatants.map((profile) => ({
          ...profile,
          physicalPower: 80,
          mysticPower: 120,
          armor: 100,
          ward: 300,
        })),
      ),
    )
    const saved = captureCombatAbilitySource({ ...source(), definition: abilityOf(authored) })
    const input = {
      state,
      actorId: 'actor',
      source: saved,
      selection: { kind: 'unit' as const, combatantId: 'enemy' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, saved),
    }
    const forecast = evaluateCombatAbility(input)
    expect(forecast.legal).toBe(true)
    const expectedDamage = family === 'physical' ? 14 : 9
    const projected = forecast.projectedEffects.find((effect) => effect.effectType === 'damage')!
    expect(Number(projected.before) - Number(projected.after)).toBe(expectedDamage)
    const committed = activateCombatAbility(input)
    expect(committed.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(
      1000 - expectedDamage,
    )
    expect(committed.events.filter((event) => event.event === 'damage_applied')).toEqual([
      expect.objectContaining({ amount: expectedDamage }),
    ])
    expect(saved.definition).toEqual(abilityOf(authored))
    // Legacy None defense and absent scaling remain base-only when captured directly.
    const historicalDefinition: AbilityDefinition = {
      schemaVersion: 1,
      behaviors: [
        {
          ...abilityOf(definition).behaviors[0]!,
          effects: [
            { id: 'old-hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 9 } },
          ],
        },
      ],
    }
    const historical = captureCombatAbilitySource({ ...source(), definition: historicalDefinition })
    const oldResult = activateCombatAbility({
      ...input,
      source: historical,
      context: combatAbilityCommandContext(state, historical),
    })
    expect(oldResult.events.filter((event) => event.event === 'damage_applied')).toEqual([
      expect.objectContaining({ amount: 9 }),
    ])
    expect(historical.definition).toEqual(historicalDefinition)
  },
)

it.each(['physical', 'mystic'] as const)(
  'uses the same automatic %s formula for Pierce while keeping its equipment Armor parameter',
  (family) => {
    const definition = fixture('skill', family)
    const original = abilityOf(definition)
    const damage = original.behaviors[0]!.effects[0]!.payload
    const value = {
      ...definition,
      ability: {
        ...original,
        behaviors: [
          {
            ...original.behaviors[0]!,
            effects: [
              {
                id: 'pierce',
                payload: { ...damage, type: 'pierce', armorIgnoredBasisPoints: 3750 },
              },
            ],
          },
        ],
      },
    }
    const authored = combatContentCategory('skill')!.parseAuthoring(value)
    expect(abilityOf(authored).behaviors[0]!.effects[0]!.payload).toEqual({
      type: 'pierce',
      recipient: 'primary-unit',
      amount: 9,
      armorIgnoredBasisPoints: 3750,
      defenseKind: family === 'physical' ? 'armor' : 'ward',
      scaling: {
        source: family === 'physical' ? 'physical-power' : 'mystic-power',
        coefficientBasisPoints: 2500,
      },
    })
  },
)

it('derives each mixed-family behavior independently rather than borrowing the Skill tags', () => {
  const physical = fixture('skill', 'physical')
  const mystic = fixture('skill', 'mystic')
  const value = {
    ...physical,
    ability: {
      schemaVersion: 1,
      behaviors: [
        abilityOf(physical).behaviors[0]!,
        { ...abilityOf(mystic).behaviors[0]!, id: 'mystic-group' },
      ],
    },
  }
  const result = combatContentCategory('skill')!.parseAuthoring(value)
  expect(abilityOf(result).behaviors.map((behavior) => behavior.effects[0]!.payload)).toMatchObject(
    [
      { defenseKind: 'armor', scaling: { source: 'physical-power', coefficientBasisPoints: 2500 } },
      { defenseKind: 'ward', scaling: { source: 'mystic-power', coefficientBasisPoints: 2500 } },
    ],
  )
})
