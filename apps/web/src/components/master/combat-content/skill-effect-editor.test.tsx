import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SkillEffectEditor } from './skill-effect-editor'

function render(effect: CombatEffectDefinition): string {
  return renderToStaticMarkup(
    createElement(SkillEffectEditor, { value: effect, onChange: vi.fn() }),
  )
}

describe('Master percentage DoT controls', () => {
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

  it('edits direct damage, defenses, elements, scaling, and Vengeance through typed controls', () => {
    const ordinary = render({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 9,
      defenseKind: 'armor',
      piercing: true,
      element: 'fire',
      scaling: { source: 'physical-power', coefficientBasisPoints: 7_500 },
    })
    for (const label of [
      'Damage amount',
      'Damage recipient',
      'Defense kind',
      'Piercing',
      'Element',
      'Scaling source',
      'Scaling coefficient (basis points)',
      'Vengeance enabled',
    ]) {
      expect(ordinary).toContain(`aria-label="${label}"`)
    }

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
    expect(vengeance).toContain('aria-label="Vengeance conversion (basis points)"')
    expect(vengeance).toContain('aria-label="Vengeance minimum damage"')
    expect(vengeance).toContain('aria-label="Vengeance maximum damage"')
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
    expect(mp).toContain('aria-label="MP delta"')
    expect(mp).toContain('aria-label="MP ticks"')
    expect(mp).not.toContain('payload')
  })

  it('edits status application/removal, Amplify/Curse, Covert, and Sensory through typed fields', () => {
    const applied = render({
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'covert',
      stacks: 1,
    })
    expect(applied).toContain('aria-label="Status ID"')
    expect(applied).toContain('value="covert"')
    expect(applied).toContain('aria-label="Status stacks"')
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
    expect(removed).toContain('aria-label="Status IDs"')
    expect(removed).toContain('value="burn, poison"')
    expect(removed).toContain('Use standard Cleanse')
    expect(removed).toContain(
      'Cleanse removes Burn, Bleed, Poison, Slow, Rooted, Vulnerable, Marked and Taunted.',
    )
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
    expect(copy).toContain('aria-label="Copy mode"')
    expect(copy).toContain('<option value="amplify" selected="">Copy Buffs</option>')
    expect(copy).toContain('<option value="curse">Copy Debuffs</option>')
    expect(copy).toContain('aria-label="Allow empty status copy"')

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
    expect(displace).toContain('aria-label="Push or Pull"')
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
      expect(dot).toContain('aria-label="Curse-copyable"')
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

it('authors percentage recovery with a resource, 1–100 percent and 1–4 applications', () => {
  const html = render({
    type: 'percentage-recovery',
    recipient: 'actor',
    resource: 'hp',
    percent: 12,
    ticks: 3,
  })
  expect(html).toContain('aria-label="Recovery percent"')
  expect(html).toContain('max="100"')
  expect(html).toContain('aria-label="Recovery resource"')
  expect(html).toContain('aria-label="Recovery applications"')
})

it('authors Ice and additional captured Drenched/Conductive Storm bonuses in percent', () => {
  const water = render({
    type: 'damage',
    recipient: 'primary-unit',
    amount: 10,
    element: 'water',
    potencyBasisPoints: 3500,
    durationTurns: 3,
  })
  expect(water).toContain('value="ice"')
  expect(water).toContain('Drenched Storm bonus (%)')
  expect(water).toContain('value="35"')
  expect(water).toContain('Elemental debuff duration (turns)')
  expect(
    render({ type: 'damage', recipient: 'primary-unit', amount: 10, element: 'storm' }),
  ).toContain('Conductive Storm bonus (%)')
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
  expect(markup).toContain('Never stacks')
})
