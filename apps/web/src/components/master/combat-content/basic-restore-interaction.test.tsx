import { renderToStaticMarkup } from 'react-dom/server'
import { ContentRecordPreview } from './content-record-preview'
import { ContentRecordModal } from './content-record-modal'
import { DeleteDiscipline } from './delete-discipline'
import { DisciplineRelationshipList } from './discipline-relationship-list'
import { NewRelationshipPower } from './new-relationship-power'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  BASIC_SKILL_IDS,
  parseBasicSkillDefinition,
  defaultBasicSkills,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { SUPPORT_ACTION_IDS } from '@aurevane/game-core/combat/support-actions'
import type {
  CompleteCombatContentRecord,
  CombatContentDefinition,
} from '@aurevane/db/combat-content'
const hooks = vi.hoisted(() => ({
  index: 0,
  cells: [] as unknown[],
  effects: [] as (() => void)[],
  cleanups: new Set<() => void>(),
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useId: () => ':description-test:',
  useMemo(factory: () => unknown) {
    return factory()
  },
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
  useEffect(effect: () => void | (() => void), dependencies: unknown[]) {
    const index = hooks.index++
    const old = hooks.cells[index] as { dependencies: unknown[]; cleanup?: () => void } | undefined
    if (!old || dependencies.some((value, i) => !Object.is(value, old.dependencies[i]))) {
      const cell = { dependencies, cleanup: undefined as (() => void) | undefined }
      hooks.cells[index] = cell
      hooks.effects.push(() => {
        if (old?.cleanup) {
          old.cleanup()
          hooks.cleanups.delete(old.cleanup)
        }
        const cleanup = effect()
        if (cleanup) {
          cell.cleanup = cleanup
          hooks.cleanups.add(cleanup)
        }
      })
    }
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
import { AbilityPresentationEditor } from './ability-presentation-editor'
import { AbilityText } from './ability-editor-fields'
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
  if (predicate(node)) return node
  if (typeof node.type === 'function' && node.type.name === 'ContentDescriptionFields')
    return find((node.type as (props: Props) => ReactNode)(node.props), predicate)
  return find(node.props.children, predicate)
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  hooks.effects = []
  hooks.cleanups.clear()
})
afterEach(() => {
  for (const cleanup of hooks.cleanups) cleanup()
  vi.unstubAllGlobals()
})
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
    const tree = CombatContentAuthoringWorkspace({
      categories: COMBAT_CONTENT_CATEGORIES.map((row) => row.editor),
      initialRecord: initial,
      references:
        initial.contentKind === 'discipline'
          ? [
              {
                contentKey: initial.contentKey,
                contentKind: 'discipline',
                name: String(initial.current?.definition.name),
              },
            ]
          : [],
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
    hooks.effects.splice(0).forEach((effect) => effect())
    return tree
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
    await vi.waitFor(() => expect(render().props['aria-busy']).toBe(false))
  }
  const command = () =>
    request.mock.calls
      .map((call) => JSON.parse(call[1].body).command)
      .filter((command) => command.action !== 'list')
      .at(-1)
  const selectRecord = async (key: string) => {
    const control = find(render(), (node) => node.props['data-content-key'] === key)!
    ;(control.props.onClick as () => void)()
    await vi.waitFor(() => expect(render().props['aria-busy']).toBe(false))
  }
  const chooseCategory = async (value: string) => {
    const selector = find(render(), (node) => node.props['aria-label'] === 'Content category')!
    ;(selector.props.onChange as (event: unknown) => void)({ currentTarget: { value } })
    await vi.waitFor(() => expect(render().props['aria-busy']).toBe(false))
  }
  return {
    initial,
    definition,
    request,
    render,
    button,
    fields,
    change,
    reply,
    click,
    command,
    chooseCategory,
    selectRecord,
  }
}
it.each(SUPPORT_ACTION_IDS)(
  'commits changed %s mechanics directly with the reviewed revision',
  async (id) => {
    const f = fixture(id)
    const changed = {
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
    expect(f.button('Commit Now').props.disabled).toBe(false)
    f.reply({
      ...f.initial,
      revision: 11,
      draft: null,
      current: { ...f.initial.current!, contentVersion: 6, definition: changed },
    })
    await f.click('Commit Now')
    expect(f.command()).toEqual({
      action: 'commit',
      contentKey: id,
      expectedRevision: 9,
      definition: changed,
    })
    expect(
      f.request.mock.calls.filter((call) => JSON.parse(call[1].body).command.action !== 'list'),
    ).toHaveLength(1)
  },
)
it('commits explicitly authored settings while retained previous versions stay outside the editor', async () => {
  const f = fixture()
  const retained = JSON.stringify({ current: f.initial.current, history: f.initial.history })
  expect(f.button('History')).toBeNull()
  expect(f.button('Restore Previous')).toBeNull()
  expect(f.button('Skill Details')).toBeTruthy()
  const authored = { ...f.initial.history[1]!.definition, name: 'Manually authored settings' }
  f.change(authored)
  f.reply({
    ...f.initial,
    revision: 10,
    draft: null,
    current: {
      ...f.initial.current!,
      contentVersion: 6,
      definition: { ...authored, contentVersion: 6 },
    },
  })
  await f.click('Commit Now')
  expect(f.command()).toEqual({
    action: 'commit',
    contentKey: 'basic.guard',
    expectedRevision: 9,
    definition: authored,
  })
  expect(f.command()).not.toHaveProperty('sourceVersion')
  expect(JSON.stringify({ current: f.initial.current, history: f.initial.history })).toBe(retained)
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
  ;(f.button('Commit Now').props.onClick as () => void)()
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
  await vi.waitFor(() => expect(f.button('Commit Now').props.disabled).toBe(false))
  expect(f.fields().props.value).toEqual(later)
  expect(f.button('Commit Now').props.disabled).toBe(false)
  f.reply({
    ...f.initial,
    revision: 11,
    draft: { ...f.initial.draft!, definition: later, draftVersion: 6 },
  })
  await f.click('Commit Now')
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
  await f.click('Commit Now')
  expect(f.fields().props.value).toEqual(changed)
  expect(find(f.render(), (node) => node.props.role === 'alert')).toBeTruthy()
  expect(f.request).toHaveBeenCalledTimes(1)
  expect(f.button('Commit Now').props.disabled).toBe(false)
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
it.each([null, 'discipline.partner'])(
  'opens a new relationship power and commits only its %s slot',
  async (partner) => {
    const f = disciplineFixture()
    const base = f.initial.current!.definition
    f.change({ ...base, name: 'Uncommitted Discipline name' })
    await f.click('Resonances')
    const relationships = () =>
      find(f.render(), (node) => node.type === DisciplineRelationshipList)!
    const close = vi.fn()
    const create = (
      relationships().props.renderCreate as (
        partner: string | null,
        close: () => void,
      ) => ReactElement<Parameters<typeof NewRelationshipPower>[0]>
    )(partner, close)
    expect(create.type).toBe(NewRelationshipPower)
    expect(create.props.partner).toBe(partner)
    const key = partner === null ? 'essence.new' : 'resonance.new'
    const child = {
      ...f.initial,
      contentKey: key,
      contentKind: partner === null ? 'essence' : 'resonance',
      lifecycle: 'draft',
      current: null,
    } as CompleteCombatContentRecord
    create.props.onCreated(child)
    expect(close).toHaveBeenCalledOnce()
    const modal = () => find(f.render(), (node) => node.type === ContentRecordModal)!
    expect(modal().props.contentKey).toBe(key)
    expect(modal().props.availableInDiscipline).toBeUndefined()
    const expected =
      partner === null
        ? { ...base, essenceId: key }
        : {
            ...base,
            resonanceSelections: [
              ...((base.resonanceSelections as unknown[]) ?? []),
              { withDisciplineId: partner, resonanceId: key },
            ],
          }
    f.reply({
      ...f.initial,
      revision: 10,
      current: {
        ...f.initial.current!,
        contentVersion: 6,
        definition: { ...expected, contentVersion: 6 },
      },
    })
    expect(await (modal().props.onCommitRelated as () => Promise<boolean>)()).toBe(true)
    expect(f.command()).toEqual({
      action: 'commit',
      contentKey: f.initial.contentKey,
      expectedRevision: 9,
      definition: expected,
    })
    expect(relationships().props.value).toMatchObject({ name: 'Uncommitted Discipline name' })
    const count = f.request.mock.calls.length
    await (modal().props.onCommitRelated as () => Promise<boolean>)()
    expect(f.request).toHaveBeenCalledTimes(count)
  },
)
it('retains a new unsaved definition until creation or explicit discard', async () => {
  const f = disciplineFixture()
  await f.click('New')
  f.change({ ...(f.fields().props.value as CombatContentDefinition), name: 'Keep new work' })
  expect(f.button('New').props.disabled).toBe(true)
  expect(f.button('Search').props.disabled).toBe(true)
  expect(
    find(f.render(), (node) => node.props['data-content-key'] === f.initial.contentKey)!.props
      .disabled,
  ).toBe(true)
  expect(
    find(f.render(), (node) => node.props['aria-label'] === 'Content category')!.props.disabled,
  ).toBe(true)
  expect(f.fields().props.value).toMatchObject({ name: 'Keep new work' })
  await f.click('Discard new content')
  expect(f.fields().props.value).toEqual(f.initial.current!.definition)
  expect(f.request).not.toHaveBeenCalled()
})
async function beginSkillCreation(f: ReturnType<typeof disciplineFixture>) {
  await f.chooseCategory('skill')
  await f.click('New')
  const details = ContentDefinitionFields({
    ...f.fields().props,
    abilitySection: 'details',
  } as unknown as Parameters<typeof ContentDefinitionFields>[0])
  const source = find(details, (node) => node.props.label === 'Source Discipline')!
  expect(source.props.choices).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ contentKey: 'discipline.original', contentKind: 'discipline' }),
    ]),
  )
  ;(source.props.onChange as (value: string) => void)('discipline.original')
  expect(f.fields().props.value).toMatchObject({ sourceDisciplineId: 'discipline.original' })
}
it('creates a source-bound Skill, finds it in its Discipline and commits explicit availability once', async () => {
  const f = disciplineFixture()
  await beginSkillCreation(f)
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
  f.reply({
    ...created,
    lifecycle: 'active',
    revision: 3,
    draft: null,
    current: { ...f.initial.current!, definition: created.draft.definition },
  })
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
  await f.click('Commit Now')
  expect(
    f.request.mock.calls
      .map((call) => JSON.parse(call[1].body).command)
      .find((command) => command.action === 'create'),
  ).toMatchObject({
    action: 'create',
    contentKind: 'skill',
    definition: JSON.parse(JSON.stringify(draft)),
  })
  expect(JSON.parse(f.request.mock.calls.at(-1)![1].body).command).toMatchObject({
    action: 'list',
    kind: 'skill',
    category: 'discipline-skill',
    sort: 'name-asc',
    limit: 100,
  })
  expect(find(f.render(), (node) => node.props['data-content-key'] === key)).toBeTruthy()
  expect(f.fields().props.value).toEqual(JSON.parse(JSON.stringify(created.draft.definition)))
  expect(f.fields().props.value).toMatchObject({
    id: key,
    sourceDisciplineId: 'discipline.original',
  })
  expect(
    f.request.mock.calls
      .map((call) => JSON.parse(call[1].body).command.action)
      .filter((action) => !['list', 'read'].includes(action)),
  ).toEqual(['create', 'commit'])
  f.request.mockResolvedValueOnce(
    Response.json({
      records: [
        {
          contentKey: f.initial.contentKey,
          contentKind: 'discipline',
          lifecycle: 'active',
          revision: f.initial.revision,
          name: f.initial.current!.definition.name,
        },
      ],
      nextCursor: null,
    }),
  )
  await f.chooseCategory('discipline')
  // The server's unchanged parent is deliberate: a matching Source Discipline
  // must be discoverable without inventing an automatic persisted parent edit.
  f.reply(f.initial)
  await f.selectRecord(f.initial.contentKey)
  await f.click('Skills')
  const related = find(
    f.render(),
    (node) =>
      node.type === 'button' &&
      Array.isArray(node.props.children) &&
      node.props.children[0] === 'New Skill',
  )
  expect(related).not.toBeNull()
  ;(related!.props.onClick as () => void)()
  const modal = () => find(f.render(), (node) => node.type === ContentRecordModal)!
  expect(modal().props.contentKey).toBe(key)
  expect(modal().props.availableInDiscipline).toBe(false)
  expect(
    find(f.render(), (node) => node.props['aria-label'] === 'Save status')!.props.children,
  ).toBe('Saved')
  const beforeInclusion = f.request.mock.calls.length
  expect(f.initial.current!.definition.linkedSkills).toEqual([])
  ;(modal().props.onAvailabilityChange as (enabled: boolean) => void)(true)
  expect(modal().props.availableInDiscipline).toBe(true)
  expect(f.request).toHaveBeenCalledTimes(beforeInclusion)
  const included = {
    ...f.initial.current!.definition,
    linkedSkills: [key],
    skillStages: [{ skillId: key, minimumStage: 1 }],
  }
  f.reply({
    ...f.initial,
    revision: 10,
    current: {
      ...f.initial.current!,
      contentVersion: 6,
      definition: { ...included, contentVersion: 6 },
    },
  })
  await (modal().props.onCommitRelated as () => Promise<void>)()
  expect(f.command()).toEqual({
    action: 'commit',
    contentKey: f.initial.contentKey,
    expectedRevision: 9,
    definition: included,
  })
  expect(modal().props.availableInDiscipline).toBe(true)
  const afterInclusion = f.request.mock.calls.length
  await (modal().props.onCommitRelated as () => Promise<void>)()
  expect(f.request).toHaveBeenCalledTimes(afterInclusion)
  expect(
    f.request.mock.calls
      .map((call) => JSON.parse(call[1].body).command.action)
      .filter((action) => !['list', 'read'].includes(action)),
  ).toEqual(['create', 'commit', 'commit'])
})
it('keeps retained archived data readable and prevents publication without exposing retired menu actions', () => {
  const active = disciplineFixture()
  const seed = active.initial
  hooks.cells = []
  hooks.effects = []
  const f = fixture('basic.guard', {
    ...seed,
    lifecycle: 'archived',
    current: null,
    draft: {
      definition: seed.current!.definition,
      draftVersion: 1,
      baseVersion: 5,
      updatedBy: 'author',
      updatedAt: '2026-10-22',
      restoredFrom: null,
      restoredBy: null,
    },
  })
  expect(f.fields().props.value).toEqual(f.initial.draft!.definition)
  expect(f.button('Commit Now').props.disabled).toBe(true)
  expect(
    find(f.render(), (node) => node.type === 'button' && node.props.children === 'Duplicate'),
  ).toBeNull()
  expect(
    find(f.render(), (node) => node.type === 'button' && node.props.children === 'Archive'),
  ).toBeNull()
  expect(
    find(f.render(), (node) => node.type === 'fieldset' && node.props.disabled === true),
  ).toBeTruthy()
  expect(f.request).not.toHaveBeenCalled()
})

