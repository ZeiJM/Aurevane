import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { correctCombatContentEntries } from '@/lib/combat-content-corrector'
import {
  validateSkillDefinition,
  validateResonanceAuthoringDefinition,
} from './current-combat-content-authoring-validation'
import {
  validateSkillDefinition as validateHistoricalSkill,
  validateResonanceAuthoringDefinition as validateHistoricalResonance,
} from './combat-content-authoring-validation'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'

vi.mock('server-only', () => ({}))

const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
const hit = {
  id: 'ground.hit',
  payload: { type: 'damage', recipient: 'affected-units', target: 'ground', amount: 5 },
}
function definition(mixed = false) {
  return {
    ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
    ability: {
      schemaVersion: 1,
      behaviors: [
        {
          ...base,
          targeting: {
            ...base.targeting!,
            kind: mixed ? 'unit' : 'ground-tile',
            geometryVersion: 3,
            categories: mixed ? ['enemy', 'ground'] : ['ground'],
            teamPolicy: 'any',
            friendlyFire: 'all-units',
            maximumSelections: 1,
          },
          effects: [
            hit,
            mixed
              ? { id: 'enemy.hit', payload: { ...hit.payload, target: 'enemy' } }
              : {
                  id: 'self.heal',
                  payload: { type: 'healing', recipient: 'actor', target: 'self', amount: 1 },
                },
          ],
        },
      ],
    },
  }
}

it('rejects unsupported current mixed Ground groups without changing their readable historical rules', () => {
  const source = definition(true)
  const before = structuredClone(source)
  expect(validateHistoricalSkill(source).valid).toBe(true)
  const proposed = correctCombatContentEntries('skill', source).definition
  expect(proposed.ability.behaviors[0]!.targeting).toEqual(source.ability.behaviors[0]!.targeting)
  expect(proposed.ability.behaviors[0]).not.toHaveProperty('groundArea')
  const result = validateSkillDefinition(proposed)
  expect(result.valid).toBe(false)
  expect(result.issues).toContainEqual(
    expect.objectContaining({
      code: 'GROUND_PERSISTENCE',
      message: expect.stringContaining('Ground-only target group'),
    }),
  )
  expect(source).toEqual(before)
})

it('accepts corrected Ground-only groups with independently targeted Self utility', () => {
  const proposed = correctCombatContentEntries('skill', definition()).definition
  expect(proposed.ability.behaviors[0]).toHaveProperty('groundArea')
  expect(validateSkillDefinition(proposed)).toMatchObject({ valid: true, issues: [] })
})
it('keeps mixed native Skill and Summon drafts unchanged and rejects current save', () => {
  const source = definition(true)
  const { ability, ...envelope } = source
  const group = ability.behaviors[0]!
  const native = {
    ...envelope,
    target: group.targeting,
    effects: group.effects.map((effect) => effect.payload),
  }
  expect(validateHistoricalSkill(native).valid).toBe(true)
  const proposed = correctCombatContentEntries('skill', native).definition
  expect(proposed).not.toHaveProperty('groundArea')
  const mixedField = {
    ...native,
    groundArea: { durationRounds: 2, visualPresetId: 'arcane-pulse', entryEffectOrdinals: [0] },
  }
  expect(validateHistoricalSkill(mixedField).valid).toBe(true)
  expect(validateSkillDefinition(mixedField)).toMatchObject({
    valid: false,
    issues: expect.arrayContaining([expect.objectContaining({ code: 'GROUND_PERSISTENCE' })]),
  })
  expect(validateSkillDefinition(proposed)).toMatchObject({
    valid: false,
    issues: expect.arrayContaining([expect.objectContaining({ code: 'GROUND_PERSISTENCE' })]),
  })
  const invocation = defaultBasicSkills().find((row) => row.id === 'basic.invocation')!
  const summonGroup = invocation.ability.behaviors[0]!
  const summonEffect = summonGroup.effects[0]!
  if (summonEffect.payload.type !== 'summon') throw new Error('Expected Invocation Summon')
  const nested = {
    ...invocation,
    ability: {
      ...invocation.ability,
      behaviors: [
        {
          ...summonGroup,
          effects: [
            {
              ...summonEffect,
              payload: {
                ...summonEffect.payload,
                profile: {
                  ...summonEffect.payload.profile,
                  abilities: [
                    {
                      ...summonEffect.payload.profile.abilities[0]!,
                      target: native.target,
                      effects: native.effects,
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    },
  }
  const correctedSummon = correctCombatContentEntries('skill', nested).definition.ability
    .behaviors[0]!.effects[0]!.payload
  if (correctedSummon.type !== 'summon') throw new Error('Expected corrected Invocation Summon')
  expect(correctedSummon.profile.abilities[0]).not.toHaveProperty('groundArea')
  expect(validateSkillDefinition(nested).issues).toContainEqual(
    expect.objectContaining({
      code: 'GROUND_PERSISTENCE',
      path: expect.stringContaining('.profile'),
    }),
  )
})
it('rejects current retained Resonance Ground results while preserving readable historical captures', () => {
  const original = resolveResonanceForPair('farstrider', 'lifebinder')!
  if (original.trigger.kind !== 'skill-trigger-v2')
    throw new Error('Expected retained v2 Resonance')
  const source = { ...original, trigger: { ...original.trigger, resultEffects: [hit.payload] } }
  delete source.ability
  const before = structuredClone(source)
  expect(validateHistoricalResonance(source).valid).toBe(true)
  const result = validateResonanceAuthoringDefinition(source)
  expect(result).toMatchObject({
    valid: false,
    issues: expect.arrayContaining([
      expect.objectContaining({
        code: 'GROUND_PERSISTENCE',
        message: expect.stringContaining('full effect editor'),
      }),
    ]),
  })
  expect(source).toEqual(before)
})

it('requires persistence for current unit-entry Ground effects but keeps a terrain operation outside that contract', () => {
  expect(validateSkillDefinition(definition()).issues).toContainEqual(
    expect.objectContaining({ code: 'GROUND_PERSISTENCE' }),
  )
  const source = definition()
  source.ability.behaviors[0]!.effects = [
    {
      id: 'terrain',
      payload: {
        type: 'create-terrain',
        recipient: 'affected-tiles',
        target: 'ground',
        terrain: 'frozen',
      },
    },
  ] as unknown as (typeof source.ability.behaviors)[0]['effects']
  expect(validateHistoricalSkill(source).valid).toBe(true)
  expect(
    validateSkillDefinition(source).issues.filter((issue) => issue.code === 'GROUND_PERSISTENCE'),
  ).toEqual([])
})
