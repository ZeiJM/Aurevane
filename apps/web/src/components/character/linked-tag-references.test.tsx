import { readFileSync } from 'node:fs'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
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
function ground() {
  return actual('frostweaver.chilling-mist')
}

it.each([
  ['ironfist.breakfall', ['frozen-ground', 'rooted', 'slow']],
  ['frostweaver.chilling-mist', ['frozen-ground', 'airborne', 'fire', 'steam']],
  ['resonance.bastion-edgedancer.linked-sequence', ['frozen-ground', 'rooted', 'slow']],
] as const)(
  'carries explicit cross-tag references from actual %s to the public reader',
  (id, expected) => {
    const definition = actual(id)
    const before = JSON.stringify(definition)
    const group = definition.behaviors.find((g) =>
      g.effects.some(
        (e) =>
          e.payload.type === 'create-terrain' ||
          (e.payload.type === 'apply-status' && e.payload.statusId === 'airborne'),
      ),
    )!
    const report = abilityBehaviorInformation(group)
    const index = group.effects.findIndex(
      (e) =>
        e.payload.type === 'create-terrain' ||
        (e.payload.type === 'apply-status' && e.payload.statusId === 'airborne'),
    )
    const parts = report.effects[index]!.explanationParts
    expect(parts).toBeDefined()
    expect(
      parts!
        .filter((part) => typeof part !== 'string')
        .map((part) => (typeof part === 'string' ? '' : part.tag)),
    ).toEqual(expected)
    expect(parts!.map((part) => (typeof part === 'string' ? part : part.label)).join('')).toBe(
      report.effectDescriptions[index],
    )
    const html = renderToStaticMarkup(
      <AbilityDefinitionParameters definition={projectPublicCombat(definition)} />,
    )
    for (const tag of expected) expect(html).toContain(`data-combat-tag-reference="${tag}"`)
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('data-combat-tag-reference-trigger="true"')
    expect(JSON.stringify(definition)).toBe(before)
  },
)
it('keeps captured old Ground/Airborne/Fire help separate from current rules', () => {
  const group = ground().behaviors[0]!
  function help(options: Parameters<typeof abilityBehaviorInformation>[1]) {
    const report = abilityBehaviorInformation(group, options)
    const parts = report.effects.find(
      (effect) => effect.parts.label === 'Frozen Ground',
    )!.explanationParts
    expect(parts).toBeDefined()
    return Object.fromEntries(
      parts!
        .filter((part) => typeof part !== 'string')
        .map((part) => (typeof part === 'string' ? [] : [part.tag, part.explanation])),
    )
  }
  const current = help({})
  const old = help({
    effectContext: { legacyFrozenGround: true, legacyElemental: true, legacyAirborne: true },
  })
  expect(current['frozen-ground']).toContain('caster’s enemies')
  expect(old['frozen-ground']).toContain('either team')
  expect(current.airborne).toContain('Ground-targeted Skills always miss')
  expect(old.airborne).not.toContain('Ground-targeted Skills always miss')
  expect(current.fire).toContain('affected Frozen Ground')
  expect(old.fire).toContain('removes Wet and Frozen')
  expect(current.steam).toContain('either team')
})
it('retains explicit Steam detail references without changing its lifetime value', () => {
  const report = abilityBehaviorInformation(ground().behaviors[0]!)
  const parts = report.effects.find((effect) => effect.parts.label === 'Frozen Ground')!.parts
  const detail = parts.details!.find((row) => row.label === 'Steam lifetime')!
  expect(detail.value).toBe('Remaining Ground lifetime')
  expect(detail.labelParts).toEqual([
    expect.objectContaining({ tag: 'steam', label: 'Steam' }),
    ' lifetime',
  ])
})
it('preserves authored text even when it exactly equals generated text instead of auto-linking words', () => {
  const definition = ground()
  const descriptions = definition.behaviors.flatMap(
    (g) => abilityBehaviorInformation(g).effectDescriptions,
  )
  const html = renderToStaticMarkup(
    <AbilityDefinitionParameters
      definition={projectPublicCombat(definition)}
      effectDescriptions={descriptions}
    />,
  )
  // Only the generated secondary fact keeps its own explicit reference; authored prose is plain.
  expect(html.match(/data-combat-tag-reference="steam"/g) ?? []).toHaveLength(1)
  expect(html).not.toContain('data-combat-tag-reference="airborne"')
  const prose = renderToStaticMarkup(
    <AbilityDefinitionParameters
      definition={projectPublicCombat(definition)}
      effectDescriptions={descriptions.map(() => 'Steam <Burn> & 42% ordinary text.')}
    />,
  )
  expect(prose).toContain('Steam &lt;Burn&gt; &amp; 42% ordinary text.')
  expect(prose).not.toContain('data-combat-tag-reference="fire"')
})
it('falls back to escaped plain text if retained reference metadata no longer matches a captured description', () => {
  const report = abilityBehaviorInformation(ground().behaviors[0]!)
  const changed = {
    ...report,
    effectDescriptions: report.effectDescriptions.map(() => 'Steam <script>42%</script>'),
  }
  const html = renderToStaticMarkup(<AbilityParameters report={changed} />)
  expect(html).toContain('Steam &lt;script&gt;42%&lt;/script&gt;')
  expect(html).not.toContain('data-combat-tag-reference="airborne"')
})

