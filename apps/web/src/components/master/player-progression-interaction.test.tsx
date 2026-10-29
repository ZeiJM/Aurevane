import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES } from '@aurevane/game-core/character/attribute-allocation'
import type { MasterPlayerView } from '@/master/players'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells))
      hooks.cells[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      hooks.cells[i],
      (value: unknown) => {
        hooks.cells[i] =
          typeof value === 'function' ? (value as (old: unknown) => unknown)(hooks.cells[i]) : value
      },
    ]
  },
}))
import { PlayerCorrectionForm } from './player-correction-form'
type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (node: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean) ?? null
  if (!isValidElement<Props>(node)) return null
  return predicate(node) ? node : find(node.props.children, predicate)
}
const policy = FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES[0]!
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  vi.stubGlobal(
    'FormData',
    class {
      get() {
        return null
      }
    },
  )
})
afterEach(() => vi.unstubAllGlobals())
function fixture(options: Partial<Parameters<typeof PlayerCorrectionForm>[0]> = {}) {
  const onReview = vi.fn()
  const player = {
    facts: {
      xp: 1185,
      level: 6,
      attributes: {
        ...policy.baseAttributes,
        might: policy.baseAttributes.might + 7,
        finesse: policy.baseAttributes.finesse + 3,
      },
      build: { primary: { disciplineId: policy.disciplineId }, secondary: null },
    },
    calculated: { personalPointPool: 10 },
    attributePolicy: policy,
    progressionCurve: {
      version: 17,
      maxLevel: 100,
      cumulativeXpByLevel: Array.from({ length: 100 }, (_, i) => i * 237),
    },
    learnedSkills: [],
    disciplines: [],
  } as unknown as MasterPlayerView
  const render = () => {
    hooks.index = 0
    return PlayerCorrectionForm({ player, onReview, disabled: false, ...options })
  }
  const input = (label: string) =>
    find(
      render(),
      (node) =>
        node.type === 'input' && (node.props.name === label || node.props['aria-label'] === label),
    )!
  const enter = (label: string, value: string) =>
    (input(label).props.onChange as (event: unknown) => void)({ target: { value } })
  const click = (label: string) =>
    (
      find(render(), (node) => node.type === 'button' && node.props.children === label)!.props
        .onClick as () => void
    )()
  const submit = () =>
    (render().props.onSubmit as (event: unknown) => void)({
      preventDefault() {},
      currentTarget: {},
    })
  return { render, input, enter, click, submit, onReview, player }
}
it('previews de-leveling without changing stats, then requires accepting redistribution before review', () => {
  const f = fixture()
  f.enter('Level', '1')
  expect(f.input('xp').props.value).toBe('0')
  expect(f.input('might').props.value).toBe(String(policy.baseAttributes.might + 7))
  f.submit()
  expect(f.onReview).not.toHaveBeenCalled()
  f.click('Use this allocation')
  f.submit()
  expect(f.onReview).toHaveBeenCalledWith({
    kind: 'source',
    xp: 0,
    attributes: {
      ...policy.baseAttributes,
      might: policy.baseAttributes.might + 4,
      finesse: policy.baseAttributes.finesse + 1,
    },
  })
})
it('Fit Level changes XP only after a deliberate click, using the actual pinned curve', () => {
  const f = fixture()
  f.enter('xp', '237')
  expect(f.input('Level').props.value).toBe('2')
  f.click('Fit Level to Stats · Level 6')
  expect(f.input('Level').props.value).toBe('6')
  expect(f.input('xp').props.value).toBe('1185')
  f.submit()
  expect(f.onReview).toHaveBeenCalledOnce()
})
it('allows empty numeric edits, strips leading zeros and retains the draft across section changes', () => {
  const f = fixture()
  f.enter('might', '')
  expect(f.input('might').props.value).toBe('')
  f.submit()
  expect(f.onReview).not.toHaveBeenCalled()
  f.enter('might', '015')
  expect(f.input('might').props.value).toBe('15')
  f.click('Disciplines')
  f.click('Stats & Progression')
  expect(f.input('might').props.value).toBe('15')
})

it('keeps refunded points by default and lowers Level/XP only when explicitly chosen', () => {
  const f = fixture()
  f.enter('might', String(policy.baseAttributes.might + 2))
  expect(f.input('Level').props.value).toBe('6')
  expect(f.input('xp').props.value).toBe('1185')
  f.submit()
  expect(f.onReview).toHaveBeenLastCalledWith({
    kind: 'source',
    xp: 1185,
    attributes: {
      ...policy.baseAttributes,
      might: policy.baseAttributes.might + 2,
      finesse: policy.baseAttributes.finesse + 3,
    },
  })
  f.click('Lower to Level 1 and remove 5 banked points')
  expect(f.input('Level').props.value).toBe('1')
  expect(f.input('xp').props.value).toBe('0')
  f.submit()
  expect(f.onReview).toHaveBeenLastCalledWith({
    kind: 'source',
    xp: 0,
    attributes: {
      ...policy.baseAttributes,
      might: policy.baseAttributes.might + 2,
      finesse: policy.baseAttributes.finesse + 3,
    },
  })
})

it('opens Encounter while battle-blocked corrections remain disabled', () => {
  const f = fixture({
    disabled: true,
    navigationDisabled: false,
    encounter: <p>Active encounter</p>,
  })
  f.click('Encounter')
  expect(
    find(f.render(), (node) => node.props['data-player-encounter-panel'] === true)?.props.hidden,
  ).toBe(false)
  expect(find(f.render(), (node) => node.type === 'fieldset')?.props).toMatchObject({
    hidden: true,
    disabled: true,
  })
  f.submit()
  expect(f.onReview).not.toHaveBeenCalled()
  f.click('Stats & Progression')
  expect(find(f.render(), (node) => node.type === 'fieldset')?.props).toMatchObject({
    hidden: false,
    disabled: true,
  })
  f.submit()
  expect(f.onReview).not.toHaveBeenCalled()
})
