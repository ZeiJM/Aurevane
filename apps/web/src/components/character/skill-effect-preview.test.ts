import { describe, expect, it } from 'vitest'

it('describes current Copy as beneficial tags while retaining pinned historical Skill Copy', () => {
  const effect = { type: 'copy' as const, recipient: 'primary-unit' as const }
  expect(previewEffect(effect).label).toBe('Copy')
  expect(previewEffect(effect).explanation).toContain('beneficial')
  expect(previewEffect(effect).explanation).not.toContain('Skill for this battle')
  expect(previewEffect(effect, null).label).toBe('Skill Copy')
  expect(previewEffect(effect, null).explanation).toContain('half AP')
})
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { previewEffect, skillPreviewEffects } from './skill-effect-preview'

describe('compact Technique explanations', () => {
  it('replaces stale authored Skill Copy prose only for the current Copy policy', () => {
    const skill = {
      ...resolveMatureSkillVersion('runeblade.siphon-slash')!,
      effects: [{ type: 'copy' as const, recipient: 'primary-unit' as const }],
      effectDescriptions: ['Steal a random Skill for this battle at half AP.'],
    }
    expect(skillPreviewEffects(skill)[0]?.explanation).toContain('beneficial')
    expect(skillPreviewEffects(skill)[0]?.explanation).not.toContain('random Skill')
    expect(skillPreviewEffects(skill, null)[0]?.explanation).toBe(skill.effectDescriptions[0])
  })
  it.each([
    ['inspired', '+11% outgoing', 'Deal 11% more damage'],
    ['warded', '−11% incoming', 'Take 11% less damage from opponents affected by Burn'],
    ['reckless', '+11% outgoing / +11% incoming', 'Deal 11% more damage and take 11% more damage'],
    ['fortified', '−11% incoming / −11% outgoing', 'Take 11% less damage and deal 11% less damage'],
    ['mark', '+11 pp Accuracy', '+11 percentage points Accuracy'],
    ['blind', '−11 pp Accuracy', 'Lose 11 percentage points Accuracy'],
  ])(
    'shows actual authored %s potency in magnitude and explanation',
    (statusId, magnitude, explanation) => {
      const preview = previewEffect({
        type: 'apply-status',
        recipient: 'actor',
        statusId,
        stacks: 1,
        potencyBasisPoints: 1100,
      })
      expect(preview.magnitude).toBe(magnitude)
      expect(preview.explanation).toContain(explanation)
    },
  )
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