it.each(BASIC_SKILL_IDS)(
  'keeps %s Details text callbacks parse/commit-valid including optional clearing',
  async (id) => {
    const f = fixture(id)
    await f.click('Skill Details')
    const tree = () =>
      ContentDefinitionFields({
        ...f.fields().props,
        abilitySection: 'details',
      } as unknown as Parameters<typeof ContentDefinitionFields>[0])
    expect(
      find(tree(), (n) => n.type === AbilityText && n.props.label === 'Flavor line'),
    ).toBeNull()
    const description = find(tree(), (n) => n.props['aria-label'] === 'Description')!
    ;(description.props.onChange as (event: unknown) => void)({
      currentTarget: { value: 'Supported description retained.' },
    })
    const battle = find(
      tree(),
      (n) => n.type === AbilityText && n.props.label === 'In-battle text',
    )!
    ;(battle.props.onChange as (value: string) => void)('{actor} uses {ability}.')
    const presentation = () =>
      AbilityPresentationEditor(
        find(tree(), (n) => n.type === AbilityPresentationEditor)!.props as unknown as Parameters<
          typeof AbilityPresentationEditor
        >[0],
      )
    const changeCompact = (value: string) =>
      (
        find(presentation(), (n) => n.props['aria-label'] === 'Compact battle description')!.props
          .onChange as (event: unknown) => void
      )({ currentTarget: { value } })
    changeCompact('Distinct {ability} compact text.')
    expect(() => parseBasicSkillDefinition(f.fields().props.value)).not.toThrow()
    changeCompact('')
    const changed = f.fields().props.value as CombatContentDefinition
    expect(parseBasicSkillDefinition(changed)).toMatchObject({
      description: 'Supported description retained.',
      battleText: '{actor} uses {ability}.',
    })
    expect(changed).not.toHaveProperty('flavorLine')
    expect(changed.presentation).not.toHaveProperty('compact')
    f.reply({
      ...f.initial,
      revision: 10,
      draft: { ...f.initial.draft!, definition: changed, draftVersion: 5 },
    })
    await f.click('Commit Now')
    expect(f.command()).toMatchObject({ action: 'commit', definition: changed })
    expect(() => parseBasicSkillDefinition(f.command().definition)).not.toThrow()
  },
)
it('edits the current definition without selecting retained future versions', async () => {
  const seed = fixture().initial
  hooks.cells = []
  hooks.effects = []
  const version = (n: number) => ({
    ...seed.current!,
    contentVersion: n,
    definition: { ...seed.current!.definition, contentVersion: n },
  })
  const f = fixture('basic.guard', {
    draft: null,
    versionFloor: 75,
    current: version(2),
    history: [version(2), version(73), version(74), version(75)],
  })
  const retained = JSON.stringify(f.initial.history)
  expect(f.button('History')).toBeNull()
  expect(f.fields().props.value).toEqual(f.initial.current!.definition)
  const authored = { ...f.initial.current!.definition, name: 'Current settings edited' }
  f.change(authored)
  f.reply({
    ...f.initial,
    revision: 10,
    current: { ...version(76), definition: { ...authored, contentVersion: 76 } },
  })
  await f.click('Commit Now')
  expect(f.command()).toEqual({
    action: 'commit',
    contentKey: f.initial.contentKey,
    expectedRevision: 9,
    definition: authored,
  })
  expect(f.command()).not.toHaveProperty('sourceVersion')
  expect(f.fields().props.value).toMatchObject({ name: authored.name, contentVersion: 76 })
  expect(JSON.stringify(f.initial.history)).toBe(retained)
})

