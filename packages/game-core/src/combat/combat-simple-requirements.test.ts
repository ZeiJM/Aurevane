import { describe, expect, it } from 'vitest'
import {
  createSimpleRequirement,
  readSimpleRequirement,
  isSimpleRequirement,
  SIMPLE_REQUIREMENT_TAG_OPTIONS,
  SIMPLE_AUTOMATIC_TRIGGER_OPTIONS,
  automaticAbilityExecutionRequirements,
  simpleEffectRequirementSubjects,
  simpleRequirementSubjects,
  simpleAutomaticTargetSubjects,
} from './combat-simple-requirements'
import { evaluateAbilityRequirements } from './combat-requirements'
import { source } from './combat-behavior.test-utils'

describe('finite simple Requirements', () => {
  it('excludes retired authoring statuses while preserving historical status evaluation', () => {
    const unavailable = [
      'displaced',
      'regeneration',
      'hastened',
      'delayed',
      'borrowed-hour',
      'summoned',
      'marked',
    ]
    const ids = SIMPLE_REQUIREMENT_TAG_OPTIONS.map(({ id }) => id)
    for (const statusId of unavailable) {
      expect(ids, statusId).not.toContain(statusId)
      expect(() => createSimpleRequirement(statusId, 'owner')).toThrow()
      const historical = {
        kind: 'status-presence',
        subject: 'owner',
        statusId,
        present: true,
      } as const
      expect(readSimpleRequirement(historical)).toBeNull()
      expect(evaluateAbilityRequirements(historical, { owner: { statusIds: [statusId] } })).toBe(
        true,
      )
    }
    expect(ids).toContain('mark')
    expect(ids).toContain('revealed')
  })
  it('offers effect Self/Target roles only where native recipient and geometry support them', () => {
    const single = source().definition.behaviors[0]!
    const circle = {
      ...single,
      targeting: { ...single.targeting!, shape: { kind: 'circle' as const, radius: 1 } },
    }
    const ground = {
      ...single,
      targeting: {
        ...single.targeting!,
        geometryVersion: 3 as const,
        categories: ['ground' as const],
      },
    }
    expect(simpleEffectRequirementSubjects(single, { recipient: 'actor' })).toEqual([
      'owner',
      'selected',
    ])
    expect(simpleEffectRequirementSubjects(single, { recipient: 'primary-unit' })).toEqual([
      'owner',
      'selected',
    ])
    expect(simpleEffectRequirementSubjects(single, { recipient: 'affected-units' })).toEqual([
      'owner',
      'affected',
    ])
    expect(simpleEffectRequirementSubjects(circle, { recipient: 'actor' })).toEqual(['owner'])
    expect(simpleEffectRequirementSubjects(circle, { recipient: 'primary-unit' })).toEqual([
      'owner',
    ])
    expect(simpleEffectRequirementSubjects(circle, { recipient: 'affected-units' })).toEqual([
      'owner',
      'affected',
    ])
    expect(simpleEffectRequirementSubjects(ground, { recipient: 'actor' })).toEqual(['owner'])
    expect(simpleEffectRequirementSubjects(single, { recipient: 'selected-tile' })).toEqual([
      'owner',
    ])
    expect(simpleEffectRequirementSubjects(single, { recipient: 'affected-tiles' })).toEqual([])
    expect(
      simpleEffectRequirementSubjects({ ...single, activation: 'ongoing' }, { recipient: 'actor' }),
    ).toEqual(['owner'])
  })
  it('manual action Target requires an actual Single unit selection while modifiers retain their native root Target', () => {
    const single = source().definition.behaviors[0]!
    expect(simpleRequirementSubjects(single)).toEqual(['owner', 'selected'])
    for (const shape of [{ kind: 'circle', radius: 1 }, { kind: 'all' }] as const)
      expect(
        simpleRequirementSubjects({ ...single, targeting: { ...single.targeting!, shape } }),
      ).toEqual(['owner'])
    expect(
      simpleRequirementSubjects({
        ...single,
        targeting: { ...single.targeting!, geometryVersion: 3, categories: ['ground'] },
      }),
    ).toEqual(['owner'])
    expect(simpleRequirementSubjects({ ...single, mode: 'modifier', targeting: null })).toEqual([
      'owner',
      'selected',
    ])
  })
  it('automatic binding choices follow actual frame roles and native target categories', () => {
    const base = source({ activation: 'automatic', requirementMode: 'simple' }).definition
      .behaviors[0]!
    const self = {
      ...base,
      targeting: {
        ...base.targeting!,
        geometryVersion: 3 as const,
        teamPolicy: 'self' as const,
        categories: ['self' as const],
        minimumRange: 0,
        maximumRange: 0,
      },
    }
    expect(simpleAutomaticTargetSubjects(self)).toEqual(['owner'])
    expect(simpleAutomaticTargetSubjects(base)).toEqual([])
    expect(simpleAutomaticTargetSubjects({ ...self, automaticTrigger: 'turn-started' })).toEqual([
      'owner',
      'triggering',
      'affected',
    ])
    expect(simpleAutomaticTargetSubjects({ ...self, automaticTrigger: 'after-action' })).toContain(
      'triggering',
    )
    expect(simpleAutomaticTargetSubjects({ ...base, automaticTrigger: 'damage-dealt' })).toEqual([
      'selected',
      'affected',
    ])
    expect(simpleAutomaticTargetSubjects({ ...base, automaticTrigger: 'damage-taken' })).toEqual([
      'triggering',
      'selected',
    ])
    expect(
      simpleAutomaticTargetSubjects({ ...base, automaticTrigger: 'enemy-turn-ended' }),
    ).toEqual(['triggering', 'affected'])
    expect(
      simpleAutomaticTargetSubjects({ ...self, targeting: { ...self.targeting, kind: 'self' } }),
    ).toEqual(['owner'])
    expect(
      simpleAutomaticTargetSubjects({
        ...self,
        targeting: { ...self.targeting, shape: { kind: 'circle', radius: 1 } },
      }),
    ).toEqual([])
    expect(
      simpleAutomaticTargetSubjects({
        ...self,
        targeting: { ...self.targeting, kind: 'self', shape: { kind: 'circle', radius: 1 } },
      }),
    ).toEqual([])
    expect(
      simpleAutomaticTargetSubjects({
        ...self,
        targeting: { ...self.targeting, kind: 'empty-tile' },
      }),
    ).toEqual([])
  })
  it('roundtrips all registered tags for each subject and strict percentage precision', () => {
    for (const { id } of SIMPLE_REQUIREMENT_TAG_OPTIONS) {
      for (const subject of ['owner', 'selected', 'affected', 'triggering'] as const) {
        const node = createSimpleRequirement(id, subject, 33.33)
        expect(isSimpleRequirement(node)).toBe(true)
        expect(readSimpleRequirement(node)).toEqual(
          id === 'none'
            ? { tagId: 'none', subject: 'owner' }
            : {
                tagId: id,
                subject,
                ...(id.startsWith('hp-') || id.startsWith('mp-') ? { percent: 33.33 } : {}),
              },
        )
      }
    }
    for (const percent of [0, 0.01, 99.99, 100])
      expect(
        readSimpleRequirement(createSimpleRequirement('hp-less-than', 'owner', percent))?.percent,
      ).toBe(percent)
    for (const percent of [-1, 100.01, NaN, Infinity, 0.001])
      expect(() => createSimpleRequirement('mp-more-than', 'owner', percent)).toThrow()
    expect(() => createSimpleRequirement('invented', 'owner')).toThrow()
  })
  it('uses actual frame source/affected bindings for every execution preset', () => {
    const owner = { combatantId: 'owner', teamId: 'allies' },
      ally = { combatantId: 'ally', teamId: 'allies' },
      enemy = { combatantId: 'enemy', teamId: 'enemies' }
    const cases = [
      ['after-action', 'combat_action_used', owner, enemy],
      ['damage-dealt', 'damage_applied', owner, enemy],
      ['damage-taken', 'damage_applied', enemy, owner],
      ['ally-damage-taken', 'damage_applied', enemy, ally],
      ['enemy-turn-ended', 'turn_ended', enemy, enemy],
      ['healed', 'healing_applied', owner, ally],
      ['resource-changed', 'resource_changed', owner, enemy],
      ['turn-started', 'turn_started', owner, owner],
      ['barrier-hit', 'barrier_absorbed', enemy, owner],
      ['displaced', 'combatant_displaced', owner, enemy],
      ['rewound', 'combatant_rewound', owner, owner],
    ] as const
    expect(cases).toHaveLength(
      SIMPLE_AUTOMATIC_TRIGGER_OPTIONS.filter(({ id }) => id !== 'requirements-met').length,
    )
    for (const [automaticTrigger, type, triggering, affected] of cases) {
      const behavior = source({
        activation: 'automatic',
        requirementMode: 'simple',
        automaticTrigger,
      }).definition.behaviors[0]!
      const node = automaticAbilityExecutionRequirements(behavior)
      expect(behavior.requirements).toBeNull()
      const context = { owner, triggering, affected, event: { type, phase: 'after' as const } }
      expect(evaluateAbilityRequirements(node, context), automaticTrigger).toBe(true)
      expect(
        evaluateAbilityRequirements(node, { ...context, owner: undefined }),
        automaticTrigger,
      ).toBe(false)
      expect(
        evaluateAbilityRequirements(node, { ...context, event: { type, phase: 'before' } }),
        automaticTrigger,
      ).toBe(false)
      const gated = automaticAbilityExecutionRequirements({
        ...behavior,
        requirements: createSimpleRequirement('burn', 'owner'),
      })
      expect(evaluateAbilityRequirements(gated, context), automaticTrigger).toBe(false)
      expect(
        evaluateAbilityRequirements(gated, {
          ...context,
          owner: { ...owner, statusIds: ['burn'] },
        }),
        automaticTrigger,
      ).toBe(true)
      if (
        [
          'after-action',
          'damage-dealt',
          'healed',
          'resource-changed',
          'turn-started',
          'displaced',
          'rewound',
        ].includes(automaticTrigger)
      )
        expect(
          evaluateAbilityRequirements(node, { ...context, triggering: enemy }),
          automaticTrigger,
        ).toBe(false)
      if (automaticTrigger === 'damage-dealt') {
        for (const recipient of [owner, ally, { combatantId: 'unaffiliated' }])
          expect(evaluateAbilityRequirements(node, { ...context, affected: recipient })).toBe(false)
      }
      if (
        automaticTrigger === 'damage-taken' ||
        automaticTrigger === 'ally-damage-taken' ||
        automaticTrigger === 'enemy-turn-ended'
      ) {
        for (const source of [owner, ally, { combatantId: 'unaffiliated' }])
          expect(evaluateAbilityRequirements(node, { ...context, triggering: source })).toBe(false)
      }
      if (automaticTrigger === 'damage-taken' || automaticTrigger === 'barrier-hit')
        expect(evaluateAbilityRequirements(node, { ...context, affected: ally })).toBe(false)
      if (automaticTrigger === 'ally-damage-taken') {
        for (const recipient of [owner, enemy, { combatantId: 'unaffiliated' }])
          expect(evaluateAbilityRequirements(node, { ...context, affected: recipient })).toBe(false)
      }
      expect(
        evaluateAbilityRequirements(node, {
          ...context,
          event: { type: 'unrelated', phase: 'after' },
        }),
      ).toBe(false)
      expect(
        evaluateAbilityRequirements(node, {
          ...context,
          triggering: undefined,
          affected: undefined,
        }),
      ).toBe(false)
    }
    const heal = automaticAbilityExecutionRequirements(
      source({ requirementMode: 'simple', automaticTrigger: 'healed' }).definition.behaviors[0]!,
    )
    expect(
      evaluateAbilityRequirements(heal, {
        owner,
        triggering: owner,
        affected: owner,
        event: { type: 'healing_applied', phase: 'after' },
      }),
    ).toBe(true)
    expect(
      evaluateAbilityRequirements(heal, {
        owner,
        triggering: owner,
        affected: enemy,
        event: { type: 'healing_applied', phase: 'after' },
      }),
    ).toBe(false)
  })
})
