import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { SUPPORT_ACTION_IDS } from '@aurevane/game-core/combat/support-actions'
import type {
  CompleteCombatContentRecord,
  CombatContentDefinition,
} from '@aurevane/db/combat-content'
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
import { COMBAT_CONTENT_CATEGORIES } from '@/server/combat/combat-content-categories'
import { CombatContentAuthoringWorkspace } from './combat-content-authoring-workspace'
import { ContentDefinitionFields } from './content-definition-fields'
type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (element: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = find(child, predicate)
      if (result) return result
    }
  }
  if (!isValidElement<Props>(node)) return null
  return predicate(node) ? node : find(node.props.children, predicate)
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
})
afterEach(() => vi.unstubAllGlobals())
function fixture(id: string = 'basic.guard', override: Partial<CompleteCombatContentRecord> = {}) {
  const definition = { ...structuredClone(defaultBasicSkills().find((row) => row.id === id)!) }
  const version = (n: number) => ({
    contentVersion: n,
    definition: { ...definition, contentVersion: n, name: `Version ${n}` },
    publishedBy: 'publisher',
    publishedAt: '2026-10-22',
    authoredBy: 'author',
    authoredAt: '2026-10-21',
    restoredFrom: null,
    restoredBy: null,
  })
  const initial: CompleteCombatContentRecord = {
    contentKey: id,
    contentKind: 'skill',
    lifecycle: 'active',
    revision: 9,
    versionFloor: 1,
    createdBy: 'author',
    createdAt: '2026-10-21',
    draft: {
      definition,
      draftVersion: 4,
      baseVersion: 5,
      updatedBy: 'editor',
      updatedAt: '2026-10-22',
      restoredFrom: null,
      restoredBy: null,
    },
    current: version(5),
    history: [version(5), version(4), version(3), version(2)],
    links: [],
    usedBy: [],
    ...override,
  }
  const request = vi.fn().mockImplementation((_url, options) => {
    const command = JSON.parse(options.body).command
    if (command.action === 'list')
      return Promise.resolve(Response.json({ records: [], nextCursor: null }))
    throw new Error('Unexpected fixture mutation')
  })
  vi.stubGlobal('fetch', request)
  function render() {
    hooks.index = 0
    return CombatContentAuthoringWorkspace({
      categories: COMBAT_CONTENT_CATEGORIES.map((row) => row.editor),
      initialRecord: initial,
      initialPage: {
        records: [
          {
            contentKey: initial.contentKey,
            contentKind: initial.contentKind,
            lifecycle: 'active',
            revision: 9,
            name: definition.name,
          },
        ],
        nextCursor: null,
      },
    })
  }
  const button = (label: string) =>
    find(render(), (node) => node.type === 'button' && node.props.children === label)!
  const fields = () => find(render(), (node) => node.type === ContentDefinitionFields)!
  const change = (next: CombatContentDefinition) =>
    (fields().props.onChange as (definition: CombatContentDefinition) => void)(next)
  const reply = (record: CompleteCombatContentRecord) =>
    request.mockResolvedValueOnce(Response.json({ record }))
  const click = async (label: string) => {
    const control = button(label)
    expect(control.props.disabled).not.toBe(true)
    ;(control.props.onClick as () => void)()
    await vi.waitFor(() =>
      expect(
        button('Save draft')?.props.disabled ?? button('Create draft')?.props.disabled ?? false,
      ).not.toBe(true),
    )
  }
  const command = () =>
    request.mock.calls
      .map((call) => JSON.parse(call[1].body).command)
      .filter((command) => command.action !== 'list')
      .at(-1)
  return { initial, definition, request, render, button, fields, change, reply, click, command }
}
it.each(SUPPORT_ACTION_IDS)(
  'saves changed %s mechanics and publishes only its exact saved revision',
  async (id) => {
    const f = fixture(id),
      changed = {
        ...f.definition,
        ability: {
          ...f.definition.ability,
          behaviors: f.definition.ability.behaviors.map((row) => ({
            ...row,
            costs: [{ resource: 'ap' as const, amount: 29 }],
          })),
        },
      }
    f.change(changed)
    expect(f.button('Publish saved draft').props.disabled).toBe(true)
    const saved = {
      ...f.initial,
      revision: 10,
      draft: { ...f.initial.draft!, definition: changed, draftVersion: 5 },
    }
    f.reply(saved)
    await f.click('Save draft')
    expect(f.command()).toEqual({
      action: 'save',
      contentKey: id,
      expectedRevision: 9,
      definition: changed,
    })
    f.reply({
      ...saved,
      revision: 11,
      draft: null,
      current: { ...f.initial.current!, contentVersion: 6, definition: changed },
    })
    await f.click('Publish saved draft')
    expect(f.command()).toEqual({
      action: 'publish',
      contentKey: id,
      expectedDraftVersion: 5,
      expectedBaseVersion: 5,
    })
    expect(f.command()).not.toHaveProperty('definition')
  },
)
it('restores the whole snapshot to a saved draft, retains the current pointer and shows only three history entries', async () => {
  const f = fixture()
  await f.click('History')
  expect(
    find(
      f.render(),
      (node) =>
        node.type === 'button' &&
        Array.isArray(node.props.children) &&
        node.props.children.join('') === 'Restore version 2 to draft',
    ),
  ).toBeNull()
  expect(
    find(f.render(), (node) => node.props['aria-label'] === 'Publication history')!.props.children,
  ).toHaveLength(3)
  const restore = find(
    f.render(),
    (node) =>
      node.type === 'button' &&
      Array.isArray(node.props.children) &&
      node.props.children.join('') === 'Restore version 4 to draft',
  )!
  const restored = {
    ...f.initial,
    revision: 10,
    draft: {
      ...f.initial.draft!,
      definition: f.initial.history[1]!.definition,
      draftVersion: 5,
      restoredFrom: 4,
      restoredBy: 'restorer',
    },
  }
  f.reply(restored)
  ;(restore.props.onClick as () => void)()
  await vi.waitFor(() =>
    expect(
      f.request.mock.calls.filter((call) => JSON.parse(call[1].body).command.action === 'restore'),
    ).toHaveLength(1),
  )
  await vi.waitFor(() => expect(f.button('Save draft').props.disabled).toBe(false))
  expect(f.command()).toEqual({
    action: 'restore',
    contentKey: 'basic.guard',
    expectedRevision: 9,
    sourceVersion: 4,
  })
  await f.click('Parameters')
  expect(f.fields().props.value).toEqual(restored.draft.definition)
  expect(
    find(f.render(), (node) => node.props['aria-label'] === 'Content version state')!.props
      .children,
  ).toContain(' · Current v5')
  expect(f.initial.history).toHaveLength(4)
})
it('keeps newer local edits when a held save returns and uses the returned revision on the next save', async () => {
  const f = fixture()
  let release!: (value: Response) => void
  f.request.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve
      }),
  )
  const first = { ...f.definition, name: 'Submitted' }
  f.change(first)
  ;(f.button('Save draft').props.onClick as () => void)()
  const later = { ...first, name: 'Newer local edit' }
  f.change(later)
  release(
    Response.json({
      record: {
        ...f.initial,
        revision: 10,
        draft: { ...f.initial.draft!, definition: first, draftVersion: 5 },
      },
    }),
  )
  await vi.waitFor(() => expect(f.button('Save draft').props.disabled).toBe(false))
  expect(f.fields().props.value).toEqual(later)
  expect(f.button('Publish saved draft').props.disabled).toBe(true)
  f.reply({
    ...f.initial,
    revision: 11,
    draft: { ...f.initial.draft!, definition: later, draftVersion: 6 },
  })
  await f.click('Save draft')
  expect(f.command()).toMatchObject({ expectedRevision: 10, definition: later })
})
it('preserves local changes and exposes a stale revision failure without automatic overwrite', async () => {
  const f = fixture(),
    changed = { ...f.definition, name: 'Keep this local draft' }
  f.change(changed)
  f.request.mockResolvedValueOnce(
    Response.json(
      { error: { code: 'REVISION_CONFLICT', message: 'Another editor saved a newer revision.' } },
      { status: 409 },
    ),
  )
  await f.click('Save draft')
  expect(f.fields().props.value).toEqual(changed)
  expect(find(f.render(), (node) => node.props.role === 'alert')).toBeTruthy()
  expect(f.request).toHaveBeenCalledTimes(1)
  expect(f.button('Publish saved draft').props.disabled).toBe(true)
})