it.each(['working', 'saved', 'current', 'compare'])(
  'reads finalized retained media through protected authoring in %s view',
  (view) => {
    const basic = defaultBasicSkills()[0]!
    const definition = (suffix: number) => ({
      ...basic,
      media: {
        ...basic.media,
        audio: {
          id: `11111111-1111-4111-8111-${String(suffix).padStart(12, '0')}`,
          kind: 'audio',
          contentType: 'audio/wav',
          checksum: 'b'.repeat(64),
          byteLength: 100,
          durationMs: 1000,
          channels: 1,
          sampleRate: 44100,
        },
      },
    })
    const props = {
      kind: 'skill' as const,
      working: definition(1),
      saved: definition(2),
      current: definition(3),
    }
    const render = () => {
      hooks.index = 0
      return ContentRecordPreview(props)
    }
    ;(find(render(), (n) => n.type === 'select')!.props.onChange as (event: unknown) => void)({
      currentTarget: { value: view },
    })
    const html = renderToStaticMarkup(render())
    const expected =
      view === 'working' ? [1] : view === 'saved' ? [2] : view === 'current' ? [3] : [1, 3]
    for (const suffix of expected)
      expect(html).toContain(
        `src="/api/master/combat-content/media/11111111-1111-4111-8111-${String(suffix).padStart(12, '0')}"`,
      )
    expect(html).not.toContain('src="/api/content-media/')
  },
)

