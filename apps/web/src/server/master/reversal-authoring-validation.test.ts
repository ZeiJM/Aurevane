import { expect, it, vi } from 'vitest'
import type { CombatContentDefinition } from '@aurevane/db/combat-content'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { createAuthorableEffectPayload } from '@aurevane/game-core/combat/combat-effect-authoring'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import {
  currentResonanceDefinitions,
  P35_REPRESENTATIVE_RESONANCES,
} from '@aurevane/game-core/combat/resonance'
import { isResonanceDefinitionV2 } from '@aurevane/game-core/combat/resonance-v2'
import { validateSummonProfileDefinition } from '@aurevane/game-core/combat/summon-content'
import { createDefaultCombatEffect } from '@/components/master/combat-content/skill-effect-list-editor'
import { combatContentCategory } from '../combat/combat-content-categories'
import { createCombatContentRecordCommand } from './combat-content-record-command'
import {
  validateSkillDefinition,
  validateEssenceAuthoringDefinition,
  validateResonanceAuthoringDefinition,
} from './current-combat-content-authoring-validation'

vi.mock('server-only', () => ({}))

const selfTarget = {
  kind: 'self',
  teamPolicy: 'self',
  friendlyFire: 'allies-only',
  shape: { kind: 'single' },
  minimumRange: 0,
  maximumRange: 0,
  requiresLineOfSight: false,
  maximumElevationDifference: null,
  maximumSelections: 1,
} as const

function nativeSkill() {
  const skill = structuredClone(resolveMatureSkillVersion('farstrider.scouts-mark')!)
  Reflect.deleteProperty(skill, 'ability')
  return {
    ...skill,
    target: selfTarget,
    tags: ['utility'],
    requirements: [],
    effects: [createDefaultCombatEffect('reversal')],
  }
}

function nativeEssence() {
  const essence = structuredClone(resolveEssenceForBuild('vanguard', null, 1)!)
  Reflect.deleteProperty(essence, 'ability')
  Reflect.deleteProperty(essence.skill, 'ability')
  return {
    ...essence,
    skill: {
      ...essence.skill,
      target: selfTarget,
      tags: ['essence', 'vanguard', 'utility'],
      requirements: [],
      effects: [createDefaultCombatEffect('reversal')],
    },
  }
}

function nativeResonance(version: 1 | 2) {
  const resonance = structuredClone(
    version === 1 ? P35_REPRESENTATIVE_RESONANCES[0]! : currentResonanceDefinitions()[0]!,
  )
  Reflect.deleteProperty(resonance, 'ability')
  const effects = [createDefaultCombatEffect('reversal')]
  return {
    ...resonance,
    trigger: isResonanceDefinitionV2(resonance)
      ? { ...resonance.trigger, resultEffects: effects }
      : { ...resonance.trigger, payoffEffects: effects },
  }
}

const fixtures = [
  {
    kind: 'skill',
    label: 'Skill',
    definition: nativeSkill(),
    path: 'effects[0]',
    code: 'REVERSAL_REQUIRES_MODULAR_ABILITY',
    validate: validateSkillDefinition,
  },
  {
    kind: 'essence',
    label: 'Essence',
    definition: nativeEssence(),
    path: 'skill.effects[0]',
    code: 'REVERSAL_REQUIRES_MODULAR_ABILITY',
    validate: validateEssenceAuthoringDefinition,
  },
  {
    kind: 'resonance',
    label: 'v1 Resonance',
    definition: nativeResonance(1),
    path: 'trigger.payoffEffects[0]',
    code: 'REVERSAL_REQUIRES_MANUAL_ACTION',
    validate: validateResonanceAuthoringDefinition,
  },
  {
    kind: 'resonance',
    label: 'v2 Resonance',
    definition: nativeResonance(2),
    path: 'trigger.resultEffects[0]',
    code: 'REVERSAL_REQUIRES_MANUAL_ACTION',
    validate: validateResonanceAuthoringDefinition,
  },
] as const

