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
        explanation:
          'Removes Burn, Bleed, Poison, Slow, Rooted, Vulnerable, Marked, Taunted, Suppress.',
      })
    },
  )
  it.each([
    ['fire', 'Fire converts affected Frozen Ground'],
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
      else expect(preview.explanation).toContain('active Drenched and Conductive bonuses')
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

it('explains saved policy 1 typed damage, captured bonuses and caster cleanse', () => {
  expect(
    previewEffect(
      { type: 'damage', recipient: 'primary-unit', amount: 10, element: 'ice' },
      { explicitElemental: false },
    ),
  ).toMatchObject({ label: 'Ice Dmg', explanation: expect.stringContaining('Chilled') })
  expect(
    previewEffect(
      {
        type: 'damage',
        recipient: 'primary-unit',
        amount: 10,
        element: 'water',
        potencyBasisPoints: 3500,
        durationTurns: 3,
      },
      { explicitElemental: false },
    ).explanation,
  ).toContain('35%')
  expect(
    previewEffect(
      { type: 'damage', recipient: 'primary-unit', amount: 10, element: 'water' },
      { explicitElemental: false },
    ).explanation,
  ).toContain('Initiative by 10%')
  expect(
    previewEffect(
      { type: 'damage', recipient: 'primary-unit', amount: 10, element: 'fire' },
      { explicitElemental: false },
    ).explanation,
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
  expect(previewEffect(water, { explicitElemental: false }).explanation).toContain(
    '2 affected turns',
  )
  expect(
    previewEffect(water, {
      explicitElemental: false,
      timingPolicy: { version: 7, modes: { wet: 'next-round' } },
    }).explanation,
  ).toContain('2 full rounds starting next round')
  expect(
    previewEffect(water, {
      explicitElemental: false,
      timingPolicy: { version: 7, modes: { wet: 'delayed' } },
    }).explanation,
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
  expect(rows[0]!.explanation).not.toContain('3 affected turns')
  expect(rows[1]!.explanation).toContain('3 affected turns')
  expect(rows[1]!.explanation).toContain('35% Storm damage')
})

describe('saved policy 1 elemental recipient overlap explanations', () => {
  const hit = { type: 'damage', recipient: 'affected-units', amount: 10, durationTurns: 0 } as const
  const tuning = {
    type: 'apply-status',
    recipient: 'primary-unit',
    stacks: 1,
    durationTurns: 3,
    potencyBasisPoints: 3500,
  } as const

  it.each([
    ['water', 'wet', 'Drenched'],
    ['ice', 'frozen', 'Chilled'],
    ['storm', 'conductive', 'Conductive'],
  ] as const)(
    'explains the tuned primary recipient and default others for %s damage',
    (element, statusId, name) => {
      const skill = {
        effects: [
          { ...hit, element },
          { ...tuning, statusId },
        ],
      }
      const before = JSON.stringify(skill)
      const explanation = skillPreviewEffects(skill, { explicitElemental: false })[0]!.explanation
      const [primary, others] = explanation.split(' Otherwise:')
      expect(primary).toContain('If a damaged recipient is the primary target:')
      expect(primary).toContain(name)
      expect(primary).toContain('for 3 affected turns')
      expect(others).toContain(name)
      expect(others).toContain('for 2 affected turns')
      if (element !== 'ice') {
        expect(primary).toContain('35% Storm damage')
        expect(others).toContain('20% Storm damage')
        expect(others).not.toContain('35%')
      }
      expect(JSON.stringify(skill)).toBe(before)
    },
  )

  it('uses an affected-unit override only when it covers the damaged primary target', () => {
    const explanation = skillPreviewEffects(
      {
        effects: [
          { ...hit, recipient: 'primary-unit', element: 'water' },
          { ...tuning, recipient: 'affected-units', statusId: 'wet' },
        ],
      },
      { explicitElemental: false },
    )[0]!.explanation
    expect(explanation).toContain('If a damaged recipient is among the affected units:')
    expect(explanation.split(' Otherwise:')[0]).toContain('3 affected turns')
    expect(explanation.split(' Otherwise:')[1]).toContain('2 affected turns')
  })

  it('keeps the first matching explicit profile per recipient and authored description indices', () => {
    const skill = {
      effects: [
        {
          type: 'apply-status',
          recipient: 'actor',
          statusId: 'blindside',
          stacks: 1,
          durationTurns: 1,
        } as const,
        { ...hit, element: 'water' } as const,
        { ...tuning, statusId: 'wet' },
        { ...tuning, statusId: 'wet', durationTurns: 4, potencyBasisPoints: 4500 },
        {
          ...tuning,
          statusId: 'wet',
          recipient: 'affected-units',
          durationTurns: 1,
          potencyBasisPoints: 1500,
        } as const,
      ],
      effectDescriptions: ['Pinned Blindside prose.', 'Pinned Water prose.'],
    }
    const rows = skillPreviewEffects(skill, { explicitElemental: false })
    expect(rows[0]!.explanation).toMatch(/^Pinned Water prose\./)
    const [primary, others] = rows[0]!.explanation.split(' Otherwise:')
    expect(primary).toContain('3 affected turns')
    expect(primary).toContain('35% Storm damage')
    expect(others).toContain('1 affected turns')
    expect(others).toContain('15% Storm damage')
    expect(rows[0]!.explanation).not.toContain('45%')
    expect(rows[0]!.explanation).not.toContain('20% Storm damage')
    expect(rows[1]!.explanation).toBe('Pinned Blindside prose.')
  })

  it('preserves historical descriptions without adding current conditional profiles', () => {
    const rows = skillPreviewEffects(
      {
        effects: [
          { ...hit, element: 'water' },
          { ...tuning, statusId: 'wet' },
        ],
      },
      { legacyElemental: true },
    )
    expect(rows[0]!.explanation).not.toContain('Drenched')
    expect(rows[0]!.explanation).not.toContain('If a damaged recipient')
    expect(rows[1]!.explanation).not.toContain('Initiative')
  })
})

it('current explicit elemental reports put captured status rules on their own row', () => {
  const rows = skillPreviewEffects(
    {
      effects: [
        { type: 'damage', recipient: 'affected-units', amount: 10, element: 'water' },
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'wet',
          stacks: 1,
          durationTurns: 4,
          potencyBasisPoints: 4250,
        },
      ],
    },
    { timingPolicy: { version: 9, modes: { wet: 'delayed' } } },
  )
  expect(rows.map((row) => row.label)).toEqual(['Water Dmg', 'Drenched'])
  expect(rows[0]!.explanation).not.toMatch(
    /applies Drenched|affected turns|full rounds|42.5%|Otherwise/,
  )
  expect(rows[1]!.explanation).toContain('42.5% Storm damage')
  expect(rows[1]!.explanation).toContain(
    '4 full rounds starting two round boundaries after damage settles (Delayed)',
  )
  expect(rows[1]!.explanation).toContain('positive hostile HP damage')
  expect(rows[1]!.explanation).toContain('survives')
  expect(rows[1]!.explanation).not.toContain('Fire removes')
})

it('current damage alone never promises hidden Chilled, Drenched or fresh Conductive', () => {
  for (const element of ['ice', 'water', 'storm'] as const) {
    expect(
      previewEffect({ type: 'damage', recipient: 'primary-unit', amount: 10, element }).explanation,
    ).not.toMatch(/applies Chilled|applies Drenched|applies one fresh Conductive/)
  }
  const fire = previewEffect({
    type: 'damage',
    recipient: 'primary-unit',
    amount: 10,
    element: 'fire',
  }).explanation
  expect(fire).not.toContain('cleanses Chilled from its caster')
  expect(fire).toContain('remaining life')
  expect(fire).not.toMatch(/removes Drenched|cleanses its recipient/)
})

it('reports the visible limited Fire cleanse separately without claiming a full Cleanse', () => {
  const effects = [
    {
      type: 'damage' as const,
      recipient: 'primary-unit' as const,
      amount: 10,
      element: 'fire' as const,
    },
    { type: 'remove-status' as const, recipient: 'actor' as const, statusIds: ['frozen'] },
  ]
  const rows = skillPreviewEffects({ effects })
  expect(rows.map((row) => row.label)).toEqual(['Fire Dmg', 'Cleanse Chilled'])
  expect(rows[0]!.explanation).toContain('Steam')
  expect(rows[0]!.explanation).not.toContain('cleanses Chilled')
  expect(rows[1]!.explanation).toBe('Removes Chilled from the caster only; other statuses remain.')
  expect(rows[1]!.explanation).not.toMatch(/Suppress|Burn|Drenched/)
  expect(skillEffectDescription(effects[1]!)).toBe(rows[1]!.explanation)
  expect(previewEffect({ ...effects[1]!, recipient: 'primary-unit' }).explanation).toBe(
    'Removes Chilled from the selected unit only; other statuses remain.',
  )
})

it('preserves historical frozen-only removal’s Suppress supplement', () => {
  const effect = {
    type: 'remove-status' as const,
    recipient: 'actor' as const,
    statusIds: ['frozen'],
  }
  for (const options of [{ explicitElemental: false }, { legacyElemental: true }]) {
    expect(previewEffect(effect, options)).toMatchObject({
      label: 'Cleanse',
      explanation: 'Removes Chilled, Suppress.',
    })
    expect(skillEffectDescription(effect, options)).toBe('Remove Chilled, Suppress from yourself.')
    expect(previewEffect(effect, options).explanation).not.toContain('other statuses remain')
  }
})

it('shows the separate limited cleanse for every current Fire Skill', () => {
  const skills = latestEnabledMatureSkills().filter((skill) =>
    skill.effects.some((effect) => effect.type === 'damage' && effect.element === 'fire'),
  )
  expect(skills.length).toBeGreaterThan(0)
  for (const skill of skills) {
    const rows = skillPreviewEffects(skill)
    expect(rows.filter((row) => row.label === 'Cleanse Chilled')).toHaveLength(1)
    expect(rows.find((row) => row.label === 'Cleanse Chilled')!.explanation).toBe(
      'Removes Chilled from the caster only; other statuses remain.',
    )
    const damage = rows.filter((row) => row.label === 'Fire Dmg')
    expect(damage.length).toBeGreaterThan(0)
    for (const row of damage)
      expect(row.explanation).not.toMatch(/cleanses Chilled|removes Drenched|removes Wet/)
  }
})
