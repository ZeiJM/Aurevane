import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { SUPPORT_ACTION_IDS } from '@aurevane/game-core/combat/support-actions'
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
