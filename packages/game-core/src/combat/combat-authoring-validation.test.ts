import { describe, expect, it } from 'vitest'

import {
  P2_3_COMBAT_CONTENT,
  P2_3_GUARDED_STATUS,
  P2_3_GUARD_ACTION,
  type CombatActionDefinition,
  type CombatStatusDefinition,
} from './actions'
import {
  validateCombatActionDefinition,
  validateCombatStatusDefinition,
} from './combat-authoring-validation'
import { combatStatusMetadata } from './combat-effect-state'

describe('combat authoring validation boundary', () => {
  it('exposes pure validators that accept current published content', () => {
    expect(() =>
      validateCombatActionDefinition(P2_3_GUARD_ACTION, P2_3_COMBAT_CONTENT),
    ).not.toThrow()
    expect(() => validateCombatStatusDefinition(P2_3_GUARDED_STATUS)).not.toThrow()
  })

  it('rejects invalid offensive damage scaling before content can publish', () => {
    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        effects: [
          {
            type: 'damage',
            recipient: 'primary-unit',
            amount: 12,
            scaling: {
              source: 'physical-power',
              coefficientBasisPoints: 20_001,
            },
          },
        ],
      } as CombatActionDefinition),
    ).toThrow(/damage scaling coefficient/i)
  })

  it('validates explicit status metadata used by cloning and reactions', () => {
    const status: CombatStatusDefinition = {
      ...P2_3_GUARDED_STATUS,
      polarity: 'positive',
      amplifyCopyable: true,
      curseCopyable: false,
      reactionClass: 'ordinary',
    }
    expect(() => validateCombatStatusDefinition(status)).not.toThrow()
    expect(combatStatusMetadata(status)).toEqual({
      polarity: 'positive',
      amplifyCopyable: true,
      curseCopyable: false,
      reactionClass: 'ordinary',
    })

    expect(() =>
      validateCombatStatusDefinition({
        ...status,
        polarity: 'beneficial',
      } as unknown as CombatStatusDefinition),
    ).toThrow(/polarity/i)
  })

  it('uses non-copying compatibility defaults for historical statuses', () => {
    expect(combatStatusMetadata(P2_3_GUARDED_STATUS)).toEqual({
      polarity: 'neutral',
      amplifyCopyable: false,
      curseCopyable: false,
      reactionClass: 'ordinary',
    })
  })

  it.each([0, 5])('rejects Heal tick count %s outside the current 1-4 bound', (ticks) => {
    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        effects: [{ type: 'healing', recipient: 'actor', amount: 4, ticks }],
      } as unknown as CombatActionDefinition),
    ).toThrow(/healing ticks/i)
  })

  it.each([0, 5])('rejects MP Rec tick count %s outside the current 1-4 bound', (ticks) => {
    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        effects: [
          {
            type: 'resource-change',
            recipient: 'actor',
            resource: 'mp',
            delta: 3,
            ticks,
          },
        ],
      } as unknown as CombatActionDefinition),
    ).toThrow(/mp recovery ticks/i)
  })

  it('keeps MP Drain immediate-only', () => {
    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        effects: [
          {
            type: 'resource-change',
            recipient: 'primary-unit',
            resource: 'mp',
            delta: -3,
            ticks: 2,
          },
        ],
      } as unknown as CombatActionDefinition),
    ).toThrow(/mp drain/i)
  })

  it('rejects Bleed applications whose raw per-stack total exceeds 10', () => {
    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        effects: [
          {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: 'bleed',
            stacks: 1,
            damagePerTick: 4,
            durationTicks: 3,
          },
        ],
      } as unknown as CombatActionDefinition),
    ).toThrow(/bleed.*10/i)

    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        effects: [
          {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: 'bleed',
            stacks: 1,
            damagePerTick: 3,
            durationTicks: 3,
          },
        ],
      } as unknown as CombatActionDefinition),
    ).not.toThrow()
  })

  it('accepts direct-unit and ground-targeted Copy while rejecting self/empty targeting', () => {
    const copyEffect = { type: 'copy' as const, recipient: 'primary-unit' as const }
    const unitTarget = {
      ...P2_3_GUARD_ACTION.target,
      kind: 'unit' as const,
      teamPolicy: 'enemy' as const,
      minimumRange: 1,
      maximumRange: 3,
      friendlyFire: 'enemies-only' as const,
    }
    const groundTarget = {
      ...unitTarget,
      kind: 'ground-tile' as const,
      teamPolicy: 'any' as const,
      friendlyFire: 'all-units' as const,
    }

    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        target: unitTarget,
        effects: [copyEffect],
      }),
    ).not.toThrow()
    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        target: groundTarget,
        effects: [copyEffect],
      }),
    ).not.toThrow()

    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        effects: [copyEffect],
      }),
    ).toThrow(/Copy requires/i)
    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        target: { ...groundTarget, kind: 'empty-tile' },
        effects: [copyEffect],
      }),
    ).toThrow(/Copy requires/i)
  })

  it('rejects malformed accuracy authoring', () => {
    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        accuracyMode: 'sometimes',
      } as unknown as CombatActionDefinition),
    ).toThrow(/accuracy mode/i)

    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        accuracyMode: 'per-target',
        accuracyModifierBasisPoints: 3_001,
      } as unknown as CombatActionDefinition),
    ).toThrow(/accuracy modifier/i)
  })
})
