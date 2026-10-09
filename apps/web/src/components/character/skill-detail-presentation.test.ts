import { describe, expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import {
  compactSkillEffectSummaryParts,
  skillCompactRangeDescription,
  skillCooldownDescription,
  skillCostDescription,
  skillEffectDescription,
  skillEffectSummaries,
  skillEffectsSummary,
  skillLineOfSightDescription,
  skillRequirementDescription,
  skillRequirementsSummary,
  skillTargetDescription,
  skillTargetElevationDescription,
  skillTargetMethodDescription,
  skillTargetTags,
  skillTypeDescription,
  skillParameterRows,
} from './skill-detail-presentation'

it('uses Self/Ally only when the friendly Skill can actually include its caster', () => {
  const mend = resolveMatureSkillVersion('lifebinder.mend')!
  const target = {
    ...mend.target,
    geometryVersion: 2 as const,
    kind: 'unit' as const,
    teamPolicy: 'ally' as const,
    friendlyFire: 'allies-only' as const,
    minimumRange: 0,
    shape: { kind: 'single' as const },
  }
  expect(skillTargetDescription({ target })).toBe('Self/Ally')
  expect(skillTargetTags({ ...mend, target })[0]).toBe('Self/Ally')
  const circle = { ...target, shape: { kind: 'circle' as const, radius: 1 } }
  expect(skillTargetDescription({ target: circle })).toBe('Ally')
  expect(skillTargetTags({ ...mend, target: circle })[0]).toBe('Ally')
  expect(skillTargetDescription({ target: { ...target, minimumRange: 1 } })).toBe('Ally')
  expect(skillTargetDescription({ target: { ...target, friendlyFire: 'all-except-actor' } })).toBe(
    'Ally',
  )
})

it('marks instant effects from their timing tags, retaining duration and excluding direct damage', () => {
  const effect = {
    type: 'apply-status' as const,
    recipient: 'actor' as const,
    statusId: 'guarded',
    stacks: 1,
    durationTurns: 2,
  }
  expect(compactSkillEffectSummaryParts(effect).timing).toBeUndefined()
  expect(
    compactSkillEffectSummaryParts(effect, { version: 2, modes: { guarded: 'instant' } }),
  ).toMatchObject({ duration: '2 Turns', timing: 'Instant' })
  expect(compactSkillEffectSummaryParts(effect, null).timing).toBe('Instant')
  expect(
    compactSkillEffectSummaryParts({ type: 'healing', recipient: 'actor', amount: 5 }).timing,
  ).toBe('Instant')
  expect(
    compactSkillEffectSummaryParts({
      type: 'resource-change',
      recipient: 'actor',
      resource: 'mp',
      delta: -5,
    }).timing,
  ).toBeUndefined()
  expect(
    compactSkillEffectSummaryParts(
      { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: -5 },
      { version: 2, modes: { 'mp-drain': 'instant' } },
    ).timing,
  ).toBe('Instant')
  expect(
    compactSkillEffectSummaryParts(
      { type: 'damage', recipient: 'primary-unit', amount: 9 },
      defaultCombatEffectTimingPolicy(),
    ).timing,
  ).toBeUndefined()
})

it('keeps configured timing in the text report for mixed damage and utility effects', () => {
  const skill = resolveMatureSkillVersion('cinderweaver.cinder-bolt')!
  const summaries = skillEffectSummaries(skill, { version: 2, modes: { burn: 'instant' } })
  expect(summaries[0]).not.toContain('Instant')
  expect(summaries[1]).toContain('[Instant]')
})

describe('Player-facing Skill targeting and effects', () => {
  it('uses Chilled for Shatter requirements without changing the stored Frozen tag', () => {
    const shatter = resolveMatureSkillVersion('frostweaver.shatter')!
    const before = JSON.stringify(shatter)
    expect(skillRequirementsSummary(shatter)).toBe('Target: Chilled')
    expect(skillRequirementDescription(shatter.requirements[0]!)).toBe('Target must have Chilled.')
    expect(shatter.requirements).toContainEqual({ kind: 'target-tag-present', tag: 'Frozen' })
    expect(JSON.stringify(shatter)).toBe(before)
  })
  it('distinguishes ranged area targeting from self recovery without changing the definition', () => {
    const volley = resolveMatureSkillVersion('farstrider.volley')!
    const before = JSON.stringify(volley)
    expect(skillTargetTags(volley)).toEqual(['Enemy', 'Circle [1]', 'Dmg [10]'])
    expect(skillCompactRangeDescription(volley)).toBe('1')
    expect(Object.fromEntries(skillParameterRows(volley)).Target).toBe('Enemy')
    const breath = resolveMatureSkillVersion('ironfist.focus-breath')!
    expect(skillTargetTags(breath)).toEqual([
      'Self',
      'Single',
      'HP Recovery [12%]',
      'MP Recovery [7%]',
    ])
    expect(skillCompactRangeDescription(breath)).toBe('N/A')
    expect(JSON.stringify(volley)).toBe(before)
  })
  it('describes prerequisites, negative resource changes, and facing explicitly', () => {
    expect(skillRequirementDescription({ kind: 'actor-status-present', statusId: 'guarded' })).toBe(
      'Requires Guard on yourself.',
    )
    expect(
      skillRequirementDescription({ kind: 'target-status-present', statusId: 'exposed' }),
    ).toBe('Target must have Vulnerable.')
    expect(skillRequirementDescription({ kind: 'actor-hp-at-most', basisPoints: 5000 })).toBe(
      'Requires your HP at 50% or below.',
    )
    expect(
      skillEffectDescription({
        type: 'resource-change',
        resource: 'mp',
        delta: -5,
        recipient: 'primary-unit',
      }),
    ).toBe('Remove 5 MP from the selected unit.')
    const backstab = resolveMatureSkillVersion('shadehand.backstab')!
    expect(skillEffectDescription(backstab.effects[0]!)).toContain(
      '160% from the side and 220% from the rear',
    )
    const historical = resolveMatureSkillVersion('shadehand.backstab', backstab.contentVersion - 1)!
    expect(skillEffectDescription(historical.effects[0]!)).toContain(
      'front 100%, side 130%, rear 170%',
    )
  })
})

it('names a linked tradeoff and explains both halves on the correct recipient', () => {
  const frenzy = resolveMatureSkillVersion('ravager.frenzy')!
  expect(skillTargetTags(frenzy)).toEqual(['Self', 'Single', 'Reckless'])
  const description = skillEffectDescription(frenzy.effects[0]!)
  expect(description).toContain('to yourself')
  expect(description).toContain('Deal 40% more damage and take 25% more damage')
  expect(description).toContain('expire or are removed together')
})
it('describes source-specific modifiers, cleansing and periodic timing', () => {
  const mark = resolveMatureSkillVersion('wildwarden.hunters-mark')!
  expect(skillEffectDescription(mark.effects[0]!)).toContain('Other attackers gain no benefit')
  const currentBurn = resolveMatureSkillVersion('cinderweaver.cinder-bolt')!
  const burn = Array.from({ length: currentBurn.contentVersion }, (_, index) =>
    resolveMatureSkillVersion(currentBurn.id, currentBurn.contentVersion - index),
  ).find((definition) =>
    definition?.effects.some(
      (effect) => effect.type === 'burn' && effect.damageProfile === undefined,
    ),
  )!
  expect(skillEffectDescription(burn.effects[1]!)).toContain('2, then 1, then 1')
  expect(skillEffectDescription(burn.effects[1]!)).toContain('end-turn boundaries')
  expect(skillTargetTags(resolveMatureSkillVersion('runeblade.unbinding-rune')!)).toContain(
    'Cleanse',
  )
})

it('distinguishes enemy MP drain from the user’s restoration in one Skill', () => {
  expect(skillTargetTags(resolveMatureSkillVersion('runeblade.siphon-slash')!)).toEqual([
    'Enemy',
    'Single',
    'Dmg [13]',
    'MP Drain [7]',
    'MP Recovery [7%] · Self',
  ])
  expect(skillTargetTags(resolveMatureSkillVersion('ravager.blood-siphon')!)).toEqual(
    expect.arrayContaining([expect.stringMatching(/^HP Recovery \[\d+%\] · Self$/)]),
  )
})

it('explains elemental interactions and typed status aliases without changing historical targeting', () => {
  const fire = skillEffectDescription({
    type: 'damage',
    recipient: 'affected-units',
    amount: 10,
    element: 'fire',
  })
  expect(fire).not.toContain('cleanses Chilled from its caster')
  expect(fire).not.toContain('removes Drenched and Chilled')
  expect(fire).toContain('Steam')
  const storm = skillEffectDescription({
    type: 'damage',
    recipient: 'primary-unit',
    amount: 10,
    element: 'storm',
  })
  expect(storm).toContain('active Drenched and Conductive bonuses')
  expect(storm).toContain('consumes the old Conductive charge')
  expect(storm).not.toContain('applies one fresh Conductive')
  expect(
    skillEffectDescription({
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'burn',
      stacks: 1,
    }),
  ).toContain('Burn')
  expect(
    Object.fromEntries(skillParameterRows(resolveMatureSkillVersion('frostweaver.chilling-mist')!))
      .Target,
  ).toContain('Frozen Ground: caster’s enemies only')
})

it('shows the executable element and canonical status names on current Technique tags', () => {
  const fire = resolveMatureSkillVersion('cinderweaver.cinder-bolt')!
  expect(skillTargetTags(fire).some((tag) => /^Fire Dmg \[\d+\]$/.test(tag))).toBe(true)
  expect(skillTargetTags(fire)).toContain('Burn [25% → 20% → 15%] [3 turns]')
  expect(
    skillTargetTags(resolveMatureSkillVersion('stormsinger.arc-spark')!).some((tag) =>
      /^Storm Dmg \[\d+\]$/.test(tag),
    ),
  ).toBe(true)
  expect(skillTargetTags(resolveMatureSkillVersion('ravager.gash')!)).toContain(
    'Bleed [20%] [3 turns]',
  )
  expect(
    skillTargetTags(resolveMatureSkillVersion('cinderweaver.cinder-bolt', 1)!).some((tag) =>
      tag.startsWith('Fire Dmg'),
    ),
  ).toBe(false)
})

it('keeps Cleanse while no longer inventing retired Summoned dispel behavior', () => {
  expect(skillTargetTags(resolveMatureSkillVersion('runeblade.aether-cut')!)).not.toContain(
    'Dispel',
  )
  expect(skillTargetTags(resolveMatureSkillVersion('tidecaller.cleansing-rain')!)).toContain(
    'Cleanse',
  )
})

it('describes actual displacement distance and recovery timing rather than legacy fixed text', () => {
  expect(
    skillEffectDescription({
      type: 'displace',
      recipient: 'primary-unit',
      direction: 'pull',
      distance: 3,
    }),
  ).toContain('Pull the selected unit up to 3 tiles')
  expect(
    skillEffectDescription({ type: 'healing', recipient: 'primary-unit', amount: 4, ticks: 3 }),
  ).toContain('3 total applications')
  expect(
    skillEffectDescription({
      type: 'resource-change',
      recipient: 'primary-unit',
      resource: 'mp',
      delta: 4,
      ticks: 2,
    }),
  ).toContain('2 total applications')
})

it('describes authored Barrier grants in Skill Details', () => {
  const barrier = {
    type: 'barrier-change',
    recipient: 'primary-unit',
    amount: 12,
  } as unknown as Parameters<typeof skillEffectDescription>[0]

  expect(skillEffectDescription(barrier)).toBe('Grant up to 12 Barrier to the selected unit.')
})

it('presents the standardized Technique characteristic schema without prose expansion', () => {
  const timeLock = resolveMatureSkillVersion('chronist.time-lock')!
  const stolenMoment = resolveMatureSkillVersion('chronist.stolen-moment')!

  expect(skillTypeDescription(timeLock)).toBe('Utility')
  expect(skillCostDescription(timeLock)).toMatch(/AP/)
  expect(skillEffectsSummary(timeLock)).toContain('Root')
  expect(skillEffectsSummary(timeLock)).toContain('Slow')
  expect(skillRequirementsSummary(stolenMoment)).toContain('Slow')
  expect(skillTargetDescription(timeLock)).toBe('Enemy')
  expect(skillTargetMethodDescription(timeLock)).toBe('Single')
  expect(skillTargetElevationDescription(timeLock)).not.toBe('N/A')
  expect(skillCompactRangeDescription(timeLock)).toBe(String(timeLock.target.maximumRange))
  expect(skillLineOfSightDescription(timeLock)).toBe('Required')
  expect(skillCooldownDescription(timeLock)).toMatch(/turn|None/)
})

it('classifies Techniques only as Attack, Recovery, or Utility', () => {
  expect(skillTypeDescription(resolveMatureSkillVersion('runeblade.aether-cut')!)).toBe('Attack')
  expect(skillTypeDescription(resolveMatureSkillVersion('vanguard.rally')!)).toBe('Recovery')
  expect(skillTypeDescription(resolveMatureSkillVersion('vanguard.brace')!)).toBe('Utility')

  const hybrid = resolveMatureSkillVersion('runeblade.siphon-slash')!
  expect(skillTypeDescription(hybrid)).toBe('Attack')
})

it('returns one effect summary per authored effect with positive durations only', () => {
  const siphon = resolveMatureSkillVersion('runeblade.siphon-slash')!
  expect(skillEffectSummaries(siphon)).toEqual([
    expect.stringMatching(/^Dmg \[\d+\]$/),
    expect.stringMatching(/^MP Drain \[\d+\]$/),
    expect.stringMatching(/^MP Recovery \[\d+%\] \[Instant\]$/),
  ])
  const guard = resolveMatureSkillVersion('runeblade.rune-guard')!
  expect(skillEffectSummaries(guard).some((line) => /\[\d+ Turns?\]$/.test(line))).toBe(true)
})

it('lists authored magnitudes as effects without leaking design tags', () => {
  const siphon = resolveMatureSkillVersion('runeblade.siphon-slash')!
  expect(skillEffectsSummary(siphon)).toBe('Dmg [13], MP Drain [7], MP Recovery [7%] [Instant]')
  expect(skillEffectsSummary({ ...siphon, tags: [...siphon.tags, 'setup', 'melee'] })).toBe(
    skillEffectsSummary(siphon),
  )
  const brand = skillEffectsSummary(resolveMatureSkillVersion('runeblade.sigil-brand')!)
  expect(brand).toBe('Dmg [10], Vulnerable [14.26%] [2 Turns], Healing Down [20.74%] [2 Turns]')
  expect(skillEffectsSummary(resolveMatureSkillVersion('runeblade.rune-mending')!)).not.toContain(
    'Dmg',
  )
})

it('shows conditional elemental and terrain magnitudes without treating them as universal damage', () => {
  expect(skillEffectsSummary(resolveMatureSkillVersion('tidecaller.water-lance')!)).toContain(
    'Drenched [+20% Storm]',
  )
  expect(skillEffectsSummary(resolveMatureSkillVersion('stormsinger.static-drain')!)).toContain(
    'Conductive [+20% Storm]',
  )
  expect(skillEffectsSummary(resolveMatureSkillVersion('frostweaver.chilling-mist')!)).toContain(
    'Frozen Ground [+10 AP/tile]',
  )
})

it('shows 1–3 turn cooldowns and no cooldown on prerequisite-gated Skills', () => {
  const ordinary = resolveMatureSkillVersion('runeblade.aether-cut')!
  const gated = resolveMatureSkillVersion('runeblade.rune-burst')!
  expect(skillCooldownDescription(ordinary)).toMatch(/^[1-3] turns?$/)
  expect(skillCooldownDescription(gated)).toBe('None')
})

describe('Combat v5.1 compact effect summaries', () => {
  it('formats authored percentage statuses as magnitude plus duration only', () => {
    expect(
      compactSkillEffectSummaryParts({
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'mark',
        stacks: 1,
        potencyBasisPoints: 1000,
        durationTurns: 2,
      }),
    ).toEqual({ label: 'Marked', magnitude: '10%', duration: '2 Turns' })

    expect(
      compactSkillEffectSummaryParts({
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'guarded',
        stacks: 1,
        potencyBasisPoints: 1200,
        durationTurns: 2,
      }),
    ).toEqual({ label: 'Guard', magnitude: '12%', duration: '2 Turns' })

    expect(
      compactSkillEffectSummaryParts({
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'exposed',
        stacks: 1,
        potencyBasisPoints: 1400,
        durationTurns: 2,
      }),
    ).toEqual({ label: 'Vulnerable', magnitude: '14%', duration: '2 Turns' })

    expect(
      compactSkillEffectSummaryParts({
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'hexed',
        stacks: 1,
        potencyBasisPoints: 1600,
        durationTurns: 2,
      }),
    ).toEqual({ label: 'Healing Down', magnitude: '16%', duration: '2 Turns' })
  })

  it('formats Slow as a concise AP magnitude and separates duration', () => {
    expect(
      compactSkillEffectSummaryParts({
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'slow',
        stacks: 1,
        durationTurns: 2,
      }),
    ).toEqual({ label: 'Slow', magnitude: '+10 AP', duration: '2 Turns' })
  })

  it('omits a duration token for immediate effects', () => {
    expect(
      compactSkillEffectSummaryParts({
        type: 'damage',
        recipient: 'primary-unit',
        amount: 9,
        durationTurns: 0,
      }),
    ).toEqual({ label: 'Dmg', magnitude: '9', duration: null })
  })
})

describe('Combat v5.1 compact targeting labels', () => {
  const base = resolveMatureSkillVersion('vanguard.forceful-strike')!

  it('shows maximum range only', () => {
    expect(
      skillCompactRangeDescription({
        ...base,
        target: { ...base.target, minimumRange: 1, maximumRange: 3 },
      }),
    ).toBe('3')
    expect(
      skillCompactRangeDescription({
        ...base,
        target: { ...base.target, minimumRange: 0, maximumRange: 3 },
      }),
    ).toBe('3')
    expect(
      skillCompactRangeDescription({
        ...base,
        target: { ...base.target, minimumRange: 1, maximumRange: 1 },
      }),
    ).toBe('1')
    expect(skillCompactRangeDescription(resolveMatureSkillVersion('ironfist.focus-breath')!)).toBe(
      'N/A',
    )
  })

  it('shows targeting shape without repeating geometry reach', () => {
    expect(
      skillTargetMethodDescription({
        ...base,
        target: { ...base.target, shape: { kind: 'single' } },
      }),
    ).toBe('Single')
    expect(
      skillTargetMethodDescription({
        ...base,
        target: { ...base.target, shape: { kind: 'line', length: 3 } },
      }),
    ).toBe('Line [3]')
    expect(
      skillTargetMethodDescription({
        ...base,
        target: { ...base.target, shape: { kind: 'circle', radius: 1 } },
      }),
    ).toBe('Circle [1]')
  })
})

it('reports the full minimum field set once in reference order, including Effects and N/A', () => {
  const labels = [
    'Skill Type',
    'Cost',
    'Cooldown',
    'Requirements',
    'Effects',
    'Range',
    'Target',
    'Target Method',
    'Target Elevation',
    'Line of Sight',
  ]
  const skill = resolveMatureSkillVersion('ironfist.focus-breath')!
  const rows = skillParameterRows(skill)
  expect(rows.map(([label]) => label)).toEqual(labels)
  expect(Object.fromEntries(rows)).toMatchObject({
    Effects: skillEffectsSummary(skill),
    Range: 'N/A',
    'Line of Sight': 'N/A',
  })
  expect(rows.every(([, value]) => value.trim().length > 0)).toBe(true)
})

it('distinguishes zero cost and no cooldown from inapplicable self-target constraints', () => {
  const base = resolveMatureSkillVersion('ironfist.focus-breath')!
  const rows = Object.fromEntries(
    skillParameterRows({ ...base, apCost: 0, mpCost: 0, cooldown: null, requirements: [] }),
  )
  expect(rows.Cost).toBe('0 AP')
  expect(rows.Cooldown).toBe('None')
  expect(rows.Requirements).toBe('None')
  expect(rows.Range).toBe('N/A')
  expect(rows['Line of Sight']).toBe('N/A')
})

it('describes the authored Burn schedule rather than substituting the default stages', () => {
  const description = skillEffectDescription({
    type: 'burn',
    recipient: 'primary-unit',
    power: 2,
    durationTurns: 2,
  })
  expect(description).toContain('2, then 1 fixed damage')
  expect(description).toContain('next 2 end-turn boundaries')
  expect(description).not.toContain('4, then 3, then 2')
})

it('keeps area dimensions and distinct recipients in canonical parameter rows', () => {
  const volley = resolveMatureSkillVersion('farstrider.volley')!
  const rows = Object.fromEntries(skillParameterRows(volley))
  expect(rows['Target Method']).toBe('Circle [1]')
  expect(rows.Target).toBe('Enemy')
  const ground = resolveMatureSkillVersion('frostweaver.chilling-mist')!
  const groundRows = Object.fromEntries(skillParameterRows(ground))
  expect(groundRows.Target).toContain('Ground')
  expect(groundRows.Target).toContain('Enemies only')
  expect(groundRows.Target).toContain('Frozen Ground: caster’s enemies only')
  const friendlyFire = {
    ...volley,
    target: { ...volley.target, friendlyFire: 'all-units' as const },
  }
  expect(Object.fromEntries(skillParameterRows(friendlyFire)).Target).toBe(
    'Enemy · All units, including allies',
  )
})

it('derives All with no positional range/LoS while retaining elevation and ordered rows', () => {
  const base = resolveMatureSkillVersion('vanguard.forceful-strike')!
  const skill = {
    ...base,
    target: {
      ...base.target,
      geometryVersion: 2 as const,
      shape: { kind: 'all' as const },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
    },
  }
  expect(skillTargetMethodDescription(skill)).toBe('All')
  expect(skillCompactRangeDescription(skill)).toBe('N/A')
  expect(skillLineOfSightDescription(skill)).toBe('N/A')
  expect(skillTargetElevationDescription(skill)).toBe(
    String(base.target.maximumElevationDifference),
  )
  expect(skillTargetTags(skill)).toContain('All')
})

import { skillTargetMethodExplanation } from './skill-detail-presentation'
it('explains current caster geometry and keeps the historical aimed explanation', () => {
  const current = resolveMatureSkillVersion('farstrider.volley')!
  const old = resolveMatureSkillVersion(current.id, current.contentVersion - 1)!
  expect(skillTargetMethodExplanation(current)).toContain('8 surrounding tiles')
  expect(skillTargetMethodExplanation(current)).toContain('excluding your tile')
  expect(skillTargetMethodExplanation(old)).toContain('selected tile')
})

it('distinguishes Delayed from Normal and percentage recovery in shared readers', () => {
  const effect = {
    type: 'percentage-recovery' as const,
    recipient: 'actor' as const,
    resource: 'hp' as const,
    percent: 12,
    ticks: 3,
  }
  expect(
    compactSkillEffectSummaryParts(effect, { version: 2, modes: { healing: 'delayed' } }),
  ).toMatchObject({ magnitude: '12%', timing: 'Delayed' })
  expect(skillEffectDescription(effect)).toContain('maximum HP')
})

it('reads Suppress percentage and duration without a power-scale representation', () => {
  const effect = {
    type: 'apply-status' as const,
    recipient: 'primary-unit' as const,
    statusId: 'suppress',
    stacks: 1,
    potencyBasisPoints: 2534,
    durationTurns: 2,
  }
  expect(skillEffectDescription(effect)).toContain('25.34%')
  expect(skillEffectDescription(effect)).not.toContain('1–20')
  expect(compactSkillEffectSummaryParts(effect)).toMatchObject({
    label: 'Suppress',
    magnitude: '25.34%',
    duration: '2 Turns',
  })
})

it('full Cleanse description includes Suppress while Dispel excludes it', () => {
  expect(
    skillEffectDescription({
      type: 'remove-status',
      recipient: 'primary-unit',
      statusIds: ['slow'],
    }),
  ).toContain('Suppress')
  expect(
    skillEffectDescription({
      type: 'remove-status',
      recipient: 'primary-unit',
      statusIds: ['guarded'],
    }),
  ).not.toContain('Suppress')
})

it('puts current elemental duration and potency solely on the explicit status tag', () => {
  const effects = [
    {
      type: 'damage' as const,
      recipient: 'primary-unit' as const,
      amount: 10,
      element: 'water' as const,
      durationTurns: 3,
      potencyBasisPoints: 3500,
    },
    {
      type: 'apply-status' as const,
      recipient: 'primary-unit' as const,
      statusId: 'wet',
      stacks: 1,
      durationTurns: 4,
      potencyBasisPoints: 4200,
    },
  ]
  const skill = { effects }
  const timing = { version: 9, modes: { wet: 'delayed' as const } }
  expect(skillEffectSummaries(skill, timing)).toEqual([
    'Water Dmg [10]',
    'Drenched [42%] [4 Turns] [Delayed]',
  ])
  expect(skillEffectSummaries(skill, timing, { explicitElemental: false })[0]).toBe(
    'Water Dmg [10] [3 Turns]',
  )
})

it('advertises Ground Fire intent only for the canonical enemy unit target', () => {
  const base = resolveMatureSkillVersion('tidecaller.water-lance')!
  const effects = [
    {
      type: 'damage' as const,
      recipient: 'primary-unit' as const,
      amount: 10,
      element: 'fire' as const,
    },
  ]
  expect(Object.fromEntries(skillParameterRows({ ...base, effects })).Target).toBe('Enemy / Ground')
  expect(
    Object.fromEntries(
      skillParameterRows({
        ...base,
        effects,
        target: { ...base.target, teamPolicy: 'any', friendlyFire: 'all-units' },
      }),
    ).Target,
  ).not.toContain('/ Ground')
})

it('keeps limited-cleanse Effects timing and historical tag aliases consistent', () => {
  const base = resolveMatureSkillVersion('cinderweaver.cinder-bolt')!
  const skill = {
    ...base,
    effects: [
      { type: 'remove-status' as const, recipient: 'actor' as const, statusIds: ['frozen'] },
    ],
    effectDescriptions: [],
  }
  const policy = { version: 7, modes: { 'remove-status': 'instant' as const } }
  expect(skillEffectSummaries(skill, policy)).toEqual(['Cleanse Chilled [Instant]'])
  expect(skillEffectSummaries(skill, policy, { explicitElemental: false })).toEqual([
    'Cleanse [Instant]',
  ])
  expect(skillTargetTags(skill)).toContain('Cleanse Chilled · Self')
  expect(skillTargetTags(skill, { explicitElemental: false })).toContain('Cleanse · Self')
})

it('shows both intents for current Flame Burst while preserving its captured Ground geometry', () => {
  const skill = resolveMatureSkillVersion('cinderweaver.flame-burst')!
  const before = JSON.stringify(skill)
  const rows = Object.fromEntries(skillParameterRows(skill))
  expect(rows.Target).toBe('Enemy / Ground')
  expect(rows['Target Method']).toBe('Circle [1]')
  expect(rows.Effects).toContain('Fire Dmg')
  expect(rows.Effects).toContain('Cleanse Chilled')
  expect(
    Object.fromEntries(
      skillParameterRows(skill, skill, defaultCombatEffectTimingPolicy(), {
        explicitElemental: false,
      }),
    ).Target,
  ).toBe('Ground · Enemies only · Steam: both teams')
  expect(JSON.stringify(skill)).toBe(before)
})