it.each(BASIC_SKILL_IDS)(
  'authors %s current settings without an original-restore control or restore intent',
  async (id) => {
    const f = fixture(id, {
      draft: null,
      builtin: { contentVersion: 1, name: id },
      builtinRestoreVersion: 1,
    })
    const retained = JSON.stringify(f.initial)
    expect(f.button('History')).toBeNull()
    expect(f.button('Restore System original')).toBeNull()
    expect(f.fields().props.value).toEqual(f.initial.current!.definition)
    const authored = { ...f.initial.current!.definition, name: `Authored ${id}` }
    f.change(authored)
    f.reply({
      ...f.initial,
      revision: 10,
      current: {
        ...f.initial.current!,
        contentVersion: 6,
        definition: { ...authored, contentVersion: 6 },
      },
    })
    await f.click('Commit Now')
    expect(f.command()).toEqual({
      action: 'commit',
      contentKey: id,
      expectedRevision: 9,
      definition: authored,
    })
    expect(f.command()).not.toHaveProperty('sourceKind')
    expect(f.command()).not.toHaveProperty('sourceVersion')
    expect(JSON.stringify(f.initial)).toBe(retained)
  },
)

it('retains the created Skill identity and inline edits after commit failure, then retries without recreating or losing its Source Discipline', async () => {
  const f = disciplineFixture()
  await beginSkillCreation(f)
  const submitted = f.fields().props.value as CombatContentDefinition
  const key = 'skill.11111111-1111-4111-8111-111111111111'
  const created: CompleteCombatContentRecord = {
    ...f.initial,
    contentKey: key,
    contentKind: 'skill',
    lifecycle: 'draft',
    revision: 1,
    current: null,
    history: [],
    links: [],
    draft: {
      definition: { ...submitted, id: key },
      draftVersion: 1,
      baseVersion: null,
      updatedBy: 'owner',
      updatedAt: '2026-10-26',
      restoredFrom: null,
      restoredBy: null,
    },
  }
  f.reply(created)
  let rejectCommit!: (response: Response) => void
  f.request.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        rejectCommit = resolve
      }),
  )
  ;(f.button('Commit Now').props.onClick as () => void)()
  await vi.waitFor(() => expect(rejectCommit).toBeTypeOf('function'))
  expect(f.fields().props.value).toMatchObject({
    id: key,
    sourceDisciplineId: 'discipline.original',
  })
  const inlineEdit = {
    ...(f.fields().props.value as CombatContentDefinition),
    name: 'Retain this new Skill',
  }
  f.change(inlineEdit)
  rejectCommit(
    Response.json(
      { error: { code: 'PERSISTENCE_UNAVAILABLE', message: 'Commit storage unavailable.' } },
      { status: 503 },
    ),
  )
  await vi.waitFor(() => expect(f.button('Commit Now').props.disabled).toBe(false))
  expect(f.fields().props.value).toEqual(inlineEdit)
  expect(f.button('Discard new content')).toBeNull()
  expect(
    JSON.stringify(find(f.render(), (node) => node.props.role === 'alert')!.props.children),
  ).toContain('Commit storage unavailable.')
  f.reply({
    ...created,
    lifecycle: 'active',
    revision: 3,
    draft: null,
    current: { ...f.initial.current!, definition: inlineEdit },
  })
  await f.click('Commit Now')
  expect(f.command()).toEqual({
    action: 'commit',
    contentKey: key,
    expectedRevision: 1,
    definition: JSON.parse(JSON.stringify(inlineEdit)),
  })
  expect(
    f.request.mock.calls
      .map((call) => JSON.parse(call[1].body).command)
      .filter((command) => command.action !== 'list')
      .map((command) => command.action),
  ).toEqual(['create', 'commit', 'commit'])
})

