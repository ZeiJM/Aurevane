import { describe, expect, it } from 'vitest'
import { resolveMatureSkillVersion, validateMatureSkillDefinition } from './mature-skills'
import { resolveEssenceForBuild } from './essence'
import {
  createPercentageDotSkillVersion,
  createPercentageDotEssenceVersion,
} from './combat-percentage-dot-roster'

function percentageSkill(id: string) {
  const current = resolveMatureSkillVersion(id)!
  return current.target.geometryVersion === 2
    ? resolveMatureSkillVersion(id, current.contentVersion - 1)!
    : current
}
function percentageEssence(discipline: string) {
  const current = resolveEssenceForBuild(discipline, null)!
  return current.skill.target.geometryVersion === 2
    ? resolveEssenceForBuild(discipline, null, current.contentVersion - 1)!
    : current
}

const rows = [
  ['ravager.gash', 'bleed', 2000, 3],
  ['edgedancer.severing-cut', 'bleed', 1500, 3],
  ['wildwarden.venom-shot', 'poison', 1500, 4],
  ['cinderweaver.cinder-bolt', 'burn', 2500, 3],
  ['cinderweaver.flame-burst', 'burn', 2000, 3],
  ['cinderweaver.ember-line', 'burn', 2000, 3],
  ['cinderweaver.blistering-heat', 'burn', 1500, 3],
] as const

describe('immutable percentage DoT roster', () => {
  it.each(rows)(
    'publishes %s with %s at %i basis points for %i ticks',
    (id, type, basisPoints, ticks) => {
      const current = percentageSkill(id)
      const effect = current.effects.find((effect) => effect.type === type)!
      expect(effect).toMatchObject({
        damageProfile: {
          kind: 'attack-percentage',
          basisPoints,
          ...(type === 'burn' ? { decayBasisPointsPerTick: 500 } : {}),
        },
      })
      expect(
        type === 'bleed' && effect.type === 'bleed' ? effect.ticks : effect.durationTurns,
      ).toBe(ticks)
      expect(validateMatureSkillDefinition(current)).toEqual([])
      const old = Array.from({ length: current.contentVersion - 1 }, (_, index) =>
        resolveMatureSkillVersion(id, index + 1),
      )
        .filter(
          (definition): definition is NonNullable<typeof definition> =>
            definition !== null &&
            !definition.effects.some((effect) => effect.type === type && 'damageProfile' in effect),
        )
        .at(-1)!
      expect(old.effects.find((effect) => effect.type === type)).not.toHaveProperty('damageProfile')
      expect(resolveMatureSkillVersion(id, old.contentVersion)).toEqual(old)
    },
  )
  it.each([
    ['ravager', 2000],
    ['cinderweaver', 2500],
  ] as const)('appends a percentage Essence for %s', (discipline, basisPoints) => {
    const current = percentageEssence(discipline)
    const effect = current.skill.effects.find(
      (effect) => effect.type === 'burn' || effect.type === 'bleed',
    )!
    expect(effect).toMatchObject({ damageProfile: { kind: 'attack-percentage', basisPoints } })
    const old = resolveEssenceForBuild(discipline, null, current.contentVersion - 1)!
    expect(createPercentageDotEssenceVersion(old)).toEqual(current)
  })
  it('adds the specified Blistering Heat attack while preserving its Slow, targeting and cooldown', () => {
    const current = percentageSkill('cinderweaver.blistering-heat')
    const old = resolveMatureSkillVersion(current.id, current.contentVersion - 1)!
    expect(current.apCost).toBe(50)
    expect(current.mpCost).toBe(3)
    expect(current.tags).toEqual(expect.arrayContaining(['attack', 'mystic', 'cockpit:attack']))
    expect(current.effects[0]).toMatchObject({
      type: 'damage',
      element: 'fire',
      amount: 6,
      recipient: 'primary-unit',
    })
    expect(current.effects.find((effect) => effect.type === 'apply-status')).toEqual(
      old.effects.find((effect) => effect.type === 'apply-status'),
    )
    expect(current.target).toEqual(old.target)
    expect(current.cooldown).toEqual(old.cooldown)
  })
  it('preserves unrelated Owner fields and already authored percentages', () => {
    const current = percentageSkill('ravager.gash')
    const old = resolveMatureSkillVersion(current.id, current.contentVersion - 1)!
    const custom = {
      ...old,
      apCost: 60,
      flavorLine: 'Owner flavor',
      media: { ...old.media, iconKey: 'custom' },
    }
    const converted = createPercentageDotSkillVersion(custom)!
    expect(converted).toMatchObject({
      apCost: 60,
      flavorLine: 'Owner flavor',
      media: { iconKey: 'custom' },
    })
    const edited = {
      ...converted,
      effects: converted.effects.map((effect) =>
        effect.type === 'bleed'
          ? {
              ...effect,
              damagePerTick: undefined,
              damageProfile: { kind: 'attack-percentage' as const, basisPoints: 1234 },
            }
          : effect,
      ),
    }
    expect(createPercentageDotSkillVersion(edited)).toBeNull()
  })
})
