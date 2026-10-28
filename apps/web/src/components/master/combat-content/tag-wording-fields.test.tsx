import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultCombatTagDefinitions } from '@aurevane/game-core/combat/combat-tag-wording'
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
  expect(html).toContain('Battle description')
  expect(html).toContain('Leave blank to use the standard description')
  expect(html).not.toContain('Canonical Tag')
  expect(html).not.toContain('aria-label="Name"')
  expect(html).not.toContain('Enabled')
  expect(onChange).not.toHaveBeenCalled()
})