it('keeps queued edits made during creation under the returned identity when the first commit succeeds', async () => {
  const f = disciplineFixture()
  await f.click('New')
  const submitted = f.fields().props.value as CombatContentDefinition
  const key = 'discipline.11111111-1111-4111-8111-111111111111'
  const created: CompleteCombatContentRecord = {
    ...f.initial,
    contentKey: key,
    contentKind: 'discipline',
    lifecycle: 'draft',
    revision: 1,
    current: null,
    history: [],
    links: [],
    draft: {
      definition: { ...submitted, id: key },
      draftVersion: 1,
      baseVersion: null,
      updatedBy: 'owner',
      updatedAt: '2026-10-26',
      restoredFrom: null,
      restoredBy: null,
    },
  }
  let finishCreate!: (response: Response) => void
  f.request.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finishCreate = resolve
      }),
  )
  ;(f.button('Commit Now').props.onClick as () => void)()
  f.change({ ...submitted, name: 'Queued while creating' })
  f.reply({
    ...created,
    lifecycle: 'active',
    revision: 3,
    draft: null,
    current: { ...f.initial.current!, definition: created.draft!.definition },
  })
  finishCreate(Response.json({ record: created }))
  await vi.waitFor(() => expect(f.button('Commit Now').props.disabled).toBe(false))
  expect(f.fields().props.value).toMatchObject({ id: key, name: 'Queued while creating' })
  expect(f.button('Discard new content')).toBeNull()
  expect(
    JSON.stringify(find(f.render(), (node) => node.props.role === 'status')?.props.children),
  ).toContain('newer local edits remain uncommitted')
})

