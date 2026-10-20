import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { AbilityParameters } from './ability-parameters'
import { plainMechanicText } from './mechanic-text'
const rows: { id: string; after: { ability: AbilityDefinition } }[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-19-resonance-modularity-cohort.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
it('Held Formula links generic Primed with its numeric MP module', () => {
  const behavior = rows.find((row) => row.id === 'resonance.aetherist-chronist.linked-sequence')!
    .after.ability.behaviors[0]!
  const report = abilityBehaviorInformation(behavior)
  const requirement = Object.fromEntries(report.rows).Requirements
  expect(requirement).toContain('Primed [Self]')
  expect(requirement).toContain('MP [≥ 12] [Self]')
  expect(requirement).not.toMatch(/Rewind|chronist/)
  expect(plainMechanicText(report.requirementParts!)).toBe(requirement)
  const html = renderToStaticMarkup(<AbilityParameters report={report} />)
  expect(html).toContain('data-combat-tag-reference="primed"')
  expect(html).toContain('data-combat-tag-reference="resource-threshold"')
})
it('Bloodfed Cinder shows its named trigger and two real setup tags', () => {
  const behavior = rows.find((row) => row.id === 'resonance.cinderweaver-ravager.linked-sequence')!
    .after.ability.behaviors[0]!
  const before = JSON.stringify(behavior)
  const report = abilityBehaviorInformation(behavior)
  const requirement = Object.fromEntries(report.rows).Requirements
  expect(requirement).toContain('Damage Dealt')
  expect(requirement).toContain('[Cinderweaver]')
  expect(requirement).toContain('Reckless [Self]')
  expect(requirement).toContain('Burn [Affected unit]')
  expect(requirement).not.toMatch(/Same Unit|Damage Applied|HP \[≤/)
  expect(plainMechanicText(report.requirementParts!)).toBe(requirement)
  expect(JSON.stringify(behavior)).toBe(before)
})
