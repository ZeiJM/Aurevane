import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { validateEssenceDefinition, type EssenceDefinition } from './essence'
import { validateResonanceDefinition, type AnyResonanceDefinition } from './resonance'
import { applyAbilityTimingDefaults } from './combat-definition'
import {
  identityBaseline,
  identityCandidate,
  identityDesigns,
  identityExtensions,
  identityResonances,
  identityTimingPolicy,
  matchingActions,
  requirementNodes,
} from './essence-resonance-identity.test-utils'
function normalized(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map(normalized)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, v]) => [k, normalized(v)]),
        )
      : value
}
function digest(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(normalized(value)))
    .digest('hex')
}
it('pins the complete source baseline and the individual153-design inventory', () => {
  expect(identityCandidate.previousManifestSha256).toBe(
    createHash('sha256')
      .update(
        readFileSync(
          new URL(
            '../../../../docs/superpowers/specs/2026-10-18-modular-correction-cohort.json',
            import.meta.url,
          ),
        ),
      )
      .digest('hex'),
  )
  expect(identityCandidate.designManifestSha256).toBe(
    createHash('sha256')
      .update(
        readFileSync(
          new URL(
            '../../../../docs/superpowers/specs/2026-10-19-essence-resonance-designs.json',
            import.meta.url,
          ),
        ),
      )
      .digest('hex'),
  )
  expect(identityCandidate.records).toHaveLength(identityCandidate.requiredRecordCount)
  expect(identityCandidate.review).toHaveLength(153)
  expect(identityExtensions).toHaveLength(153)
  expect(identityResonances).toHaveLength(136)
  expect(new Set(identityResonances.map((row) => row.after.disciplinePair!.join(':'))).size).toBe(
    136,
  )
  expect(
    new Set(
      identityExtensions
        .filter((row) => row.kind === 'essence')
        .map((row) => row.after.sourceDisciplineId),
    ).size,
  ).toBe(17)
  expect(
    identityCandidate.records.every((row) => row.kind === 'essence' || row.kind === 'resonance'),
  ).toBe(true)
})
it.each(identityCandidate.records)(
  '$id appends one real change to the exact stable released version',
  (row) => {
    const before = identityBaseline.records.find((record) => record.id === row.id)!
    expect(row.kind).toBe(before.kind)
    expect(row.beforeVersion).toBe(before.after.contentVersion)
    expect(row.beforeDigest).toBe(digest(before.after))
    expect(row.after.contentVersion).toBe(before.after.contentVersion + 1)
    for (const field of ['id', 'essenceId', 'sourceDisciplineId', 'disciplinePair'] as const)
      expect(row.after[field]).toEqual(before.after[field])
    expect({ ...row.after, contentVersion: before.after.contentVersion }).not.toEqual(before.after)
  },
)
it.each(identityExtensions)(
  '$id validates actual canonical authority and preserves a reviewed design',
  (row) => {
    expect(
      row.kind === 'essence'
        ? validateEssenceDefinition(row.after as unknown as EssenceDefinition)
        : validateResonanceDefinition(row.after as unknown as AnyResonanceDefinition),
    ).toEqual([])
    expect(
      identityDesigns.records.find((record) => record.id === row.id)!.canonicalAbility,
    ).toEqual(row.after.ability)
    for (const behavior of row.after.ability.behaviors) {
      expect(behavior.activationLimits ?? []).not.toContain('once-per-battle')
      expect(() => applyAbilityTimingDefaults(behavior, identityTimingPolicy)).not.toThrow()
      for (const effect of behavior.effects) expect(effect.timing).toBeUndefined()
      if (row.kind === 'resonance') {
        expect(['automatic', 'ongoing']).toContain(behavior.activation)
        if (behavior.activation === 'automatic') {
          expect(
            (behavior.cooldown?.ownerTurns ?? 0) > 0 ||
              (behavior.activationLimits?.length ?? 0) > 0,
          ).toBe(true)
        }
        if (requirementNodes(behavior.requirements).some((node) => node.kind === 'action'))
          expect(
            matchingActions(behavior.requirements, row.after.disciplinePair).length,
          ).toBeGreaterThan(0)
      }
    }
  },
)
it('keeps only two explicitly prepared fixed-power damage riders and covers causal relations', () => {
  const damage = identityResonances.flatMap((row) =>
    row.after.ability.behaviors.flatMap((behavior) =>
      behavior.effects
        .filter((effect) => effect.payload.type === 'damage' || effect.payload.type === 'pierce')
        .map((effect) => ({ row, behavior, effect })),
    ),
  )
  expect(damage).toHaveLength(2)
  for (const { behavior, effect } of damage) {
    expect(behavior.activation).toBe('automatic')
    expect(behavior.mode).toBe('modifier')
    expect(
      requirementNodes(behavior.requirements).filter((node) => node.kind === 'status-presence')
        .length,
    ).toBeGreaterThanOrEqual(2)
    expect(
      requirementNodes(behavior.requirements).some(
        (node) =>
          node.kind === 'action' && !!node.sourceDisciplineId && !!node.requiredTags?.length,
      ),
    ).toBe(true)
    expect(effect.payload).toMatchObject({ scaling: { coefficientBasisPoints: 0 } })
  }
  const kinds = new Set(
    identityResonances.flatMap((row) =>
      row.after.ability.behaviors.flatMap((behavior) =>
        requirementNodes(behavior.requirements).map((node) => node.kind),
      ),
    ),
  )
  for (const kind of [
    'all',
    'any',
    'event',
    'action',
    'resource-state',
    'resource-threshold-crossing',
    'status-presence',
    'prime-presence',
    'subject-relation',
  ] as const)
    expect(kinds.has(kind)).toBe(true)
})

it('has no scalar/identity-only canonical mechanical duplicates across136 pairs', () => {
  const signatures = new Map<string, string[]>()
  function recipe(value: unknown): unknown {
    if (typeof value === 'number') return '#'
    if (Array.isArray(value)) return value.map(recipe)
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !['id', 'key', 'sourceDisciplineId', 'abilityId'].includes(key))
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, entry]) => [key, recipe(entry)]),
      )
    return value
  }
  for (const row of identityResonances) {
    const signature = JSON.stringify(recipe(row.after.ability)),
      ids = signatures.get(signature) ?? []
    signatures.set(signature, [...ids, row.id])
  }
  expect([...signatures.values()].filter((ids) => ids.length > 1)).toEqual([])
})
it('requires a current native producer for any interrupted-action pair recipe', () => {
  for (const row of identityResonances)
    for (const behavior of row.after.ability.behaviors) {
      if (
        !requirementNodes(behavior.requirements).some(
          (node) => node.kind === 'event' && node.eventType === 'combat_action_interrupted',
        )
      )
        continue
      const parents = matchingActions(behavior.requirements, row.after.disciplinePair)
      const currentBeforeUseReactions = [
        ...identityBaseline.records.filter((row) => row.kind === 'skill'),
        ...identityResonances,
      ]
        .flatMap((row) => row.after.ability.behaviors)
        .filter(
          (group) =>
            group.activation === 'automatic' &&
            group.mode === 'action' &&
            requirementNodes(group.requirements).some(
              (node) =>
                node.kind === 'event' &&
                node.eventType === 'combat_action_used' &&
                node.phase === 'before',
            ),
        )
      expect(
        parents.some((parent) =>
          parent.behavior.effects.some((effect) =>
            ['move', 'summon', 'return-to-turn-start'].includes(effect.payload.type),
          ),
        ) || currentBeforeUseReactions.length > 0,
        `${row.id}: no current interrupted parent producer`,
      ).toBe(true)
    }
})
