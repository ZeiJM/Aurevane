import { describe, expect, it } from 'vitest'

import { resolveEssenceForBuild, validateEssenceDefinition } from './essence'
import {
  P33_REPRESENTATIVE_DISCIPLINE_SKILLS,
  resolveMatureSkillVersion,
  validateMatureSkillDefinition,
} from './mature-skills'
import { PV1F_COMBAT_CONTENT, PV1F_EXPOSED_STATUS } from './pv1f-action-economy'
import {
  P35_REPRESENTATIVE_RESONANCES,
  resolveResonanceForPair,
  validateResonanceDefinition,
} from './resonance'

const NEWLY_AUTHORED_DISCIPLINES = ['aetherist', 'farstrider', 'shadehand'] as const
const AUTHORED_DISCIPLINES = [
  'aetherist',
  'farstrider',
  'lifebinder',
  'shadehand',
  'vanguard',
] as const

const AUTHORED_PAIRS = [
  ['aetherist', 'farstrider'],
  ['aetherist', 'lifebinder'],
  ['aetherist', 'shadehand'],
  ['aetherist', 'vanguard'],
  ['farstrider', 'lifebinder'],
  ['farstrider', 'shadehand'],
  ['farstrider', 'vanguard'],
  ['lifebinder', 'shadehand'],
  ['lifebinder', 'vanguard'],
  ['shadehand', 'vanguard'],
] as const

describe('Foundation trio authored class content', () => {
  it('ships exactly eight valid Techniques for Aetherist, Farstrider, and Shadehand', () => {
    for (const disciplineId of NEWLY_AUTHORED_DISCIPLINES) {
      const definitions = P33_REPRESENTATIVE_DISCIPLINE_SKILLS.filter(
        (definition) => definition.enabled && definition.sourceDisciplineId === disciplineId,
      )

      expect(definitions).toHaveLength(8)
      for (const definition of definitions) {
        expect(validateMatureSkillDefinition(definition)).toEqual([])
      }
    }
  })

  it('makes Exposed an authoritative PV-1F setup status', () => {
    expect(PV1F_EXPOSED_STATUS).toMatchObject({
      id: 'exposed',
      maximumStacks: 1,
      durationOwnerTurnStarts: 2,
      damageTakenMultiplierBasisPoints: 11_500,
    })
    expect(PV1F_COMBAT_CONTENT.statuses).toContain(PV1F_EXPOSED_STATUS)
    expect(resolveMatureSkillVersion('shadehand.exploit-opening')?.requirements).toContainEqual({
      kind: 'target-status-present',
      statusId: 'exposed',
    })
  })

  it('preserves each new Discipline combat identity in the authored mechanics', () => {
    const longshot = resolveMatureSkillVersion('farstrider.longshot')
    expect(longshot?.target).toMatchObject({
      minimumRange: 3,
      maximumRange: 6,
      maximumElevationDifference: 3,
    })

    const backstab = resolveMatureSkillVersion('shadehand.backstab')
    const backstabDamage = backstab?.effects.find((effect) => effect.type === 'damage')
    expect(backstabDamage).toMatchObject({
      facingModifiersBasisPoints: { front: 10_000, side: 13_000, rear: 17_000 },
    })

    const arcaneField = resolveMatureSkillVersion('aetherist.arcane-field')
    expect(arcaneField?.tags).toEqual(expect.arrayContaining(['mystic', 'area', 'expose']))
  })

  it('resolves one valid pure Essence for every currently authored Discipline', () => {
    const expected = new Map<string, string>([
      ['aetherist', 'essence.aetherist.aether-nova'],
      ['farstrider', 'essence.farstrider.deadeye-barrage'],
      ['lifebinder', 'essence.lifebinder.verdant-rupture'],
      ['shadehand', 'essence.shadehand.perfect-opening'],
      ['vanguard', 'essence.vanguard.unbroken-strike'],
    ])

    for (const disciplineId of AUTHORED_DISCIPLINES) {
      const essence = resolveEssenceForBuild(disciplineId, null)
      expect(essence?.essenceId).toBe(expected.get(disciplineId))
      if (!essence) throw new Error(`Missing ${disciplineId} Essence.`)
      expect(validateEssenceDefinition(essence)).toEqual([])
    }
  })

  it('covers all ten mixed pairs among the five currently authored Disciplines', () => {
    expect(
      P35_REPRESENTATIVE_RESONANCES.filter(
        (definition) => !definition.disciplinePair.some((id) => id === 'ironfist'),
      ),
    ).toHaveLength(10)
    for (const definition of P35_REPRESENTATIVE_RESONANCES) {
      expect(validateResonanceDefinition(definition)).toEqual([])
    }

    for (const [left, right] of AUTHORED_PAIRS) {
      expect(resolveResonanceForPair(left, right)).not.toBeNull()
    }
  })
})
