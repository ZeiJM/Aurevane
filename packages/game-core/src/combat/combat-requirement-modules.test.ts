import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AbilityBehavior } from './combat-definition'
import type { RequirementNode } from './combat-requirements'
import { evaluateAbilityRequirements } from './combat-requirements'
import {
  COMBAT_TRIGGER_MODULES,
  COMBAT_REQUIREMENT_DISCIPLINE_OPTIONS,
  COMBAT_REQUIREMENT_ACTION_TAG_OPTIONS,
  COMBAT_REQUIREMENT_STATUS_OPTIONS,
  COMBAT_REQUIREMENT_STATUS_SETS,
  createCombatTriggerModuleSelection,
  compileCombatTriggerModule,
  recognizeCombatRequirementModules,
  compileCombatRequirementModules,
  setCombatRequirementTriggerModule,
} from './combat-requirement-modules'

type Row = {
  id: string
  kind: string
  after: { tags?: string[]; ability: { behaviors: AbilityBehavior[] } }
}
function manifest(name: string): Row[] {
  return JSON.parse(
    readFileSync(
      new URL(`../../../../docs/superpowers/specs/${name}.json`, import.meta.url),
      'utf8',
    ),
  ).records
}
const baseline = new Map(
  manifest('2026-10-18-modular-correction-cohort').map((row) => [row.id, row]),
)
for (const name of [
  '2026-10-19-essence-resonance-identity-cohort',
  '2026-10-19-resonance-modularity-cohort',
])
  for (const row of manifest(name)) baseline.set(row.id, row)
const resonances = [...baseline.values()].filter((row) => row.kind === 'resonance')

