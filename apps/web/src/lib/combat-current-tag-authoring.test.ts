import { expect, it } from 'vitest'
import { currentTagForAuthoring } from './combat-current-tag-authoring'
it('converts an edited Vengeance into configured Counter without changing the original capture', () => {
  const old = {
    type: 'damage' as const,
    recipient: 'primary-unit' as const,
    amount: 0,
    vengeance: { conversionBasisPoints: 17500, maximumDamage: 20 },
  }
  expect(currentTagForAuthoring(old)).toMatchObject({
    type: 'apply-status',
    statusId: 'counter',
    counter: { kind: 'full', basisPoints: 17500 },
    durationTurns: 2,
  })
  expect(old).toHaveProperty('vengeance')
  expect(currentTagForAuthoring(currentTagForAuthoring(old))).toEqual(currentTagForAuthoring(old))
})
it('uses requested current rules for retained Cleanse, Drain and Ground only in authoring', () => {
  expect(
    currentTagForAuthoring({
      type: 'remove-status',
      recipient: 'primary-unit',
      statusIds: ['burn'],
    }),
  ).toMatchObject({ removalMode: 'all-debuffs' })
  expect(
    currentTagForAuthoring({ type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] }),
  ).not.toHaveProperty('removalMode', 'all-debuffs')
  expect(
    currentTagForAuthoring({
      type: 'resource-change',
      recipient: 'primary-unit',
      resource: 'mp',
      delta: -15,
    }),
  ).toMatchObject({ basis: 'maximum-mp-percent', delta: -15 })
  expect(
    currentTagForAuthoring({
      type: 'create-terrain',
      recipient: 'affected-tiles',
      terrain: 'frozen',
    }),
  ).toHaveProperty('skillApSurcharge', 10)
})
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { validateAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { correctCombatContentEntries } from './combat-content-corrector'
it.each(['skill', 'essence', 'resonance'] as const)(
  'saves the current Counter rule through the shared %s commit corrector',
  (kind) => {
    const ability = structuredClone(
      defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability,
    )
    const group = ability.behaviors[0]!
    const original = {
      ability: {
        ...ability,
        behaviors: [
          {
            ...group,
            effects: [
              {
                id: 'old-vengeance',
                payload: {
                  type: 'damage' as const,
                  recipient: 'primary-unit' as const,
                  amount: 0,
                  vengeance: { conversionBasisPoints: 15000, maximumDamage: 20 },
                },
              },
            ],
          },
        ],
      },
    }
    const result = correctCombatContentEntries(kind, original)
    expect(result.definition.ability.behaviors[0]!.effects[0]!.payload).toMatchObject({
      type: 'apply-status',
      statusId: 'counter',
      counter: { basisPoints: 15000 },
    })
    expect(validateAbilityDefinition(result.definition.ability)).toEqual([])
    expect(original.ability.behaviors[0]!.effects[0]!.payload).toHaveProperty('vengeance')
  },
)
it('adds linked Chilled on an explicit commit of a retained Frozen Ground effect', () => {
  const input = {
    id: 'custom.frozen',
    effects: [{ type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' }],
    effectDescriptions: ['Keep this terrain note.'],
  }
  const result = correctCombatContentEntries('skill', input)
  expect(result.definition.effects).toHaveLength(2)
  expect(result.definition.effects[1]).toMatchObject({ type: 'apply-status', statusId: 'frozen' })
  expect(result.definition.effectDescriptions).toEqual(['Keep this terrain note.', null])
  expect(input.effects).toHaveLength(1)
})

import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { currentSummonForAuthoring } from './combat-current-tag-authoring'
it('projects current Summon settings without rewriting the retained profile on read', () => {
  const original = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
  const before = structuredClone(original)
  const current = currentSummonForAuthoring(original)
  expect(current).toMatchObject({
    coreAttributes: {
      might: 10,
      finesse: 10,
      vitality: 10,
      agility: 10,
      intellect: 10,
      resolve: 10,
    },
    derivedStatRulesVersion: 5,
    potencyBasisPoints: 4000,
    neverMoves: false,
    aiProfile: 'high',
  })
  expect(current.id).toBe(original.id)
  expect(current.tags).toEqual(original.tags)
  expect(current.portraitKey).toBe(original.portraitKey)
  expect(currentSummonForAuthoring(current)).toEqual(current)
  expect(original).toEqual(before)
})
it.each(['skill', 'essence', 'resonance'] as const)(
  'inherits parent text for canonical %s Summon only on explicit save',
  (kind) => {
    const profile = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
    const original = {
      description: 'Parent details',
      flavorLine: 'Parent flavor',
      ability: {
        schemaVersion: 1,
        behaviors: [
          {
            id: 'main',
            effects: [
              { id: 'summon', payload: { type: 'summon', recipient: 'selected-tile', profile } },
            ],
          },
        ],
      },
    }
    const before = structuredClone(original)
    const result = correctCombatContentEntries(kind, original).definition
    expect(result.ability.behaviors[0]!.effects[0]!.payload.profile).toMatchObject({
      description: 'Parent details',
      flavorLine: 'Parent flavor',
      potencyBasisPoints: 4000,
      derivedStatRulesVersion: 5,
    })
    expect(original).toEqual(before)
    expect(correctCombatContentEntries(kind, result).corrections).toEqual([])
  },
)
it('inherits parent text for retained native Summons and preserves hidden text when parent text is absent', () => {
  const profile = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
  expect(
    correctCombatContentEntries('skill', {
      description: 'Edited details',
      flavorLine: 'Edited flavor',
      summonProfile: profile,
    }).definition.summonProfile,
  ).toMatchObject({ description: 'Edited details', flavorLine: 'Edited flavor' })
  expect(
    correctCombatContentEntries('skill', { summonProfile: profile }).definition.summonProfile,
  ).toMatchObject({ description: profile.description, flavorLine: profile.flavorLine })
})
it('leaves malformed Summon rows for strict validation instead of throwing during correction', () => {
  const malformed = { summonProfile: { abilities: [null], stats: {} } }
  expect(correctCombatContentEntries('skill', malformed).definition).toEqual(malformed)
})

it('classifies a healing Summon Skill as an attack when its shared editor adds Damage', () => {
  const original = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
  const healing = original.abilities[1]!
  const changed = {
    ...original,
    abilities: [
      {
        ...healing,
        tags: ['heal', 'support'],
        effects: [{ type: 'damage' as const, recipient: 'primary-unit' as const, amount: 8 }],
      },
    ],
  }
  expect(currentSummonForAuthoring(changed).abilities[0]!.tags).toEqual([
    'heal',
    'support',
    'attack',
    'physical',
  ])
  expect(changed.abilities[0]!.tags).toEqual(['heal', 'support'])
  expect(
    currentSummonForAuthoring({
      ...changed,
      abilities: [{ ...changed.abilities[0]!, tags: ['heal', 'mystic'] }],
    }).abilities[0]!.tags,
  ).toEqual(['heal', 'attack', 'mystic'])
})

it('binds an Endure-only Summon Skill to Self without requiring an enemy selection', () => {
  const original = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
  const profile = {
    ...original,
    abilities: [
      {
        ...original.abilities[0]!,
        effects: [
          {
            type: 'endure' as const,
            recipient: 'actor' as const,
            durationTurns: 2,
            releaseBasisPoints: 15000,
            radiusTiles: 3,
            targetTeams: 'enemies' as const,
          },
        ],
      },
    ],
  }
  const current = currentSummonForAuthoring(profile)
  expect(current.abilities[0]!.target).toMatchObject({
    kind: 'self',
    minimumRange: 0,
    maximumRange: 0,
  })
  expect(current.abilities[0]!.effects[0]).toMatchObject({ target: 'self', recipient: 'actor' })
  expect(profile.abilities[0]!.target.kind).toBe('unit')
})

it.each(['skill', 'essence', 'resonance'] as const)(
  'preserves Dispel identity through the shared %s current-save corrector',
  (kind) => {
    const payload = {
      type: 'remove-status' as const,
      recipient: 'primary-unit' as const,
      statusIds: ['guarded'],
      removalMode: 'specified' as const,
    }
    const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability
    const ability = {
      ...base,
      behaviors: base.behaviors.map((behavior, index) =>
        index === 0 ? { ...behavior, effects: [{ id: 'remove-buff', payload }] } : behavior,
      ),
    }
    const result = correctCombatContentEntries(kind, { ability })
    expect(result.definition.ability.behaviors[0]!.effects[0]!.payload).toMatchObject({
      selectionKind: 'buffs',
      statusIds: ['guarded'],
      removalMode: 'specified',
    })
    expect(validateAbilityDefinition(result.definition.ability)).toEqual([])
    expect(payload).not.toHaveProperty('selectionKind')
  },
)