it.each(fixtures)(
  'rejects unsupported native $label Reversal without changing the input',
  ({ definition, path, code, validate }) => {
    const before = structuredClone(definition)
    expect(validate(definition)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([expect.objectContaining({ path, code })]),
    })
    expect(definition).toEqual(before)
  },
)

it.each(fixtures)(
  'blocks $label Reversal at the strict save and Commit Now boundary',
  async ({ kind, definition }) => {
    const writeRecord = vi.fn()
    const commitRecord = vi.fn()
    const command = createCombatContentRecordCommand(
      {
        readRecord: async () => ({ contentKind: kind }),
        writeRecord,
        commitRecord,
      } as unknown as Parameters<typeof createCombatContentRecordCommand>[0],
      { requireOperator: vi.fn() } as unknown as Parameters<
        typeof createCombatContentRecordCommand
      >[1],
      'owner',
    )
    for (const action of ['save', 'commit']) {
      await expect(
        command({ action, contentKey: 'test.reversal', expectedRevision: 1, definition }),
      ).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
        message: expect.stringMatching(/Reversal requires/),
      })
    }
    expect(writeRecord).not.toHaveBeenCalled()
    expect(commitRecord).not.toHaveBeenCalled()
  },
)

it.each(fixtures)(
  'retains historical $label payloads unchanged for reading',
  ({ kind, definition }) => {
    const before = structuredClone(definition)
    const key = 'essenceId' in definition ? definition.essenceId : definition.id
    expect(combatContentCategory(kind)!.parseRetained(definition, key)).toEqual(before)
    expect(definition).toEqual(before)
  },
)

it.each(['skill', 'essence'] as const)(
  'accepts paid modular Manual Action Reversal for %s',
  (kind) => {
    const guard = defaultBasicSkills().find((row) => row.id === 'basic.guard')!.ability
      .behaviors[0]!
    const ability: AbilityDefinition = {
      schemaVersion: 1,
      behaviors: [
        {
          ...guard,
          classification: 'utility',
          targeting: selfTarget,
          costs: [{ resource: 'ap', amount: 50 }],
          effects: [
            {
              id: 'reversal',
              timing: 'controlled',
              payload: createAuthorableEffectPayload('reversal')!,
            },
          ],
        },
      ],
    }
    const definition =
      kind === 'skill' ? { ...nativeSkill(), ability } : { ...nativeEssence(), ability }
    const before = structuredClone(definition)
    const validate = kind === 'skill' ? validateSkillDefinition : validateEssenceAuthoringDefinition
    expect(validate(definition)).toMatchObject({ valid: true, issues: [] })
    expect(
      combatContentCategory(kind)!.parseAuthoring(definition as unknown as CombatContentDefinition),
    ).toHaveProperty('ability', ability)
    expect(definition).toEqual(before)
  },
)

it('keeps native Summon Reversal valid for the paid preparation adapter', () => {
  const skill = structuredClone(resolveMatureSkillVersion('wildwarden.renewing-herbs')!)
  Reflect.deleteProperty(skill, 'ability')
  const profile = skill.summonProfile!
  const value = {
    ...profile,
    abilities: [
      {
        ...profile.abilities[0]!,
        apCost: 50,
        mpCost: 5,
        tags: ['utility'],
        target: selfTarget,
        requirements: [],
        effects: [createDefaultCombatEffect('reversal')],
      },
    ],
  }
  const before = structuredClone(value)
  expect(validateSummonProfileDefinition(value)).toEqual([])
  const definition = { ...skill, summonProfile: value }
  expect(validateSkillDefinition(definition)).toMatchObject({ valid: true, issues: [] })
  expect(
    combatContentCategory('skill')!.parseAuthoring(
      definition as unknown as CombatContentDefinition,
    ),
  ).toHaveProperty('summonProfile', value)
  expect(value).toEqual(before)
})
