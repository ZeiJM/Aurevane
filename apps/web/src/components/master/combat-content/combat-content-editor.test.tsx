import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { ContentDefinitionFields } from './content-definition-fields'
vi.mock('server-only', () => ({}))
import { COMBAT_CONTENT_CATEGORIES } from '@/server/combat/combat-content-categories'
it('keeps authored Skill text separate from stable identity and native mechanics', () => {
  const definition = {
    ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
    name: 'Named Strike',
    battleText: 'Saved unpublished action text.',
  }
  const html = renderToStaticMarkup(
    <ContentDefinitionFields kind="skill" value={definition} tab="Text" onChange={() => {}} />,
  )
  expect(html).toContain('value="Named Strike"')
  expect(html).toContain('value="Saved unpublished action text."')
  expect(html).toContain('Battle narration')
  expect(definition.id).toBe('vanguard.forceful-strike')
})
it('keeps Essence action text independently editable from catalogue flavor', () => {
  const original = resolveEssenceForBuild('vanguard', null)!
  const definition = {
    ...original,
    flavorLine: 'Catalogue flavor stays separate.',
    skill: { ...original.skill, battleText: '{actor} raises {ability}.' },
  }
  const html = renderToStaticMarkup(
    <ContentDefinitionFields kind="essence" value={definition} tab="Text" onChange={() => {}} />,
  )
  expect(html).toContain('aria-label="In-battle text"')
  expect(html).toContain('value="{actor} raises {ability}."')
  expect(html).toContain('value="Catalogue flavor stays separate."')
})
it.each(['skill', 'essence'] as const)(
  'mounts finalized and retained hook media controls on %s only in Media',
  (kind) => {
    const definition =
      kind === 'skill'
        ? { ...resolveMatureSkillVersion('vanguard.forceful-strike')! }
        : { ...resolveEssenceForBuild('vanguard', null)! }
    const html = renderToStaticMarkup(
      <ContentDefinitionFields kind={kind} value={definition} tab="Media" onChange={() => {}} />,
    )
    for (const label of ['Upload content media', 'Skill artwork hook', 'Skill audio hook'])
      expect(html).toContain(`aria-label="${label}"`)
    expect(html).not.toContain('Action Economy (AP)')
  },
)
it('mounts a dedicated retained Summon profile editor', () => {
  const definition = { ...resolveMatureSkillVersion('wildwarden.renewing-herbs')! }
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="skill"
      value={definition}
      tab="Parameters"
      onChange={() => {}}
    />,
  )
  expect(html).toContain('Summon')
  expect(html).toContain('Summon name')
  expect(html).not.toContain('derivedTags')
})
it.each(COMBAT_CONTENT_CATEGORIES.filter((row) => row.editor.defaultDefinition))(
  'mounts finite $category fields without a disconnected empty category',
  ({ editor }) => {
    const html = renderToStaticMarkup(
      <ContentDefinitionFields
        kind={editor.storedKind}
        value={editor.defaultDefinition!}
        tab="Parameters"
        onChange={() => {}}
      />,
    )
    expect(html).toContain('Name')
    expect(html).not.toContain('Complete compatibility settings')
  },
)

it('exposes Status mechanics without unsupported Enabled or ordering fields', () => {
  const value = COMBAT_CONTENT_CATEGORIES.find((row) => row.category === 'status')!.editor
    .defaultDefinition!
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="status"
      value={value}
      tab="Parameters"
      onChange={() => undefined}
    />,
  )
  expect(html).toContain('Maximum stacks')
  expect(html).toContain('Duration (owner turn starts)')
  expect(html).not.toContain('Enabled')
  expect(html).not.toContain('Display order')
})
