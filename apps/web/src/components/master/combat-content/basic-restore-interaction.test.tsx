import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells))
      hooks.cells[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      hooks.cells[i],
      (next: unknown) => {
        hooks.cells[i] =
          typeof next === 'function' ? (next as (old: unknown) => unknown)(hooks.cells[i]) : next
      },
    ]
  },
  useRef(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = { current: initial }
    return hooks.cells[i]
  },
}))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
vi.mock('../../character/skill-effect-timing-context', () => ({
  useSkillEffectTimingPolicy: () => ({ version: 1, modes: {} }),
}))
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import {
  defaultBasicSkills,
  parseBasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createCombatContentAuthoringService } from '@/server/master/combat-content-authoring-service'
import { handleCombatContentAuthoringRequest } from '@/server/master/combat-content-authoring-handler'
import { BasicContentEditor } from './basic-content-editor'
import { CombatContentReviewPanel } from './combat-content-review-panel'
import { AbilityText } from './ability-editor-fields'

type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (element: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node))
    for (const child of node) {
      const result = find(child, predicate)
      if (result) return result
    }
  if (!isValidElement<Props>(node)) return null
  return predicate(node) ? node : find(node.props.children, predicate)
}
const owner = '11111111-1111-4111-8111-111111111111'
class Store extends InMemoryCombatContentRepository {
  async getOperatorRole() {
    return 'owner' as const
  }
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
})
afterEach(() => vi.unstubAllGlobals())
async function fixture(id: string = 'basic.guard') {
  const store = new Store()
  const resolver = createCombatContentResolver({
    findCurrentSkill: (key) => store.findPublished(key, 'skill'),
    findSkillVersion: async (key, version) =>
      (await store.listPublishedVersions(key)).find((row) => row.contentVersion === version) ??
      null,
  })
  const service = createCombatContentAuthoringService({ store, resolver })
  const original = structuredClone(defaultBasicSkills().find((row) => row.id === id)!)
  const first = await service.publishSkill({
    actorUserId: owner,
    definition: { ...original, name: 'Earlier published name' },
    expectedBaseVersion: 1,
  })
  const edited = structuredClone(original)
  Object.assign(edited, { name: 'Current published name' })
  Object.assign(edited.ability.behaviors[0]!, { costs: [{ resource: 'ap', amount: 29 }] })
  const current = await service.publishSkill({
    actorUserId: owner,
    definition: edited,
    expectedBaseVersion: 2,
  })
  const draft = await service.saveSkillDraft({
    actorUserId: owner,
    definition: { ...edited, name: 'Unsaved publication draft' },
    baseVersion: 3,
    expectedDraftVersion: null,
  })
  const options = defaultBasicSkills().map((definition) =>
    definition.id === id
      ? {
          id: definition.id,
          label: current.definition.name as string,
          definition: parseBasicSkillDefinition(current.definition),
          initialDraft: parseBasicSkillDefinition(draft.definition),
          currentVersion: 3,
          baseVersion: 3,
          draftVersion: 1,
          history: [
            {
              contentVersion: 3,
              source: 'published' as const,
              current: true,
              publishedAt: current.publishedAt,
            },
            {
              contentVersion: 2,
              source: 'published' as const,
              current: false,
              publishedAt: first.publishedAt,
            },
            {
              contentVersion: 1,
              source: 'static-baseline' as const,
              current: false,
              publishedAt: null,
            },
          ],
        }
      : {
          id: definition.id,
          label: definition.name,
          definition,
          currentVersion: 1,
          baseVersion: 1,
          draftVersion: null,
          history: [],
        },
  )
  const requests: Record<string, unknown>[] = []
  let hold = false
  let release: (() => void) | undefined
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string)
    requests.push(body)
    if (body.operation === 'restore-basic-draft' && hold)
      await new Promise<void>((resolve) => {
        release = resolve
      })
    return handleCombatContentAuthoringRequest(
      new Request('https://aurevane.test/api/master/combat-content', init),
      {
        getActor: async () => ({ userId: owner }),
        createService: () => service,
      },
    )
  })
  function render() {
    hooks.index = 0
    return BasicContentEditor({ basics: options, initialBasicId: id })
  }
  function panel() {
    return find(render(), (node) => node.type === CombatContentReviewPanel)!
      .props as unknown as Parameters<typeof CombatContentReviewPanel>[0]
  }
  function button(node: ReactNode, text: string) {
    const found = find(node, (row) => row.type === 'button' && row.props.children === text)
    expect(found, text).not.toBeNull()
    return found!
  }
  function request(version: number) {
    const row = find(
      CombatContentReviewPanel(panel()),
      (node) =>
        node.type === 'button' && node.props['aria-label'] === `Restore v${version} to draft`,
    )
    expect(row, `Restore v${version} button`).not.toBeNull()
    ;(row!.props.onClick as () => void)()
  }
  function confirmation() {
    return find(render(), (node) => node.props['aria-label'] === 'Confirm restore to draft')
  }
  async function confirm() {
    ;(button(confirmation(), 'Confirm restore to draft').props.onClick as () => void)()
    await vi.waitFor(() => expect(panel().busy).toBe(false))
  }
  function name() {
    return find(
      render(),
      (node) => node.type === AbilityText && node.props.label === 'Basic Skill name',
    )!
  }
  function editName(value: string) {
    ;(name().props.onChange as (value: string) => void)(value)
  }
  async function run(action: 'onValidate' | 'onDiff' | 'onPreview' | 'onConfirmPublish') {
    panel()[action]()
    await vi.waitFor(() => expect(panel().busy).toBe(false))
  }
  return {
    original,
    store,
    service,
    requests,
    current,
    draft,
    render,
    panel,
    button,
    request,
    confirmation,
    confirm,
    name,
    editName,
    run,
    holdRestore() {
      hold = true
    },
    releaseRestore() {
      expect(release).toBeTypeOf('function')
      release!()
    },
  }
}

