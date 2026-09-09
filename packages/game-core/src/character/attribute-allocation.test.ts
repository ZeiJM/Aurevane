import { describe, expect, it } from 'vitest'

import {
  ATTRIBUTE_RESET_LIMIT_PER_WINDOW,
  FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES,
  FOUNDATION_NON_FOCUS_ATTRIBUTE_CAP,
  PERSONAL_STARTING_ATTRIBUTE_POINT_POOL,
  STARTING_ATTRIBUTE_POINT_POOL,
  attributePointPoolForLevel,
  consumeAttributeReset,
  effectiveAttributesFromPersonal,
  foundationDisciplineAttributePolicy,
  personalAttributePointPoolForLevel,
  personalAttributesFromEffective,
  projectAllocationForPrimaryDisciplineChange,
  resolveAttributeResetWindow,
  unspentAttributePoints,
  validateAttributeAllocation,
  validateDisciplineAttributePolicy,
  type DisciplineAttributePolicy,
} from './attribute-allocation'

describe('attribute allocation guardrails', () => {
  it('keeps 36 effective points at Level 1 while only five are player-owned', () => {
    expect(STARTING_ATTRIBUTE_POINT_POOL).toBe(36)
    expect(PERSONAL_STARTING_ATTRIBUTE_POINT_POOL).toBe(5)
    expect(attributePointPoolForLevel(1)).toBe(36)
    expect(attributePointPoolForLevel(2)).toBe(37)
    expect(attributePointPoolForLevel(50)).toBe(85)
    expect(personalAttributePointPoolForLevel(1)).toBe(5)
    expect(personalAttributePointPoolForLevel(50)).toBe(54)
  })

  it('allows level-earned personal points to remain unspent until the player assigns them', () => {
    const vanguard = foundationDisciplineAttributePolicy('vanguard')!
    const starting = effectiveAttributesFromPersonal(
      { might: 2, finesse: 0, vitality: 2, agility: 0, intellect: 0, resolve: 1 },
      vanguard,
    )
    expect(unspentAttributePoints(starting, 10)).toBe(9)
    expect(validateAttributeAllocation({ attributes: starting, level: 10, policy: vanguard })).toEqual(
      [],
    )
  })

  it('never allows a redistribution to spend below the fixed Primary base', () => {
    const aetherist = foundationDisciplineAttributePolicy('aetherist')!
    const illegal = {
      might: 1,
      finesse: 3,
      vitality: 4,
      agility: 3,
      intellect: 15,
      resolve: 10,
    }
    expect(
      validateAttributeAllocation({
        attributes: illegal,
        level: 1,
        policy: aetherist,
        requireFullPool: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'below-discipline-base', field: 'attributes.might' }),
      ]),
    )
  })

  it('round-trips player-owned allocations independently from the Primary base', () => {
    const vanguard = foundationDisciplineAttributePolicy('vanguard')!
    const personal = { might: 1, finesse: 0, vitality: 2, agility: 0, intellect: 0, resolve: 2 }
    const effective = effectiveAttributesFromPersonal(personal, vanguard)
    expect(personalAttributesFromEffective(effective, vanguard)).toEqual(personal)
    expect(Object.values(effective).reduce((total, value) => total + value, 0)).toBe(36)
  })

  it('keeps focus attributes uncapped while enforcing only authored off-identity ceilings', () => {
    const policy: DisciplineAttributePolicy = {
      disciplineId: 'test-mage',
      policyVersion: 1,
      baseAttributes: { might: 3, finesse: 3, vitality: 4, agility: 3, intellect: 9, resolve: 9 },
      focusAttributes: ['intellect', 'resolve'],
      attributeCaps: { might: 8, finesse: 10, vitality: 12, agility: 10 },
    }

    const legal = {
      might: 8,
      finesse: 3,
      vitality: 4,
      agility: 3,
      intellect: 9,
      resolve: 9,
    }
    const illegal = { ...legal, might: 9, intellect: 8 }

    expect(validateAttributeAllocation({ attributes: legal, level: 5, policy })).toEqual([])
    expect(validateAttributeAllocation({ attributes: illegal, level: 5, policy })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'discipline-cap-exceeded', field: 'attributes.might' }),
      ]),
    )
  })

  it('requires every policy to define exactly two or three unique focus attributes and 31 base points', () => {
    expect(
      validateDisciplineAttributePolicy({
        disciplineId: 'bad-mage',
        policyVersion: 1,
        baseAttributes: { might: 2, finesse: 3, vitality: 4, agility: 3, intellect: 10, resolve: 9 },
        focusAttributes: ['intellect'],
        attributeCaps: {},
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-discipline-policy',
          field: 'policy.focusAttributes',
        }),
      ]),
    )
  })

  it('ships Foundation policy v3 with mixed 2/3 focus counts and a 30-point non-focus ceiling', () => {
    expect(FOUNDATION_NON_FOCUS_ATTRIBUTE_CAP).toBe(30)
    expect(FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES).toHaveLength(6)

    const focusCounts = new Set<number>()
    for (const policy of FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES) {
      expect(policy.policyVersion).toBe(3)
      expect(validateDisciplineAttributePolicy(policy)).toEqual([])
      expect(Object.keys(policy.attributeCaps)).toHaveLength(6 - policy.focusAttributes.length)
      for (const focusAttribute of policy.focusAttributes) {
        expect(policy.attributeCaps).not.toHaveProperty(focusAttribute)
      }
      for (const cap of Object.values(policy.attributeCaps)) {
        expect(cap).toBe(FOUNDATION_NON_FOCUS_ATTRIBUTE_CAP)
      }
      focusCounts.add(policy.focusAttributes.length)
    }
    expect(focusCounts).toEqual(new Set([2, 3]))
  })

  it('moves only the fixed Primary base while preserving every personal point on a legal swap', () => {
    const vanguard = foundationDisciplineAttributePolicy('vanguard')!
    const aetherist = foundationDisciplineAttributePolicy('aetherist')!
    const personal = { might: 2, finesse: 0, vitality: 1, agility: 0, intellect: 1, resolve: 1 }
    const current = effectiveAttributesFromPersonal(personal, vanguard)

    const projected = projectAllocationForPrimaryDisciplineChange({
      attributes: current,
      level: 1,
      currentPolicy: vanguard,
      proposedPolicy: aetherist,
    })

    expect(projected.issues).toEqual([])
    expect(projected.personalAttributes).toEqual(personal)
    expect(projected.attributes).toEqual(effectiveAttributesFromPersonal(personal, aetherist))
    expect(Object.values(projected.attributes).reduce((total, value) => total + value, 0)).toBe(36)
  })

  it('rejects a projected swap when preserved personal investment would exceed a target off-focus cap', () => {
    const aetherist = foundationDisciplineAttributePolicy('aetherist')!
    const vanguard = foundationDisciplineAttributePolicy('vanguard')!
    const personal = { might: 0, finesse: 28, vitality: 0, agility: 0, intellect: 20, resolve: 1 }
    const current = effectiveAttributesFromPersonal(personal, aetherist)

    const projected = projectAllocationForPrimaryDisciplineChange({
      attributes: current,
      level: 45,
      currentPolicy: aetherist,
      proposedPolicy: vanguard,
    })
    expect(projected.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'discipline-cap-exceeded', field: 'attributes.finesse' }),
      ]),
    )
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