function disciplineFixture() {
  const definition = COMBAT_CONTENT_CATEGORIES.find((row) => row.category === 'discipline')!.editor
    .defaultDefinition!
  const f = fixture('basic.guard', {
    contentKind: 'discipline',
    contentKey: 'discipline.original',
    draft: null,
    current: {
      contentVersion: 5,
      definition: { ...definition, id: 'discipline.original' },
      publishedBy: 'publisher',
      publishedAt: '2026-10-22',
      authoredBy: 'author',
      authoredAt: '2026-10-21',
      restoredFrom: null,
      restoredBy: null,
    },
  })
  return f
}
it('retains a new unsaved definition until creation or explicit discard', async () => {
  const f = disciplineFixture()
  await f.click('New')
  f.change({ ...(f.fields().props.value as CombatContentDefinition), name: 'Keep new work' })
  expect(f.button('New').props.disabled).toBe(true)
  expect(f.button('First page').props.disabled).toBe(true)
  expect(
    find(f.render(), (node) => node.props['aria-label'] === 'Content category')!.props.disabled,
  ).toBe(true)
  expect(f.fields().props.value).toMatchObject({ name: 'Keep new work' })
  await f.click('Discard new draft')
  expect(f.fields().props.value).toEqual(f.initial.current!.definition)
  expect(f.request).not.toHaveBeenCalled()
})
it('creates directly within a Discipline using its revision and refreshes the matching global Skill list', async () => {
  const f = disciplineFixture()
  await f.click('New Skill in this Discipline')
  const draft = f.fields().props.value as CombatContentDefinition
  expect(draft.sourceDisciplineId).toBe('discipline.original')
  const key = 'skill.11111111-1111-4111-8111-111111111111'
  const created = {
    ...f.initial,
    contentKey: key,
    contentKind: 'skill' as const,
    lifecycle: 'draft' as const,
    revision: 1,
    current: null,
    history: [],
    draft: {
      definition: { ...draft, id: key },
      draftVersion: 1,
      baseVersion: null,
      updatedBy: 'author',
      updatedAt: '2026-10-23',
      restoredFrom: null,
      restoredBy: null,
    },
  }
  f.reply(created)
  f.request.mockResolvedValueOnce(
    Response.json({
      records: [
        {
          contentKey: key,
          contentKind: 'skill',
          revision: 1,
          lifecycle: 'draft',
          name: 'New Skill',
        },
      ],
      nextCursor: null,
    }),
  )
  await f.click('Create draft')
  expect(JSON.parse(f.request.mock.calls[0]![1].body).command).toMatchObject({
    action: 'create',
    contentKind: 'skill',
    parentKey: 'discipline.original',
    expectedParentRevision: 9,
    definition: JSON.parse(JSON.stringify(draft)),
  })
  expect(JSON.parse(f.request.mock.calls.at(-1)![1].body).command).toMatchObject({
    action: 'list',
    kind: 'skill',
    category: 'discipline-skill',
    sort: 'name-asc',
    limit: 20,
  })
  expect(find(f.render(), (node) => node.props['data-content-key'] === key)).toBeTruthy()
  expect(f.fields().props.value).toEqual(JSON.parse(JSON.stringify(created.draft.definition)))
})
it('keeps the record when dependency-aware archive rejects it', async () => {
  const f = disciplineFixture()
  f.request.mockResolvedValueOnce(
    Response.json(
      {
        error: {
          code: 'CONTENT_REFERENCED',
          message: 'This Discipline is used by a player build.',
        },
      },
      { status: 409 },
    ),
  )
  await f.click('Archive')
  expect(f.command()).toEqual({
    action: 'archive',
    contentKey: 'discipline.original',
    expectedRevision: 9,
  })
  expect(f.fields().props.value).toEqual(f.initial.current!.definition)
  expect(find(f.render(), (node) => node.props.role === 'alert')).toBeTruthy()
})
