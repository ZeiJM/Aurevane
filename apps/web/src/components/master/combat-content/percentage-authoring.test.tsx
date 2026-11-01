import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import { SkillEffectEditor } from './skill-effect-editor'
import { AbilityEffectEditor } from './ability-effect-editor'

const status = (statusId: string): CombatEffectDefinition => ({
  type: 'apply-status',
  recipient: 'actor',
  statusId,
  stacks: 1,
})
const cases: [string, CombatEffectDefinition][] = [
  ['Status potency (%)', status('guarded')],
  ['Storm damage increase (%)', status('wet')],
  ['Initiative reduction (%)', status('wet')],
  ['Defense increase / outgoing damage reduction (%)', status('fortified')],
  ['Damage taken (%)', status('lowered-guard')],
  [
    'Reflect potency (%)',
    {
      ...status('counter'),
      counter: { kind: 'full', basisPoints: 10000 },
    } as CombatEffectDefinition,
  ],
  [
    'Damage returned (%)',
    {
      type: 'endure',
      recipient: 'actor',
      durationTurns: 2,
      releaseBasisPoints: 15000,
      radiusTiles: 3,
      targetTeams: 'enemies',
    },
  ],
  [
    'Damage increase per debuff (%)',
    { type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 1000 },
  ],
  [
    'Increased damage taken (%)',
    {
      type: 'sensory',
      recipient: 'primary-unit',
      increasedDamageTakenBasisPoints: 1500,
      revealedDurationOwnerTurnStarts: 2,
    },
  ],
  [
    'Recovery percent',
    { type: 'percentage-recovery', recipient: 'actor', resource: 'hp', percent: 15 },
  ],
  [
    'MP Drain potency (%)',
    {
      type: 'resource-change',
      resource: 'mp',
      recipient: 'primary-unit',
      basis: 'maximum-mp-percent',
      delta: -15,
    },
  ],
  [
    'Barrier (% maximum HP)',
    { type: 'barrier-change', recipient: 'actor', basis: 'maximum-hp-percent', amount: 20 },
  ],
  ['Side damage (%)', status('blindside')],
  ['Rear damage (%)', status('blindside')],
  [
    'Reflection potency (%)',
    {
      type: 'reversal',
      recipient: 'actor',
      version: 1,
      family: 'physical',
      reflectionBasisPoints: 10000,
      attackerMaxHpCapBasisPoints: 2000,
      defenderMaxHpCapBasisPoints: 2500,
    },
  ],
]

function control(
  node: ReactNode,
  label: string,
): { onChange: (value: never) => void; type?: string } | undefined {
  if (Array.isArray(node)) return node.map((child) => control(child, label)).find(Boolean)
  if (!isValidElement<{ label?: string; 'aria-label'?: string; children?: ReactNode }>(node)) return
  if (
    (typeof node.type !== 'string' &&
      (node.props.label === label ||
        (label === 'Status potency (%)' && node.props.label === 'Status potency (percent)'))) ||
    node.props['aria-label'] === label
  )
    return node.props as never
  if (typeof node.type === 'function' && node.type.name === 'PercentageDotControls')
    return control((node.type as (props: unknown) => ReactNode)(node.props), label)
  return control(node.props.children, label)
}

it.each(cases)(
  'bounds the %s editor callback at the authored percentage ceiling',
  (label, value) => {
    const onChange = vi.fn()
    const input = control(SkillEffectEditor({ value, onChange }), label)!
    const edit = (percent: number) =>
      input.onChange(
        (input.type === 'number'
          ? { currentTarget: { value: String(percent) } }
          : percent) as never,
      )
    edit(999)
    expect(onChange).toHaveBeenCalledOnce()
    onChange.mockClear()
    edit(1000)
    expect(onChange).not.toHaveBeenCalled()
    const markup = renderToStaticMarkup(createElement(SkillEffectEditor, { value, onChange }))
    const field = [...markup.matchAll(/<input[^>]+>/gu)].find(([tag]) =>
      tag.includes(
        `aria-label="${label.replace('Status potency (%)', 'Status potency (percent)').replaceAll('&', '&amp;')}"`,
      ),
    )![0]
    expect(field).toContain('max="999"')
  },
)

it.each([
  ['Damage Up (%)', { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11250 }],
  [
    'Equipment Armor ignored (%)',
    { type: 'pierce', recipient: 'primary-unit', amount: 5, armorIgnoredBasisPoints: 2500 },
  ],
] as const)('bounds canonical %s without changing saved captures', (label, payload) => {
  const onChange = vi.fn()
  const value = { id: 'effect', payload }
  const original = JSON.stringify(value)
  const input = control(AbilityEffectEditor({ value, onChange }), label)!
  input.onChange(999 as never)
  expect(onChange).toHaveBeenCalledOnce()
  onChange.mockClear()
  input.onChange(1000 as never)
  expect(onChange).not.toHaveBeenCalled()
  expect(JSON.stringify(value)).toBe(original)
})

it('allows correcting one oversized historical Blindside field while retaining the other field for review', () => {
  const value = {
    ...status('blindside'),
    blindsideModifiersBasisPoints: { side: 100000, rear: 100000 },
  } as CombatEffectDefinition
  const onChange = vi.fn()
  control(SkillEffectEditor({ value, onChange }), 'Side damage (%)')!.onChange({
    currentTarget: { value: '999' },
  } as never)
  expect(onChange).toHaveBeenCalledWith({
    ...value,
    blindsideModifiersBasisPoints: { side: 99900, rear: 100000 },
  })
})

it.each([
  'First tick (% of attack damage)',
  'Decay per tick (percentage points)',
  'Backlash (% of burning unit’s hostile damage)',
])('bounds Burn’s %s updates without changing its captured percentage profile', (label) => {
  const value: CombatEffectDefinition = {
    type: 'burn',
    recipient: 'primary-unit',
    durationTurns: 1,
    damageProfile: { kind: 'attack-percentage', basisPoints: 2500, decayBasisPointsPerTick: 0 },
  }
  const onChange = vi.fn()
  const input = control(SkillEffectEditor({ value, onChange }), label)!
  input.onChange(99900 as never)
  expect(onChange).toHaveBeenCalledOnce()
  onChange.mockClear()
  input.onChange(100000 as never)
  expect(onChange).not.toHaveBeenCalled()
})
