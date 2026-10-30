import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultCombatTagDefinitions } from '@aurevane/game-core/combat/combat-tag-wording'
import { tagWordingDefaults } from './tag-wording-defaults'
import { ContentDefinitionFields } from './content-definition-fields'

it('edits only full and battle descriptions for an existing engine tag', () => {
  const value = defaultCombatTagDefinitions().find((row) => row.tagId === 'dispel')!
  const onChange = vi.fn()
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="tag"
      value={{ ...value }}
      choices={[]}
      tab="Parameters"
      onChange={onChange}
    />,
  )
  expect(html).toContain('Skill Manager description')
  expect(html).toContain('Shown below Effects in full ability details.')
  expect(html).not.toContain('Master preview')
  expect(html).toContain('Battle description')
  expect(html).toContain('Leave blank to use the standard description')
  expect(html).not.toContain('Canonical Tag')
  expect(html).not.toContain('aria-label="Name"')
  expect(html).not.toContain('Enabled')
  expect(onChange).not.toHaveBeenCalled()
})

it('shows readable automatic wording without silently replacing parameter-aware templates', () => {
  const value = defaultCombatTagDefinitions().find((row) => row.tagId === 'inspired')!
  const onChange = vi.fn()
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="tag"
      value={{ ...value }}
      choices={[]}
      tab="Parameters"
      onChange={onChange}
    />,
  )
  expect(html).toContain('Deal 10% more damage per application.')
  expect(html).toContain('Automatic wording is shown using default effect values')
  expect(html).toContain('Restore automatic descriptions')
  expect(html).not.toMatch(/<textarea[^>]*><\/textarea>/)
  expect(onChange).not.toHaveBeenCalled()
  expect(value.explanation).toBe('{details}')
  expect(value.description).toBe('{summary}')
})

it('shows saved custom wording verbatim in both editors', () => {
  const value = {
    ...defaultCombatTagDefinitions()[0]!,
    explanation: 'Custom full {details}',
    description: 'Custom brief {summary}',
  }
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="tag"
      value={value}
      choices={[]}
      tab="Parameters"
      onChange={() => {}}
    />,
  )
  expect(html).toContain('Custom full {details}</textarea>')
  expect(html).toContain('Custom brief {summary}</textarea>')
})

it.each(['burn', 'bleed', 'poison'])('shows current percentage-aware defaults for %s', (id) => {
  const text = tagWordingDefaults(id)
  expect(text.short).toBe(text.full)
  expect(text.short).not.toMatch(/fixed \d+ HP|ignores.*modifiers/iu)
  expect(text.short.length).toBeGreaterThan(20)
})
it('explains the custom limit without truncating a longer automatic example', () => {
  const value = defaultCombatTagDefinitions().find((row) => row.tagId === 'airborne')!
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="tag"
      value={{ ...value }}
      choices={[]}
      tab="Parameters"
      onChange={() => {}}
    />,
  )
  expect(html).toContain('maxLength="240"')
  expect(html).toContain('select and replace or shorten it to customize')
  expect(html).toContain('0/240 characters')
})
