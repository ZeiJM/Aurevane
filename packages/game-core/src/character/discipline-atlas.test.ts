import { describe, expect, it } from 'vitest'

import {
  DISCIPLINE_ATLAS,
  DISCIPLINE_ATLAS_BY_ID,
  evaluateDisciplineAtlasEntry,
  rekindlingCountFromCycleNumber,
} from './discipline-atlas'

describe('Discipline Atlas', () => {
  it('keeps the canonical 36-Discipline identity roster unique', () => {
    expect(DISCIPLINE_ATLAS).toHaveLength(36)
    expect(new Set(DISCIPLINE_ATLAS.map((entry) => entry.id)).size).toBe(36)
    expect(DISCIPLINE_ATLAS.filter((entry) => entry.publication === 'published')).toHaveLength(17)
  })

  it('opens published Disciplines for testing without pretending release requirements are met', () => {
    const bastion = DISCIPLINE_ATLAS_BY_ID.bastion!
    const evaluation = evaluateDisciplineAtlasEntry(bastion, {
      masteryByDiscipline: { vanguard: 1 },
      rekindlingCount: 0,
      testingAccess: true,
    })

    expect(evaluation.state).toBe('testing')
    expect(evaluation.effectiveSelectable).toBe(true)
    expect(evaluation.releaseEligible).toBe(false)
    expect(evaluation.unmetRequirements).toContain('Vanguard Adept')
  })

  it('never makes unpublished content selectable through the testing override', () => {
    const skywarden = DISCIPLINE_ATLAS_BY_ID.skywarden!
    const evaluation = evaluateDisciplineAtlasEntry(skywarden, {
      masteryByDiscipline: { vanguard: 5, farstrider: 5 },
      rekindlingCount: 3,
      testingAccess: true,
    })

    expect(evaluation.effectiveSelectable).toBe(false)
    expect(evaluation.state).toBe('revealed')
  })

  it('requires Rekindling and prerequisite mastery for veteran Disciplines', () => {
    const chronist = DISCIPLINE_ATLAS_BY_ID.chronist!
    expect(
      evaluateDisciplineAtlasEntry(chronist, {
        masteryByDiscipline: { aetherist: 3 },
        rekindlingCount: 0,
      }).releaseEligible,
    ).toBe(false)
    expect(
      evaluateDisciplineAtlasEntry(chronist, {
        masteryByDiscipline: { aetherist: 3 },
        rekindlingCount: 1,
      }).releaseEligible,
    ).toBe(true)
  })

  it('keeps secret Disciplines veiled until their reveal condition is discovered', () => {
    const loreeater = DISCIPLINE_ATLAS_BY_ID.loreeater!
    const hidden = evaluateDisciplineAtlasEntry(loreeater, {
      masteryByDiscipline: { farstrider: 5, aetherist: 5 },
      rekindlingCount: 0,
    })
    const revealed = evaluateDisciplineAtlasEntry(loreeater, {
      masteryByDiscipline: { farstrider: 5, aetherist: 5 },
      rekindlingCount: 0,
      flags: ['reveal:loreeater'],
    })

    expect(hidden.state).toBe('veiled')
    expect(hidden.revealed).toBe(false)
    expect(revealed.state).toBe('rumored')
    expect(revealed.revealed).toBe(true)
  })

  it('uses count-of requirements for Spellwright breadth instead of one fixed path', () => {
    const spellwright = DISCIPLINE_ATLAS_BY_ID.spellwright!
    const base = {
      aetherist: 5 as const,
      cinderweaver: 5 as const,
      frostweaver: 5 as const,
      stormsinger: 5 as const,
    }

    expect(
      evaluateDisciplineAtlasEntry(spellwright, {
        masteryByDiscipline: base,
        rekindlingCount: 3,
        flags: ['reveal:spellwright', 'unlock:spellwright'],
      }).releaseEligible,
    ).toBe(true)

    expect(
      evaluateDisciplineAtlasEntry(spellwright, {
        masteryByDiscipline: { aetherist: 5, cinderweaver: 5, frostweaver: 5 },
        rekindlingCount: 3,
        flags: ['reveal:spellwright', 'unlock:spellwright'],
      }).releaseEligible,
    ).toBe(false)
  })

  it('converts the visible cycle number into completed Rekindlings', () => {
    expect(rekindlingCountFromCycleNumber(1)).toBe(0)
    expect(rekindlingCountFromCycleNumber(2)).toBe(1)
    expect(rekindlingCountFromCycleNumber(4)).toBe(3)
    expect(rekindlingCountFromCycleNumber(99)).toBe(3)
  })
})
