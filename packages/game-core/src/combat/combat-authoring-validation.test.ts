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
import { validateCombatTagPayload } from './combat-tag-registry'

describe('generated companion link validation', () => {
  it.each([
    'dot-damage.1',
    'frozen-ground.12',
    'element-companion.frozen.primary-unit',
    'element-companion.wet.affected-units',
    'element-companion.conductive.primary-unit.1',
    'element-companion.cleanse-chilled.actor',
  ])('accepts supported link %s through canonical and native validators', (authoringLink) => {
    const effect = { ...P2_3_GUARD_ACTION.effects[0]!, authoringLink }
    expect(validateCombatTagPayload(effect)).toEqual([])
    expect(() =>
      validateCombatActionDefinition({ ...P2_3_GUARD_ACTION, effects: [effect] }),
    ).not.toThrow()
  })

  it.each([
    '',
    'authored.hit',
    'dot-damage.0',
    'frozen-ground.-1',
    'element-companion.other.actor',
    'element-companion.frozen.selected-tile',
    'element-companion.frozen.primary-unit.0',
    'element-companion.frozen.primary-unit.01',
    'element-companion.frozen.primary-unit.1.extra',
  ])('rejects unsupported link %s through canonical and native validators', (authoringLink) => {
    const effect = { ...P2_3_GUARD_ACTION.effects[0]!, authoringLink }
    expect(validateCombatTagPayload(effect)).toContainEqual(
      expect.objectContaining({ path: 'payload.authoringLink', code: 'invalid-payload' }),
    )
    expect(() =>
      validateCombatActionDefinition({ ...P2_3_GUARD_ACTION, effects: [effect] }),
    ).toThrow('Invalid generated companion link.')
  })
})

describe('combat authoring validation boundary', () => {
  it('rejects the private native Basic marker at the actual authored boundary', () => {
    expect(() =>
      validateCombatActionDefinition({
        ...P2_3_GUARD_ACTION,
        sourceType: 'basic-attack',
        target: { ...P2_3_GUARD_ACTION.target, kind: 'unit' },
        nativeBasicAttackCommand: true,
      }),
    ).toThrow('private-native-basic-command-not-authored')
  })
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

  it.each([0, 101])(
    'rejects Heal tick count %s outside the current 1-100 application bound',
    (ticks) => {
      expect(() =>
        validateCombatActionDefinition({
          ...P2_3_GUARD_ACTION,
          effects: [{ type: 'healing', recipient: 'actor', amount: 4, ticks }],
        } as unknown as CombatActionDefinition),
      ).toThrow(/healing ticks/i)
    },
  )

  it.each([0, 101])(
    'rejects MP Rec tick count %s outside the current 1-100 application bound',
    (ticks) => {
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
    },
  )

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

it.each([-1, 0.5, Infinity])('rejects invalid authored HP payment %s', (hp) => {
  expect(() =>
    validateCombatActionDefinition({
      ...P2_3_GUARD_ACTION,
      cost: { ...P2_3_GUARD_ACTION.cost, hp },
    }),
  ).toThrow(/HP cost/)
})
