import { describe, expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
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

describe('Player-facing Skill targeting and effects', () => {
  it('distinguishes ranged area targeting from self recovery without changing the definition', () => {
    const volley = resolveMatureSkillVersion('farstrider.volley')!
    const before = JSON.stringify(volley)
    expect(skillTargetTags(volley)).toEqual(['Enemy', 'Circle 1', 'Dmg'])
    expect(skillCompactRangeDescription(volley)).toBe('5')
    expect(Object.fromEntries(skillParameterRows(volley)).Target).toBe('Enemy')
    const breath = resolveMatureSkillVersion('ironfist.focus-breath')!
    expect(skillTargetTags(breath)).toEqual(['Self', 'Single', 'Heal 1', 'MP Rec 1'])
    expect(skillCompactRangeDescription(breath)).toBe('N/A')
    expect(JSON.stringify(volley)).toBe(before)
  })
  it('describes prerequisites, negative resource changes, and facing explicitly', () => {
    expect(skillRequirementDescription({ kind: 'actor-status-present', statusId: 'guarded' })).toBe(
      'Requires Guarded on yourself.',
    )
    expect(
      skillRequirementDescription({ kind: 'target-status-present', statusId: 'exposed' }),
    ).toBe('Target must have Exposed.')
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
  const burn = resolveMatureSkillVersion('cinderweaver.cinder-bolt')!
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
    'Dmg',
    'MP Drain',
    'MP Rec 1 · Self',
  ])
  expect(skillTargetTags(resolveMatureSkillVersion('ravager.blood-siphon')!)).toContain(
    'Heal 1 · Self',
  )
})

it('explains elemental interactions and typed status aliases without changing historical targeting', () => {
  const fire = skillEffectDescription({
    type: 'damage',
    recipient: 'affected-units',
    amount: 10,
    element: 'fire',
  })
  expect(fire).toContain('removes Wet and Frozen')
  expect(fire).toContain('Steam')
  const storm = skillEffectDescription({
    type: 'damage',
    recipient: 'primary-unit',
    amount: 10,
    element: 'storm',
  })
  expect(storm).toContain('20%')
  expect(storm).toContain('consumes Conductive')
  expect(storm).toContain('once per recipient')
  expect(
    skillEffectDescription({
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'burn',
      stacks: 1,
    }),
  ).toContain('Scorched')
  expect(
    Object.fromEntries(skillParameterRows(resolveMatureSkillVersion('frostweaver.chilling-mist')!))
      .Target,
  ).toContain('Terrain: both teams')
})

it('shows the executable element and canonical status names on current Technique tags', () => {
  const fire = resolveMatureSkillVersion('cinderweaver.cinder-bolt')!
  expect(skillTargetTags(fire)).toContain('Fire Dmg')
  expect(skillTargetTags(fire)).toContain('Burn (Scorched)')
  expect(skillTargetTags(resolveMatureSkillVersion('stormsinger.arc-spark')!)).toContain(
    'Storm Dmg',
  )
  expect(skillTargetTags(resolveMatureSkillVersion('ravager.gash')!)).toContain('Bleed (Bleeding)')
  expect(skillTargetTags(resolveMatureSkillVersion('cinderweaver.cinder-bolt', 1)!)).not.toContain(
    'Fire Dmg',
  )
})

it('distinguishes dispelling enemy protection from cleansing harmful effects', () => {
  expect(skillTargetTags(resolveMatureSkillVersion('runeblade.aether-cut')!)).toContain('Dispel')
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
    expect.stringMatching(/^MP Restore \[\d+\]$/),
  ])
  const guard = resolveMatureSkillVersion('runeblade.rune-guard')!
  expect(skillEffectSummaries(guard).some((line) => /\[\d+ Turns?\]$/.test(line))).toBe(true)
})

it('lists authored magnitudes as effects without leaking design tags', () => {
  const siphon = resolveMatureSkillVersion('runeblade.siphon-slash')!
  expect(skillEffectsSummary(siphon)).toBe('Dmg [13], MP Drain [7], MP Restore [7]')
  expect(skillEffectsSummary({ ...siphon, tags: [...siphon.tags, 'setup', 'melee'] })).toBe(
    skillEffectsSummary(siphon),
  )
  const brand = skillEffectsSummary(resolveMatureSkillVersion('runeblade.sigil-brand')!)
  expect(brand).toBe('Dmg [10], Exposed [14.26%] [2 Turns], Hexed [20.74%] [2 Turns]')
  expect(skillEffectsSummary(resolveMatureSkillVersion('runeblade.rune-mending')!)).not.toContain(
    'Dmg',
  )
})

it('shows conditional elemental and terrain magnitudes without treating them as universal damage', () => {
  expect(skillEffectsSummary(resolveMatureSkillVersion('tidecaller.water-lance')!)).toContain(
    'Wet [+20% Storm]',
  )
  expect(skillEffectsSummary(resolveMatureSkillVersion('stormsinger.static-drain')!)).toContain(
    'Conductive [+20% Storm]',
  )
  expect(skillEffectsSummary(resolveMatureSkillVersion('frostweaver.chilling-mist')!)).toContain(
    'Frozen Terrain [+10 AP/tile]',
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
    ).toEqual({ label: 'Guarded', magnitude: '12%', duration: '2 Turns' })

    expect(
      compactSkillEffectSummaryParts({
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'exposed',
        stacks: 1,
        potencyBasisPoints: 1400,
        durationTurns: 2,
      }),
    ).toEqual({ label: 'Exposed', magnitude: '14%', duration: '2 Turns' })

    expect(
      compactSkillEffectSummaryParts({
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'hexed',
        stacks: 1,
        potencyBasisPoints: 1600,
        durationTurns: 2,
      }),
    ).toEqual({ label: 'Hexed', magnitude: '16%', duration: '2 Turns' })
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
    ).toBe('Line · Length: 3 tiles')
    expect(
      skillTargetMethodDescription({
        ...base,
        target: { ...base.target, shape: { kind: 'circle', radius: 1 } },
      }),
    ).toBe('Circle · Radius: 1 tile')
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
  expect(rows['Target Method']).toBe('Circle · Radius: 1 tile')
  expect(rows.Target).toBe('Enemy')
  const ground = resolveMatureSkillVersion('frostweaver.chilling-mist')!
  const groundRows = Object.fromEntries(skillParameterRows(ground))
  expect(groundRows.Target).toContain('Ground')
  expect(groundRows.Target).toContain('Enemies only')
  expect(groundRows.Target).toContain('Terrain: both teams')
  const friendlyFire = {
    ...volley,
    target: { ...volley.target, friendlyFire: 'all-units' as const },
  }
  expect(Object.fromEntries(skillParameterRows(friendlyFire)).Target).toBe(
    'Enemy · All units, including allies',
  )
})
