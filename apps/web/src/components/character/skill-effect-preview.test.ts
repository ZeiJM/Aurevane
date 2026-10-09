import { describe, expect, it } from 'vitest'

import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { previewEffect, skillPreviewEffects } from './skill-effect-preview'
import { skillEffectDescription, skillEffectSummaries } from './skill-detail-presentation'

it('reports Airborne Jump and Attack elevation without rewriting historical readers', () => {
  const effect = {
    type: 'apply-status' as const,
    recipient: 'actor' as const,
    statusId: 'airborne',
    stacks: 1,
    durationTurns: 2,
  }
  expect(previewEffect(effect).explanation).toContain('Your Jump is 3')
  expect(skillEffectDescription(effect)).toContain('Target Elevation 3')
  expect(previewEffect(effect, { legacyAirborneJump: true }).explanation).not.toContain(
    'Your Jump is 3',
  )
  expect(previewEffect(effect, { legacyAirborneJump: true }).explanation).toContain(
    'Target Elevation 3',
  )
})

it('describes the granting Skill’s authored Blindside side and rear percentages', () => {
  const effect = {
    type: 'apply-status' as const,
    recipient: 'actor' as const,
    statusId: 'blindside',
    stacks: 1,
    durationTurns: 1,
    blindsideModifiersBasisPoints: { side: 17550, rear: 25000 },
  }
  expect(previewEffect(effect).explanation).toContain('175.5% from the side and 250% from the rear')
  expect(skillEffectDescription(effect)).toContain('175.5% from the side and 250% from the rear')
})

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
    ['fire', 'removes Drenched and Chilled'],
    ['storm', 'consumes the old Conductive charge'],
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
      else expect(preview.explanation).toContain('+20% Storm damage')
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
    const current = resolveMatureSkillVersion('shadehand.backstab')!
    expect(
      skillPreviewEffects(current).find((effect) => effect.label === 'Blindside')!.explanation,
    ).toContain('160% from the side and 220% from the rear')
    expect(
      skillPreviewEffects(
        resolveMatureSkillVersion('shadehand.backstab', current.contentVersion - 1)!,
      )[0].explanation,
    ).toContain('front 100%, side 130%, rear 170%')
  })
  it('shares one explanation for identical effect meaning while parameters retain authored applications', () => {
    const skill = resolveMatureSkillVersion('runeblade.siphon-slash')!
    const effects = [
      { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 2 },
      { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 3 },
    ]
    expect(skillPreviewEffects({ ...skill, effects })).toHaveLength(1)
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

it('shows captured percentage HP/MP recovery without offensive Power', () => {
  const result = previewEffect({
    type: 'percentage-recovery',
    recipient: 'actor',
    resource: 'hp',
    percent: 12,
    ticks: 3,
  })
  expect(result).toMatchObject({ label: 'HP Recovery', magnitude: '12%' })
  expect(result.explanation).toContain('maximum HP')
  expect(result.explanation).toContain('captured')
})

it('Healing Down Skill readers explain both resources and respect historical battle rules', () => {
  const effect = {
    type: 'apply-status' as const,
    recipient: 'primary-unit' as const,
    statusId: 'hexed',
    stacks: 1,
    potencyBasisPoints: 1400,
  }
  expect(previewEffect(effect)).toMatchObject({
    label: 'Healing Down',
    magnitude: '−14% HP/MP recovery',
    explanation: 'Receive 14% less HP and MP recovery.',
  })
  expect(previewEffect(effect, { legacyHealingDown: true })).toMatchObject({
    magnitude: '−14% healing',
    explanation: 'Receive 14% less healing.',
  })
})

it('shows Damage before Blindside for every granting Skill without mutating execution order', () => {
  const skills = [
    ...latestEnabledMatureSkills(),
    resolveEssenceForBuild('shadehand', null)!.skill,
  ].filter((skill) =>
    skill.effects.some(
      (effect) => effect.type === 'apply-status' && effect.statusId === 'blindside',
    ),
  )
  expect(skills.length).toBeGreaterThanOrEqual(5)
  for (const skill of skills) {
    const before = JSON.stringify(skill)
    expect(skillEffectSummaries(skill)[0]).toMatch(/Dmg/)
    expect(skillEffectSummaries(skill)[1]).toMatch(/Blindside/)
    expect(skillPreviewEffects(skill)[0]?.label).toMatch(/Dmg/)
    expect(skillPreviewEffects(skill)[1]?.label).toBe('Blindside')
    expect(JSON.stringify(skill)).toBe(before)
  }
})

it('explains current typed damage, captured bonuses and caster cleanse', () => {
  expect(
    previewEffect({ type: 'damage', recipient: 'primary-unit', amount: 10, element: 'ice' }),
  ).toMatchObject({ label: 'Ice Dmg', explanation: expect.stringContaining('Chilled') })
  expect(
    previewEffect({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 10,
      element: 'water',
      potencyBasisPoints: 3500,
      durationTurns: 3,
    }).explanation,
  ).toContain('35%')
  expect(
    previewEffect({ type: 'damage', recipient: 'primary-unit', amount: 10, element: 'water' })
      .explanation,
  ).toContain('Initiative by 10%')
  expect(
    previewEffect({ type: 'damage', recipient: 'primary-unit', amount: 10, element: 'fire' })
      .explanation,
  ).toContain('caster')
})

it('explains implicit elemental timing using the captured status timing override', () => {
  const water = {
    type: 'damage' as const,
    recipient: 'primary-unit' as const,
    amount: 10,
    element: 'water' as const,
    durationTurns: 0,
  }
  expect(previewEffect(water).explanation).toContain('2 affected turns')
  expect(
    previewEffect(water, { timingPolicy: { version: 7, modes: { wet: 'next-round' } } })
      .explanation,
  ).toContain('2 full rounds starting next round')
  expect(
    previewEffect(water, { timingPolicy: { version: 7, modes: { wet: 'delayed' } } }).explanation,
  ).toContain('2 full rounds starting two round boundaries after damage settles')
})

it('keeps captured explicit elemental duration and bonus in authored prose overrides', () => {
  const water = {
    type: 'damage' as const,
    recipient: 'primary-unit' as const,
    amount: 10,
    element: 'water' as const,
    durationTurns: 0,
  }
  const status = {
    type: 'apply-status' as const,
    recipient: 'primary-unit' as const,
    statusId: 'wet',
    stacks: 1,
    durationTurns: 3,
    potencyBasisPoints: 3500,
  }
  const rows = skillPreviewEffects({
    effects: [water, status],
    effectDescriptions: ['A wave strikes.'],
  })
  expect(rows[0]!.explanation).toContain('A wave strikes.')
  expect(rows[0]!.explanation).toContain('3 affected turns')
  expect(rows[0]!.explanation).toContain('35% Storm damage')
})
