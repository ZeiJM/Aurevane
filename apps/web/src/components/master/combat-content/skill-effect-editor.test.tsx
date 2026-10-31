import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { AbilityNumber } from './ability-editor-fields'
import { SkillEffectEditor } from './skill-effect-editor'
import { createDefaultCombatEffect } from './skill-effect-list-editor'

function render(effect: CombatEffectDefinition): string {
  return renderToStaticMarkup(
    createElement(SkillEffectEditor, { value: effect, onChange: vi.fn() }),
  )
}

it.each<CombatEffectDefinition>([
  { type: 'damage', recipient: 'primary-unit', amount: 10 },
  { type: 'remove-status', recipient: 'primary-unit', statusIds: ['guarded'] },
  { type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' },
  { type: 'apply-status', recipient: 'primary-unit', statusId: 'blindside', stacks: 1 },
])('omits non-editable duration boxes for $type without rewriting the effect', (effect) => {
  const before = JSON.stringify(effect)
  const html = render(effect)
  expect(html).not.toContain('aria-label="Effect duration (turns)"')
  expect(html).not.toContain('[0 Turns]')
  if (effect.type === 'create-terrain') expect(html).toContain('Lasts 2 rounds.')
  if (effect.type === 'apply-status') expect(html).toContain('affected character’s turn')
  expect(JSON.stringify(effect)).toBe(before)
})

it('hides the percentage-recovery schedule control without changing its saved applications', () => {
  const html = render({
    type: 'percentage-recovery',
    recipient: 'actor',
    resource: 'hp',
    percent: 15,
    ticks: 3,
    durationTurns: 2,
  })
  expect(html).not.toContain('aria-label="Recovery applications"')
  expect(html).not.toContain('aria-label="Effect duration (turns)"')
})

it('keeps editable recovery duration within the engine’s four-application limit', () => {
  const onChange = vi.fn()
  const tree = SkillEffectEditor({
    value: { type: 'healing', recipient: 'actor', amount: 5, ticks: 1 },
    onChange,
  })
  function find(node: ReactNode): { onChange(value: number): void } | undefined {
    if (Array.isArray(node)) return node.map(find).find(Boolean)
    if (!isValidElement<{ children?: ReactNode; label?: string }>(node)) return
    if (node.type === AbilityNumber && node.props.label === 'Effect duration (turns)')
      return node.props as never
    return find(node.props.children)
  }
  find(tree)!.onChange(4)
  expect(onChange).toHaveBeenCalledWith({
    type: 'healing',
    recipient: 'actor',
    amount: 5,
    ticks: 4,
    durationTurns: 3,
  })
})

describe('Master percentage DoT controls', () => {
  it('authors Barrier as a percentage of maximum HP rather than the 1–20 Skill power range', () => {
    const template = createDefaultCombatEffect('barrier-change')
    if (template.type !== 'barrier-change') throw new Error('Wrong Barrier template.')
    const html = render({ ...template, amount: 25 })
    expect(html).toContain('aria-label="Barrier (% maximum HP)"')
    expect(html).toContain('max="100"')
    expect(html).not.toContain('max="20"')
    expect(template.durationTurns).toBe(2)
    expect(html).toContain(
      'aria-label="Effect duration (turns)" type="number" min="1" max="4" step="1" placeholder="Until depleted (historical)" value="2"',
    )
  })
  it('keeps an omitted historical Barrier lifetime blank until explicitly edited', () => {
    const html = render({
      type: 'barrier-change',
      recipient: 'actor',
      amount: 20,
      basis: 'maximum-hp-percent',
    })
    expect(html).toContain('placeholder="Until depleted (historical)"')
    expect(html).toContain('value=""')
    expect(html).not.toMatch(/<input[^>]*aria-label="Effect duration \(turns\)"[^>]*disabled/u)
  })
  it.each(['poison', 'bleed', 'burn'] as const)(
    'edits %s percentages instead of fixed HP',
    (type) => {
      const effect: CombatEffectDefinition =
        type === 'bleed'
          ? {
              type,
              recipient: 'primary-unit',
              ticks: 3,
              damageProfile: { kind: 'attack-percentage', basisPoints: 1234 },
            }
          : {
              type,
              recipient: 'primary-unit',
              durationTurns: 3,
              damageProfile: {
                kind: 'attack-percentage',
                basisPoints: type === 'burn' ? 2500 : 1234,
                ...(type === 'burn' ? { decayBasisPointsPerTick: 500 } : {}),
              },
            }
      const html = render(effect)
      expect(html).toContain(
        type === 'burn'
          ? 'First tick (% of attack damage)'
          : 'Damage per tick (% of attack damage)',
      )
      expect(html).not.toContain('aria-label="Effect power"')
      expect(html).not.toContain('aria-label="Bleed damage per tick"')
      if (type === 'burn') {
        expect(html).toContain('Decay per tick (percentage points)')
        expect(html).toContain('Backlash (% of burning unit’s hostile damage)')
        expect(html).toContain('Backlash can trigger once per turn.')
        expect(html).toContain('25% → 20% → 15%')
      } else expect(html).toContain('value="12.34"')
    },
  )
})

describe('Master Panel Skill effect editor', () => {
  it.each([
    ['damage', { type: 'damage', recipient: 'primary-unit', amount: 8 }],
    ['healing', { type: 'healing', recipient: 'actor', amount: 6, ticks: 2 }],
    [
      'resource-change',
      { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 4, ticks: 2 },
    ],
    [
      'apply-status',
      { type: 'apply-status', recipient: 'primary-unit', statusId: 'covert', stacks: 1 },
    ],
    [
      'remove-status',
      { type: 'remove-status', recipient: 'primary-unit', statusIds: ['burn', 'poison'] },
    ],
    ['return-to-turn-start', { type: 'return-to-turn-start', recipient: 'actor' }],
    ['create-terrain', { type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' }],
    ['displace', { type: 'displace', recipient: 'primary-unit', direction: 'pull', distance: 2 }],
    ['poison', { type: 'poison', recipient: 'primary-unit', curseCopyable: true }],
    [
      'bleed',
      {
        type: 'bleed',
        recipient: 'primary-unit',
        damagePerTick: 2,
        ticks: 4,
        curseCopyable: true,
      },
    ],
    ['burn', { type: 'burn', recipient: 'primary-unit', curseCopyable: true }],
    ['barrier-change', { type: 'barrier-change', recipient: 'actor', amount: 10 }],
    ['copy-statuses', { type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' }],
    ['sensory', { type: 'sensory', recipient: 'primary-unit', revealedDurationOwnerTurnStarts: 3 }],
  ] satisfies readonly [CombatEffectDefinition['type'], CombatEffectDefinition][])(
    'has an explicit %s editor branch',
    (type, effect) => {
      expect(render(effect)).toContain(`data-effect-type="${type}"`)
    },
  )

  it('edits direct power, elements and Vengeance while Defense and scaling are automatic', () => {
    const ordinary = render({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 9,
      defenseKind: 'armor',
      piercing: true,
      element: 'fire',
      scaling: { source: 'physical-power', coefficientBasisPoints: 7_500 },
    })
    for (const label of ['Damage amount', 'Target']) {
      expect(ordinary).toContain(`aria-label="${label}"`)
    }

    expect(ordinary).not.toContain('aria-label="Element"')
    expect(
      render({ type: 'damage', recipient: 'primary-unit', amount: 9, element: 'fire' }),
    ).toContain('aria-label="Element"')
    for (const label of ['Defense kind', 'Damage scaling', 'Scaling (%)'])
      expect(ordinary).not.toContain(`aria-label="${label}"`)

    const vengeance = render({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 0,
      vengeance: {
        conversionBasisPoints: 5_000,
        minimumDamage: 2,
        maximumDamage: 80,
      },
    })
    expect(vengeance).toContain('aria-label="Counter potency (%)"')
    expect(vengeance).not.toContain('aria-label="Vengeance minimum damage"')
    expect(vengeance).not.toContain('aria-label="Vengeance maximum damage"')
  })

  it('edits healing and MP recovery/drain timing without a generic payload field', () => {
    const healing = render({ type: 'healing', recipient: 'actor', amount: 6, ticks: 3 })
    expect(healing).toContain('aria-label="Healing amount"')
    expect(healing).toContain('aria-label="Healing ticks"')

    const mp = render({
      type: 'resource-change',
      recipient: 'primary-unit',
      resource: 'mp',
      delta: -5,
      ticks: 1,
    })
    expect(mp).toContain('aria-label="MP Drain potency (%)"')
    expect(mp).not.toContain('aria-label="MP ticks"')
    expect(mp).not.toContain('payload')
  })

  it('edits status application/removal, Amplify/Curse, Covert, and Sensory through typed fields', () => {
    const applied = render({
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'covert',
      stacks: 1,
    })
    expect(applied).toContain('aria-label="Status"')
    expect(applied).toContain('value="covert"')
    expect(applied).not.toContain('aria-label="Status stacks"')
    expect(applied).toContain('aria-label="Effect duration (turns)"')
    expect(applied).not.toContain('aria-label="Status potency (percent)"')

    const percentage = render({
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'guarded',
      stacks: 1,
      potencyBasisPoints: 1_500,
    })
    expect(percentage).toContain('aria-label="Status potency (percent)"')
    expect(percentage).toContain('value="15"')

    const removed = render({
      type: 'remove-status',
      recipient: 'primary-unit',
      statusIds: ['burn', 'poison'],
    })
    expect(removed).not.toContain('aria-label="Status IDs"')
    expect(removed).not.toContain('Status removal mode')
    expect(removed).not.toContain('Use standard Cleanse')
    expect(removed).not.toContain('aria-label="About Cleanse"')
    const dispel = render({
      type: 'remove-status',
      recipient: 'primary-unit',
      statusIds: ['guarded'],
    })
    expect(dispel).not.toContain('Use standard Cleanse')

    const copy = render({
      type: 'copy-statuses',
      recipient: 'primary-unit',
      mode: 'amplify',
      allowNoEligibleEffects: true,
    })
    expect(copy).not.toContain('aria-label="Copy mode"')
    expect(copy).toContain('aria-label="Copy Damage Up"')
    expect(copy).not.toContain('aria-label="Copy Slow"')
    expect(copy).not.toContain('aria-label="Allow empty status copy"')

    const sensory = render({
      type: 'sensory',
      recipient: 'primary-unit',
      revealedDurationOwnerTurnStarts: 4,
    })
    expect(sensory).toContain('aria-label="Revealed duration (owner-turn starts)"')
    expect(sensory).toContain('min="1"')
    expect(sensory).toContain('max="4"')
  })

  it('edits displacement, terrain/Revert, current DoTs, and Barrier with bounded typed controls', () => {
    const displace = render({
      type: 'displace',
      recipient: 'primary-unit',
      direction: 'push',
      distance: 2,
    })
    expect(displace).not.toContain('aria-label="Push or Pull"')
    expect(displace).toContain('aria-label="Tiles moved"')

    const terrain = render({
      type: 'create-terrain',
      recipient: 'affected-tiles',
      terrain: 'frozen',
    })
    expect(terrain).toContain('Frozen Ground')
    expect(terrain).toContain('Affected tiles')

    const bleed = render({
      type: 'bleed',
      recipient: 'primary-unit',
      damagePerTick: 2,
      ticks: 4,
      curseCopyable: true,
    })
    expect(bleed).toContain('Damage per tick (% of attack damage)')
    expect(bleed).toContain('aria-label="Effect duration (turns)"')
    expect(bleed).toContain('max="4"')

    for (const type of ['poison', 'burn'] as const) {
      const dot = render({ type, recipient: 'primary-unit', curseCopyable: true })
      if (type === 'poison') expect(dot).toContain('aria-label="Curse-copyable"')
      else expect(dot).not.toContain('aria-label="Curse-copyable"')
      expect(dot).toContain(
        type === 'burn'
          ? 'First tick (% of attack damage)'
          : 'Damage per tick (% of attack damage)',
      )
      expect(dot).toContain('aria-label="Effect duration (turns)"')
    }

    const barrier = render({ type: 'barrier-change', recipient: 'actor', amount: 12 })
    expect(barrier).toContain('aria-label="Barrier amount"')

    const rewind = render({ type: 'return-to-turn-start', recipient: 'actor' })
    expect(rewind).toContain('Return to turn start')
    expect(rewind).toContain('Actor only')
    const captured = render({
      type: 'return-to-turn-start',
      recipient: 'actor',
      anchorMode: 'cast-position',
    })
    expect(captured).toContain('Return to captured cast tile')
  })
})

it('authors percentage recovery potency with fixed resource and saved applications', () => {
  const html = render({
    type: 'percentage-recovery',
    recipient: 'actor',
    resource: 'hp',
    percent: 12,
    ticks: 3,
  })
  expect(html).toContain('aria-label="Recovery percent"')
  expect(html).toContain('max="100"')
  expect(html).not.toContain('aria-label="Recovery resource"')
  expect(html).not.toContain('aria-label="Recovery applications"')
})

it('authors elemental damage typing independently from captured status potency', () => {
  const water = render({
    type: 'damage',
    recipient: 'primary-unit',
    amount: 10,
    element: 'water',
    potencyBasisPoints: 3500,
    durationTurns: 3,
  })
  expect(water).toContain('value="ice"')
  expect(water).not.toContain('Drenched Storm bonus (%)')
  expect(water).not.toContain('Elemental debuff duration (turns)')
  expect(
    render({ type: 'damage', recipient: 'primary-unit', amount: 10, element: 'storm' }),
  ).not.toContain('Conductive Storm bonus (%)')
})

it('authors Suppress as 1–100% with two decimal places and a single application', () => {
  const markup = render({
    type: 'apply-status',
    recipient: 'primary-unit',
    statusId: 'suppress',
    stacks: 1,
  })
  expect(markup).toContain('aria-label="Status potency (percent)"')
  expect(markup).toContain('max="100"')
  expect(markup).toContain('step="0.01"')
  expect(markup).toContain('value="25"')
  expect(markup).toMatch(/aria-label="Status stacks"[^>]*max="1"[^>]*disabled/)
})

it('keeps elemental status duration and potency controls on the separate status tag', () => {
  const water = render({ type: 'damage', recipient: 'primary-unit', amount: 10, element: 'water' })
  expect(water).not.toContain('Elemental debuff duration (turns)')
  expect(water).not.toContain('Drenched Storm bonus (%)')
  for (const statusId of ['wet', 'conductive']) {
    const tag = render({
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId,
      stacks: 1,
      durationTurns: 4,
      potencyBasisPoints: 4200,
    })
    expect(tag).toContain(
      statusId === 'wet'
        ? 'aria-label="Storm damage increase (%)"'
        : 'aria-label="Status potency (percent)"',
    )
    expect(tag).toContain('value="42"')
    expect(tag).toContain('aria-label="Effect duration (turns)"')
    expect(tag).toContain('value="4"')
  }
})

it('keeps limited Chilled removal independent from standard Cleanse authoring', () => {
  const markup = render({ type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] })
  expect(markup).not.toContain('aria-label="About Conditional Cleanse"')
  expect(markup).toContain('value="frozen"')
  expect(markup).not.toContain('Use standard Cleanse')
  expect(markup).not.toContain('Cleanse removes Burn')
})

it('authors explicit listed-status removal independently of full Cleanse', () => {
  const markup = render({
    type: 'remove-status',
    recipient: 'primary-unit',
    statusIds: ['mark'],
    removalMode: 'specified',
  } as CombatEffectDefinition)
  expect(markup).not.toContain('Status removal mode')
  expect(markup).toContain('aria-label="Remove Marked" checked=""')
  expect(markup).not.toContain('aria-label="Remove Guarded"')
  expect(markup).not.toContain('Use standard Cleanse')
})

it('offers registered limited-removal statuses and retains unregistered stored IDs', () => {
  const markup = render({
    type: 'remove-status',
    recipient: 'actor',
    statusIds: ['burn', 'wet', 'historical-status'],
    removalMode: 'specified',
  })
  expect(markup).toContain('aria-label="Remove Burn" checked=""')
  expect(markup).toContain('aria-label="Remove Drenched" checked=""')
  expect(markup).toContain('Historical Status')
  expect(markup).not.toContain('aria-label="Remove Historical Status"')
})

it('uses explicit damage profiles and percentage parameters instead of four generic switches', () => {
  const html = render({
    type: 'damage',
    recipient: 'primary-unit',
    amount: 8,
    scaling: { source: 'physical-power', coefficientBasisPoints: 12500 },
    facingModifiersBasisPoints: { front: 10000, side: 11000, rear: 12000 },
  })
  for (const label of [
    'Piercing',
    'Scaling enabled',
    'Vengeance enabled',
    'Facing modifiers enabled',
  ])
    expect(html).not.toContain(`aria-label="${label}"`)
  expect(html).not.toContain('aria-label="Damage scaling"')
  expect(html).not.toContain('aria-label="Scaling (%)"')
  const vengeance = render({
    type: 'damage',
    recipient: 'primary-unit',
    amount: 0,
    vengeance: { conversionBasisPoints: 2500, maximumDamage: 40 },
  })
  expect(vengeance).toContain('aria-label="Counter potency (%)"')
  expect(vengeance).toContain('value="25"')
})

it('keeps positional damage controls on Blindside instead of ordinary Damage', () => {
  const ordinary = render({
    type: 'damage',
    recipient: 'primary-unit',
    amount: 8,
    facingModifiersBasisPoints: { front: 10000, side: 16000, rear: 22000 },
  })
  for (const label of ['Facing damage', 'Front damage (%)', 'Side damage (%)', 'Rear damage (%)'])
    expect(ordinary).not.toContain(`aria-label="${label}"`)
  const blindside = render({
    type: 'apply-status',
    recipient: 'primary-unit',
    statusId: 'blindside-vulnerability',
    stacks: 1,
    blindsideModifiersBasisPoints: { side: 17500, rear: 22500 },
  })
  expect(blindside).toContain('aria-label="Side damage (%)"')
  expect(blindside).toContain('aria-label="Rear damage (%)"')
  expect(blindside).toContain('value="175"')
  expect(blindside).toContain('value="225"')
  expect(blindside).not.toContain('aria-label="About Blindside"')
})

it('omits duplicated help from the editable tag area', () => {
  const html = render({
    type: 'apply-status',
    recipient: 'affected-units',
    statusId: 'conductive',
    stacks: 1,
    durationTurns: 2,
    potencyBasisPoints: 2000,
  })
  expect(html).not.toContain('aria-label="About Conductive"')
  expect(html).not.toContain('aria-haspopup="dialog"')
  expect(html).not.toContain('Additional Storm damage captured')
  expect(html).not.toContain('Includes authored statuses')
  expect(html).not.toContain('Positive durations persist')
})

it('does not offer an Element control for canonical Pierce', () => {
  const html = renderToStaticMarkup(
    createElement(SkillEffectEditor, {
      value: { type: 'damage', recipient: 'affected-units', amount: 1, shattersBarrier: true },
      canonicalDamage: 'pierce',
      onChange: vi.fn(),
    }),
  )
  expect(html).not.toContain('aria-label="Element"')
})

it('shows readable Status names without exposing an editable internal Status ID', () => {
  const html = render({
    type: 'apply-status',
    recipient: 'actor',
    statusId: 'inspired',
    stacks: 1,
    durationTurns: 2,
    potencyBasisPoints: 1500,
  })
  expect(html).toContain('aria-label="Status"')
  expect(html).toContain('>Damage Up</option>')
  expect(html).not.toContain('aria-label="Status ID"')
  expect(html).not.toContain('>inspired<')
})

it('shows attack-tag tuning without redundant target or duration controls', () => {
  const weak = renderToStaticMarkup(
    createElement(SkillEffectEditor, {
      value: { type: 'weak-point', recipient: 'actor', debuffThreshold: 3 },
      onChange: vi.fn(),
    }),
  )
  const ruin = renderToStaticMarkup(
    createElement(SkillEffectEditor, {
      value: { type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 1250 },
      onChange: vi.fn(),
    }),
  )
  const spike = renderToStaticMarkup(
    createElement(SkillEffectEditor, {
      value: { type: 'spike', recipient: 'actor' },
      onChange: vi.fn(),
    }),
  )
  expect(weak).toContain('aria-label="Debuff threshold"')
  expect(ruin).toContain('aria-label="Damage increase per debuff (%)"')
  for (const html of [weak, ruin, spike]) {
    expect(html).not.toContain('aria-label="Target"')
    expect(html).not.toContain('aria-label="Effect duration (turns)"')
  }
})
it('authors Endure duration, burst targets/range and returned damage above100%', () => {
  const html = renderToStaticMarkup(
    createElement(SkillEffectEditor, {
      value: {
        type: 'endure',
        recipient: 'actor',
        durationTurns: 3,
        releaseBasisPoints: 17500,
        radiusTiles: 5,
        targetTeams: 'all',
      },
      onChange: vi.fn(),
    }),
  )
  for (const label of [
    'Effect duration (turns)',
    'Damage returned (%)',
    'Burst range (tiles)',
    'Endure burst targets',
  ])
    expect(html).toContain(`aria-label="${label}"`)
  expect(html).toMatch(/aria-label="Damage returned \(%\)"[^>]*value="175"/u)
  expect(html).not.toContain('aria-label="Target"')
  expect(html).not.toContain('aria-label="Status"')
})

it('offers one Reversal family, configured return/caps and fixed window without generic status fields', () => {
  const html = renderToStaticMarkup(
    createElement(SkillEffectEditor, {
      value: {
        type: 'reversal',
        recipient: 'actor',
        version: 1,
        family: 'physical',
        reflectionBasisPoints: 15000,
        attackerMaxHpCapBasisPoints: 2000,
        defenderMaxHpCapBasisPoints: 2500,
      },
      onChange: vi.fn(),
    }),
  )
  for (const label of [
    'Reversal family',
    'Reflection potency (%)',
    'Attacker HP cap (%)',
    'User HP cap (%)',
  ])
    expect(html).toContain(`aria-label="${label}"`)
  expect(html).toContain('Physical Reversal')
  expect(html).toContain('Mystic Reversal')
  expect(html).not.toContain('Full Reversal')
  expect(html).not.toContain('value="both"')
  expect(html).not.toContain('aria-label="Target"')
  expect(html).not.toContain('aria-label="Status"')
  expect(html).not.toContain('aria-label="Effect duration (turns)"')
})
