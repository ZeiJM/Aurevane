import { describe, expect, it } from 'vitest'

import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { previewEffect, skillPreviewEffects } from './skill-effect-preview'

describe('compact Technique explanations', () => {
  it.each(['bastion.steady-footing', 'frostweaver.thaw', 'stormsinger.grounding'])(
    'describes the complete canonical Cleanse on %s',
    (id) => {
      const skill = resolveMatureSkillVersion(id)!
      const effect = skill.effects.find((entry) => entry.type === 'remove-status')!
      expect(previewEffect(effect)).toMatchObject({
        label: 'Cleanse',
        explanation: 'Removes Burn, Bleed, Poison, Slow, Rooted, Vulnerable, Marked, Taunted.',
      })
    },
  )
  it.each([
    ['fire', 'removes Wet and Frozen'],
    ['storm', 'consumes Conductive; Wet remains'],
  ] as const)(
    'explains %s interactions without repeating the displayed power',
    (element, interaction) => {
      const preview = previewEffect({
        type: 'damage',
        recipient: 'primary-unit',
        amount: 9,
        element,
      })
      expect(preview.magnitude).toBe('9')
      expect(preview.explanation).toContain('Skill power ranges from 1 to 20')
      expect(preview.explanation).toContain(interaction)
      expect(preview.explanation).not.toContain('9 power')
      if (element === 'fire') expect(preview.explanation).toContain('Steam')
      else expect(preview.explanation).toContain('20% per active Wet or Conductive')
    },
  )
  it('does not invent an elemental interaction for untyped or Water damage', () => {
    for (const element of [undefined, 'water'] as const) {
      const preview = previewEffect({
        type: 'damage',
        recipient: 'primary-unit',
        amount: 9,
        element,
      })
      expect(preview.explanation).not.toMatch(/9 power|Steam|consumes Conductive|applies Wet/)
    }
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
  it('shows current Accuracy Mark and linked tradeoffs', () => {
    const status = (statusId: string) =>
      previewEffect({ type: 'apply-status', recipient: 'primary-unit', statusId, stacks: 1 })
    expect(status('mark').magnitude).toBe('+15 pp Accuracy')
    expect(status('reckless').magnitude).toBe('+40% outgoing / +25% incoming')
    expect(status('fortified').magnitude).toBe('−30% incoming / −20% outgoing')
    expect(status('guarded').magnitude).toBe('−15% incoming')
  })
})
