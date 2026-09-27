import { describe, expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { previewEffect, skillPreviewEffects } from './skill-effect-preview'

describe('compact Technique explanations', () => {
  it('keeps Haste a reduction with its floor and preserves facing magnitudes', () => {
    expect(
      previewEffect({ type: 'apply-status', recipient: 'actor', statusId: 'haste', stacks: 1 })
        .explanation,
    ).toContain('minimum of 10 AP')
    expect(
      skillPreviewEffects(resolveMatureSkillVersion('shadehand.backstab')!)[0].explanation,
    ).toContain('front 100%, side 130%, rear 170%')
  })
  it('returns one explanation line for every authored effect', () => {
    const skill = resolveMatureSkillVersion('runeblade.siphon-slash')!
    const effects = [
      { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 2 },
      { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 3 },
    ]
    expect(skillPreviewEffects({ ...skill, effects })).toHaveLength(2)
  })

  it('deduplicates legacy/current aliases in generated Cleanse wording', () => {
    const skill = resolveMatureSkillVersion('runeblade.unbinding-rune')!
    const cleanse = skillPreviewEffects(skill).find((effect) => effect.label === 'Cleanse')
    expect(cleanse).toBeDefined()
    expect(cleanse!.explanation.match(/Marked/g) ?? []).toHaveLength(1)
  })

  it('uses an authored player-facing description without changing the combat effect', () => {
    const skill = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
    const before = JSON.stringify(skill.effects)
    const preview = skillPreviewEffects({
      ...skill,
      effectDescriptions: ['A concise player-facing description.'],
    })

    expect(preview[0]?.explanation).toBe('A concise player-facing description.')
    expect(JSON.stringify(skill.effects)).toBe(before)
  })
  it('distinguishes current Accuracy Mark from historical damage Marked and linked tradeoffs', () => {
    const status = (statusId: string) =>
      previewEffect({ type: 'apply-status', recipient: 'primary-unit', statusId, stacks: 1 })
    expect(status('mark').magnitude).toBe('+15 pp Accuracy')
    expect(status('marked').magnitude).toBe('+20% incoming')
    expect(status('reckless').magnitude).toBe('+40% outgoing / +25% incoming')
    expect(status('fortified').magnitude).toBe('−30% incoming / −20% outgoing')
    expect(status('guarded').magnitude).toBe('−15% incoming/stack')
  })
})