it('preserves a revert to the previously saved value while an earlier changed value is committing', async () => {
  const f = fixture()
  const original = f.fields().props.value as CombatContentDefinition
  const submitted = { ...original, name: 'Earlier submitted change' }
  f.change(submitted)
  let finishCommit!: (response: Response) => void
  f.request.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finishCommit = resolve
      }),
  )
  ;(f.button('Commit Now').props.onClick as () => void)()
  f.change(original)
  finishCommit(
    Response.json({
      record: {
        ...f.initial,
        revision: 10,
        draft: null,
        current: { ...f.initial.current!, contentVersion: 6, definition: submitted },
      },
    }),
  )
  await vi.waitFor(() => expect(f.button('Commit Now').props.disabled).toBe(false))
  expect(f.fields().props.value).toEqual(original)
  expect(
    find(f.render(), (node) => node.props['aria-label'] === 'Save status')!.props.children,
  ).toBe('Unsaved changes')
  f.reply({
    ...f.initial,
    revision: 11,
    draft: null,
    current: { ...f.initial.current!, contentVersion: 7, definition: original },
  })
  await f.click('Commit Now')
  expect(f.command()).toEqual({
    action: 'commit',
    contentKey: f.initial.contentKey,
    expectedRevision: 10,
    definition: original,
  })
})

