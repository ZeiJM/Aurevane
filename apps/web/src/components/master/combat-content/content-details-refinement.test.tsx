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
  const artwork = renderToStaticMarkup(
    <ContentDefinitionFields kind="discipline" tab="Media" value={value} onChange={() => {}} />,
  )
  expect(artwork).toContain('/media/art/discipline-sigils/aetherist-sigil-v01.webp')
  expect(html).not.toContain('Upload content media')
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

it('spaces the description and flavor fields and explains their in-game locations without expandable wording controls', async () => {
  const { latestEnabledMatureSkills } = await import('@aurevane/game-core/combat/mature-skills')
  const value = { ...latestEnabledMatureSkills()[0]! }
  const html = renderToStaticMarkup(
    <ContentDefinitionFields kind="skill" tab="Text" value={value} onChange={() => {}} />,
  )
  expect(html).toContain('descriptionFields')
  expect(html).toContain('writingField')
  expect(html).toContain('Shown in the full ability details.')
  expect(html).toContain('Shown on the Skill card.')
  expect(html).toContain('aria-label="In-battle text"')
  expect(html).toContain('aria-label="Full public description"')
  expect(html).toContain('About Flavor line tags')
  expect(html).not.toContain('Wording overrides')
  expect(html).not.toContain('References and writing preview')
  expect(html).not.toContain('mechanical parameters')
  expect(html).not.toContain('Master preview')
  expect(html).not.toContain('Master player preview')
})