it.each(defaultBasicSkills())(
  'restores $id through its actual editor, server and normal publication review',
  async ({ id }) => {
    const f = await fixture(id)
    const oldHistory = await f.store.listPublishedVersions(id)
    f.request(1)
    expect(f.confirmation()).not.toBeNull()
    expect(f.requests).toHaveLength(0)
    await f.confirm()
    expect(f.requests[0]).toEqual({
      operation: 'restore-basic-draft',
      skillId: id,
      targetVersion: 1,
      expectedBaseVersion: 3,
      expectedDraftVersion: 1,
    })
    expect(f.name().props.value).toBe(f.original.name)
    expect(await f.store.findDraft(id)).toMatchObject({
      definition: f.original,
      baseVersion: 3,
      draftVersion: 2,
    })
    expect(await f.store.findPublished(id)).toEqual(f.current)
    expect(await f.store.listPublishedVersions(id)).toEqual(oldHistory)
    expect(f.panel()).toMatchObject({
      baseVersion: 3,
      validation: null,
      diff: null,
      preview: null,
      publishConfirmationOpen: false,
    })
    await f.run('onValidate')
    await f.run('onDiff')
    await f.run('onPreview')
    expect(f.panel().preview?.legal).toBe(true)
    f.panel().onRequestPublish()
    expect(f.panel().publishConfirmationOpen).toBe(true)
    await f.run('onConfirmPublish')
    expect(f.panel().baseVersion).toBe(4)
    expect(
      f
        .panel()
        .history.map((row) => row.contentVersion)
        .sort(),
    ).toEqual([2, 3, 4])
    expect((await f.store.findPublished(id))!.definition).toEqual({
      ...f.original,
      contentVersion: 4,
    })
    expect((await f.store.listPublishedVersions(id)).slice(0, 2)).toEqual(oldHistory)
  },
)

it('cancels restore without a request and binds confirmation to the selected Basic', async () => {
  const f = await fixture()
  f.request(2)
  ;(f.button(f.confirmation(), 'Cancel restore').props.onClick as () => void)()
  expect(f.confirmation()).toBeNull()
  expect(f.requests).toHaveLength(0)
  f.request(1)
  const change = (id: string) => {
    const select = find(
      f.render(),
      (node) => node.type === 'select' && node.props['aria-label'] === 'Basic Skill',
    )!
    ;(select.props.onChange as (event: unknown) => void)({ currentTarget: { value: id } })
  }
  change('basic.recover.mp')
  expect(f.confirmation()).toBeNull()
  change('basic.guard')
  expect(f.confirmation()).toBeNull()
  expect(f.requests).toHaveLength(0)
})

it('preserves newer local edits during restore and advances the saved draft CAS for the next save', async () => {
  const f = await fixture()
  f.holdRestore()
  f.request(1)
  ;(f.button(f.confirmation(), 'Confirm restore to draft').props.onClick as () => void)()
  await vi.waitFor(() => expect(f.panel().busy).toBe(true))
  const restore = find(
    CombatContentReviewPanel(f.panel()),
    (node) => node.props['aria-label'] === 'Restore v2 to draft',
  )!
  expect(restore.props.disabled).toBe(true)
  f.editName('Newer local edit')
  f.releaseRestore()
  await vi.waitFor(() => expect(f.panel().busy).toBe(false))
  expect(f.name().props.value).toBe('Newer local edit')
  expect(f.panel().noticeMessage).toMatch(/newer edits.*unsaved/i)
  expect((await f.store.findDraft(f.original.id))!.definition).toEqual(f.original)
  ;(f.button(f.panel().draftActions, 'Save draft').props.onClick as () => void)()
  await vi.waitFor(() => expect(f.panel().busy).toBe(false))
  expect(f.requests.at(-1)).toMatchObject({
    operation: 'save-draft',
    baseVersion: 3,
    expectedDraftVersion: 2,
    definition: { name: 'Newer local edit' },
  })
  expect((await f.store.findDraft(f.original.id))!.draftVersion).toBe(3)
})

it('retains local draft and review when another writer wins the draft CAS', async () => {
  const f = await fixture()
  await f.run('onValidate')
  await f.run('onDiff')
  await f.run('onPreview')
  const before = f.panel()
  await f.service.saveSkillDraft({
    actorUserId: owner,
    definition: { ...f.original, name: 'Other writer' },
    baseVersion: 3,
    expectedDraftVersion: 1,
  })
  f.request(1)
  await f.confirm()
  expect(f.panel().errorMessage).toMatch(/Refresh/)
  expect(f.name().props.value).toBe('Unsaved publication draft')
  expect(f.panel().history).toEqual(before.history)
  expect(f.panel().validation).toEqual(before.validation)
  expect(f.panel().diff).toEqual(before.diff)
  expect(f.panel().preview).toEqual(before.preview)
  expect((await f.store.findDraft(f.original.id))!.definition.name).toBe('Other writer')
  expect(await f.store.findPublished(f.original.id)).toEqual(f.current)
})
