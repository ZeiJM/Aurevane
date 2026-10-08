import { createCurrentGroundSkillVersion } from './combat-ground-roster'
import { describe, expect, it } from 'vitest'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
  toCombatActionDefinition,
  validateMatureSkillDefinition,
} from './mature-skills'

const ground = { durationRounds: 3, visualPresetId: 'embers' as const, entryEffectOrdinals: [0, 1] }
describe('immutable persistent Ground definitions', () => {
  it('defaults direct Ground damage to two rounds without inventing entry ticks for pure terrain', () => {
    const current = resolveMatureSkillVersion('cinderweaver.flame-burst')!
    const old = resolveMatureSkillVersion(current.id, current.contentVersion - 1)!
    const direct = { ...old, effects: old.effects.filter((effect) => effect.type === 'damage') }
    expect(createCurrentGroundSkillVersion(direct)?.groundArea).toEqual({
      durationRounds: 2,
      visualPresetId: 'embers',
      entryEffectOrdinals: [0],
    })
    const terrain = {
      ...old,
      effects: [
        {
          type: 'create-terrain' as const,
          recipient: 'affected-tiles' as const,
          terrain: 'frozen' as const,
          durationTurns: 2,
        },
      ],
    }
    expect(createCurrentGroundSkillVersion(terrain)).toBeNull()
    expect(createCurrentGroundSkillVersion(current)).toBeNull()
  })
  it('gives Flame Burst an explicit three-round area with damage and Burn entry effects', () => {
    const current = resolveMatureSkillVersion('cinderweaver.flame-burst')!
    expect(current).toHaveProperty('groundArea', ground)
    expect(toCombatActionDefinition(current, 'pve')).toHaveProperty('groundArea', ground)
    const old = resolveMatureSkillVersion(current.id, current.contentVersion - 1)!
    expect(old).not.toHaveProperty('groundArea')
    expect(old.target).toEqual(current.target)
    expect(old.effects).toEqual(current.effects)
    expect(old.apCost).toBe(current.apCost)
  })
  it('uses the existing repeated lifetime for Poison and excludes terrain operations from entry', () => {
    expect(resolveMatureSkillVersion('wildwarden.venom-shot')).toHaveProperty('groundArea', {
      durationRounds: 4,
      visualPresetId: 'arcane-pulse',
      entryEffectOrdinals: [0, 1],
    })
    const mist = resolveMatureSkillVersion('frostweaver.chilling-mist')!
    expect(mist).toHaveProperty('groundArea.durationRounds', 2)
    expect(mist).toHaveProperty('groundArea.visualPresetId', 'frost')
    const selected = (
      mist as typeof mist & { groundArea: { entryEffectOrdinals: readonly number[] } }
    ).groundArea?.entryEffectOrdinals
    expect(selected?.map((index) => mist.effects[index]!.type)).toEqual([
      'apply-status',
      'apply-status',
    ])
  })
  it('rejects malformed lifetime, animation, timing and entry operations in Skill authoring', () => {
    const base = resolveMatureSkillVersion('cinderweaver.flame-burst')!
    for (const invalid of [
      { ...ground, durationRounds: 0 },
      { ...ground, durationRounds: 5 },
      { ...ground, visualPresetId: 'javascript:evil' },
      { ...ground, timing: 'later' },
      { ...ground, entryEffectOrdinals: [] },
      { ...ground, entryEffectOrdinals: [99] },
      { ...ground, entryEffectOrdinals: [0, 0] },
      { ...ground, entryEffectOrdinals: [1] },
    ])
      expect(
        validateMatureSkillDefinition({ ...base, groundArea: invalid } as typeof base),
      ).toContain('groundArea')
    expect(
      validateMatureSkillDefinition({
        ...base,
        groundArea: ground,
        effects: [
          { type: 'displace', recipient: 'affected-units', direction: 'push', distance: 1 },
          base.effects[1]!,
        ],
      } as typeof base),
    ).toContain('groundArea')
  })
  it('keeps all current roster definitions valid and only gives eligible Ground Skills an area', () => {
    for (const skill of latestEnabledMatureSkills()) {
      expect(validateMatureSkillDefinition(skill), skill.id).toEqual([])
      const area = (skill as typeof skill & { groundArea?: unknown }).groundArea
      if (
        skill.target.kind === 'ground-tile' &&
        skill.effects.some(
          (effect) =>
            effect.recipient !== 'actor' &&
            ['damage', 'apply-status', 'healing', 'poison', 'burn', 'bleed'].includes(effect.type),
        )
      )
        expect(area, skill.id).toBeDefined()
      else expect(area, skill.id).toBeUndefined()
    }
  })
})
