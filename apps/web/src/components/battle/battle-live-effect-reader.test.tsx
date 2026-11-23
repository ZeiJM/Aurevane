import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { BattleCombatantEffects } from './battle-combatant-effects'
import { BattleEffectInformation, battleEffectInformation } from './battle-effect-information'
import type { BattlePresentedStatus } from '@/lib/battle/battle-elevation-effects'

const base: BattlePresentedStatus = {
  statusId: 'guarded',
  statusVersion: 1,
  stacks: 2,
  potencyBasisPoints: 1000,
  remainingOwnerTurnStarts: 2,
  remainingOwnerTurnEnds: 2,
  sourceCombatantId: 'private-source-id',
}
function reader(effect: BattlePresentedStatus, compact = false) {
  return renderToStaticMarkup(
    <BattleCombatantEffects name="Archer" statuses={[effect]} compact={compact} />,
  )
}
it.each([false, true])(
  'describes the captured compounded incoming summary inside the %s reader accessibility text',
  (compact) => {
    const effect = { ...base },
      before = JSON.stringify(effect)
    const html = reader(effect, compact)
    expect(html).toContain('Incoming damage from this effect: −19%')
    expect(html).toContain('2 stacks')
    expect(html).toContain('2 turns remaining')
    expect(html).not.toContain('private-source-id')
    expect(JSON.stringify(effect)).toBe(before)
  },
)
it('keeps heterogeneous application strength and its combined incoming summary together', () => {
  const html = reader(
    {
      ...base,
      effectStackingPolicyVersion: 1,
      applicationModifiers: [
        { stacks: 1, sourceCombatantId: 'private-source-a', potencyBasisPoints: 1000 },
        { stacks: 1, sourceCombatantId: 'private-source-b', potencyBasisPoints: 2000 },
      ],
    },
    true,
  )
  expect(html).toContain('Incoming damage from this effect: −28%')
  expect(html).toContain('Application 1: 1 stack')
  expect(html).toContain('Reduces incoming damage by 20%')
  expect(html).not.toContain('private-source-')
})
it('does not present a pending status as an active incoming modifier', () => {
  const html = reader(
    {
      ...base,
      timingState: 'pending',
      activationRound: 4,
      durationScope: 'rounds',
      remainingRoundBoundaries: 2,
    },
    true,
  )
  expect(html).toContain('round 4')
  expect(html).toContain('2 round boundaries remaining')
  expect(html).not.toContain('Incoming damage from this effect:')
})
it('does not replace an unavailable captured version with current Guard potency', () => {
  const html = reader({ ...base, statusVersion: 99, potencyBasisPoints: undefined }, true)
  expect(html).toContain('Captured effect rules unavailable')
  expect(html).not.toContain('15%')
  expect(html).not.toContain('Incoming damage from this effect:')
})
it('keeps explicit recovery applications and depletion lifetimes distinct', () => {
  const recovery = reader(
    {
      ...base,
      statusId: 'healing',
      stacks: 1,
      durationScope: 'instant',
      timingState: 'pending',
      activationRound: 3,
      recoveryApplications: 4,
      potencyBasisPoints: undefined,
    },
    true,
  )
  expect(recovery).toContain('4 applications remaining')
  expect(recovery).toContain('first on activation')
  const barrier = reader(
    {
      ...base,
      statusId: 'barrier',
      stacks: 1,
      durationScope: 'until-spent',
      potencyBasisPoints: undefined,
    },
    true,
  )
  expect(barrier).toContain('Until depleted')
  expect(barrier).not.toContain('2 turns remaining')
})
it('escapes an unsupported identity instead of interpreting it as presentation markup', () => {
  const html = reader(
    { ...base, statusId: '<private-script>', statusVersion: 99, potencyBasisPoints: undefined },
    true,
  )
  expect(html).toContain('&lt;private-script&gt;')
  expect(html).not.toContain('<private-script>')
  expect(html).toContain('Captured effect rules unavailable')
})
it('retains an unsupported prototype-name identity in the visible chip', () => {
  const html = reader({ ...base, statusId: 'constructor', statusVersion: 99 }, true)
  expect(html).toContain('id:constructor')
  expect(html).toContain('Captured effect rules unavailable')
})
it('does not accept an unsupported positional status as a known elevated-terrain rule', () => {
  const html = reader(
    {
      ...base,
      statusId: 'unrecognized-position',
      statusVersion: 99,
      presentationDuration: 'while-elevated',
    },
    true,
  )
  expect(html).toContain('Captured effect rules unavailable')
})
it('does not invent the default potency for a mixed group whose individual strengths are recorded', () => {
  const html = reader(
    {
      ...base,
      effectStackingPolicyVersion: 1,
      potencyBasisPoints: undefined,
      applicationModifiers: [
        { stacks: 1, sourceCombatantId: 'source', potencyBasisPoints: 1000 },
        { stacks: 1, sourceCombatantId: 'source', potencyBasisPoints: 2000 },
      ],
    },
    true,
  )
  expect(html).toContain('10%')
  expect(html).toContain('20%')
  expect(html).not.toContain('15%')
})
it('labels a summary as belonging to its own effect rather than the entire combatant', () => {
  const html = renderToStaticMarkup(
    <BattleCombatantEffects
      name="Archer"
      compact
      statuses={[base, { ...base, statusId: 'exposed', stacks: 1 }]}
    />,
  )
  expect(html.match(/Incoming damage from this effect:/g) ?? []).toHaveLength(2)
})
it('uses the captured legacy stacking policy rather than applying a later heterogeneous profile', () => {
  const effect = {
    ...base,
    applicationModifiers: [
      { stacks: 1, sourceCombatantId: 'source', potencyBasisPoints: 1000 },
      { stacks: 1, sourceCombatantId: 'source', potencyBasisPoints: 2000 },
    ],
  }
  const html = reader(effect, true)
  expect(html).toContain('Incoming damage from this effect: −19%')
  expect(html).not.toContain('−28%')
  expect(html).not.toContain('Application 1:')
})
it('does not claim later per-application Storm stacking for the oldest elemental snapshot', () => {
  const html = reader({ ...base, statusId: 'wet', stacks: 3, potencyBasisPoints: undefined }, true)
  expect(html).toContain('Storm damage')
  expect(html).not.toContain('per active Wet or Conductive application')
})

