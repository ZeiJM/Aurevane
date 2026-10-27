import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { COMBAT_CONTENT_CATEGORIES } from '@/server/combat/combat-content-categories'
import { ContentDefinitionFields, ContentReferenceSelect } from './content-definition-fields'

it('previews the real foundation class icon and merges description into details without mystery ratings', () => {
  const value = {
    ...COMBAT_CONTENT_CATEGORIES.find((entry) => entry.editor.category === 'discipline')!.editor
      .defaultDefinition!,
    id: 'aetherist',
    name: 'Aetherist',
    description: 'Editable class description.',
  }
  const original = structuredClone(value)
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="discipline"
      tab="Parameters"
      value={value}
      onChange={() => {}}
    />,
  )
  expect(html).toContain('/media/art/discipline-sigils/aetherist-sigil-v01.webp')
  expect(html).toContain('Editable class description.')
  expect(html).not.toContain('Progression band')
  expect(html).not.toContain('ruleAccess presentation')
  expect(value).toEqual(original)
})

it('keeps the selection field and removes the redundant expandable Find helper', () => {
  const html = renderToStaticMarkup(
    <ContentReferenceSelect
      label="Partner Discipline"
      value="bastion"
      choices={[{ contentKey: 'bastion', contentKind: 'discipline', name: 'Bastion' }]}
      kind="discipline"
      onChange={() => {}}
    />,
  )
  expect(html).toContain('Bastion')
  expect(html).toContain('<select')
  expect(html).not.toContain('<details')
  expect(html).not.toContain('Find Partner')
})

it('keeps the Essence display text and executable skill text in sync when edited', async () => {
  const { withContentIdentityText } = await import('./content-definition-fields')
  const definition = {
    essenceId: 'essence.bastion',
    name: 'Old power',
    description: 'Old description',
    skill: { id: 'essence.bastion', name: 'Old power', description: 'Old description' },
  }
  const renamed = withContentIdentityText('essence', definition, 'name', 'New power')
  expect(renamed.name).toBe('New power')
  expect(renamed.skill).toMatchObject({ id: 'essence.bastion', name: 'New power' })
  expect(
    withContentIdentityText('essence', renamed, 'description', 'New description').skill,
  ).toMatchObject({ description: 'New description' })
  expect(definition.skill.name).toBe('Old power')
})
