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
  it('explains repeated hits once while preserving their separate summary magnitudes', () => {
    const skill = resolveMatureSkillVersion('runeblade.siphon-slash')!
    const effects = [
      { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 2 },
      { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 3 },
    ]
    expect(skillPreviewEffects({ ...skill, effects })).toHaveLength(1)
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
