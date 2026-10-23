import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { SUPPORT_ACTION_IDS } from '@aurevane/game-core/combat/support-actions'
import { EffectTagLabel } from '@/components/character/compact-skill-effect-summary'
import { ContentRecordPreview } from './content-record-preview'
import { CombatContentAuthoringWorkspace } from './combat-content-authoring-workspace'
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
import { COMBAT_CONTENT_CATEGORIES } from '@/server/combat/combat-content-categories'
it.each(SUPPORT_ACTION_IDS)(
  'mounts the complete-record editor for independent %s authoring',
  (id) => {
    const definition = defaultBasicSkills().find((row) => row.id === id)!
    const record = {
      contentKey: id,
      contentKind: 'skill' as const,
      lifecycle: 'active' as const,
      revision: 1,
      versionFloor: 1,
      createdBy: null,
      createdAt: null,
      builtin: { contentVersion: 1, name: definition.name },
      builtinDefinition: { ...definition },
      current: null,
      draft: null,
      history: [],
      links: [],
      usedBy: [],
    }
    const props = {
      initialRecord: record,
      categories: COMBAT_CONTENT_CATEGORIES.map((row) => row.editor),
      initialPage: {
        records: [
          {
            contentKey: id,
            contentKind: 'skill' as const,
            lifecycle: 'active' as const,
            revision: 1,
            name: definition.name,
          },
        ],
        nextCursor: null,
      },
    }
    const html = renderToStaticMarkup(<CombatContentAuthoringWorkspace {...props} />)
    expect(html).toContain('Save draft')
    expect(html).toContain('Publish saved draft')
    expect(html).toContain('Parameters')
    expect(html).toContain('History')
    expect(html).toContain('New')
    expect(html).toContain(definition.name)
    expect(html).not.toContain('Confirm rollback')
  },
)

it.each(['basic.recover', 'basic.recover.mp'])(
  'uses the shared full reader and distinct actual %s message receipt shape',
  (id) => {
    const definition = defaultBasicSkills().find((row) => row.id === id)!
    const html = renderToStaticMarkup(
      <ContentRecordPreview kind="skill" working={{ ...definition }} saved={null} current={null} />,
    )
    const text = html.replace(/<[^>]+>/g, '')
    expect(html).toContain('data-testid="skill-details"')
    expect(text).toContain(id === 'basic.recover' ? '+37 HP' : '+37 MP')
    if (id === 'basic.recover.mp') expect(text).not.toContain('+37 HP')
    expect(text).not.toMatch(/Accuracy|chanceBasisPoints/)
    expect(text).toContain('does not simulate a battle')
  },
)

it('renders current catalogue Tag wording in raw authoring previews without modifying the saved definition', () => {
  const definition = structuredClone(
    defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!,
  )
  const original = structuredClone(definition)
  const tag = {
    contentKey: 'tag.damage',
    contentVersion: 8,
    tagId: 'damage',
    name: 'Impact',
    compact: 'Changed damage wording.',
    full: 'Snapshot published explanation.',
  }
  const html = renderToStaticMarkup(
    <ContentRecordPreview
      kind="skill"
      working={{ ...definition }}
      saved={null}
      current={null}
      tagPresentations={[tag]}
    />,
  )
  expect(html).toContain('Explain Impact')
  // The real popover mounts its body only when opened; inspect the shared label's actual body separately.
  expect(
    renderToStaticMarkup(EffectTagLabel({ label: 'Damage', tagPresentation: tag }).props.children),
  ).toContain('Snapshot published explanation.')
  expect(html).toContain('data-tag-version="8"')
  expect(definition).toEqual(original)
  expect(definition.ability).not.toHaveProperty('tagPresentation')
})
