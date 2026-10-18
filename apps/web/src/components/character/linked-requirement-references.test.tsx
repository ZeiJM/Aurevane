import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  parseAbilityDefinition,
  type AbilityDefinition,
  type RequirementNode,
} from '@aurevane/game-core/combat/combat-definition'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { AbilityParameters } from './ability-parameters'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
import type { MechanicTextPart } from './mechanic-text'

const records: readonly { id: string; after: { ability: AbilityDefinition } }[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
function actual(id: string) {
  return parseAbilityDefinition(records.find((row) => row.id === id)!.after.ability)
}
function references(parts?: readonly MechanicTextPart[]) {
  return parts?.filter((part) => typeof part !== 'string') ?? []
}
function plain(parts?: readonly MechanicTextPart[]) {
  return parts?.map((part) => (typeof part === 'string' ? part : part.label)).join('')
}

// Catch dropped global requirements and accidental all/any flattening in the rendered reader.
it('links the actual alternative prerequisites without changing their grouping or source', () => {
  const definition = actual('shadehand.exploit-opening')
  const before = JSON.stringify(definition)
  const report = abilityBehaviorInformation(definition.behaviors[0]!)
  const html = renderToStaticMarkup(<AbilityParameters report={report} />)
  expect(html).toContain('data-combat-tag-reference="exposed"')
  expect(html).toContain('data-combat-tag-reference="mark"')
  expect(plain(report.requirementParts)).toBe('(Vulnerable or Marked)')
  expect(JSON.stringify(definition)).toBe(before)
})
it('binds a condition link only to its actual conditional effect', () => {
  const report = abilityBehaviorInformation(actual('shadehand.execution-cut').behaviors[0]!)
  expect(report.requirementParts).toBeUndefined()
  expect(report.effects[0]!.conditionParts).toBeUndefined()
  expect(plain(report.effects[1]!.conditionParts)).toBe('Vulnerable')
  const html = renderToStaticMarkup(<AbilityParameters report={report} />)
  expect(html.match(/data-combat-tag-reference="exposed"/g)).toHaveLength(1)
  expect(html).toContain('If <')
})
it('retains all subjects, absence and non-status branches around nested linked predicates', () => {
  const requirements: RequirementNode = {
    kind: 'all',
    children: [
      { kind: 'status-presence', subject: 'owner', statusId: 'root', present: false },
      {
        kind: 'any',
        children: [
          { kind: 'status-presence', subject: 'affected', statusId: 'burn', present: true },
          { kind: 'status-presence', subject: 'triggering', statusId: 'covert', present: false },
        ],
      },
      {
        kind: 'resource-state',
        subject: 'selected',
        resource: 'mp',
        comparison: 'at-least',
        basisPoints: 7500,
      },
      {
        kind: 'resource-state',
        subject: 'owner',
        resource: 'ap',
        comparison: 'at-most',
        amount: 40,
      },
      {
        kind: 'resource-threshold-crossing',
        subject: 'triggering',
        resource: 'hp',
        direction: 'below',
        thresholdBasisPoints: 3500,
      },
      { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
      {
        kind: 'action',
        classification: 'attack',
        attackFamily: 'physical',
        sourceDisciplineId: 'mark',
        requiredTags: ['burn'],
      },
      { kind: 'prime-presence', subject: 'owner', abilityId: 'burn', present: false },
      { kind: 'status-presence', subject: 'selected', statusId: 'constructor', present: true },
    ],
  }
  const report = abilityBehaviorInformation({
    ...actual('shadehand.exploit-opening').behaviors[0]!,
    requirements,
  })
  expect(plain(report.requirementParts)).toBe(
    '(No Rooted [Self] & (Burn [Area] or No Covert [Trigger]) & Each selected unit: MP ≥ 75% & You: AP ≤ 40 & Triggering unit: HP crosses below 35% & Before combat action used & attack / physical / mark / burn & You must not have burn primed & constructor)',
  )
  expect(references(report.requirementParts).map((part) => part.tag)).toEqual([
    'rooted',
    'burn',
    'covert',
  ])
})
it.each([
  ['exposed', 'Vulnerable'],
  ['mark', 'Marked'],
  ['slow', 'Slow'],
  ['guarded', 'Guard'],
  ['burn', 'Burn'],
  ['frozen', 'Chilled'],
  ['covert', 'Covert'],
  ['fortified', 'Fortified'],
  ['reckless', 'Reckless'],
  ['airborne', 'Airborne'],
  ['bleed', 'Bleed'],
  ['poison', 'Poison'],
  ['root', 'Rooted'],
  ['challenged', 'Taunted'],
  ['suppress', 'Suppress'],
  ['conductive', 'Conductive'],
  ['wet', 'Drenched'],
])('explains typed %s without assigning an active potency or lifetime', (statusId, label) => {
  const report = abilityBehaviorInformation({
    ...actual('shadehand.exploit-opening').behaviors[0]!,
    requirements: { kind: 'status-presence', subject: 'owner', statusId, present: true },
  })
  const ref = references(report.requirementParts)[0]!
  expect(ref?.label).toBe(label)
  expect(ref?.explanation).toBeTruthy()
  expect(ref?.explanation).not.toMatch(
    /Stacks:|Duration:|2 full rounds|20% Storm|next two turns|Lose [234] HP/,
  )
  expect(Object.keys(ref).sort()).toEqual(['explanation', 'label', 'tag'])
})
it('uses captured elemental policies while excluding the containing Skill damage overlap from generic help', () => {
  const group = actual('tidecaller.crushing-wave').behaviors[0]!
  const help = (
    effectContext: NonNullable<Parameters<typeof abilityBehaviorInformation>[1]>['effectContext'],
  ) =>
    references(abilityBehaviorInformation(group, { effectContext }).effects[1]!.conditionParts)[0]
      ?.explanation
  expect(help({})).toContain('Each Drenched application')
  expect(help({ explicitElemental: false })).toContain('once while active')
  expect(help({ legacyElemental: true })).toContain('Storm damage taken')
  expect(help({})).not.toContain('recipients also hit')
  expect(help({})).not.toContain('20%')
})
it('retains native Move N/A rather than linking an inapplicable requirement', () => {
  const basic = defaultBasicSkills().find((row) => row.execution.kind === 'basic-move')!
  const report = abilityBehaviorInformation(actual('shadehand.exploit-opening').behaviors[0]!, {
    basic,
  })
  expect(report.rows.find(([label]) => label === 'Requirements')?.[1]).toBe('N/A')
  expect(report.requirementParts).toBeUndefined()
})
it('renders global and conditional links even with authored escaped explanation overrides', () => {
  const a = actual('shadehand.exploit-opening'),
    b = actual('shadehand.execution-cut')
  const definition = { ...a, behaviors: [a.behaviors[0]!, b.behaviors[0]!] }
  const html = renderToStaticMarkup(
    <AbilityDefinitionParameters
      definition={projectPublicCombat(definition)}
      effectDescriptions={['<Burn> ordinary text', '<Burn> ordinary text', '<Burn> ordinary text']}
    />,
  )
  expect(html.match(/data-combat-tag-reference="exposed"/g)).toHaveLength(2)
  expect(html.match(/data-combat-tag-reference="mark"/g)).toHaveLength(1)
  expect(html).toContain('&lt;Burn&gt; ordinary text')
  expect(html).not.toContain('data-combat-tag-reference="burn"')
})
it('falls back to captured plain global and effect strings when optional parts are stale or absent', () => {
  const base = abilityBehaviorInformation(actual('shadehand.execution-cut').behaviors[0]!)
  const report = {
    ...base,
    requirementParts: [{ tag: 'burn', label: 'Burn', explanation: 'wrong' }],
    effects: base.effects.map((effect) => ({
      ...effect,
      conditionParts: [{ tag: 'burn', label: 'Burn', explanation: 'wrong' }],
    })),
  } as unknown as Parameters<typeof AbilityParameters>[0]['report']
  const html = renderToStaticMarkup(<AbilityParameters report={report} />)
  expect(html).toContain('Each selected unit: HP ≤ 35%')
  expect(html).toContain('If Vulnerable: ')
  expect(html).not.toContain('data-combat-tag-reference="burn"')
})

it.each(['wet', 'conductive'])(
  'does not claim per-application Storm scaling for generic legacy %s when the oldest fixed-bonus policy is not distinguished',
  (statusId) => {
    const report = abilityBehaviorInformation(
      {
        ...actual('shadehand.exploit-opening').behaviors[0]!,
        requirements: { kind: 'status-presence', subject: 'selected', statusId, present: true },
      },
      { effectContext: { legacyElemental: true } },
    )
    const help = references(report.requirementParts)[0]!.explanation!
    expect(help).toContain('Storm damage')
    expect(help).not.toMatch(/per active|per application|20%/)
    expect(help).toContain(statusId === 'wet' ? 'Fire removes' : 'consum')
  },
)
