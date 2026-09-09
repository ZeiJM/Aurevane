import { describe, expect, it } from 'vitest'

import {
  ATTRIBUTE_RESET_LIMIT_PER_WINDOW,
  FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES,
  FOUNDATION_NON_FOCUS_ATTRIBUTE_CAP,
  STARTING_ATTRIBUTE_POINT_POOL,
  attributePointPoolForLevel,
  consumeAttributeReset,
  foundationDisciplineAttributePolicy,
  resolveAttributeResetWindow,
  unspentAttributePoints,
  validateAllocationForPrimaryDisciplineChange,
  validateAttributeAllocation,
  validateDisciplineAttributePolicy,
  type DisciplineAttributePolicy,
} from './attribute-allocation'

describe('attribute allocation guardrails', () => {
  it('grants one total core-attribute point for every Level after Level 1', () => {
    expect(STARTING_ATTRIBUTE_POINT_POOL).toBe(36)
    expect(attributePointPoolForLevel(1)).toBe(36)
    expect(attributePointPoolForLevel(2)).toBe(37)
    expect(attributePointPoolForLevel(50)).toBe(85)
  })

  it('allows level-earned points to remain unspent until the player assigns them', () => {
    const starting = {
      might: 6,
      finesse: 6,
      vitality: 6,
      agility: 6,
      intellect: 6,
      resolve: 6,
    }
    expect(unspentAttributePoints(starting, 10)).toBe(9)
    expect(validateAttributeAllocation({ attributes: starting, level: 10 })).toEqual([])
  })

  it('treats the entire starter pool as redistributable rather than permanently locking baseline values', () => {
    const redistributed = {
      might: 1,
      finesse: 1,
      vitality: 1,
      agility: 1,
      intellect: 31,
      resolve: 1,
    }
    expect(
      validateAttributeAllocation({
        attributes: redistributed,
        level: 1,
        policy: foundationDisciplineAttributePolicy('aetherist'),
        requireFullPool: true,
      }),
    ).toEqual([])
  })

  it('keeps focus attributes uncapped while enforcing only explicitly authored off-identity ceilings', () => {
    const policy: DisciplineAttributePolicy = {
      disciplineId: 'test-mage',
      policyVersion: 1,
      focusAttributes: ['intellect', 'resolve'],
      attributeCaps: { might: 8, finesse: 10, vitality: 12, agility: 10 },
    }

    const legal = {
      might: 8,
      finesse: 1,
      vitality: 1,
      agility: 1,
      intellect: 24,
      resolve: 1,
    }
    const illegal = { ...legal, might: 9, intellect: 23 }

    expect(validateAttributeAllocation({ attributes: legal, level: 1, policy })).toEqual([])
    expect(validateAttributeAllocation({ attributes: illegal, level: 1, policy })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'discipline-cap-exceeded', field: 'attributes.might' }),
      ]),
    )
  })

  it('rejects policies that attempt to cap their own focus attributes', () => {
    expect(
      validateDisciplineAttributePolicy({
        disciplineId: 'bad-mage',
        policyVersion: 1,
        focusAttributes: ['intellect'],
        attributeCaps: { intellect: 20 },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-discipline-policy',
          field: 'policy.attributeCaps.intellect',
        }),
      ]),
    )
  })

  it('checks a proposed Primary without mutating or silently clamping the player allocation', () => {
    const proposedPolicy: DisciplineAttributePolicy = {
      disciplineId: 'bounded-mage',
      policyVersion: 1,
      focusAttributes: ['intellect'],
      attributeCaps: { might: 8 },
    }
    const attributes = {
      might: 12,
      finesse: 1,
      vitality: 1,
      agility: 1,
      intellect: 20,
      resolve: 1,
    }

    const before = { ...attributes }
    expect(validateAllocationForPrimaryDisciplineChange(attributes, 1, proposedPolicy)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'discipline-cap-exceeded' })]),
    )
    expect(attributes).toEqual(before)
  })

  it('ships Foundation policy v2 with uncapped focus attributes and a 30-point non-focus ceiling', () => {
    expect(FOUNDATION_NON_FOCUS_ATTRIBUTE_CAP).toBe(30)
    expect(FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES).toHaveLength(6)

    for (const policy of FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES) {
      expect(policy.policyVersion).toBe(2)
      expect(validateDisciplineAttributePolicy(policy)).toEqual([])
      expect(Object.keys(policy.attributeCaps)).toHaveLength(4)
      for (const focusAttribute of policy.focusAttributes) {
        expect(policy.attributeCaps).not.toHaveProperty(focusAttribute)
      }
      for (const cap of Object.values(policy.attributeCaps)) {
        expect(cap).toBe(FOUNDATION_NON_FOCUS_ATTRIBUTE_CAP)
      }
    }

    expect(foundationDisciplineAttributePolicy('aetherist')?.focusAttributes).toEqual([
      'intellect',
      'resolve',
    ])
    expect(foundationDisciplineAttributePolicy('aetherist')?.attributeCaps).toEqual({
      might: 30,
      finesse: 30,
      vitality: 30,
      agility: 30,
    })
  })

  it('allows a serious Level 50 hybrid at the non-focus ceiling and rejects only the point beyond it', () => {
    const policy = foundationDisciplineAttributePolicy('aetherist')
    expect(policy).not.toBeNull()

    const legalHybrid = {
      might: 30,
      finesse: 3,
      vitality: 3,
      agility: 3,
      intellect: 40,
      resolve: 6,
    }
    const illegalHybrid = {
      ...legalHybrid,
      might: 31,
      intellect: 39,
    }

    expect(
      validateAttributeAllocation({
        attributes: legalHybrid,
        level: 50,
        policy,
        requireFullPool: true,
      }),
    ).toEqual([])
    expect(
      validateAttributeAllocation({
        attributes: illegalHybrid,
        level: 50,
        policy,
        requireFullPool: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'discipline-cap-exceeded', field: 'attributes.might' }),
      ]),
    )
  })

  it('requires redistribution before a Primary swap when the target Discipline makes a 31-point stat non-focus', () => {
    const attributes = {
      might: 31,
      finesse: 3,
      vitality: 39,
      agility: 3,
      intellect: 6,
      resolve: 3,
    }
    const before = { ...attributes }
    const aetherist = foundationDisciplineAttributePolicy('aetherist')
    expect(aetherist).not.toBeNull()

    expect(validateAllocationForPrimaryDisciplineChange(attributes, 50, aetherist!)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'discipline-cap-exceeded', field: 'attributes.might' }),
        expect.objectContaining({ code: 'discipline-cap-exceeded', field: 'attributes.vitality' }),
      ]),
    )
    expect(attributes).toEqual(before)
  })

  it('allows five resets per 30-day window and replenishes the full allowance when the window renews', () => {
    const start = resolveAttributeResetWindow({
      windowStartedAt: null,
      used: 99,
      now: '2026-09-01T12:00:00.000Z',
    })
    expect(start.used).toBe(0)
    expect(start.remaining).toBe(ATTRIBUTE_RESET_LIMIT_PER_WINDOW)

    let state = start
    for (let index = 0; index < ATTRIBUTE_RESET_LIMIT_PER_WINDOW; index += 1) {
      state = consumeAttributeReset(state)
    }
    expect(state.remaining).toBe(0)
    expect(() => consumeAttributeReset(state)).toThrow(/No attribute resets remain/)

    const renewed = resolveAttributeResetWindow({
      windowStartedAt: state.windowStartedAt,
      used: state.used,
      now: '2026-10-01T12:00:00.000Z',
    })
    expect(renewed.used).toBe(0)
    expect(renewed.remaining).toBe(ATTRIBUTE_RESET_LIMIT_PER_WINDOW)
  })
})
