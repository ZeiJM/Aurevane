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
import {
  combatTimingUsedBy,
  validateCombatCatalogueTiming,
} from './combat-catalogue-timing-compatibility'

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
function skill(
  ability: ReturnType<typeof parseAbilityDefinition> = source().definition,
): CombatContentCatalogueEntry {
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
function essenceEntry(
  ability: ReturnType<typeof parseAbilityDefinition> | undefined,
  nestedAbility?: ReturnType<typeof parseAbilityDefinition>,
): CombatContentCatalogueEntry {
  const definition = structuredClone(resolveEssenceForBuild('vanguard', null)!)
  if (ability) Object.assign(definition, { ability })
  if (nestedAbility) Object.assign(definition.skill, { ability: nestedAbility })
  return {
    contentKey: definition.essenceId,
    contentKind: 'essence',
    contentVersion: definition.contentVersion,
    source: 'published',
    category: 'essence',
    definition,
  }
}
function automaticAbility() {
  return parseAbilityDefinition(
    source({
      activation: 'automatic',
      activationLimits: ['once-per-action'],
      automaticTarget: { subject: 'triggering' },
      requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
    }).definition,
  )
}
it.each(['native', 'canonical'] as const)(
  'accepts compatible root Essence mechanics over an incompatible %s envelope without mutation',
  (envelope) => {
    const root = parseAbilityDefinition(source().definition)
    Object.assign(root.behaviors[0]!.effects[0]!, { timing: 'instant' })
    const current = catalogue([
      essenceEntry(root, envelope === 'canonical' ? automaticAbility() : undefined),
    ])
    const before = JSON.stringify(current)
    expect(validateCombatCatalogueTiming(current)).toEqual([])
    expect(JSON.stringify(current)).toBe(before)
  },
)
it.each(['native', 'canonical'] as const)(
  'rejects incompatible root Essence mechanics even with a compatible %s envelope',
  (envelope) => {
    const entry = essenceEntry(
      automaticAbility(),
      envelope === 'canonical' ? parseAbilityDefinition(source().definition) : undefined,
    )
    const current = catalogue([entry])
    // The native Vanguard envelope contains no healing; the root does.
    if (envelope === 'native') {
      const root = (entry.definition as { ability: ReturnType<typeof parseAbilityDefinition> })
        .ability
      Object.assign(root.behaviors[0]!.effects[0]!, {
        payload: { type: 'healing', recipient: 'actor', amount: 10, durationTurns: 0 },
      })
      expect(() => parseAbilityDefinition(root)).not.toThrow()
      current.policy.modes = { healing: 'controlled' }
    }
    const before = JSON.stringify(current)
    expect(validateCombatCatalogueTiming(current)).toEqual([
      {
        contentKey: entry.contentKey,
        behaviorId: 'strike',
        code: 'unsupported-controlled-behavior',
      },
    ])
    expect(JSON.stringify(current)).toBe(before)
  },
)
it.each(['manual', 'automatic'] as const)(
  'preserves historical nested canonical Essence %s timing checks',
  (activation) => {
    const entry = essenceEntry(
      undefined,
      activation === 'manual' ? parseAbilityDefinition(source().definition) : automaticAbility(),
    )
    expect(validateCombatCatalogueTiming(catalogue([entry]))).toEqual(
      activation === 'manual'
        ? []
        : [
            {
              contentKey: entry.contentKey,
              behaviorId: 'strike',
              code: 'unsupported-controlled-behavior',
            },
          ],
    )
  },
)
it('skips disabled root Essences without invoking runtime usability or mutating the snapshot', () => {
  const entry = essenceEntry(automaticAbility())
  Object.assign(entry.definition, { enabled: false })
  const current = catalogue([entry])
  const before = JSON.stringify(current)
  expect(validateCombatCatalogueTiming(current)).toEqual([])
  expect(JSON.stringify(current)).toBe(before)
})
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

it('reports actual Used-by from the same canonical timing inputs without changing execution order', () => {
  const entry = skill(source().definition)
  const captured = catalogue([entry, essenceEntry(source().definition)])
  const before = JSON.stringify(captured)
  const used = combatTimingUsedBy(captured)
  expect(used.damage?.map((row) => row.contentKey)).toEqual(
    expect.arrayContaining([entry.contentKey, captured.entries[1]!.contentKey]),
  )
  expect(JSON.stringify(captured)).toBe(before)
  expect(used.damage).toHaveLength(2)
  expect(validateCombatCatalogueTiming(catalogue([skill(automaticAbility())]))).toHaveLength(1)
})
