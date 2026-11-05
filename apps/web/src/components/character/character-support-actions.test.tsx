import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { CharacterSkillBuildPanel } from './character-skill-build-panel'
import type { SupportActionId } from '@aurevane/game-core/combat/support-actions'

vi.mock('server-only', () => ({}))
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (initial: unknown) => {
    const index = hooks.index++
    if (!(index in hooks.cells))
      hooks.cells[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      hooks.cells[index],
      (next: unknown) => {
        hooks.cells[index] =
          typeof next === 'function'
            ? (next as (old: unknown) => unknown)(hooks.cells[index])
            : next
      },
    ]
  },
  useRef: (initial: unknown) => {
    const index = hooks.index++
    if (!(index in hooks.cells)) hooks.cells[index] = { current: initial }
    return hooks.cells[index]
  },
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => {},
  useContext: (context: { _currentValue: unknown }) => context._currentValue,
  useSyncExternalStore: () => true,
}))
vi.mock('react-dom', () => ({ createPortal: (node: ReactNode) => node }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace() {}, refresh() {} }),
  usePathname: () => '/game/character',
  useSearchParams: () => new URLSearchParams('profilePanel=techniques'),
}))
type Props = Record<string, unknown> & { children?: ReactNode }
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  return isValidElement<Props>(node) ? [node, ...nodes(node.props.children)] : []
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  vi.stubGlobal('document', { body: {} })
})
afterEach(() => vi.unstubAllGlobals())

it.each([
  ['basic.pilfer', 'Pilfer'],
  ['basic.fleetstep', 'Fleetstep'],
  ['basic.invocation', 'Invocation'],
] as const)(
  'saves %s once with build CAS and retains that sole Support choice after refresh',
  async (id, label) => {
    let stored: SupportActionId = 'basic.recover'
    const commands: { supportActionId: SupportActionId; expectedBuildVersion: number }[] = []
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const command = JSON.parse(String(init.body))
      commands.push(command)
      stored = command.supportActionId
      return Response.json({
        context: {
          build: { buildVersion: 8, supportActionId: stored },
          disciplineSkills: { capacity: 4, learnedSkills: [], equippedSkills: [] },
        },
      })
    })
    const render = (initialSupportActionId: SupportActionId = 'basic.recover') => {
      hooks.index = 0
      return CharacterSkillBuildPanel({
        characterId: 'character',
        initialBuildVersion: 7,
        initialSupportActionId,
        primaryDiscipline: { id: 'vanguard', name: 'Vanguard' },
        secondaryDiscipline: null,
        initialCapacity: 4,
        initialLearnedSkills: [],
        initialEquippedSkills: [],
        initialResonance: null,
        initialEssence: null,
      })
    }
    const choices = (tree: ReactNode) =>
      nodes(tree).filter((row) => row.type === 'input' && row.props.type === 'radio')
    const first = choices(render())
    expect(first.map((row) => row.props['aria-label'])).toEqual([
      'HP Recovery',
      'MP Recovery',
      'Pilfer',
      'Fleetstep',
      'Invocation',
    ])
    expect(first.filter((row) => row.props.checked).map((row) => row.props['aria-label'])).toEqual([
      'HP Recovery',
    ])
    ;(first.find((row) => row.props['aria-label'] === label)!.props.onChange as () => void)()
    await vi.waitFor(() => expect(commands).toHaveLength(1))
    await vi.waitFor(() =>
      expect(
        choices(render())
          .filter((row) => row.props.checked)
          .map((row) => row.props['aria-label']),
      ).toEqual([label]),
    )
    expect(commands[0]).toMatchObject({
      characterId: 'character',
      expectedBuildVersion: 7,
      supportActionId: id,
      idempotencyKey: expect.any(String),
    })
    hooks.cells = []
    expect(
      choices(render(stored))
        .filter((row) => row.props.checked)
        .map((row) => row.props['aria-label']),
    ).toEqual([label])
  },
)

