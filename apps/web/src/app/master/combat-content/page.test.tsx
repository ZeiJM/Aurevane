import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  InMemoryCombatContentRepository,
  type CombatContentVersionRecord,
} from '@aurevane/db/combat-content'
import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import type { CombatContentAuthoringWorkspaceProps } from '@/components/master/combat-content/combat-content-authoring-workspace'

vi.mock('server-only', () => ({}))
const source = vi.hoisted(() => ({
  read: vi.fn(),
  store: vi.fn(),
  access: vi.fn(),
  timing: vi.fn(),
}))
vi.mock('@/server/combat/combat-content-resolver', async (original) => ({
  ...(await original<object>()),
  createServerCombatContentResolver: () => ({
    resolveCurrentCatalogue: source.read,
    resolveCurrentSkillDefinition: async (id: string) =>
      (await source.read()).entries.find(
        (row: { category: string; contentKey: string }) =>
          row.category === 'skill' && row.contentKey === id,
      )?.definition ?? null,
  }),
}))
vi.mock('@/server/master/master-panel-page-access', () => ({
  requireMasterPanelPageAccess: source.access,
}))
vi.mock('@/server/master/supabase-combat-content-authoring-store', () => ({
  createSupabaseCombatContentAuthoringStore: source.store,
}))
vi.mock('@/server/master/combat-effect-timing-policy-store', () => ({
  readCombatEffectTimingPolicy: source.timing,
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
import { resolveCombatContentCatalogueSnapshot } from '@/server/combat/combat-content-resolver'
import MasterCombatContentPage from './page'

const native = resolveMatureSkillVersion('vanguard.forceful-strike')!
let store: InMemoryCombatContentRepository
function publication(
  kind: CombatContentVersionRecord['contentKind'],
  key: string,
  definition: object,
  version: number,
): CombatContentVersionRecord {
  return {
    id: `version:${key}`,
    contentKey: key,
    contentKind: kind,
    definition: definition as Record<string, unknown>,
    contentVersion: version,
    publishedBy: 'owner',
    publishedAt: '2026-10-15T12:00:00Z',
  }
}
function catalogue(publications: CombatContentVersionRecord[] = []) {
  return resolveCombatContentCatalogueSnapshot({
    token: 'a'.repeat(32),
    policy: { ...defaultCombatEffectTimingPolicy(), version: 17 },
    publications,
  })
}
async function pageProps() {
  const markup = renderToStaticMarkup(await MasterCombatContentPage())
  const encoded = markup.match(/<pre>(.*?)<\/pre>/s)![1]!
  const decoded = encoded
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  return { props: JSON.parse(decoded) as CombatContentAuthoringWorkspaceProps, markup }
}
beforeEach(() => {
  vi.clearAllMocks()
  store = new InMemoryCombatContentRepository()
  source.store.mockReturnValue(store)
  source.access.mockResolvedValue({ actor: { userId: 'owner' }, access: {} })
  source.read.mockResolvedValue(catalogue())
  source.timing.mockResolvedValue({ ...defaultCombatEffectTimingPolicy(), version: 999 })
})
it('lists authoritative custom and disabled Skills, preserving current versions and saved drafts separately', async () => {
  const custom = {
    ...native,
    id: 'owner.custom-strike',
    contentVersion: 73,
    enabled: false,
    flavorLine: 'Edited strike',
  }
  source.read.mockResolvedValue(catalogue([publication('skill', custom.id, custom, 73)]))
  const draft = { ...custom, flavorLine: 'Unpublished strike' }
  await store.saveDraft({
    contentKey: custom.id,
    contentKind: 'skill',
    definition: draft as unknown as Record<string, unknown>,
    baseVersion: 73,
    expectedDraftVersion: null,
    actorUserId: 'owner',
  })
  const { props, markup } = await pageProps()
  expect(props.skills.find((row) => row.id === custom.id)).toMatchObject({
    currentVersion: 73,
    baseVersion: 73,
    draftVersion: 1,
    definition: JSON.parse(JSON.stringify(custom)),
    initialDraft: JSON.parse(JSON.stringify(draft)),
    label: 'Custom Strike',
  })
  expect(markup).toContain('data-timing="17"')
  expect(source.read).toHaveBeenCalledTimes(1)
  expect(source.timing).not.toHaveBeenCalled()
})
it('keeps an explicitly older current Skill and the builtin history without inventing a custom baseline', async () => {
  const older = resolveMatureSkillVersion(native.id, 2)!
  const custom = { ...native, id: 'owner.custom-strike', contentVersion: 73 }
  const olderRow = publication('skill', older.id, older, 2)
  const customRow = publication('skill', custom.id, custom, 73)
  source.read.mockResolvedValue(catalogue([olderRow, customRow]))
  vi.spyOn(store, 'listPublishedVersions').mockImplementation(async (key) =>
    key === custom.id ? [customRow] : key === older.id ? [olderRow] : [],
  )
  const { props } = await pageProps()
  const option = props.skills.find((row) => row.id === native.id)!
  expect(option.definition).toEqual(older)
  expect(option.history).toEqual(
    expect.arrayContaining([
      { contentVersion: 2, source: 'published', current: true, publishedAt: olderRow.publishedAt },
      {
        contentVersion: native.contentVersion,
        source: 'static-baseline',
        current: false,
        publishedAt: null,
      },
    ]),
  )
  expect(props.skills.find((row) => row.id === custom.id)!.history).toEqual([
    { contentVersion: 73, source: 'published', current: true, publishedAt: customRow.publishedAt },
  ])
})
it('uses the same current catalogue for custom Essence and Resonance records', async () => {
  const essence = resolveEssenceForBuild('vanguard', null)!
  const resonance = resolveResonanceForPair('vanguard', 'lifebinder')!
  const changedEssence = {
    ...essence,
    essenceId: 'owner.custom-essence',
    contentVersion: 80,
    skill: { ...essence.skill, id: 'owner.custom-essence', contentVersion: 80 },
  }
  const changedResonance = { ...resonance, id: 'owner.custom-resonance', contentVersion: 81 }
  source.read.mockResolvedValue(
    catalogue([
      publication('essence', changedEssence.essenceId, changedEssence, 80),
      publication('resonance', changedResonance.id, changedResonance, 81),
    ]),
  )
  const { props } = await pageProps()
  expect(props.essences.find((row) => row.id === changedEssence.essenceId)?.definition).toEqual(
    changedEssence,
  )
  expect(props.resonances.find((row) => row.id === changedResonance.id)?.definition).toEqual(
    changedResonance,
  )
})
it('fails honestly when the authoritative catalogue is unavailable', async () => {
  source.read.mockRejectedValue(new Error('catalogue unavailable'))
  await expect(MasterCombatContentPage()).rejects.toThrow('catalogue unavailable')
})
it('checks panel access before reading private definitions or drafts', async () => {
  source.access.mockRejectedValue(new Error('denied'))
  await expect(MasterCombatContentPage()).rejects.toThrow('denied')
  expect(source.read).not.toHaveBeenCalled()
  expect(source.store).not.toHaveBeenCalled()
})
it('preserves a draft with an explicitly null base and rejects a mismatched stored kind', async () => {
  await store.saveDraft({
    contentKey: native.id,
    contentKind: 'skill',
    definition: native as unknown as Record<string, unknown>,
    baseVersion: null,
    expectedDraftVersion: null,
    actorUserId: 'owner',
  })
  expect(
    (await pageProps()).props.skills.find((row) => row.id === native.id)?.baseVersion,
  ).toBeNull()
  const wrong = new InMemoryCombatContentRepository()
  await wrong.saveDraft({
    contentKey: native.id,
    contentKind: 'status',
    definition: { id: native.id },
    baseVersion: null,
    expectedDraftVersion: null,
    actorUserId: 'owner',
  })
  source.store.mockReturnValue(wrong)
  await expect(MasterCombatContentPage()).rejects.toThrow(
    'Draft kind does not match authoritative content',
  )
})
it('keeps selected current disabled Essences and Resonances editable with their own saved drafts', async () => {
  const essence = resolveEssenceForBuild('vanguard', null)!
  const resonance = resolveResonanceForPair('vanguard', 'lifebinder')!
  const changedEssence = {
    ...essence,
    enabled: false,
    contentVersion: 80,
    skill: { ...essence.skill, contentVersion: 80 },
  }
  const changedResonance = { ...resonance, enabled: false, contentVersion: 81 }
  source.read.mockResolvedValue(
    catalogue([
      publication('essence', essence.essenceId, changedEssence, 80),
      publication('resonance', resonance.id, changedResonance, 81),
    ]),
  )
  for (const [kind, key, definition] of [
    ['essence', essence.essenceId, { ...changedEssence, description: 'Saved Essence draft.' }],
    ['resonance', resonance.id, { ...changedResonance, description: 'Saved Resonance draft.' }],
  ] as const) {
    await store.saveDraft({
      contentKey: key,
      contentKind: kind,
      definition: definition as unknown as Record<string, unknown>,
      baseVersion: definition.contentVersion,
      expectedDraftVersion: null,
      actorUserId: 'owner',
    })
  }
  const { props } = await pageProps()
  expect(props.essences.find((row) => row.id === essence.essenceId)).toMatchObject({
    currentVersion: 80,
    draftVersion: 1,
    definition: { enabled: false },
    initialDraft: { description: 'Saved Essence draft.' },
  })
  expect(props.resonances.find((row) => row.id === resonance.id)).toMatchObject({
    currentVersion: 81,
    draftVersion: 1,
    definition: { enabled: false },
    initialDraft: { description: 'Saved Resonance draft.' },
  })
})
