import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import type { AbilityBehavior, RequirementNode } from '@aurevane/game-core/combat/combat-definition'
import {
  abilityBehaviorInformation,
  abilityRequirementDescription,
} from './ability-detail-presentation'
import { AbilityParameters } from './ability-parameters'
import { plainMechanicText } from './mechanic-text'

function report(requirements: RequirementNode | null) {
  const group: AbilityBehavior = {
    ...defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!,
    requirementMode: 'simple',
    requirements,
  }
  return abilityBehaviorInformation(group)
}

it('shows a linked status tag and its Target explicitly', () => {
  const r = report({ kind: 'status-presence', subject: 'selected', statusId: 'wet', present: true })
  expect(Object.fromEntries(r.rows).Requirements).toBe('Drenched [Target]')
  expect(plainMechanicText(r.requirementParts!)).toBe('Drenched [Target]')
  const html = renderToStaticMarkup(<AbilityParameters report={r} />)
  expect(html).toMatch(/<strong[^>]*data-combat-tag-reference="wet"[^>]*>Drenched<\/strong>/)
  expect(html).toContain('aria-label="Requirement explanations"')
  expect(html).toContain('data-effect-tag-label="true">Drenched</span>')
  const explanation = r.requirementParts!.find((part) => typeof part !== 'string')!.explanation
  expect(html).toContain(renderToStaticMarkup(<>{explanation}</>))
})

it.each([
  ['hp', 'less-than', 'HP less than', 'hp-less-than'],
  ['hp', 'more-than', 'HP more than', 'hp-more-than'],
  ['mp', 'less-than', 'MP less than', 'mp-less-than'],
  ['mp', 'more-than', 'MP more than', 'mp-more-than'],
] as const)(
  'links the predefined %s %s requirement tag with its percentage',
  (resource, comparison, label, tag) => {
    const r = report({
      kind: 'resource-state',
      subject: 'owner',
      resource,
      comparison,
      basisPoints: 4050,
    })
    expect(Object.fromEntries(r.rows).Requirements).toBe(`${label} [40.5%] [Self]`)
    expect(plainMechanicText(r.requirementParts!)).toBe(`${label} [40.5%] [Self]`)
    const html = renderToStaticMarkup(<AbilityParameters report={r} />)
    expect(html).toContain(`data-combat-tag-reference="${tag}"`)
    expect(r.requirementParts!.find((part) => typeof part !== 'string')?.explanation).toContain(
      'strictly',
    )
  },
)

it('renders None without adding an event or action prerequisite', () => {
  const r = report(null)
  expect(Object.fromEntries(r.rows).Requirements).toBe('None')
  expect(r.requirementParts).toBeUndefined()
  expect(renderToStaticMarkup(<AbilityParameters report={r} />)).not.toContain(
    'aria-label="Requirement explanations"',
  )
})

it('keeps automatic timing outside the simple requirement line', () => {
  const r = abilityBehaviorInformation({
    ...defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!,
    activation: 'automatic',
    requirementMode: 'simple',
    automaticTrigger: 'damage-dealt',
    automaticTarget: { subject: 'affected' },
    requirements: { kind: 'status-presence', subject: 'affected', statusId: 'burn', present: true },
  })
  expect(Object.fromEntries(r.rows).Requirements).toBe('Burn [Target]')
  const html = renderToStaticMarkup(<AbilityParameters report={r} />)
  expect(html).toContain('Automatic: Damage Dealt')
  expect(html.slice(0, html.indexOf('</dl>'))).not.toContain('Damage Dealt')
})

const candidate = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-19-simple-requirements-cohort.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  records: { id: string; after: { ability: { behaviors: AbilityBehavior[] } } }[]
}
it.each(candidate.records)(
  '$id renders its complete saved requirement as one tag or None',
  (row) => {
    for (const behavior of row.after.ability.behaviors) {
      const result = abilityBehaviorInformation(behavior)
      const requirement = Object.fromEntries(result.rows).Requirements!
      const root = abilityRequirementDescription(behavior.requirements, behavior)
      expect(root).toMatch(
        /^(None|[^\[\]&]+ \[(Self|Target)\]|(?:HP|MP) (?:less|more) than \[[\d.]+%\] \[(Self|Target)\])$/,
      )
      if (root !== 'None') expect(requirement).toContain(root)
      for (const effect of result.effects)
        if (effect.condition) {
          expect(requirement).toContain(`${effect.parts.label}: ${effect.condition}`)
          expect(Object.fromEntries(result.rows).Effects).not.toContain(effect.condition)
        }
      expect(requirement).not.toMatch(/After|Tidecaller|Trigger|Action|\bIf\b/)
      const html = renderToStaticMarkup(<AbilityParameters report={result} />)
      expect(html.match(/<dt>/g)).toHaveLength(9)
      if (requirement !== 'None') expect(html).toContain('data-combat-tag-reference=')
      if (result.automaticActivation)
        expect(html.slice(0, html.indexOf('</dl>'))).not.toContain('Automatic:')
    }
  },
)
