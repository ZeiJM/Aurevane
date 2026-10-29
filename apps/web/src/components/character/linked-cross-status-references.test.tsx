import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  parseAbilityDefinition,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
import { AbilityParameters } from './ability-parameters'
import { canonicalStatusExplanation } from './canonical-status-explanation'

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
function reportFor(id: string) {
  return abilityBehaviorInformation(actual(id).behaviors[0]!)
}

// Catch missing semantic references and prose/packet rewrites at the actual public reader boundary.
it.each([
  [
    'vanguard.shield-bash',
    1,
    ['rooted'],
    'Push the selected unit away from you. Stops before occupied, blocked or unreachable tiles. Pull never enters your tile. Rooted prevents displacement.',
  ],
  [
    'farstrider.scouts-mark',
    0,
    ['covert', 'covert'],
    'Attempt Reveal on the selected unit. A successful hit against Covert removes eligible positive statuses and Covert, then applies Revealed. Otherwise Reveal has no effect.',
  ],
  [
    'aetherist.chain-spark',
    1,
    ['burn', 'poison', 'bleed'],
    'Deal less direct damage. Reapplying keeps the stronger, longer effect. Existing Burn, Poison and Bleed damage is unchanged. Cleanse removes it; Dispel does not.',
  ],
  ['cinderweaver.ash-ward', 0, ['burn'], 'Take less damage from opponents affected by Burn.'],
] as const)(
  'links the supported cross-status terms in actual %s without rewriting its explanation',
  (id, index, tags, text) => {
    const definition = actual(id),
      before = JSON.stringify(definition),
      report = reportFor(id)
    const parts = report.effects[index]!.explanationParts
    expect(parts).toBeDefined()
    expect(parts!.map((part) => (typeof part === 'string' ? part : part.label)).join('')).toBe(text)
    expect(report.effectDescriptions[index]).toBe(text)
    const refs = parts!.filter((part) => typeof part !== 'string')
    expect(refs.map((part) => part.tag)).toEqual(tags)
    for (const ref of refs) {
      expect(Object.keys(ref).sort()).toEqual(['explanation', 'label', 'tag'])
      expect(ref.explanation).toBeTruthy()
    }
    const html = renderToStaticMarkup(
      <AbilityDefinitionParameters definition={projectPublicCombat(definition)} />,
    )
    for (const tag of new Set(tags)) expect(html).toContain(`data-combat-tag-reference="${tag}"`)
    expect(html).toContain('data-combat-tag-reference-trigger="true"')
    expect(JSON.stringify(definition)).toBe(before)
  },
)
it.each(['delayed', 'controlled'] as const)(
  'retains the %s wrapper around linked displacement prose',
  (timing) => {
    const definition = actual('vanguard.shield-bash')
    const group = definition.behaviors[0]!
    const report = abilityBehaviorInformation({
      ...group,
      effects: group.effects.map((effect) =>
        effect.payload.type === 'displace' ? { ...effect, timing } : effect,
      ),
    })
    const parts = report.effects[1]!.explanationParts
    expect(parts).toBeDefined()
    expect(parts!.filter((part) => typeof part !== 'string').map((part) => part.tag)).toEqual([
      'rooted',
    ])
    expect(parts!.map((part) => (typeof part === 'string' ? part : part.label)).join('')).toBe(
      report.effectDescriptions[1],
    )
    expect(report.effectDescriptions[1]).not.toContain(
      timing === 'delayed'
        ? 'Activates two global round boundaries later'
        : 'Controlled primes the whole selected action for free',
    )
  },
)
it('keeps conditional displacement and unrelated neighboring damage/status packets separate', () => {
  const report = reportFor('tidecaller.crushing-wave')
  expect(report.effects[0]!.explanationParts).toBeUndefined()
  expect(
    report.effects[1]!.explanationParts?.filter((part) => typeof part !== 'string').map(
      (part) => part.tag,
    ),
  ).toEqual(['rooted', 'wet'])
  expect(Object.fromEntries(report.rows).Requirements).toBe('None')
  expect(report.effectDescriptions[1]).toContain('Applies only when Drenched.')
  expect(
    report.effects[1]!.conditionParts?.filter((part) => typeof part !== 'string').map(
      (part) => part.tag,
    ),
  ).toEqual(['wet'])
  expect(report.effects[2]!.explanationParts).toBeUndefined()
  const html = renderToStaticMarkup(<AbilityParameters report={report} />)
  expect(html.match(/data-combat-tag-reference="rooted"/g) ?? []).toHaveLength(1)
  expect(html.match(/data-combat-tag-reference="wet"/g) ?? []).toHaveLength(1)
})
it('keeps captured legacy Suppress references generic without manufacturing fixed or percentage tick values', () => {
  const report = abilityBehaviorInformation(actual('aetherist.chain-spark').behaviors[0]!, {
    effectContext: { legacyTriggers: true, legacyPoisonMovement: true, legacyElemental: true },
  })
  const refs = report.effects[1]!.explanationParts?.filter((part) => typeof part !== 'string')
  expect(refs?.map((part) => part.tag)).toEqual(['burn', 'poison', 'bleed'])
  for (const ref of refs!) {
    expect(ref.explanation).toContain('damage over time')
    expect(ref.explanation).not.toMatch(/\d|<button|<script/)
  }
})
it('keeps authored descriptions plain even when they equal the generated reference sentence', () => {
  const definition = actual('vanguard.shield-bash'),
    report = abilityBehaviorInformation(definition.behaviors[0]!)
  const html = renderToStaticMarkup(
    <AbilityDefinitionParameters
      definition={projectPublicCombat(definition)}
      effectDescriptions={report.effectDescriptions}
    />,
  )
  expect(html).toContain('Rooted prevents displacement.')
  expect(html).not.toContain('data-combat-tag-reference="rooted"')
})
it('escapes stale descriptions without retaining an unrelated generated reference', () => {
  const report = reportFor('vanguard.shield-bash')
  const html = renderToStaticMarkup(
    <AbilityParameters
      report={{
        ...report,
        effectDescriptions: report.effectDescriptions.map(() => '<Rooted> Burn & Covert'),
      }}
    />,
  )
  expect(html).toContain('&lt;Rooted&gt; Burn &amp; Covert')
  expect(html).not.toContain('data-combat-tag-reference="rooted"')
  expect(html).not.toContain('data-combat-tag-reference="burn"')
  expect(html).not.toContain('data-combat-tag-reference="covert"')
})
it('leaves unsupported status identities to the existing fallback instead of accepting prototype dictionary entries', () => {
  expect(
    canonicalStatusExplanation(
      { type: 'apply-status', recipient: 'actor', statusId: 'constructor', stacks: 1 },
      {},
    ),
  ).toBeNull()
})
