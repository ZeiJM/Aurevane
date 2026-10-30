import { describe, expect, it } from 'vitest'
import { parseAbilityDefinition, validateAbilityDefinition } from './combat-definition'
import {
  P33_REPRESENTATIVE_DISCIPLINE_SKILLS,
  toCombatActionDefinition,
  validateMatureSkillDefinition,
} from './mature-skills'
import { P36_REPRESENTATIVE_ESSENCES, validateEssenceDefinition } from './essence'
import { P35_REPRESENTATIVE_RESONANCES, validateResonanceDefinition } from './resonance'
import {
  convertV5ResonanceToV2,
  normalizedResonanceMechanics,
  validateResonanceDefinitionV2,
} from './resonance-v2'

function ability() {
  return {
    schemaVersion: 1,
    behaviors: [
      {
        id: 'strike',
        activation: 'manual',
        mode: 'action',
        classification: 'attack',
        attackFamily: 'physical',
        costs: [
          { resource: 'ap', amount: 11 },
          { resource: 'mp', amount: 2 },
          { resource: 'hp', amount: 1 },
        ],
        cooldown: null,
        requirements: null,
        targeting: {
          kind: 'unit',
          teamPolicy: 'enemy',
          shape: { kind: 'single' },
          minimumRange: 1,
          maximumRange: 3,
          requiresLineOfSight: true,
          maximumElevationDifference: 1,
          friendlyFire: 'enemies-only',
          maximumSelections: 1,
        },
        effects: [
          { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
        ],
      },
    ],
  }
}

describe('canonical Ability definition', () => {
  it('admits a single simple requirement without synthesizing an Automatic modifier anchor', () => {
    const value = ability()
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [
          {
            ...value.behaviors[0],
            activation: 'automatic',
            mode: 'modifier',
            targeting: null,
            requirementMode: 'simple',
            requirements: {
              kind: 'status-presence',
              subject: 'selected',
              statusId: 'frozen',
              present: true,
            },
          },
        ],
      }),
    ).toEqual([])
  })
  it('simple Automatic action binds a finite execution trigger separately from its requirement', () => {
    const value = ability()
    const behavior = {
      ...value.behaviors[0],
      activation: 'automatic',
      requirementMode: 'simple',
      automaticTrigger: 'damage-dealt',
      automaticTarget: { subject: 'affected' },
      requirements: {
        kind: 'status-presence',
        subject: 'affected',
        statusId: 'frozen',
        present: true,
      },
    }
    expect(validateAbilityDefinition({ ...value, behaviors: [behavior] })).toEqual([])
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [{ ...behavior, automaticTrigger: undefined }],
      }),
    ).toContainEqual(expect.objectContaining({ code: 'automatic-state-anchor-required' }))
  })
  it('rejects a Simple behavior target outside its genuine execution role', () => {
    const value = ability()
    const requirements = {
      kind: 'status-presence',
      subject: 'affected',
      statusId: 'frozen',
      present: true,
    }
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [{ ...value.behaviors[0], requirementMode: 'simple', requirements }],
      }),
    ).toContainEqual(expect.objectContaining({ code: 'invalid-requirement' }))
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [
          {
            ...value.behaviors[0],
            activation: 'automatic',
            requirementMode: 'simple',
            automaticTrigger: 'after-action',
            automaticTarget: { subject: 'selected' },
            requirements,
          },
        ],
      }),
    ).toContainEqual(expect.objectContaining({ code: 'invalid-requirement' }))
  })

  it.each([
    { automaticTrigger: undefined, subject: 'selected', self: true },
    { automaticTrigger: undefined, subject: 'owner', self: false },
    { automaticTrigger: 'turn-started', subject: 'selected', self: true },
    { automaticTrigger: 'after-action', subject: 'triggering', self: false },
  ])(
    'Simple automatic bindings reject unavailable $automaticTrigger/$subject with Self=$self',
    ({ automaticTrigger, subject, self }) => {
      const value = ability()
      const base = value.behaviors[0]!
      const behavior = {
        ...base,
        activation: 'automatic',
        requirementMode: 'simple',
        automaticTrigger,
        automaticTarget: { subject },
        targeting: {
          ...base.targeting,
          geometryVersion: 3,
          categories: self ? ['self'] : ['enemy'],
          teamPolicy: self ? 'self' : 'enemy',
          minimumRange: self ? 0 : 1,
          maximumRange: self ? 0 : 3,
        },
      }
      expect(validateAbilityDefinition({ ...value, behaviors: [behavior] })).toContainEqual(
        expect.objectContaining({
          code: 'invalid-automatic-target',
          path: 'behaviors[0].automaticTarget',
        }),
      )
    },
  )
  it('Simple after-action triggering owner remains a valid Self unit binding', () => {
    const value = ability()
    const base = value.behaviors[0]!
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [
          {
            ...base,
            activation: 'automatic',
            requirementMode: 'simple',
            automaticTrigger: 'after-action',
            automaticTarget: { subject: 'triggering' },
            targeting: {
              ...base.targeting,
              geometryVersion: 3,
              categories: ['self'],
              teamPolicy: 'self',
              minimumRange: 0,
              maximumRange: 0,
            },
          },
        ],
      }),
    ).toEqual([])
  })

  it.each([{ kind: 'circle', radius: 1 }, { kind: 'all' }] as const)(
    'Simple manual $kind actions cannot require a nonexistent selected unit',
    (shape) => {
      const value = ability()
      const behavior = {
        ...value.behaviors[0]!,
        targeting: {
          ...value.behaviors[0]!.targeting,
          shape,
          minimumRange: 0,
          maximumRange: shape.kind === 'circle' ? 1 : 0,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
        },
        effects: [
          { id: 'area', payload: { type: 'damage', recipient: 'affected-units', amount: 1 } },
        ],
        requirements: {
          kind: 'status-presence',
          subject: 'selected',
          statusId: 'wet',
          present: true,
        },
      }
      expect(validateAbilityDefinition({ ...value, behaviors: [behavior] })).toEqual([])
      expect(
        validateAbilityDefinition({
          ...value,
          behaviors: [{ ...behavior, requirementMode: 'simple' }],
        }),
      ).toContainEqual(
        expect.objectContaining({
          code: 'invalid-requirement',
          path: 'behaviors[0].requirements.subject',
        }),
      )
      expect(
        validateAbilityDefinition({
          ...value,
          behaviors: [
            {
              ...behavior,
              requirementMode: 'simple',
              requirements: { ...behavior.requirements, subject: 'owner' },
            },
          ],
        }),
      ).toEqual([])
    },
  )
  it('Simple manual Single actions retain their genuine selected unit predicate', () => {
    const value = ability()
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [
          {
            ...value.behaviors[0],
            requirementMode: 'simple',
            requirements: {
              kind: 'status-presence',
              subject: 'selected',
              statusId: 'wet',
              present: true,
            },
          },
        ],
      }),
    ).toEqual([])
  })

  it.each([
    { recipient: 'actor', subject: 'selected', shape: { kind: 'circle', radius: 1 } },
    { recipient: 'affected-units', subject: 'selected', shape: { kind: 'single' } },
    { recipient: 'primary-unit', subject: 'affected', shape: { kind: 'single' } },
    { recipient: 'primary-unit', subject: 'triggering', shape: { kind: 'single' } },
  ])(
    'Simple effect conditions reject unsupported $recipient/$subject on $shape.kind',
    ({ recipient, subject, shape }) => {
      const value = ability()
      const behavior = value.behaviors[0]!
      const effect = {
        id: 'conditioned',
        payload: { type: 'damage', recipient, amount: 1 },
        requirements: { kind: 'status-presence', subject, statusId: 'wet', present: true },
      }
      expect(
        validateAbilityDefinition({
          ...value,
          behaviors: [
            {
              ...behavior,
              requirementMode: 'simple',
              targeting: {
                ...behavior.targeting,
                shape,
                minimumRange: shape.kind === 'single' ? 1 : 0,
                maximumRange: shape.kind === 'single' ? 3 : 1,
              },
              effects: [effect],
            },
          ],
        }),
      ).toContainEqual(
        expect.objectContaining({
          code: 'invalid-requirement',
          path: 'behaviors[0].effects[0].requirements.subject',
        }),
      )
      expect(
        validateAbilityDefinition({
          ...value,
          behaviors: [
            {
              ...behavior,
              targeting: {
                ...behavior.targeting,
                shape,
                minimumRange: shape.kind === 'single' ? 1 : 0,
                maximumRange: shape.kind === 'single' ? 3 : 1,
              },
              effects: [effect],
            },
          ],
        }).filter((issue) => issue.code === 'invalid-requirement'),
      ).toEqual([])
    },
  )
  it('Simple affected-tile packets require None because native routing has no effect gate', () => {
    const value = ability()
    const behavior = {
      ...value.behaviors[0],
      requirementMode: 'simple',
      targeting: { ...value.behaviors[0]!.targeting, kind: 'ground-tile', teamPolicy: 'any' },
    }
    const effect = {
      id: 'frozen',
      payload: { type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' },
      requirements: { kind: 'status-presence', subject: 'owner', statusId: 'burn', present: true },
    }
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [{ ...behavior, effects: [{ ...effect, requirements: null }] }],
      }),
    ).toEqual([])
    expect(
      validateAbilityDefinition({ ...value, behaviors: [{ ...behavior, effects: [effect] }] }),
    ).toContainEqual(
      expect.objectContaining({
        code: 'invalid-requirement',
        path: 'behaviors[0].effects[0].requirements.subject',
      }),
    )
  })

  it('Simple Self and unit Single effects retain selected conditions independently of actor recipient', () => {
    const value = ability()
    const behavior = value.behaviors[0]!
    const effects = [
      {
        id: 'conditioned',
        payload: { type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 },
        requirements: {
          kind: 'status-presence',
          subject: 'selected',
          statusId: 'wet',
          present: true,
        },
      },
    ]
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [{ ...behavior, requirementMode: 'simple', effects }],
      }),
    ).toEqual([])
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [
          {
            ...behavior,
            requirementMode: 'simple',
            targeting: {
              ...behavior.targeting,
              kind: 'self',
              teamPolicy: 'self',
              minimumRange: 0,
              maximumRange: 0,
            },
            effects,
          },
        ],
      }),
    ).toEqual([])
  })

  it.each([
    {
      kind: 'all',
      children: [{ kind: 'status-presence', subject: 'owner', statusId: 'frozen', present: true }],
    },
    { kind: 'status-presence', subject: 'owner', statusId: 'invented', present: true },
    { kind: 'status-presence', subject: 'owner', statusId: 'frozen', present: false },
    { kind: 'prime-presence', subject: 'owner', abilityId: 'strike', present: true },
    { kind: 'action', sourceDisciplineId: 'vanguard' },
    {
      kind: 'resource-state',
      subject: 'owner',
      resource: 'ap',
      comparison: 'less-than',
      basisPoints: 5000,
    },
    {
      kind: 'resource-state',
      subject: 'owner',
      resource: 'hp',
      comparison: 'at-most',
      basisPoints: 5000,
    },
    {
      kind: 'resource-state',
      subject: 'owner',
      resource: 'mp',
      comparison: 'less-than',
      amount: 5,
    },
  ])('rejects unsupported simple requirement $kind', (requirements) => {
    const value = ability()
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [{ ...value.behaviors[0], requirementMode: 'simple', requirements }],
      }),
    ).toContainEqual(expect.objectContaining({ code: 'invalid-requirement' }))
  })

  it.each([
    { categories: ['ground'], friendlyFire: 'enemies-only', allowed: true },
    { categories: ['ground'], friendlyFire: 'allies-only', allowed: false },
    { categories: ['ally'], friendlyFire: 'enemies-only', allowed: false },
    { categories: ['enemy'], friendlyFire: 'allies-only', allowed: true },
  ])(
    'uses category and Ground recipient authority for accuracy: $categories/$friendlyFire',
    ({ categories, friendlyFire, allowed }) => {
      const value = ability()
      const behavior = value.behaviors[0]!
      const issues = validateAbilityDefinition({
        ...value,
        behaviors: [
          {
            ...behavior,
            accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
            targeting: { ...behavior.targeting, geometryVersion: 3, categories, friendlyFire },
          },
        ],
      })
      if (allowed) expect(issues).toEqual([])
      else expect(issues).toContainEqual(expect.objectContaining({ code: 'accuracy-inapplicable' }))
    },
  )
  it('admits hostile accuracy from current categories despite a historical Self envelope', () => {
    const value = ability()
    const behavior = value.behaviors[0]!
    const mixed = {
      ...value,
      behaviors: [
        {
          ...behavior,
          accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
          targeting: {
            ...behavior.targeting,
            geometryVersion: 3,
            categories: ['self', 'enemy'],
            kind: 'self',
            teamPolicy: 'self',
            minimumRange: 0,
          },
        },
      ],
    }
    expect(validateAbilityDefinition(mixed)).toEqual([])
    expect(parseAbilityDefinition(mixed).behaviors[0]!.accuracy).toEqual({
      kind: 'fixed',
      chanceBasisPoints: 10000,
    })
    expect(
      validateAbilityDefinition({
        ...mixed,
        behaviors: [
          {
            ...mixed.behaviors[0],
            targeting: { ...mixed.behaviors[0]!.targeting, categories: ['self'] },
          },
        ],
      }),
    ).toContainEqual(expect.objectContaining({ code: 'accuracy-inapplicable' }))
  })
  it('requires explicit Automatic unit binding and admits exact supported subjects', () => {
    const value = ability()
    value.behaviors[0]!.activation = 'automatic'
    expect(validateAbilityDefinition(value)).toContainEqual(
      expect.objectContaining({ code: 'automatic-target-required' }),
    )
    for (const subject of ['owner', 'triggering', 'selected', 'affected']) {
      expect(
        validateAbilityDefinition({
          ...value,
          behaviors: [{ ...value.behaviors[0], automaticTarget: { subject } }],
        }),
      ).toEqual([])
    }
  })
  it('rejects unanchored nonowner Automatic state branches and unsupported phases', () => {
    const value = ability(),
      behavior = {
        ...value.behaviors[0]!,
        activation: 'automatic',
        automaticTarget: { subject: 'triggering' },
      }
    for (const requirements of [
      {
        kind: 'resource-state',
        subject: 'selected',
        resource: 'hp',
        comparison: 'at-most',
        amount: 5,
      },
      {
        kind: 'any',
        children: [
          { kind: 'event', eventType: 'damage_applied', phase: 'after' },
          { kind: 'status-presence', subject: 'affected', statusId: 'wet', present: true },
        ],
      },
    ])
      expect(
        validateAbilityDefinition({ ...value, behaviors: [{ ...behavior, requirements }] }),
      ).toContainEqual(expect.objectContaining({ code: 'automatic-state-anchor-required' }))
    for (const requirements of [
      { kind: 'event', eventType: 'damage_applied', phase: 'before' },
      { kind: 'event', eventType: 'made_up', phase: 'after' },
    ])
      expect(
        validateAbilityDefinition({ ...value, behaviors: [{ ...behavior, requirements }] }),
      ).toContainEqual(expect.objectContaining({ code: 'automatic-event-unsupported' }))
  })
  it('Self defaults to owner and rejects foreign or inapplicable binding fields', () => {
    const value = ability(),
      base = value.behaviors[0]!
    const self = {
      ...base,
      activation: 'automatic',
      classification: 'utility',
      attackFamily: undefined,
      targeting: {
        ...base.targeting,
        kind: 'self',
        teamPolicy: 'self',
        minimumRange: 0,
        maximumRange: 0,
        friendlyFire: 'allies-only',
      },
      effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
    }
    expect(validateAbilityDefinition({ ...value, behaviors: [self] })).toEqual([])
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [{ ...self, automaticTarget: { subject: 'owner' } }],
      }),
    ).toEqual([])
    for (const subject of ['triggering', 'selected', 'affected', 'invented'])
      expect(
        validateAbilityDefinition({
          ...value,
          behaviors: [{ ...self, automaticTarget: { subject } }],
        }),
      ).toContainEqual(expect.objectContaining({ code: 'invalid-automatic-target' }))
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [{ ...base, automaticTarget: { subject: 'owner' } }],
      }),
    ).toContainEqual(expect.objectContaining({ code: 'invalid-automatic-target' }))
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [
          {
            ...self,
            activation: 'ongoing',
            mode: 'modifier',
            targeting: null,
            automaticTarget: { subject: 'owner' },
          },
        ],
      }),
    ).toContainEqual(expect.objectContaining({ code: 'invalid-automatic-target' }))
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: [{ ...self, automaticTarget: { subject: 'owner', nearest: true } }],
      }),
    ).toContainEqual(expect.objectContaining({ code: 'unknown-key' }))
  })

  it.each([
    null,
    { kind: 'resource-state', subject: 'owner', resource: 'hp', comparison: 'at-most', amount: 10 },
    {
      kind: 'any',
      children: [
        { kind: 'action', classification: 'attack' },
        { kind: 'status-presence', subject: 'owner', statusId: 'wet', present: true },
      ],
    },
    { kind: 'event', eventType: 'combat_action_used', phase: 'after' },
    {
      kind: 'all',
      children: [
        { kind: 'action', classification: 'attack' },
        {
          kind: 'resource-threshold-crossing',
          subject: 'owner',
          resource: 'hp',
          direction: 'below',
          thresholdBasisPoints: 5000,
        },
      ],
    },
  ])('Automatic modifier rejects an unanchored/incompatible tree %j', (requirements) => {
    const value = ability()
    Object.assign(value.behaviors[0]!, {
      activation: 'automatic',
      mode: 'modifier',
      targeting: null,
      requirements,
    })
    expect(validateAbilityDefinition(value)).toContainEqual(
      expect.objectContaining({ code: 'automatic-modifier-before-action-required' }),
    )
  })
  it('Automatic modifier accepts All(action, Any(stateA,stateB))', () => {
    const value = ability()
    Object.assign(value.behaviors[0]!, {
      activation: 'automatic',
      mode: 'modifier',
      targeting: null,
      requirements: {
        kind: 'all',
        children: [
          { kind: 'action', classification: 'attack' },
          {
            kind: 'any',
            children: [
              { kind: 'status-presence', subject: 'owner', statusId: 'wet', present: true },
              {
                kind: 'resource-state',
                subject: 'owner',
                resource: 'hp',
                comparison: 'at-most',
                amount: 10,
              },
            ],
          },
        ],
      },
    })
    expect(validateAbilityDefinition(value)).toEqual([])
  })
  it('activation_limit_contract accepts all four distinct scopes and historical absence', () => {
    const value = ability()
    const activationLimits = [
      'once-per-action',
      'once-per-owner-turn',
      'once-per-round',
      'once-per-battle',
    ]
    Object.assign(value.behaviors[0]!, { activationLimits })
    expect(parseAbilityDefinition(value).behaviors[0]).toHaveProperty(
      'activationLimits',
      activationLimits,
    )
    expect(parseAbilityDefinition(ability()).behaviors[0]).not.toHaveProperty('activationLimits')
  })
  it.each([
    null,
    'once-per-round',
    ['once-per-turn'],
    ['once-per-round', 'once-per-round'],
    Array(5).fill('once-per-action'),
  ])('activation_limit_contract rejects malformed limits %j', (activationLimits) => {
    const value = ability()
    Object.assign(value.behaviors[0]!, { activationLimits })
    expect(validateAbilityDefinition(value)).toContainEqual(
      expect.objectContaining({ code: 'invalid-activation-limit' }),
    )
  })
  it('packet_modifier_contract accepts inherited elemental packets and rejects unrelated status modifiers', () => {
    const value = ability()
    Object.assign(value.behaviors[0]!, { mode: 'modifier', targeting: null })
    Object.assign(value.behaviors[0]!.effects[0]!.payload, { element: 'water' })
    value.behaviors[0]!.effects.push({
      id: 'companion',
      payload: {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'wet',
        stacks: 1,
        durationTurns: 2,
        potencyBasisPoints: 2000,
      },
    } as never)
    expect(validateAbilityDefinition(value)).toEqual([])
    Object.assign(value.behaviors[0]!, { activation: 'automatic' })
    Object.assign(value.behaviors[0]!, {
      requirements: { kind: 'action', classification: 'attack' },
    })
    expect(validateAbilityDefinition(value)).toEqual([])
    Object.assign(value.behaviors[0]!.effects[1]!.payload, { statusId: 'suppress' })
    expect(validateAbilityDefinition(value)).toContainEqual(
      expect.objectContaining({ code: 'unsupported-combination' }),
    )
  })
  it('ongoing_limit_contract rejects activation scopes and continuous packets', () => {
    const value = ability()
    Object.assign(value.behaviors[0]!, {
      activation: 'ongoing',
      mode: 'modifier',
      targeting: null,
      costs: [],
      activationLimits: ['once-per-round'],
    })
    value.behaviors[0]!.effects = [
      {
        id: 'bonus',
        payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11000 },
      } as never,
    ]
    expect(validateAbilityDefinition(value)).toContainEqual(
      expect.objectContaining({ code: 'invalid-activation-limit' }),
    )
    Object.assign(value.behaviors[0]!, { activationLimits: [] })
    expect(validateAbilityDefinition(value)).toEqual([])
  })
  it('canonical_cost_units keeps simultaneous AP11/MP2/HP1 as three typed costs', () => {
    expect(parseAbilityDefinition(ability()).behaviors[0]?.costs).toEqual([
      { resource: 'ap', amount: 11 },
      { resource: 'mp', amount: 2 },
      { resource: 'hp', amount: 1 },
    ])
    const invalid = ability()
    invalid.behaviors[0]!.costs.push({ resource: 'ap', amount: 3 })
    expect(validateAbilityDefinition(invalid)).toContainEqual(
      expect.objectContaining({ code: 'duplicate-cost' }),
    )
  })

  it.each([0, 10000])('fixed_accuracy_endpoints accepts Fixed %i', (chanceBasisPoints) => {
    const value = ability()
    Object.assign(value.behaviors[0]!, { accuracy: { kind: 'fixed', chanceBasisPoints } })
    expect(parseAbilityDefinition(value).behaviors[0]?.accuracy).toEqual({
      kind: 'fixed',
      chanceBasisPoints,
    })
  })
  it.each([-1, 10001, 0.5])('fixed_accuracy_endpoints rejects Fixed %i', (chanceBasisPoints) => {
    const value = ability()
    Object.assign(value.behaviors[0]!, { accuracy: { kind: 'fixed', chanceBasisPoints } })
    expect(validateAbilityDefinition(value)).toContainEqual(
      expect.objectContaining({ code: 'invalid-accuracy' }),
    )
  })

  it('rejects unknown mechanical keys, duplicate behavior/effect IDs and unbounded groups', () => {
    expect(validateAbilityDefinition({ ...ability(), script: 'dealDamage()' })).toContainEqual(
      expect.objectContaining({ code: 'unknown-key', path: 'script' }),
    )
    const duplicate = ability()
    duplicate.behaviors.push(duplicate.behaviors[0]!)
    expect(validateAbilityDefinition(duplicate)).toContainEqual(
      expect.objectContaining({ code: 'duplicate-id' }),
    )
    const effects = ability()
    effects.behaviors[0]!.effects.push(effects.behaviors[0]!.effects[0]!)
    expect(validateAbilityDefinition(effects)).toContainEqual(
      expect.objectContaining({ code: 'duplicate-id' }),
    )
    const groups = ability()
    groups.behaviors = Array.from({ length: 17 }, (_, index) => ({
      ...groups.behaviors[0]!,
      id: `group-${index}`,
    }))
    expect(validateAbilityDefinition(groups)).toContainEqual(
      expect.objectContaining({ code: 'array-budget' }),
    )
    const bounded = ability()
    bounded.behaviors[0]!.effects = Array.from({ length: 32 }, (_, index) => ({
      ...bounded.behaviors[0]!.effects[0]!,
      id: `effect-${index}`,
    }))
    expect(validateAbilityDefinition(bounded)).toEqual([])
    bounded.behaviors[0]!.effects.push({ ...bounded.behaviors[0]!.effects[0]!, id: 'overflow' })
    expect(validateAbilityDefinition(bounded)).toContainEqual(
      expect.objectContaining({ code: 'array-budget' }),
    )
  })

  it('rejects duplicate recipient authority and accuracy without an applicable hostile hit check', () => {
    const value = ability()
    Object.assign(value.behaviors[0]!.effects[0]!, { recipient: 'actor' })
    expect(validateAbilityDefinition(value)).toContainEqual(
      expect.objectContaining({ code: 'unknown-key' }),
    )
    const self = ability()
    Object.assign(self.behaviors[0]!, {
      accuracy: { kind: 'fixed', chanceBasisPoints: 5000 },
      targeting: {
        ...self.behaviors[0]!.targeting,
        kind: 'self',
        teamPolicy: 'self',
        minimumRange: 0,
        maximumRange: 0,
        friendlyFire: 'allies-only',
      },
    })
    self.behaviors[0]!.effects[0]!.payload.recipient = 'actor'
    expect(validateAbilityDefinition(self)).toContainEqual(
      expect.objectContaining({ code: 'accuracy-inapplicable' }),
    )
  })

  it('canonical_legacy_conflict fails closed for present malformed envelopes and never executes flat fields', () => {
    const skill = P33_REPRESENTATIVE_DISCIPLINE_SKILLS.find((candidate) => candidate.enabled)!
    expect(
      validateMatureSkillDefinition({ ...skill, ability: { schemaVersion: 99 } } as never),
    ).toContain('ability')
    expect(() => toCombatActionDefinition({ ...skill, ability: null } as never, 'pve')).toThrow(
      /ability/i,
    )
    expect(() =>
      toCombatActionDefinition({ ...skill, ability: parseAbilityDefinition(ability()) }, 'pve'),
    ).toThrow(/canonical-activation-required/)
    expect(validateMatureSkillDefinition(skill)).toEqual([])
    const essence = P36_REPRESENTATIVE_ESSENCES.find((candidate) => candidate.enabled)!
    expect(validateEssenceDefinition({ ...essence, ability: null } as never)).toContain('ability')
    const resonance = P35_REPRESENTATIVE_RESONANCES.find((candidate) => candidate.enabled)!
    expect(validateResonanceDefinition({ ...resonance, ability: null } as never)).toContain(
      'ability',
    )
  })

  it('elemental_companion_validation requires one unconditional same-recipient policy2 companion', () => {
    for (const [element, statusId] of [
      ['ice', 'frozen'],
      ['water', 'wet'],
      ['storm', 'conductive'],
    ] as const) {
      const value = ability()
      Object.assign(value.behaviors[0]!.effects[0]!.payload, { element })
      expect(validateAbilityDefinition(value)).toContainEqual(
        expect.objectContaining({ code: 'elemental-companion' }),
      )
      value.behaviors[0]!.effects.push({
        id: 'companion',
        payload: {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId,
          stacks: 1,
          durationTurns: 2,
          ...(element === 'ice' ? {} : { potencyBasisPoints: 2000 }),
        },
      } as never)
      expect(validateAbilityDefinition(value)).toEqual([])
      for (const durationTurns of [1, 3, 4]) {
        Object.assign(value.behaviors[0]!.effects[1]!.payload, {
          durationTurns,
          ...(element === 'ice' ? {} : { potencyBasisPoints: 3525 }),
        })
        expect(validateAbilityDefinition(value)).toEqual([])
      }
      for (const durationTurns of [0, 5]) {
        Object.assign(value.behaviors[0]!.effects[1]!.payload, { durationTurns })
        expect(validateAbilityDefinition(value).length).toBeGreaterThan(0)
      }
      Object.assign(value.behaviors[0]!.effects[1]!.payload, { durationTurns: 2 })
      value.behaviors[0]!.effects.push({
        ...value.behaviors[0]!.effects[1]!,
        id: 'duplicate-companion',
      })
      expect(validateAbilityDefinition(value)).toContainEqual(
        expect.objectContaining({ code: 'elemental-companion' }),
      )
    }
    const fire = ability()
    Object.assign(fire.behaviors[0]!.effects[0]!.payload, { element: 'fire' })
    expect(validateAbilityDefinition(fire)).toContainEqual(
      expect.objectContaining({ code: 'elemental-companion' }),
    )
    fire.behaviors[0]!.effects.push({
      id: 'thaw',
      payload: { type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] },
    } as never)
    expect(validateAbilityDefinition(fire)).toEqual([])
    Object.assign(fire.behaviors[0]!.effects[1]!, {
      requirements: {
        kind: 'prime-presence',
        subject: 'owner',
        abilityId: 'strike',
        present: true,
      },
    })
    expect(validateAbilityDefinition(fire)).toContainEqual(
      expect.objectContaining({ code: 'elemental-companion' }),
    )
  })

  it('supports Automatic native packets and only source-owned Ongoing modifiers', () => {
    const automatic = ability()
    automatic.behaviors[0]!.activation = 'automatic'
    Object.assign(automatic.behaviors[0]!, {
      requirements: { kind: 'event', eventType: 'damage_applied', phase: 'after' },
      automaticTarget: { subject: 'triggering' },
    })
    expect(validateAbilityDefinition(automatic)).toEqual([])
    const ongoing = ability()
    Object.assign(ongoing.behaviors[0]!, {
      activation: 'ongoing',
      mode: 'modifier',
      costs: [],
      targeting: null,
      effects: [
        {
          id: 'bonus',
          payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11000 },
        },
      ],
    })
    expect(validateAbilityDefinition(ongoing)).toEqual([])
    ongoing.behaviors[0]!.costs = [{ resource: 'hp', amount: 1 }]
    expect(validateAbilityDefinition(ongoing)).toContainEqual(
      expect.objectContaining({ code: 'unsupported-combination' }),
    )
    const mystic = ability()
    mystic.behaviors[0]!.attackFamily = 'mystic'
    expect(parseAbilityDefinition(mystic).behaviors[0]?.attackFamily).toBe('mystic')
    Object.assign(mystic.behaviors[0]!, { attackFamily: undefined })
    expect(validateAbilityDefinition(mystic)).not.toEqual([])
  })

  it('rejects malformed shapes and raw legacy envelopes keep piercing semantics', () => {
    const malformed = ability()
    Object.assign(malformed.behaviors[0]!, {
      targeting: { ...malformed.behaviors[0]!.targeting, shape: null },
    })
    expect(validateAbilityDefinition(malformed)).not.toEqual([])
    const historicalGeometry = ability()
    Object.assign(historicalGeometry.behaviors[0]!.targeting, { geometryVersion: 1 })
    expect(validateAbilityDefinition(historicalGeometry)).toContainEqual(
      expect.objectContaining({ code: 'invalid-targeting' }),
    )
    const skill = P33_REPRESENTATIVE_DISCIPLINE_SKILLS.find(
      (candidate) =>
        candidate.enabled && candidate.effects.some((effect) => effect.type === 'damage'),
    )!
    const legacy = {
      ...skill,
      effects: [
        { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 20, piercing: true },
      ],
    }
    expect(validateMatureSkillDefinition(legacy)).toEqual([])
    expect(toCombatActionDefinition(legacy, 'pve').effects[0]).toMatchObject({ piercing: true })
  })

  it('keeps identity validation with canonical mechanics and guards the direct Resonance V2 adapter', () => {
    const canonical = parseAbilityDefinition(ability())
    const skill = P33_REPRESENTATIVE_DISCIPLINE_SKILLS.find((candidate) => candidate.enabled)!
    expect(
      validateMatureSkillDefinition({ ...skill, ability: canonical, apCost: -1, effects: [] }),
    ).toEqual([])
    expect(
      validateMatureSkillDefinition({ ...skill, ability: canonical, id: 'invalid id' }),
    ).toContain('id')
    const essence = P36_REPRESENTATIVE_ESSENCES.find((candidate) => candidate.enabled)!
    expect(
      validateEssenceDefinition({
        ...essence,
        ability: canonical,
        skill: { ...essence.skill, apCost: -1, effects: [] },
      }),
    ).toEqual([])
    expect(
      validateEssenceDefinition({
        ...essence,
        ability: canonical,
        skill: { ...essence.skill, nameRef: '' },
      }),
    ).toContain('skill.definition')
    const resonance = convertV5ResonanceToV2(
      P35_REPRESENTATIVE_RESONANCES.find((candidate) => candidate.enabled)!,
    )
    expect(validateResonanceDefinitionV2({ ...resonance, ability: null } as never)).toContain(
      'ability',
    )
    expect(() => normalizedResonanceMechanics({ ...resonance, ability: canonical })).toThrow(
      /canonical-activation-required/,
    )
  })
})