it('renders the visible mixed-strength report with the shared magnitude presentation and no guessed default', () => {
  const html = renderToStaticMarkup(
    <BattleEffectInformation
      effect={{
        ...base,
        effectStackingPolicyVersion: 1,
        potencyBasisPoints: undefined,
        applicationModifiers: [
          { stacks: 1, sourceCombatantId: 'secret-a', potencyBasisPoints: 1000 },
          { stacks: 1, sourceCombatantId: 'secret-b', potencyBasisPoints: 2000 },
        ],
      }}
    />,
  )
  expect(html).toContain('data-compact-effect-magnitude="true">[−28%]')
  expect(html).toContain('Application 1: 1 stack')
  expect(html).toContain('10%')
  expect(html).toContain('20%')
  expect(html).not.toContain('15%')
  expect(html).not.toContain('secret-')
})

it('does not inherit omitted application Blindside modifiers from the latest root', () => {
  const effect = {
    ...base,
    statusId: 'blindside',
    effectStackingPolicyVersion: 1 as const,
    blindsideActivationPolicyVersion: 1 as const,
    blindsideModifiersBasisPoints: { side: 13000, rear: 14000 },
    applicationModifiers: [
      { stacks: 1, sourceCombatantId: 'a' },
      {
        stacks: 1,
        sourceCombatantId: 'b',
        blindsideModifiersBasisPoints: { side: 13000, rear: 14000 },
      },
    ],
  }
  const report = battleEffectInformation(effect)
  expect(report.applications[0]).toContain('160% from the side and 220% from the rear')
  expect(report.applications[1]).toContain('130% from the side and 140% from the rear')
})

it('shows only the remaining captured Burn progression after an elapsed tick', () => {
  const report = battleEffectInformation({
    ...base,
    statusId: 'burn',
    stacks: 1,
    dotTriggerPolicyVersion: 2,
    percentageDotStage: 1,
    percentageDamage: {
      capturedDamage: 20,
      profile: { kind: 'attack-percentage', basisPoints: 3000, decayBasisPointsPerTick: 1000 },
    },
  })
  expect(report.description).toContain('20% → 10%')
  expect(report.description).not.toContain('30% →')
  expect(report.description).toContain('Next tick: 4 HP')
})

it('keeps legacy Burn triggers while displaying its captured profile', () => {
  const report = battleEffectInformation({
    ...base,
    statusId: 'burn',
    stacks: 1,
    percentageDamage: {
      capturedDamage: 20,
      profile: { kind: 'attack-percentage', basisPoints: 3000, decayBasisPointsPerTick: 1000 },
    },
  })
  expect(report.description).toContain('30% → 20%')
  expect(report.description).toContain('2 HP backlash once after each damaging command')
})

it.each([false, true])(
  'keeps the visible incoming modifier consistent with legacy/current policy=%s',
  (current) => {
    const html = reader({
      ...base,
      ...(current ? { effectStackingPolicyVersion: 1 as const } : {}),
      applicationModifiers: [
        { stacks: 1, sourceCombatantId: 'a', potencyBasisPoints: 1000 },
        { stacks: 1, sourceCombatantId: 'b', potencyBasisPoints: 2000 },
      ],
    })
    const visible = html
      .replace(/<span[^>]* hidden=""[^>]*>.*?<\/span>/g, '')
      .replace(/<[^>]*>/g, '')
    expect(visible).toContain(current ? '−28%' : '−19%')
    expect(visible).not.toContain(current ? '−19%' : '−28%')
  },
)
