import { describe, expect, it } from 'vitest'

import { P35_REPRESENTATIVE_RESONANCES, resolveResonanceForPair } from './resonance'
import { CLEANSE_STATUS_IDS, isCleanseEffect } from './combat-cleanse'
import { latestEnabledMatureSkills } from './mature-skills'
import { matchesResonanceSkill } from './resonance-skill-matcher'
import {
  RESONANCE_V2_SCHEMA_VERSION,
  convertV5ResonanceToV2,
  isResonanceDefinitionV2,
  normalizedResonanceMechanics,
  validateResonanceDefinitionV2,
} from './resonance-v2'

describe('Combat v5.1 Resonance v2 schema', () => {
  it('has real qualifying current Skills for every displayed setup and trigger', () => {
    const skills = latestEnabledMatureSkills()
    for (const definition of P35_REPRESENTATIVE_RESONANCES) {
      const current = resolveResonanceForPair(...definition.disciplinePair)!
      const mechanics = normalizedResonanceMechanics(current)
      for (const matcher of [mechanics.setup, mechanics.trigger]) {
        if (!matcher) continue
        expect(
          skills.some((skill) => matchesResonanceSkill(skill, matcher)),
          `${current.id}: ${JSON.stringify(matcher)}`,
        ).toBe(true)
      }
    }
  })
  it('appends honest matcher wording without changing prior versions or non-Chronist eligibility', () => {
    for (const original of P35_REPRESENTATIVE_RESONANCES) {
      const [first, second] = original.disciplinePair
      const latest = resolveResonanceForPair(first, second)!
      const current = latest.authoring.validationTags.includes('captured-percentage-recovery')
        ? resolveResonanceForPair(first, second, latest.contentVersion - 1)!
        : latest
      const previous = resolveResonanceForPair(first, second, current.contentVersion - 1)!
      const nextMechanics = normalizedResonanceMechanics(current)
      const oldMechanics = normalizedResonanceMechanics(previous)
      expect(nextMechanics.trigger).toEqual(oldMechanics.trigger)
      expect(nextMechanics.resultEffects).toEqual(oldMechanics.resultEffects)
      expect(nextMechanics.aiSetupUtilityBonus).toBe(oldMechanics.aiSetupUtilityBonus)
      expect(nextMechanics.aiTriggerUtilityBonus).toBe(oldMechanics.aiTriggerUtilityBonus)
      if (oldMechanics.setup?.sourceDisciplineId === 'chronist') {
        expect(oldMechanics.setup.requiredTags).toEqual(['tempo'])
        expect(nextMechanics.setup).toEqual({
          sourceDisciplineId: 'chronist',
          matchMode: 'any-skill',
          requiredTags: [],
        })
      } else expect(nextMechanics.setup).toEqual(oldMechanics.setup)
      expect(current.description).not.toContain('tempo')
      expect(
        validateResonanceDefinitionV2(
          current as Parameters<typeof validateResonanceDefinitionV2>[0],
        ),
      ).toEqual([])
    }
  })

  it('rejects ambiguous Any Skill matcher payloads instead of silently accepting every Skill', () => {
    const current = resolveResonanceForPair('chronist', 'cinderweaver')!
    if (!isResonanceDefinitionV2(current) || !current.trigger.setup)
      throw new Error('Expected sequence')
    for (const setup of [
      { ...current.trigger.setup, requiredTags: ['attack'] },
      { sourceDisciplineId: 'chronist', requiredTags: [] },
      { ...current.trigger.setup, matchMode: 'unknown' },
    ]) {
      const invalid = {
        ...current,
        trigger: { ...current.trigger, setup },
      } as unknown as Parameters<typeof validateResonanceDefinitionV2>[0]
      expect(validateResonanceDefinitionV2(invalid)).toContain('trigger.setup')
    }
    expect(
      validateResonanceDefinitionV2({
        ...current,
        trigger: {
          ...current.trigger,
          trigger: { ...current.trigger.trigger, matchMode: 'any-skill', requiredTags: [] },
        },
      }),
    ).toContain('trigger.trigger')
  })
  it('gives every current Resonance Cleanse the same removal contract while preserving pinned v3', () => {
    let corrected = 0
    for (const definition of P35_REPRESENTATIVE_RESONANCES) {
      const [first, second] = definition.disciplinePair
      const current = resolveResonanceForPair(first, second)!
      const historical = resolveResonanceForPair(first, second, 3)!
      const effects = normalizedResonanceMechanics(current).resultEffects
      const oldEffects = normalizedResonanceMechanics(historical).resultEffects
      if (!oldEffects.some(isCleanseEffect)) continue
      corrected += 1
      expect(current.contentVersion).toBe(5)
      for (const effect of effects.filter(isCleanseEffect))
        expect(effect.statusIds).toEqual(CLEANSE_STATUS_IDS)
      expect(
        oldEffects.filter(isCleanseEffect).every((effect) => effect.statusIds.length < 8),
      ).toBe(true)
      expect({
        ...resolveResonanceForPair(first, second, 4)!,
        contentVersion: 3,
        trigger: historical.trigger,
        authoring: historical.authoring,
      }).toEqual(historical)
    }
    expect(corrected).toBe(11)
  })
  it('normalizes historical v1 payoff terminology without mutating the definition', () => {
    const historical = resolveResonanceForPair('lifebinder', 'vanguard', 1)
    if (!historical) throw new Error('Expected historical Resonance.')

    const normalized = normalizedResonanceMechanics(historical)
    expect(normalized).toMatchObject({
      mode: 'sequence',
      setup: historical.trigger.setup,
      trigger: historical.trigger.payoff,
      resultEffects: historical.trigger.payoffEffects,
      aiSetupUtilityBonus: historical.trigger.aiSetupUtilityBonus,
      aiTriggerUtilityBonus: historical.trigger.aiPayoffUtilityBonus,
    })
    expect(historical.authoring.schemaVersion).toBe(1)
  })

  it('converts a v5 sequence to schema v2 with Setup, Trigger and one or two Result effects', () => {
    const v5 = resolveResonanceForPair('lifebinder', 'vanguard', 2)
    if (!v5) throw new Error('Expected current v5 Resonance.')

    const v2 = convertV5ResonanceToV2(v5)
    expect(v2.authoring.schemaVersion).toBe(RESONANCE_V2_SCHEMA_VERSION)
    expect(v2.trigger.kind).toBe('skill-trigger-v2')
    expect(v2.trigger.resultEffects.length).toBeGreaterThanOrEqual(1)
    expect(v2.trigger.resultEffects.length).toBeLessThanOrEqual(2)
    expect(v2.trigger.trigger.requiredTags.length).toBeLessThanOrEqual(2)
    expect(validateResonanceDefinitionV2(v2)).toEqual([])
  })

  it('supports immediate Resonance without stale armed Setup state and weakens its Result', () => {
    const v5 = resolveResonanceForPair('farstrider', 'lifebinder', 2)
    if (!v5 || v5.authoring.schemaVersion !== 1) {
      throw new Error('Expected Farstrider/Lifebinder v5 Resonance.')
    }

    const v2 = convertV5ResonanceToV2(v5)
    expect(v2.trigger.mode).toBe('immediate')
    expect(v2.trigger.setup).toBeNull()
    expect(v2.trigger.aiSetupUtilityBonus).toBe(0)
    expect(validateResonanceDefinitionV2(v2)).toEqual([])

    const originalDamage = v5.trigger.payoffEffects.find((effect) => effect.type === 'damage')
    const nextDamage = v2.trigger.resultEffects.find((effect) => effect.type === 'damage')
    if (originalDamage?.type === 'damage' && nextDamage?.type === 'damage') {
      expect(nextDamage.amount).toBeLessThan(originalDamage.amount)
    }
  })

  it('rejects more than two matcher tags or more than two Result effects', () => {
    const v5 = resolveResonanceForPair('lifebinder', 'vanguard', 2)
    if (!v5 || isResonanceDefinitionV2(v5)) {
      throw new Error('Expected current v5 Resonance.')
    }
    const v2 = convertV5ResonanceToV2(v5)

    expect(
      validateResonanceDefinitionV2({
        ...v2,
        trigger: {
          ...v2.trigger,
          trigger: {
            ...v2.trigger.trigger,
            requiredTags: ['attack', 'melee', 'extra'],
          },
        },
      }),
    ).toContain('trigger.trigger')

    expect(
      validateResonanceDefinitionV2({
        ...v2,
        trigger: {
          ...v2.trigger,
          resultEffects: [
            ...v2.trigger.resultEffects,
            { type: 'damage', recipient: 'primary-unit', amount: 1 },
          ],
        },
      }),
    ).toContain('trigger.resultEffects')
  })
})