it('shows saved finalized Invocation artwork in Skill Manager instead of its default icon', () => {
  const tree = CharacterSkillBuildPanel({
    supportActionArtworkKeys: {
      'basic.invocation': 'content-media.00000000-0000-4000-8000-000000000099',
    },
    characterId: 'character',
    initialBuildVersion: 7,
    initialSupportActionId: 'basic.invocation',
    primaryDiscipline: { id: 'vanguard', name: 'Vanguard' },
    secondaryDiscipline: null,
    initialCapacity: 4,
    initialLearnedSkills: [],
    initialEquippedSkills: [],
    initialResonance: null,
    initialEssence: null,
  })
  const invocation = nodes(tree).find(
    (row) =>
      row.type === 'article' &&
      nodes(row).some((child) => child.props['aria-label'] === 'Invocation'),
  )!
  expect(nodes(invocation).find((row) => row.props.width === 160)?.props.src).toBe(
    '/api/content-media/00000000-0000-4000-8000-000000000099',
  )
  expect(nodes(tree).some((row) => row.props.src === '/media/skills/hp-recovery.webp')).toBe(true)
})

it('keeps one equipment Support selected and lets the retained Basic choice replace it through the existing atomic writer', async () => {
  const item = {
    id: 'bracer',
    name: 'Wardstone Bracer',
    enabled: true,
    actions: { support: { behaviorId: 'prayer', name: 'Warding Prayer' } },
    artworkSrc: '/media/art/items/wardstone-bracer-v01.webp',
  }
  const initialItemsView = {
    characterId: 'character',
    revision: 11,
    catalogueToken: 'a'.repeat(32),
    battleLocked: false,
    equipmentIssue: null,
    equipment: { 'off-hand': 'owned-private' },
    selectedSupport: {
      kind: 'equipment',
      position: 'off-hand',
      itemId: 'bracer',
      behaviorId: 'prayer',
    },
    stacks: [{ id: 'owned-private', item }],
  } as unknown as import('@/server/character/character-items-service').CharacterItemsView
  const commands: Record<string, unknown>[] = []
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    commands.push(JSON.parse(String(init.body)))
    return Response.json({
      context: {
        build: { buildVersion: 12, supportActionId: 'basic.recover' },
        disciplineSkills: { capacity: 4, learnedSkills: [], equippedSkills: [] },
      },
    })
  })
  const render = () => {
    hooks.index = 0
    return CharacterSkillBuildPanel({
      characterId: 'character',
      initialBuildVersion: 11,
      initialSupportActionId: 'basic.recover',
      initialItemsView,
      primaryDiscipline: { id: 'vanguard', name: 'Vanguard' },
      secondaryDiscipline: null,
      initialCapacity: 4,
      initialLearnedSkills: [],
      initialEquippedSkills: [],
      initialResonance: null,
      initialEssence: null,
    })
  }
  const radios = () => nodes(render()).filter((n) => n.type === 'input' && n.props.type === 'radio')
  expect(
    radios()
      .filter((n) => n.props.checked)
      .map((n) => n.props['aria-label']),
  ).toEqual(['Warding Prayer · Off Hand'])
  ;(radios().find((n) => n.props['aria-label'] === 'HP Recovery')!.props.onChange as () => void)()
  await vi.waitFor(() => expect(commands).toHaveLength(1))
  await vi.waitFor(() =>
    expect(
      radios()
        .filter((n) => n.props.checked)
        .map((n) => n.props['aria-label']),
    ).toEqual(['HP Recovery']),
  )
  expect(commands[0]).toMatchObject({
    characterId: 'character',
    expectedBuildVersion: 11,
    supportActionId: 'basic.recover',
  })
  expect(radios().map((n) => n.props['aria-label'])).toContain('Warding Prayer · Off Hand')
})

