import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  parseAbilityDefinition,
  type AbilityBehavior,
} from '@aurevane/game-core/combat/combat-definition'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import type { CombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import {
  createCombatContentResolver,
  RpcPublishedCombatContentSource,
  type CombatContentCatalogue,
  type CombatContentCatalogueEntry,
} from './combat-content-resolver'
import { validateCombatCatalogueTiming } from './combat-catalogue-timing-compatibility'

const policy: CombatEffectTimingPolicy = { version: 7, modes: { damage: 'controlled' } }
function source(overrides: Partial<AbilityBehavior> = {}) {
  const basic = defaultBasicSkills().find((entry) => entry.id === 'unarmed.basic')!
  return {
    definition: {
      schemaVersion: 1 as const,
      behaviors: [
        {
          ...structuredClone(basic.ability.behaviors[0]!),
          id: 'strike',
          effects: [
            {
              id: 'hit',
              payload: { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 10 },
            },
          ],
          ...overrides,
        },
      ],
    },
  }
}
function skill(ability = source().definition): CombatContentCatalogueEntry {
  const definition = {
    ...structuredClone(resolveMatureSkillVersion('vanguard.forceful-strike')!),
    ability: parseAbilityDefinition(ability),
  }
  return {
    contentKey: definition.id,
    contentKind: 'skill',
    contentVersion: definition.contentVersion,
    source: 'published',
    category: 'skill',
    definition,
  }
}
function catalogue(entries: readonly CombatContentCatalogueEntry[]): CombatContentCatalogue {
  return { token: 'a'.repeat(32), policy: structuredClone(policy), entries }
}
it('accepts the complete current native roster with its existing timing and does not mutate it', async () => {
  const resolver = createCombatContentResolver(
    new RpcPublishedCombatContentSource(async () => ({
      data: { token: 'a'.repeat(32), policy: { version: 1, modes: {} }, publications: [] },
      error: null,
    })),
  )
  const current = await resolver.resolveCurrentCatalogue!()
  const before = JSON.stringify(current)
  expect(validateCombatCatalogueTiming(current)).toEqual([])
  expect(JSON.stringify(current)).toBe(before)
})
it('accepts a captured Manual group using inherited Controlled without rewriting its immutable definition', () => {
  const current = catalogue([skill()])
  const before = JSON.stringify(current)
  expect(validateCombatCatalogueTiming(current)).toEqual([])
  expect(JSON.stringify(current)).toBe(before)
})
it('reports the exact incompatible Automatic group and accepts its explicit Instant override', () => {
  const automatic = source({
    activation: 'automatic',
    activationLimits: ['once-per-action'],
    automaticTarget: { subject: 'triggering' },
    requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
  }).definition
  expect(validateCombatCatalogueTiming(catalogue([skill(automatic)]))).toEqual([
    expect.objectContaining({
      contentKey: 'vanguard.forceful-strike',
      behaviorId: 'strike',
      code: 'unsupported-controlled-behavior',
    }),
  ])
  const explicit = structuredClone(automatic)
  Object.assign(explicit.behaviors[0]!.effects[0]!, { timing: 'instant' })
  expect(validateCombatCatalogueTiming(catalogue([skill(explicit)]))).toEqual([])
})
it('rejects a legacy Skill that would have no Manual prime authority', () => {
  const entry = skill()
  const definition = structuredClone(entry.definition)
  delete (definition as { ability?: unknown }).ability
  const result = validateCombatCatalogueTiming(
    catalogue([{ ...entry, definition } as CombatContentCatalogueEntry]),
  )
  expect(result).toEqual([
    expect.objectContaining({
      contentKey: entry.contentKey,
      code: 'legacy-controlled-unsupported',
    }),
  ])
})
it('checks legacy Essence and Resonance effects rather than assuming all entries have canonical behaviors', () => {
  const essence = structuredClone(resolveEssenceForBuild('vanguard', null)!)
  const resonance = structuredClone(resolveResonanceForPair('vanguard', 'lifebinder')!)
  const current = catalogue([
    {
      contentKey: essence.essenceId,
      contentKind: 'essence',
      contentVersion: essence.contentVersion,
      source: 'published',
      category: 'essence',
      definition: essence,
    },
    {
      contentKey: resonance.id,
      contentKind: 'resonance',
      contentVersion: resonance.contentVersion,
      source: 'published',
      category: 'resonance',
      definition: resonance,
    },
  ])
  current.policy.modes = { healing: 'controlled', damage: 'controlled', fortified: 'controlled' }
  expect(
    validateCombatCatalogueTiming(current)
      .map((issue) => issue.contentKey)
      .sort(),
  ).toEqual([essence.essenceId, resonance.id].sort())
})
it('does not let an inherited Controlled Rewind skip its required captured cast-position anchor', () => {
  const current = catalogue([
    skill(
      source({
        classification: 'utility',
        attackFamily: undefined,
        targeting: defaultBasicSkills().find((entry) => entry.id === 'basic.guard')!.ability
          .behaviors[0]!.targeting,
        effects: [{ id: 'rewind', payload: { type: 'return-to-turn-start', recipient: 'actor' } }],
      }).definition,
    ),
  ])
  current.policy.modes = { 'return-to-turn-start': 'controlled' }
  expect(validateCombatCatalogueTiming(current)).toEqual([
    expect.objectContaining({
      contentKey: 'vanguard.forceful-strike',
      behaviorId: 'strike',
      code: 'unsupported-controlled-behavior',
    }),
  ])
  Object.assign(
    (current.entries[0]!.definition as { ability: ReturnType<typeof source>['definition'] }).ability
      .behaviors[0]!.effects[0]!.payload,
    { anchorMode: 'cast-position' },
  )
  expect(validateCombatCatalogueTiming(current)).toEqual([])
})
it('keeps disabled incompatible Owner entries inactive without replacing them with builtins', () => {
  const entry = skill()
  const legacy = structuredClone(entry.definition)
  delete (legacy as { ability?: unknown }).ability
  Object.assign(legacy, { enabled: false })
  const current = catalogue([{ ...entry, definition: legacy } as CombatContentCatalogueEntry])
  const before = JSON.stringify(current)
  expect(validateCombatCatalogueTiming(current)).toEqual([])
  expect(JSON.stringify(current)).toBe(before)
})
