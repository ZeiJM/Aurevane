import { describe, expect, it } from 'vitest'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
  validateMatureSkillDefinition,
} from './mature-skills'
import {
  P36_REPRESENTATIVE_ESSENCES,
  resolveEssenceForBuild,
  validateEssenceDefinition,
} from './essence'
import {
  createCurrentTargetingSkillVersion,
  createCurrentTargetingEssenceVersion,
} from './combat-targeting-roster'
import { applyV51CurrentTechniqueTargeting } from './skill-balance-v5-1'
const essences = () =>
  [...new Set(P36_REPRESENTATIVE_ESSENCES.map((e) => e.sourceDisciplineId))].map((id) =>
    resolveEssenceForBuild(id, null)!,
  )
describe('immutable current targeting catalog', () => {
  it('versions exactly 23 Circle and 13 Line entries while retaining 117 Single definitions', () => {
    const all = [...latestEnabledMatureSkills(), ...essences().map((e) => e.skill)]
    expect(all).toHaveLength(153)
    expect(all.filter((s) => s.target.shape.kind === 'circle')).toHaveLength(23)
    expect(all.filter((s) => s.target.shape.kind === 'line')).toHaveLength(13)
    expect(all.filter((s) => s.target.shape.kind === 'single')).toHaveLength(117)
    for (const current of all) {
      if (current.target.shape.kind === 'single') {
        expect(current.target.geometryVersion).toBeUndefined()
        expect(createCurrentTargetingSkillVersion(current)).toBeNull()
        continue
      }
      expect(current.target.geometryVersion, current.id).toBe(2)
      const geometryCurrent = current.groundArea
        ? current.id.startsWith('essence.')
          ? resolveEssenceForBuild(current.sourceDisciplineId, null, current.contentVersion - 1)!
              .skill
          : resolveMatureSkillVersion(current.id, current.contentVersion - 1)!
        : current
      const old = current.id.startsWith('essence.')
        ? resolveEssenceForBuild(
            current.sourceDisciplineId,
            null,
            geometryCurrent.contentVersion - 1,
          )!.skill
        : resolveMatureSkillVersion(current.id, geometryCurrent.contentVersion - 1)!
      expect(old.target.geometryVersion).toBeUndefined()
      expect(createCurrentTargetingSkillVersion(old)).toEqual(geometryCurrent)
      expect({
        ...geometryCurrent,
        contentVersion: old.contentVersion,
        target: old.target,
        authoring: old.authoring,
      }).toEqual(old)
      expect(current.target.minimumRange).toBe(0)
      expect(current.target.maximumRange).toBe(
        current.target.shape.kind === 'circle'
          ? current.target.shape.radius
          : current.target.shape.kind === 'line'
            ? current.target.shape.length
            : 0,
      )
      expect(validateMatureSkillDefinition(current), current.id).toEqual([])
      expect(createCurrentTargetingSkillVersion(current)).toBeNull()
    }
  })
  it('versions both Essence and embedded Skill while preserving history', () => {
    for (const current of essences().filter((e) => e.skill.target.shape.kind !== 'single')) {
      const old = resolveEssenceForBuild(
        current.sourceDisciplineId,
        null,
        current.contentVersion - 1,
      )!
      expect(createCurrentTargetingEssenceVersion(old)).toEqual(current)
      expect(validateEssenceDefinition(current)).toEqual([])
      expect(resolveEssenceForBuild(current.sourceDisciplineId, null, old.contentVersion)).toEqual(
        old,
      )
    }
  })
  it('preserves custom Owner percentages, media, costs, cooldowns and elevation', () => {
    const current = resolveMatureSkillVersion('cinderweaver.ember-line')!
    const custom = {
      ...current,
      target: { ...current.target, geometryVersion: undefined, maximumElevationDifference: 2 },
      apCost: 60,
      media: { ...current.media, iconKey: 'owner.custom' },
      flavorLine: 'Owner flavor',
      effects: current.effects.map((e) =>
        e.type === 'burn'
          ? {
              ...e,
              damageProfile: {
                kind: 'attack-percentage' as const,
                basisPoints: 1234,
                decayBasisPointsPerTick: 100,
              },
            }
          : e,
      ),
    }
    const converted = createCurrentTargetingSkillVersion(custom)!
    expect(converted).toMatchObject({
      apCost: 60,
      media: { iconKey: 'owner.custom' },
      flavorLine: 'Owner flavor',
      target: { geometryVersion: 2, maximumElevationDifference: 2 },
    })
    expect(converted.effects).toEqual(custom.effects)
    expect(converted.cooldown).toEqual(custom.cooldown)
  })
  it('does not re-normalize or rebalance versioned targeting through historical V5.1 normalization', () => {
    const current = resolveMatureSkillVersion('cinderweaver.ember-line')!
    const custom = {
      ...current,
      target: {
        ...current.target,
        geometryVersion: 2 as const,
        minimumRange: 0,
        maximumRange: 3,
        maximumElevationDifference: 2,
      },
    }
    expect(applyV51CurrentTechniqueTargeting(custom)).toEqual(custom)
  })
})