it.each(['delayed', 'controlled'] as const)(
  'preserves exact %s wrapper text around typed Airborne references',
  (timing) => {
    const original = actual('ironfist.breakfall')
    const definition = parseAbilityDefinition({
      ...original,
      behaviors: original.behaviors.map((group) => ({
        ...group,
        effects: group.effects.map((effect) => ({ ...effect, timing })),
      })),
    })
    const group = definition.behaviors[0]!
    const report = abilityBehaviorInformation(group)
    const index = group.effects.findIndex((effect) => effect.payload.type === 'apply-status')
    const parts = report.effects[index]!.explanationParts!
    expect(parts.map((part) => (typeof part === 'string' ? part : part.label)).join('')).toBe(
      report.effectDescriptions[index],
    )
    expect(report.effectDescriptions[index]).not.toContain(
      timing === 'controlled'
        ? 'whole selected action'
        : 'Activates two global round boundaries later',
    )
    for (const part of parts)
      if (typeof part !== 'string') {
        expect(Object.keys(part).sort()).toEqual(['explanation', 'label', 'tag'])
        expect(typeof part.explanation).toBe('string')
      }
  },
)
it('treats an unsupported reference identity as escaped ordinary text', () => {
  const original = abilityBehaviorInformation(ground().behaviors[0]!)
  const report = {
    ...original,
    effectDescriptions: original.effectDescriptions.map(() => '<Steam>'),
    effects: original.effects.map((effect) => ({
      ...effect,
      explanationParts: [{ tag: 'constructor', label: '<Steam>', explanation: 'untrusted' }],
    })),
  } as unknown as Parameters<typeof AbilityParameters>[0]['report']
  const html = renderToStaticMarkup(<AbilityParameters report={report} />)
  expect(html).toContain('&lt;Steam&gt;')
  expect(html).not.toContain('data-combat-tag-reference="constructor"')
})

it('places modular Requirements explanations before Effects while keeping their exact tags', () => {
  const definition = actual('resonance.bastion-edgedancer.linked-sequence')
  const group = definition.behaviors[0]!
  const report = abilityBehaviorInformation(group)
  const markup = renderToStaticMarkup(<AbilityParameters report={report} />)
  if (report.requirementParts?.some((part) => typeof part !== 'string')) {
    expect(markup).toContain('aria-label="Requirement explanations"')
    expect(markup.indexOf('aria-label="Requirement explanations"')).toBeLessThan(
      markup.indexOf('aria-label="Effect explanations"'),
    )
  }
})

it('explains an effect-specific condition with linked effect prose while general Requirements remain empty', () => {
  const behavior = defaultBasicSkills().find((row) => row.id === 'basic.guard')!.ability
    .behaviors[0]!
  const conditioned = {
    ...behavior,
    effects: behavior.effects.map((effect, index) =>
      index === 0
        ? {
            ...effect,
            requirements: {
              kind: 'status-presence' as const,
              statusId: 'wet',
              subject: 'owner' as const,
              present: true,
            },
          }
        : effect,
    ),
  }
  const report = abilityBehaviorInformation(conditioned)
  const requirements = report.rows.find(([label]) => label === 'Requirements')![1]
  const effects = report.rows.find(([label]) => label === 'Effects')![1]
  expect(requirements).toBe('None')
  expect(report.effectDescriptions[0]).toContain('Applies only when Drenched [Self].')
  expect(effects).not.toContain('If ')
  expect(effects).not.toContain('Drenched')
  const html = renderToStaticMarkup(<AbilityParameters report={report} />)
  expect(html).not.toContain('aria-label="Requirement explanations"')
  const explanations = html.slice(html.indexOf('aria-label="Effect explanations"'))
  expect(explanations).toContain('data-combat-tag-reference="wet"')
  expect(html.match(/data-combat-tag-reference="wet"/gu)).toHaveLength(1)
})
