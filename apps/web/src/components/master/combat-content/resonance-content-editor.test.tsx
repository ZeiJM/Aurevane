import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { ContentDefinitionFields } from './content-definition-fields'
import { ContentRecordPreview } from './content-record-preview'
it('keeps explicit Any Skill matching in historical Chronist Setup', () => {
  const definition = { ...resolveResonanceForPair('chronist', 'cinderweaver')! }
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="resonance"
      value={definition}
      tab="Parameters"
      onChange={() => {}}
    />,
  )
  expect(html).toContain('aria-label="Resonance Setup matching"')
  expect(html).toContain(
    '<option value="any-skill" selected="">Any Skill in this Discipline</option>',
  )
  expect(html).toMatch(/aria-label="Resonance Setup tags"[^>]*disabled=""/)
})
it('authors retained sequence as Setup, Trigger, Result with bounded result effects', () => {
  const definition = { ...resolveResonanceForPair('lifebinder', 'vanguard')! }
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="resonance"
      value={definition}
      tab="Parameters"
      onChange={() => {}}
    />,
  )
  for (const label of [
    'Resonance mode',
    'Resonance Setup Discipline',
    'Resonance Trigger Discipline',
    'Resonance AI trigger utility',
  ])
    expect(html).toContain(`aria-label="${label}"`)
  expect(html).toContain('<legend>Result</legend>')
  expect(html).not.toContain('Payoff')
})
it('keeps immediate historical Resonance without a fabricated Setup', () => {
  const definition = { ...resolveResonanceForPair('farstrider', 'lifebinder')! }
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="resonance"
      value={definition}
      tab="Parameters"
      onChange={() => {}}
    />,
  )
  expect(html).not.toContain('aria-label="Resonance Setup Discipline"')
  expect(html).toContain('Setup: None')
  expect(html).toContain('Resonance Trigger Discipline')
})
it('uses the shared passive parameter reader and truthful illustrative context', () => {
  const definition = { ...resolveResonanceForPair('wildwarden', 'edgedancer')! }
  const html = renderToStaticMarkup(
    <ContentRecordPreview kind="resonance" working={definition} current={null} saved={null} />,
  )
  for (const field of [
    'Skill Type',
    'Cost',
    'Cooldown',
    'Requirements',
    'Range',
    'Effects',
    'Target Method',
    'Target Elevation',
    'Line of Sight',
  ])
    expect(html).toContain(`<dt>${field}</dt>`)
  expect(html).toContain('does not simulate a battle or an equipped Resonance match')
  expect(html).toContain('data-compact-effect-magnitude')
})
