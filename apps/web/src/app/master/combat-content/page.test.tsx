import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import type { CombatContentAuthoringWorkspaceProps } from '@/components/master/combat-content/combat-content-authoring-workspace'
vi.mock('server-only', () => ({}))
const source = vi.hoisted(() => ({
  read: vi.fn(),
  list: vi.fn(),
  record: vi.fn(),
  access: vi.fn(),
  store: vi.fn(),
}))
vi.mock('@/server/combat/combat-content-resolver', () => ({
  createServerCombatContentResolver: () => ({ resolveCurrentCatalogue: source.read }),
}))
vi.mock('@/server/master/master-panel-page-access', () => ({
  requireMasterPanelPageAccess: source.access,
}))
vi.mock('@/server/master/supabase-combat-content-authoring-store', () => ({
  createSupabaseCombatContentAuthoringStore: source.store,
}))
vi.mock('@/components/master/master-panel-shell', () => ({
  MasterPanelShell: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/character/skill-effect-timing-context', () => ({
  SkillEffectTimingProvider: ({
    policy,
    children,
  }: {
    policy: { version: number }
    children: React.ReactNode
  }) => <div data-timing={policy.version}>{children}</div>,
}))
vi.mock('@/components/master/combat-content/combat-content-authoring-workspace', () => ({
  CombatContentAuthoringWorkspace: (props: CombatContentAuthoringWorkspaceProps) => (
    <pre>{JSON.stringify(props)}</pre>
  ),
}))
import MasterCombatContentPage from './page'
async function pageProps() {
  const markup = renderToStaticMarkup(await MasterCombatContentPage())
  const encoded = markup.match(/<pre>(.*?)<\/pre>/s)![1]!
  return {
    markup,
    props: JSON.parse(
      encoded
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>'),
    ) as CombatContentAuthoringWorkspaceProps,
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  source.access.mockResolvedValue({ actor: { userId: 'owner' }, access: {} })
  source.store.mockReturnValue({ listRecords: source.list, readRecord: source.record })
  source.read.mockResolvedValue({
    policy: { ...defaultCombatEffectTimingPolicy(), version: 17 },
    entries: defaultBasicSkills().map((definition) => ({
      category: 'basic',
      contentKind: 'skill',
      contentKey: definition.id,
      definition,
    })),
  })
  source.list.mockResolvedValue({
    records: [
      {
        contentKey: 'discipline.custom',
        contentKind: 'discipline',
        name: 'Custom',
        lifecycle: 'draft',
        revision: 4,
      },
    ],
    nextCursor: 'next',
  })
  source.record.mockResolvedValue({
    contentKey: 'discipline.custom',
    contentKind: 'discipline',
    revision: 4,
    lifecycle: 'draft',
    builtin: null,
    current: null,
    draft: {
      definition: { id: 'discipline.custom', name: 'Saved custom' },
      baseVersion: null,
      draftVersion: 2,
    },
    history: [],
    usedBy: [],
    links: [],
  })
})
it('loads one bounded metadata page and only its selected complete record, preserving saved revisions and null base', async () => {
  const { props, markup } = await pageProps()
  expect(source.list).toHaveBeenCalledWith({ kind: 'discipline', sort: 'name-asc', limit: 20 })
  expect(source.record).toHaveBeenCalledExactlyOnceWith('discipline.custom')
  expect(props.initialPage?.nextCursor).toBe('next')
  expect(props.initialRecord?.draft).toMatchObject({
    baseVersion: null,
    draftVersion: 2,
    definition: { name: 'Saved custom' },
  })
  expect(markup).toContain('data-timing="17"')
  expect(source.read).toHaveBeenCalledTimes(1)
})
it('exposes every auxiliary as a reference independently of the selected slot and supplies serializable category defaults', async () => {
  const { props } = await pageProps()
  expect(
    props.references
      ?.filter((row) => row.contentKind === 'skill')
      .map((row) => row.contentKey)
      .sort(),
  ).toEqual(
    defaultBasicSkills()
      .map((row) => row.id)
      .sort(),
  )
  expect(props.categories?.map((row) => row.category)).toEqual(
    expect.arrayContaining([
      'basic',
      'skill',
      'essence',
      'resonance',
      'discipline',
      'tag',
      'item',
      'ascension',
      'severence',
    ]),
  )
  expect(props.categories?.find((row) => row.category === 'item')?.publicationBlocker).toBeTruthy()
})
it('preserves selected current, deeper history and disabled custom content without synthesizing a baseline', async () => {
  const record = {
    contentKey: 'discipline.custom',
    contentKind: 'discipline',
    lifecycle: 'active',
    revision: 6,
    builtin: null,
    current: { contentVersion: 2, definition: { enabled: false } },
    history: [
      { contentVersion: 2 },
      { contentVersion: 73 },
      { contentVersion: 74 },
      { contentVersion: 75 },
    ],
    draft: null,
  }
  source.record.mockResolvedValue(record)
  expect((await pageProps()).props.initialRecord).toEqual(record)
})
it('avoids a record read when the initial category is empty', async () => {
  source.list.mockResolvedValue({ records: [], nextCursor: null })
  expect((await pageProps()).props.initialRecord).toBeNull()
  expect(source.record).not.toHaveBeenCalled()
})
it('checks panel access before private catalogue or store access', async () => {
  source.access.mockRejectedValue(new Error('denied'))
  await expect(MasterCombatContentPage()).rejects.toThrow('denied')
  expect(source.read).not.toHaveBeenCalled()
  expect(source.store).not.toHaveBeenCalled()
})
it('fails honestly when the authoritative catalogue is unavailable', async () => {
  source.read.mockRejectedValue(new Error('catalogue unavailable'))
  await expect(MasterCombatContentPage()).rejects.toThrow('catalogue unavailable')
})

it('passes current Tag wording from the same catalogue call into previews without another source read', async () => {
  const tags = [
    {
      contentKey: 'tag.damage',
      contentVersion: 8,
      tagId: 'damage',
      name: 'Impact',
      compact: 'Impact power.',
      full: 'Current exact catalogue explanation.',
    },
  ]
  source.read.mockResolvedValueOnce({
    policy: defaultCombatEffectTimingPolicy(),
    entries: [],
    tagPresentations: tags,
  })
  const { props } = await pageProps()
  expect(props.tagPresentations).toEqual(tags)
  expect(source.read).toHaveBeenCalledTimes(1)
  expect(source.record).toHaveBeenCalledTimes(1)
})
