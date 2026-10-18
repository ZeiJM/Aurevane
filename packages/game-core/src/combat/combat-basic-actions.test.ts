import { describe, expect, it } from 'vitest'
import {
  BASIC_SKILL_IDS,
  defaultBasicSkills,
  validateBasicSkillDefinition,
  captureBasicSkillSources,
  resolveBasicSkillVersion,
} from './combat-basic-actions'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { SUPPORT_ACTION_IDS } from './support-actions'

describe('editable Basic and Support definitions', () => {
  it('includes both Basics and every Support option as independently valid records', () => {
    const definitions = defaultBasicSkills()
    expect(definitions.map((row) => row.id)).toEqual(BASIC_SKILL_IDS)
    expect(definitions.map((row) => row.id)).toEqual([
      'basic.move',
      'unarmed.basic',
      ...SUPPORT_ACTION_IDS,
    ])
    for (const row of definitions) expect(validateBasicSkillDefinition(row)).toEqual([])
    expect(
      definitions.find((row) => row.id === 'basic.move')!.ability.behaviors[0]!.effects[0]!.payload
        .type,
    ).toBe('move')
  })

  it('preserves default AP, recovery percentages and cooldown sharing', () => {
    const definitions = defaultBasicSkills()
    expect(definitions.map((row) => row.ability.behaviors[0]!.costs)).toEqual([
      [{ resource: 'ap', amount: 20 }],
      [{ resource: 'ap', amount: 30 }],
      [{ resource: 'ap', amount: 30 }],
      [{ resource: 'ap', amount: 50 }],
      [{ resource: 'ap', amount: 50 }],
    ])
    const guard = definitions.find((row) => row.id === 'basic.guard')!
    const hp = definitions.find((row) => row.id === 'basic.recover')!
    const mp = definitions.find((row) => row.id === 'basic.recover.mp')!
    expect(guard.ability.behaviors[0]!.cooldown).toEqual({ key: 'basic.guard', ownerTurns: 2 })
    expect(hp.ability.behaviors[0]!.cooldown).toEqual({ key: 'basic.recovery', ownerTurns: 2 })
    expect(mp.ability.behaviors[0]!.cooldown).toEqual(hp.ability.behaviors[0]!.cooldown)
    expect(hp.ability.behaviors[0]!.effects[0]!.payload).toEqual({
      type: 'percentage-recovery',
      recipient: 'actor',
      resource: 'hp',
      percentageBasisPoints: 1000,
    })
    expect(mp.ability.behaviors[0]!.effects[0]!.payload).toEqual({
      type: 'percentage-recovery',
      recipient: 'actor',
      resource: 'mp',
      percentageBasisPoints: 1000,
    })
  })

  it('captures only the equipped Support alongside Move and Basic Attack', () => {
    for (const supportActionId of SUPPORT_ACTION_IDS) {
      const sources = captureBasicSkillSources({
        ownerCombatantId: 'actor',
        supportActionId,
        definitions: defaultBasicSkills(),
      })
      expect(sources.map((row) => row.abilityId)).toEqual([
        'basic.move',
        'unarmed.basic',
        supportActionId,
      ])
      for (const source of sources) {
        expect(source.sourceKind).toBe('basic')
        expect(captureCombatAbilitySource(source)).toEqual(source)
        expect(source.basic!.id).toBe(source.abilityId)
        expect(source.basic!.ability).toEqual(source.definition)
      }
    }
  })

  it('keeps complete old captures immutable while a new version contains real edits', () => {
    const definitions = defaultBasicSkills()
    const old = captureBasicSkillSources({
      ownerCombatantId: 'actor',
      supportActionId: 'basic.recover',
      definitions,
    })
    const original = definitions.find((row) => row.id === 'basic.recover')!
    const edited = {
      ...original,
      contentVersion: 2,
      name: 'Renewal',
      description: 'Restore a quarter of maximum HP.',
      media: { ...original.media, iconKey: 'owner/renewal' },
      ability: {
        ...original.ability,
        behaviors: original.ability.behaviors.map((behavior) => ({
          ...behavior,
          costs: [{ resource: 'ap' as const, amount: 35 }],
          cooldown: { key: 'basic.recovery', ownerTurns: 3 },
          effects: [
            {
              id: 'recovery',
              payload: {
                type: 'percentage-recovery' as const,
                recipient: 'actor' as const,
                resource: 'hp' as const,
                percentageBasisPoints: 2500,
              },
            },
          ],
        })),
      },
    }
    const next = captureBasicSkillSources({
      ownerCombatantId: 'actor',
      supportActionId: 'basic.recover',
      definitions: definitions.map((row) => (row.id === edited.id ? edited : row)),
    })
    expect(old[2]!.basic!.name).toBe('HP Recovery')
    expect(old[2]!.definition.behaviors[0]!.costs[0]!.amount).toBe(50)
    expect(next[2]!.basic).toEqual(edited)
    expect(next[2]!.contentVersion).toBe(2)
    expect(Object.isFrozen(old[2]!.basic!.media)).toBe(true)
    edited.media.iconKey = 'changed-after-capture'
    expect(next[2]!.basic!.media.iconKey).toBe('owner/renewal')
  })

  it('resolves an exact version and refuses missing or contradictory captures', () => {
    const definitions = defaultBasicSkills()
    expect(resolveBasicSkillVersion('basic.guard', 1, definitions).id).toBe('basic.guard')
    expect(() => resolveBasicSkillVersion('basic.guard', 2, definitions)).toThrow(/version/i)
    const captured = captureBasicSkillSources({
      ownerCombatantId: 'actor',
      supportActionId: 'basic.guard',
      definitions,
    })[2]!
    expect(() => captureCombatAbilitySource({ ...captured, contentVersion: 2 })).toThrow(/basic/i)
    expect(() =>
      captureCombatAbilitySource({ ...captured, sourceKind: 'discipline-skill' }),
    ).toThrow(/basic/i)
    expect(() =>
      captureCombatAbilitySource({
        ...captured,
        definition: {
          ...captured.definition,
          behaviors: [{ ...captured.definition.behaviors[0]!, costs: [] }],
        },
      }),
    ).toThrow(/basic/i)
  })

  it('rejects zero-AP Basic Attack and incomplete native Move conversion', () => {
    const definitions = defaultBasicSkills()
    const attack = definitions.find((row) => row.id === 'unarmed.basic')!
    expect(
      validateBasicSkillDefinition({
        ...attack,
        ability: { ...attack.ability, behaviors: [{ ...attack.ability.behaviors[0]!, costs: [] }] },
      }),
    ).toContainEqual(expect.objectContaining({ code: 'basic-attack-positive-ap' }))
    const move = definitions[0]!
    const ability = {
      ...move.ability,
      behaviors: [
        {
          ...move.ability.behaviors[0]!,
          effects: [
            ...move.ability.behaviors[0]!.effects,
            { id: 'hit', payload: { type: 'damage', recipient: 'actor', amount: 10 } },
          ],
        },
      ],
    }
    expect(validateBasicSkillDefinition({ ...move, ability })).toContainEqual(
      expect.objectContaining({ code: 'native-move-conversion' }),
    )
    expect(
      validateBasicSkillDefinition({
        ...move,
        execution: { kind: 'basic-move', costBasis: 'flat' },
        ability,
      }),
    ).toEqual([])
  })
})

it('rejects a fixed Basic Attack family that its adaptive binding would overwrite', () => {
  const basic = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!
  const edited = {
    ...basic,
    ability: {
      ...basic.ability,
      behaviors: basic.ability.behaviors.map((behavior) => ({
        ...behavior,
        attackFamily: 'mystic' as const,
      })),
    },
  }
  expect(validateBasicSkillDefinition(edited)).toContainEqual(
    expect.objectContaining({ code: 'basic-attack-adaptive-family' }),
  )
})