it('keeps save feedback with Commit Now and removes Duplicate and Archive menu actions', () => {
  const f = disciplineFixture()
  const root = f.render()
  const status = find(root, (node) => node.props['aria-label'] === 'Save status')
  expect(status?.props.children).toBe('Saved')
  const sidebar = find(root, (node) => node.type === 'aside')!
  expect(find(sidebar, (node) => node.props['aria-label'] === 'Save status')).not.toBeNull()
  const heading = find(root, (node) => node.type === 'header')!
  expect(find(heading, (node) => node.props.role === 'status')).toBeNull()
  for (const label of ['Duplicate', 'Archive'])
    expect(find(root, (node) => node.type === 'button' && node.props.children === label)).toBeNull()
})
it('successful Discipline deletion removes the current selection and its pending edits', () => {
  const f = disciplineFixture()
  f.change({ ...f.initial.current!.definition, name: 'Uncommitted name' })
  const control = find(f.render(), (node) => node.type === DeleteDiscipline)!
  expect(control).not.toBeNull()
  ;(control.props.onDeleted as (keys: string[]) => void)([f.initial.contentKey])
  expect(find(f.render(), (node) => node.type === DeleteDiscipline)).toBeNull()
  expect(
    find(f.render(), (node) => node.props['data-content-key'] === f.initial.contentKey),
  ).toBeNull()
  expect(find(f.render(), (node) => node.type === ContentDefinitionFields)).toBeNull()
  expect(find(f.render(), (node) => node.props.role === 'status')?.props.children).toBe(
    'Discipline deleted. Saved battle history is retained.',
  )
})
