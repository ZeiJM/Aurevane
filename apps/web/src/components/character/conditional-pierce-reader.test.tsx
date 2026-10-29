import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  parseAbilityDefinition,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { abilityBehaviorInformation } from '@/components/character/ability-detail-presentation'
import { AbilityDefinitionParameters } from '@/components/character/ability-definition-parameters'
import { AbilityParameters } from '@/components/character/ability-parameters'
const rows: readonly { id: string; after: { ability: AbilityDefinition } }[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
function actual(id: string) {
  return parseAbilityDefinition(rows.find((row) => row.id === id)!.after.ability)
}
it.each(['bastion.hold-fast', 'essence.bastion.last-bastion'])(
  'reports the finite reserve in actual public %s',
  (id) => {
    const definition = actual(id)
    const before = JSON.stringify(definition)
    const html = renderToStaticMarkup(
      <AbilityDefinitionParameters definition={projectPublicCombat(definition)} />,
    )
    expect(html).toContain('Once per battle')
    expect(JSON.stringify(definition)).toBe(before)
  },
)
it.each(['wildwarden.field-remedy', 'essence.dawnshield.dawns-oath'])(
  'keeps historical Cleanse recovery eligibility beside its effect and general Requirements empty for %s',
  (id) => {
    const definition = actual(id)
    const before = JSON.stringify(definition)
    const report = abilityBehaviorInformation(definition.behaviors[0]!)
    expect(report.effects[1]!.condition).not.toBeNull()
    expect(Object.fromEntries(report.rows).Requirements).toBe('None')
    expect(report.effectDescriptions[1]).toContain(
      `Applies only when ${report.effects[1]!.condition}.`,
    )
    expect(report.effectDescriptions[1]).not.toContain('only if')
    const html = renderToStaticMarkup(
      <AbilityDefinitionParameters definition={projectPublicCombat(definition)} />,
    )
    expect(html).not.toContain('If (')
    expect(report.effectDescriptions[0]).toContain('Poison')
    expect(JSON.stringify(definition)).toBe(before)
  },
)
it.each([
  'conditional-cleanse',
  'different-recipient',
  'different-subject',
  'different-status-list',
  'non-percentage-recovery',
] as const)('preserves meaningful recovery conditions for %s', (variant) => {
  const group = actual('essence.dawnshield.dawns-oath').behaviors[0]!
  const cleanse = group.effects[0]!
  const recovery = group.effects[1]!
  if (
    cleanse.payload.type !== 'remove-status' ||
    recovery.payload.type !== 'percentage-recovery' ||
    recovery.requirements?.kind !== 'any'
  )
    throw new Error('Expected the actual conditional Cleanse/recovery fixture.')
  const requirements = recovery.requirements
  const effects = [
    {
      ...cleanse,
      ...(variant === 'conditional-cleanse'
        ? {
            requirements: {
              kind: 'resource-state' as const,
              subject: 'owner' as const,
              resource: 'mp' as const,
              comparison: 'at-least' as const,
              amount: 1,
            },
          }
        : {}),
      payload: {
        ...cleanse.payload,
        ...(variant === 'different-recipient' ? { recipient: 'actor' as const } : {}),
        ...(variant === 'different-status-list'
          ? { statusIds: cleanse.payload.statusIds.filter((id) => id !== 'poison') }
          : {}),
      },
    },
    {
      ...recovery,
      requirements:
        variant === 'different-subject'
          ? {
              ...requirements,
              children: requirements.children.map((child) =>
                child.kind === 'status-presence' ? { ...child, subject: 'owner' as const } : child,
              ),
            }
          : requirements,
      payload:
        variant === 'non-percentage-recovery'
          ? { type: 'healing' as const, recipient: recovery.payload.recipient, amount: 9 }
          : recovery.payload,
    },
    ...group.effects.slice(2),
  ]
  const definition = { ...group, effects }
  const before = JSON.stringify(definition)
  const report = abilityBehaviorInformation(definition)
  expect(report.effects[1]!.condition).not.toBeNull()
  expect(Object.fromEntries(report.rows).Requirements).toBe('None')
  expect(report.effectDescriptions[1]).toContain(
    `Applies only when ${report.effects[1]!.condition}.`,
  )
  expect(Object.fromEntries(report.rows).Effects).not.toContain('If ')
  expect(report.effectDescriptions[1]).not.toContain(
    'Applies only if the recipient has an effect that Cleanse can remove.',
  )
  expect(JSON.stringify(definition)).toBe(before)
})
it.each([
  ['resonance.ravager-wildwarden.linked-sequence', 'HP [≤ 50%] [Target]'],
  ['resonance.aetherist-frostweaver.linked-sequence', 'MP [≥ 50%] [Self]'],
  ['resonance.edgedancer-tidecaller.linked-sequence', 'MP [≤ 30%] [Self]'],
])('keeps the actual condition once in the full public report for %s', (id, condition) => {
  const definition = actual(id!)
  const before = JSON.stringify(definition)
  const group = definition.behaviors[0]!
  const index = group.effects.findIndex((effect) => effect.requirements)
  const report = abilityBehaviorInformation(group)
  expect(report.effects[index]!.condition).toBe(condition)
  expect(Object.fromEntries(report.rows).Requirements).not.toContain(condition)
  expect(report.effectDescriptions[index]).toContain(`Applies only when ${condition}.`)
  expect(Object.fromEntries(report.rows).Effects).not.toContain('If ')
  expect(
    report.effectDescriptions[index]!.replace(` Applies only when ${condition}.`, ''),
  ).not.toMatch(/^If |\d/)
  const html = renderToStaticMarkup(
    <AbilityDefinitionParameters definition={projectPublicCombat(definition)} />,
  )
  expect(html).not.toContain(`If ${condition}: `)
  expect(html.replace(/<[^>]*>/gu, '').split(condition)).toHaveLength(2)
  expect(html).toContain('<dt>Requirements</dt>')
  expect(report.effects.map((effect) => effect.condition)).toEqual(
    group.effects.map((effect, i) => (i === index ? condition : null)),
  )
  expect(JSON.stringify(definition)).toBe(before)
})
it.each([
  ['vanguard.guard-break', 11, 50],
  ['farstrider.piercing-barrage', 10, 50],
  ['runeblade.aether-cut', 15, 50],
  ['resonance.aetherist-vanguard.spellsteel-rhythm', 12, 30],
])('retains exact Pierce bypass once in actual public %s', (id, amount, percent) => {
  const definition = actual(String(id))
  const before = JSON.stringify(definition)
  const group = definition.behaviors[0]!
  const index = group.effects.findIndex((effect) => effect.payload.type === 'pierce')
  const report = abilityBehaviorInformation(group)
  expect(report.effects[index]!.parts).toMatchObject({
    label: 'Pierce',
    magnitude: String(amount),
    details: expect.arrayContaining([{ label: 'Armor ignored', value: `${percent}%` }]),
  })
  expect(report.effectDescriptions[index]).not.toContain(`${percent}%`)
  expect(report.effectDescriptions[index]).toContain('only to equipment Armor')
  expect(report.effectDescriptions[index]).toContain('Without equipment Armor')
  const html = renderToStaticMarkup(
    <AbilityDefinitionParameters definition={projectPublicCombat(definition)} />,
  )
  expect(html.split(`Armor ignored: ${percent}%.`)).toHaveLength(2)
  expect(html).not.toContain(`Ignores ${percent}%`)
  expect(JSON.stringify(definition)).toBe(before)
})
it('keeps nested effect requirements aligned while prose stays plain and global requirements stay separate', () => {
  const original = actual('resonance.aetherist-frostweaver.linked-sequence')
  const group = original.behaviors[0]!
  const nested = parseAbilityDefinition({
    ...original,
    behaviors: [
      {
        ...group,
        requirements: {
          kind: 'resource-state',
          subject: 'owner',
          resource: 'ap',
          comparison: 'at-least',
          amount: 9,
        },
        effects: group.effects.map((effect, index) =>
          index === 1
            ? {
                ...effect,
                requirements: {
                  kind: 'any',
                  children: [
                    effect.requirements!,
                    {
                      kind: 'status-presence',
                      subject: 'selected',
                      statusId: 'marked',
                      present: true,
                    },
                  ],
                },
              }
            : effect,
        ),
      },
    ],
  })
  const report = abilityBehaviorInformation(nested.behaviors[0]!)
  const condition = '(MP [≥ 50%] [Self] or Marked)'
  expect(report.effects.map((effect) => effect.condition)).toEqual([null, condition, null])
  expect(Object.fromEntries(report.rows).Requirements).toBe('AP [≥ 9] [Self]')
  expect(Object.fromEntries(report.rows).Effects).not.toContain('If ')
  expect(report.effectDescriptions[1]).toBe(
    `Restore MP to yourself, without exceeding the maximum. Recovery cannot revive a defeated unit. Applies only when ${condition}.`,
  )
  const html = renderToStaticMarkup(<AbilityParameters report={report} />)
  expect(html.replace(/<[^>]*>/gu, '').split(condition)).toHaveLength(2)
  expect(html).not.toContain(`If ${condition}:`)
  expect(html.replace(/<[^>]*>/gu, '')).toContain('AP [≥ 9] [Self]')
})
it('preserves authored conditional text exactly as escaped text without stripping repeated numbers', () => {
  const definition = actual('resonance.edgedancer-tidecaller.linked-sequence')
  const authored = ['Move <carefully> & wait 2.', null, 'If You: MP ≤ 30%: authored <note>.']
  const before = JSON.stringify({ definition, authored })
  const html = renderToStaticMarkup(
    <AbilityDefinitionParameters
      definition={projectPublicCombat(definition)}
      effectDescriptions={authored}
    />,
  )
  expect(html).toContain('Move &lt;carefully&gt; &amp; wait 2.')
  expect(html).toContain('If You: MP ≤ 30%: authored &lt;note&gt;.')
  expect(html).not.toContain('<note>')
  expect(html).toContain('data-compact-effect-magnitude="true">[3]</span>')
  expect(JSON.stringify({ definition, authored })).toBe(before)
})
it('retains a captured custom Pierce percentage and Basic scaling with equipment-only plain prose', () => {
  const basic = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!
  const group = basic.ability.behaviors[0]!
  const definition = parseAbilityDefinition({
    ...basic.ability,
    behaviors: [
      {
        ...group,
        effects: group.effects.map((effect) => ({
          ...effect,
          payload: { ...effect.payload, type: 'pierce', armorIgnoredBasisPoints: 3333 },
        })),
      },
    ],
  })
  const before = JSON.stringify(definition)
  const report = abilityBehaviorInformation(definition.behaviors[0]!, {
    basic,
    stats: { physicalPower: 20, mysticPower: 40 },
  })
  expect(report.effects[0]!.parts.details).toContainEqual({
    label: 'Armor ignored',
    value: '33.33%',
  })
  expect(report.effects[0]!.parts.magnitude).toContain('Mystic Power')
  expect(report.effectDescriptions[0]).not.toContain('33.33%')
  expect(report.effectDescriptions[0]).toContain('only to equipment Armor')
  expect(report.effectDescriptions[0]).toContain('Physical wins ties')
  expect(JSON.stringify(definition)).toBe(before)
})