it('offers an equipped weapon technique beside all Basic choices and restores the previous Basic Support after authoritative unequip', async () => {
  const { defaultBasicSkills } = await import('@aurevane/game-core/combat/combat-basic-actions')
  const { itemFixture } =
    await import('../../../../../packages/game-core/src/content/items-test-fixtures')
  const { equipInventoryItem, unequipInventoryItem, selectInventorySupport, grantInventoryItems } =
    await import('@aurevane/game-core/character/item-inventory')
  const { characterItemsView } = await import('@/server/character/character-items-service')
  const attack = structuredClone(
    defaultBasicSkills().find((skill) => skill.id === 'unarmed.basic')!.ability!.behaviors[0]!,
  )
  const technique = {
    ...structuredClone(
      defaultBasicSkills().find((skill) => skill.id === 'basic.recover')!.ability!.behaviors[0]!,
    ),
    id: 'prayer',
  }
  const weapon = itemFixture({
    id: 'test.sword',
    itemClass: 'weapon',
    equipment: { slot: 'hand', hands: 1 },
    ability: { schemaVersion: 1, behaviors: [attack, technique] },
    actions: {
      attack: { behaviorId: attack.id, name: 'Cut' },
      support: { behaviorId: technique.id, name: 'Sunward Prayer' },
    },
  })
  const definitions = { [weapon.id]: weapon }
  const empty = {
    characterId: 'character',
    revision: 0,
    stacks: [],
    equipment: {},
    selectedSupport: { kind: 'basic' as const, actionId: 'basic.pilfer' as const },
    previousBasicSupport: 'basic.pilfer' as const,
    grants: [],
  }
  const granted = grantInventoryItems(
    empty,
    definitions,
    0,
    'test',
    [{ itemId: weapon.id, quantity: 1 }],
    '2026-11-05T00:00:00Z',
  )
  expect(granted.ok).toBe(true)
  if (!granted.ok) return
  const equipped = equipInventoryItem(
    granted.snapshot,
    definitions,
    granted.snapshot.revision,
    granted.snapshot.stacks[0]!.id,
    'main-hand',
  )
  expect(equipped.ok).toBe(true)
  if (!equipped.ok) return
  const selected = selectInventorySupport(
    equipped.snapshot,
    definitions,
    equipped.snapshot.revision,
    { kind: 'equipment', position: 'main-hand', itemId: weapon.id, behaviorId: technique.id },
  )
  expect(selected.ok).toBe(true)
  if (!selected.ok) return
  const choices = (snapshot: typeof selected.snapshot) => {
    hooks.cells = []
    hooks.index = 0
    const view = characterItemsView({
      snapshot,
      definitions,
      catalogueToken: 'a'.repeat(32),
      battleLocked: false,
    })
    const tree = CharacterSkillBuildPanel({
      characterId: 'character',
      initialBuildVersion: 7,
      initialSupportActionId: 'basic.pilfer',
      initialItemsView: view,
      primaryDiscipline: { id: 'vanguard', name: 'Vanguard' },
      secondaryDiscipline: null,
      initialCapacity: 4,
      initialLearnedSkills: [],
      initialEquippedSkills: [],
      initialResonance: null,
      initialEssence: null,
    })
    return nodes(tree).filter((row) => row.type === 'input' && row.props.type === 'radio')
  }
  expect(choices(selected.snapshot).map((row) => row.props['aria-label'])).toEqual([
    'HP Recovery',
    'MP Recovery',
    'Pilfer',
    'Fleetstep',
    'Invocation',
    'Sunward Prayer · Main Hand',
  ])
  expect(
    choices(selected.snapshot)
      .filter((row) => row.props.checked)
      .map((row) => row.props['aria-label']),
  ).toEqual(['Sunward Prayer · Main Hand'])
  const removed = unequipInventoryItem(
    selected.snapshot,
    definitions,
    selected.snapshot.revision,
    'main-hand',
  )
  expect(removed.ok).toBe(true)
  if (!removed.ok) return
  expect(removed.snapshot.selectedSupport).toEqual({ kind: 'basic', actionId: 'basic.pilfer' })
  expect(choices(removed.snapshot).map((row) => row.props['aria-label'])).not.toContain(
    'Sunward Prayer · Main Hand',
  )
  expect(
    choices(removed.snapshot)
      .filter((row) => row.props.checked)
      .map((row) => row.props['aria-label']),
  ).toEqual(['Pilfer'])
  expect(
    selectInventorySupport(removed.snapshot, definitions, removed.snapshot.revision, {
      kind: 'equipment',
      position: 'main-hand',
      itemId: weapon.id,
      behaviorId: technique.id,
    }).ok,
  ).toBe(false)
})