describe('registered requirement modules', () => {
  it('accounts for every primitive and roundtrips all132 current automatic Resonances exactly', () => {
    const automatic = resonances.filter(
      (row) => row.after.ability.behaviors[0].activation === 'automatic',
    )
    expect(automatic).toHaveLength(132)
    const ids = new Set<string>()
    for (const row of automatic) {
      const behavior = row.after.ability.behaviors[0]
      const projection = recognizeCombatRequirementModules(behavior.requirements, behavior)
      expect(projection, row.id).not.toBeNull()
      expect(projection?.trigger, row.id).not.toBeNull()
      expect(compileCombatRequirementModules(projection!), row.id).toEqual(behavior.requirements)
      expect(projection!.conditions.length, row.id).toBeLessThanOrEqual(2)
      ids.add(projection!.trigger!.id)
    }
    expect(ids.size).toBe(14)
    expect(COMBAT_TRIGGER_MODULES).toHaveLength(14)
  })

  it('keeps ongoing and nested condition grouping executable without a fake event', () => {
    for (const row of resonances.filter(
      (value) => value.after.ability.behaviors[0].activation === 'ongoing',
    )) {
      const behavior = row.after.ability.behaviors[0]
      const projection = recognizeCombatRequirementModules(behavior.requirements, behavior)
      expect(projection?.trigger).toBeNull()
      expect(compileCombatRequirementModules(projection!)).toEqual(behavior.requirements)
    }
    const node: RequirementNode = {
      kind: 'all',
      children: [
        {
          kind: 'all',
          children: [
            {
              kind: 'resource-state',
              subject: 'owner',
              resource: 'mp',
              comparison: 'at-least',
              amount: 12,
            },
          ],
        },
        {
          kind: 'any',
          children: [
            { kind: 'status-presence', subject: 'owner', statusId: 'burn', present: true },
            { kind: 'status-presence', subject: 'owner', statusId: 'poison', present: true },
          ],
        },
      ],
    }
    expect(compileCombatRequirementModules(recognizeCombatRequirementModules(node)!)).toEqual(node)
  })

  it('compiles Damage Dealt and Damage Taken with distinct causal ownership', () => {
    const dealt = compileCombatTriggerModule(
      createCombatTriggerModuleSelection('trigger.attack-hit'),
    )
    const taken = compileCombatTriggerModule(
      createCombatTriggerModuleSelection('trigger.damage-received'),
    )
    const owner = { combatantId: 'self', teamId: 'friendly' }
    const enemy = { combatantId: 'enemy', teamId: 'hostile' }
    const event = {
      type: 'damage_applied',
      phase: 'after' as const,
      action: { classification: 'attack' as const, tags: [] },
    }
    expect(
      evaluateAbilityRequirements(dealt, { owner, triggering: owner, affected: enemy, event }),
    ).toBe(true)
    expect(
      evaluateAbilityRequirements(dealt, { owner, triggering: enemy, affected: owner, event }),
    ).toBe(false)
    expect(
      evaluateAbilityRequirements(taken, { owner, triggering: enemy, affected: owner, event }),
    ).toBe(true)
    expect(
      evaluateAbilityRequirements(taken, { owner, triggering: owner, affected: enemy, event }),
    ).toBe(false)
  })

  it('keeps MP gained as a witnessed resource predicate and rejects zero or wrong-direction changes', () => {
    const node = compileCombatTriggerModule(
      createCombatTriggerModuleSelection('trigger.mp-restored'),
    )
    const owner = {
      combatantId: 'self',
      teamId: 'friendly',
      resources: { mp: 20 },
      previousResources: { mp: 15 },
    }
    const context = {
      owner,
      triggering: owner,
      affected: owner,
      resourceMutations: { affected: ['mp' as const] },
      event: {
        type: 'resource_changed',
        phase: 'after' as const,
        action: { classification: 'recovery' as const, tags: [] },
      },
    }
    expect(evaluateAbilityRequirements(node, context)).toBe(true)
    expect(
      evaluateAbilityRequirements(node, {
        ...context,
        affected: { ...owner, previousResources: { mp: 20 } },
      }),
    ).toBe(false)
    expect(
      evaluateAbilityRequirements(node, {
        ...context,
        affected: { ...owner, previousResources: { mp: 25 } },
      }),
    ).toBe(false)
    expect(evaluateAbilityRequirements(node, { ...context, resourceMutations: {} })).toBe(false)
  })

  it('replaces a selected trigger while preserving its actual condition blocks', () => {
    const row = resonances.find(
      (value) => value.id === 'resonance.cinderweaver-ravager.linked-sequence',
    )!
    const behavior = row.after.ability.behaviors[0]
    const original = recognizeCombatRequirementModules(behavior.requirements, behavior)!
    const trigger = createCombatTriggerModuleSelection('trigger.damage-received')
    const next = compileCombatRequirementModules({ ...original, trigger })
    const recognized = recognizeCombatRequirementModules(next)
    expect(recognized!.trigger!.id).toBe('trigger.damage-received')
    expect(recognized!.conditions).toEqual(original.conditions)
    expect(setCombatRequirementTriggerModule(behavior.requirements, trigger, behavior)).toEqual(
      next,
    )
  })

  it('preserves unsupported raw AST by returning no partial projection', () => {
    const event: RequirementNode = { kind: 'event', eventType: 'unknown_event', phase: 'after' }
    const unknown: RequirementNode[] = [
      event,
      {
        kind: 'all',
        children: [{ kind: 'event', eventType: 'damage_applied', phase: 'after' }, event],
      },
      {
        kind: 'any',
        children: [
          { kind: 'event', eventType: 'damage_applied', phase: 'after' },
          { kind: 'status-presence', subject: 'owner', statusId: 'burn', present: true },
        ],
      },
      { kind: 'status-presence', subject: 'owner', statusId: 'custom.legacy', present: true },
      {
        kind: 'all',
        children: [
          { kind: 'event', eventType: 'damage_applied', phase: 'after' },
          { kind: 'action', classification: 'attack', requiredTags: ['custom-legacy'] },
        ],
      },
    ]
    for (const node of unknown) {
      const saved = structuredClone(node)
      expect(recognizeCombatRequirementModules(node)).toBeNull()
      expect(node).toEqual(saved)
    }
    expect(() =>
      setCombatRequirementTriggerModule(
        event,
        createCombatTriggerModuleSelection('trigger.attack-hit'),
      ),
    ).toThrow()
  })

  it('refuses a mislabeled causal selection and preserves reordered primitive keys', () => {
    const incoming = createCombatTriggerModuleSelection('trigger.damage-received')
    const outgoing = createCombatTriggerModuleSelection('trigger.attack-hit')
    expect(() =>
      compileCombatTriggerModule({ ...incoming, parameters: outgoing.parameters }),
    ).toThrow()
    const node: RequirementNode = {
      kind: 'all',
      children: [
        { phase: 'after', eventType: 'damage_applied', kind: 'event' },
        { classification: 'attack', kind: 'action' },
        {
          relation: 'same-unit',
          otherSubject: 'owner',
          subject: 'triggering',
          kind: 'subject-relation',
        },
      ],
    }
    const projection = recognizeCombatRequirementModules(node)
    expect(projection).not.toBeNull()
    expect(compileCombatRequirementModules(projection!)).toEqual(node)
  })

  it('offers finite real Discipline, status and action-tag choices and refuses unknown compilation values', () => {
    expect(COMBAT_REQUIREMENT_DISCIPLINE_OPTIONS).toHaveLength(17)
    expect(
      COMBAT_REQUIREMENT_STATUS_OPTIONS.some(
        (row) => row.id === 'guarded' && row.label === 'Guard',
      ),
    ).toBe(true)
    const tags = new Set([
      'attack',
      'physical',
      'mystic',
      ...[...baseline.values()].flatMap((row) => row.after.tags ?? []),
    ])
    expect(COMBAT_REQUIREMENT_ACTION_TAG_OPTIONS.every((row) => tags.has(row.id))).toBe(true)
    const selection = createCombatTriggerModuleSelection('trigger.attack-hit')
    expect(() =>
      compileCombatTriggerModule({
        ...selection,
        parameters: {
          ...selection.parameters,
          actionQualifiers: [{ kind: 'action', sourceDisciplineId: 'unregistered' }],
        },
      }),
    ).toThrow()
    expect(
      COMBAT_REQUIREMENT_STATUS_SETS.find((row) => row.id === 'removable-debuffs')?.statusIds,
    ).toEqual([
      'burn',
      'bleed',
      'poison',
      'slow',
      'root',
      'exposed',
      'mark',
      'challenged',
      'suppress',
    ])
  })
})

it('offers registered filters for every released intrinsic gameplay tag', () => {
  const organizational = new Set([
    'discipline',
    ...COMBAT_REQUIREMENT_DISCIPLINE_OPTIONS.map((option) => option.id),
  ])
  const registered = new Set(COMBAT_REQUIREMENT_ACTION_TAG_OPTIONS.map((option) => option.id))
  const released = manifest('2026-10-18-modular-correction-cohort')
  for (const row of released) {
    if (row.kind !== 'skill') continue
    for (const tag of row.after.tags ?? []) {
      if (organizational.has(tag) || tag.startsWith('cockpit:')) continue
      expect(registered.has(tag), `Missing intrinsic filter: ${tag}`).toBe(true)
    }
  }
})
