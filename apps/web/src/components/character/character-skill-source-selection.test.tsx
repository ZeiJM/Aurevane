import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
} from '@aurevane/game-core/combat/mature-skills'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState(initial: unknown) {
    const index = hooks.index++
    if (!(index in hooks.cells))
      hooks.cells[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      hooks.cells[index],
      (value: unknown) => {
        hooks.cells[index] =
          typeof value === 'function'
            ? (value as (previous: unknown) => unknown)(hooks.cells[index])
            : value
      },
    ]
  },
  useRef(initial: unknown) {
    const index = hooks.index++
    if (!(index in hooks.cells)) hooks.cells[index] = { current: initial }
    return hooks.cells[index]
  },
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => undefined,
  useSyncExternalStore: () => true,
}))
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (node: unknown) => node,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {} }),
  usePathname: () => '/game/character',
  useSearchParams: () => new URLSearchParams('profilePanel=techniques'),
}))
vi.mock('./skill-effect-timing-context', () => ({ useSkillEffectTimingPolicy: () => null }))
import { CharacterSkillBuildPanel } from './character-skill-build-panel'
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
const shared = resolveMatureSkillVersion('lifebinder.mending-light')!
const nativeSkills = latestEnabledMatureSkills()
  .filter((skill) => skill.sourceDisciplineId === 'vanguard')
  .slice(0, 3)
const grants = [
  { eligibilityDisciplineId: 'aetherist', activeSource: true },
  { eligibilityDisciplineId: 'vanguard', activeSource: true },
]
const learned = [
  {
    definition: shared,
    learnedAt: '2026-10-20T00:00:00Z',
    activeSource: true,
    eligibilityGrants: grants,
  },
  ...nativeSkills.map((definition) => ({
    definition,
    learnedAt: '2026-10-20T00:00:00Z',
    activeSource: true,
  })),
]
function fixture(equipped: { definition: typeof shared; eligibilityDisciplineId?: string }[]) {
  const initialEquippedSkills = equipped.map((entry, slotIndex) => ({
    ...entry,
    slotIndex: slotIndex + 1,
    equippedAt: '2026-10-20T00:00:00Z',
  }))
  const request = vi.fn(async (_url: string, options: RequestInit) => {
    const command = JSON.parse(String(options.body))
    return Response.json({
      context: {
        build: { buildVersion: 3 },
        disciplineSkills: {
          capacity: 4,
          learnedSkills: learned,
          equippedSkills: command.eligibilitySelections.map(
            (choice: { skillId: string; eligibilityDisciplineId: string }, slotIndex: number) => ({
              definition: learned.find((entry) => entry.definition.id === choice.skillId)!
                .definition,
              eligibilityDisciplineId: choice.eligibilityDisciplineId,
              slotIndex: slotIndex + 1,
              equippedAt: '2026-10-26T00:00:00Z',
            }),
          ),
        },
      },
    })
  })
  vi.stubGlobal('fetch', request)
  function render() {
    hooks.index = 0
    return CharacterSkillBuildPanel({
      characterId: 'chosen',
      initialBuildVersion: 2,
      primaryDiscipline: { id: 'vanguard', name: 'Vanguard' },
      secondaryDiscipline: { id: 'aetherist', name: 'Aetherist' },
      initialCapacity: 4,
      initialLearnedSkills: learned,
      initialEquippedSkills,
      initialResonance: null,
      initialEssence: null,
    })
  }
  const select = (name: string) =>
    find(
      render(),
      (element) => element.type === 'input' && element.props['aria-label'] === 'Select ' + name,
    )!
  return { request, select, render }
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  vi.stubGlobal('document', { body: {} })
})
afterEach(() => vi.unstubAllGlobals())
it('equips a shared Skill without a dropdown, choosing the active primary grant deterministically', async () => {
  const { request, select } = fixture([])
  const checkbox = select('Mending Light')
  expect(checkbox.props.disabled).toBe(false)
  ;(checkbox.props.onChange as () => void)()
  await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
  expect(JSON.parse(String(request.mock.calls[0]![1].body))).toMatchObject({
    eligibilitySelections: [{ skillId: shared.id, eligibilityDisciplineId: 'vanguard' }],
  })
})
it('retains a valid equipped shared Skill source while adding another Skill', async () => {
  const { request, select } = fixture([
    { definition: shared, eligibilityDisciplineId: 'aetherist' },
  ])
  ;(select('Forceful Strike').props.onChange as () => void)()
  await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
  expect(JSON.parse(String(request.mock.calls[0]![1].body)).eligibilitySelections).toContainEqual({
    skillId: shared.id,
    eligibilityDisciplineId: 'aetherist',
  })
})
it('uses the other active grant when the primary has reached its existing mixed-source limit', async () => {
  const { request, select } = fixture(
    nativeSkills.map((definition) => ({ definition, eligibilityDisciplineId: 'vanguard' })),
  )
  const checkbox = select('Mending Light')
  expect(checkbox.props.disabled).toBe(false)
  ;(checkbox.props.onChange as () => void)()
  await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
  expect(JSON.parse(String(request.mock.calls[0]![1].body)).eligibilitySelections).toContainEqual({
    skillId: shared.id,
    eligibilityDisciplineId: 'aetherist',
  })
})
it('replaces an invalid equipped provenance only with an active granting Discipline', async () => {
  const { request, select } = fixture([{ definition: shared, eligibilityDisciplineId: 'inactive' }])
  ;(select('Forceful Strike').props.onChange as () => void)()
  await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
  expect(JSON.parse(String(request.mock.calls[0]![1].body)).eligibilitySelections).toContainEqual({
    skillId: shared.id,
    eligibilityDisciplineId: 'vanguard',
  })
})
