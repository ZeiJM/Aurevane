import { describe, expect, it } from 'vitest'
import {
  parsePercentageBasisPoints,
  validateCurrentPercentageDotAuthoring,
} from './combat-percentage-dots'
import { resolveMatureSkillVersion } from './mature-skills'

describe('exact percentage authoring', () => {
  it.each([
    ['12.34', 1234],
    ['0.01', 1],
    ['100', 10000],
    ['25.00', 2500],
  ])('parses %s exactly', (text, result) => expect(parsePercentageBasisPoints(text)).toBe(result))
  it.each(['', 'NaN', 'Infinity', '12.345', '1e1', '-1', '0', '100.01', ' 12.34 '])(
    'rejects %s instead of silently clamping',
    (text) => expect(() => parsePercentageBasisPoints(text)).toThrow(),
  )
  it('allows zero decay explicitly', () => expect(parsePercentageBasisPoints('0', true)).toBe(0))
  it('requires hostile attack damage with compatible recipients', () => {
    const skill = resolveMatureSkillVersion('ravager.gash')!
    expect(() => validateCurrentPercentageDotAuthoring(skill)).not.toThrow()
    expect(() => validateCurrentPercentageDotAuthoring({ ...skill, tags: [] })).toThrow(/attack/)
    expect(() =>
      validateCurrentPercentageDotAuthoring({
        ...skill,
        effects: skill.effects.filter((effect) => effect.type !== 'damage'),
      }),
    ).toThrow(/damage/i)
    expect(() =>
      validateCurrentPercentageDotAuthoring({
        ...skill,
        effects: skill.effects.map((effect) =>
          effect.type === 'bleed' ? { ...effect, recipient: 'affected-units' as const } : effect,
        ),
        target: { ...skill.target, shape: { kind: 'circle' as const, radius: 2 } },
      }),
    ).toThrow(/recipient/i)
    expect(() =>
      validateCurrentPercentageDotAuthoring({
        ...skill,
        effects: [{ type: 'apply-status', recipient: 'primary-unit', statusId: 'burn', stacks: 1 }],
      }),
    ).toThrow(/typed/i)
    expect(() =>
      validateCurrentPercentageDotAuthoring({
        ...skill,
        effects: [{ type: 'bleed', recipient: 'primary-unit', damagePerTick: 2, ticks: 3 }],
      }),
    ).toThrow(/percentage/i)
  })
})
