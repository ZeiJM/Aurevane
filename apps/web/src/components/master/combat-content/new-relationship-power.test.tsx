import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = initial
    return [
      hooks.cells[i],
      (value: unknown) => {
        hooks.cells[i] = value
      },
    ]
  },
  useRef(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = { current: initial }
    return hooks.cells[i]
  },
}))
import { NewRelationshipPower } from './new-relationship-power'
type Props = { children?: ReactNode; disabled?: boolean; onClick?(): void; role?: string }
function find(
  node: ReactNode,
  predicate: (node: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean) ?? null
  if (!isValidElement<Props>(node)) return null
  return predicate(node) ? node : find(node.props.children, predicate)
}
let storage: Map<string, string>
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())
function mount({
  failOnce = false,
  deleted = false,
  active = true,
  compact = false,
  partner = null as string | null,
} = {}) {
  const commands: Record<string, unknown>[] = []
  const created = vi.fn(),
    busy = vi.fn()
  let child: Record<string, unknown>
  vi.stubGlobal('fetch', async (_url: unknown, input: RequestInit) => {
    const { command } = JSON.parse(String(input.body))
    commands.push(command)
    if (failOnce) {
      failOnce = false
      throw new Error('Connection interrupted')
    }
    if (command.action === 'create')
      child = {
        contentKey: command.definition.essenceId ?? command.definition.id,
        contentKind: command.contentKind,
        lifecycle: 'draft',
        draft: { definition: command.definition },
      }
    return Response.json({
      record: {
        ...child,
        ...(command.action === 'read' && deleted ? { lifecycle: 'archived' } : {}),
      },
    })
  })
  const render = () => {
    hooks.index = 0
    return NewRelationshipPower({
      parent: {
        contentKey: 'discipline.custom',
        lifecycle: active ? 'active' : 'draft',
      } as CompleteCombatContentRecord,
      partner,
      blank:
        partner === null
          ? { ...currentEssenceDefinitions()[0]! }
          : { ...currentResonanceDefinitions()[0]! },
      recoveryScope: 'owner',
      disabled: false,
      compact,
      triggerLabel: compact ? 'Edit power for None (Essence)' : undefined,
      onCreated: created,
      onBusyChange: busy,
    })
  }
  const button = () => find(render(), (node) => node.type === 'button')!
  return { render, button, created, busy, commands }
}
it.each([null, 'discipline.partner'])(
  'creates a correctly owned power for %s, reads its current state and opens the editor',
  async (partner) => {
    const f = mount({ partner })
    f.button().props.onClick!()
    await vi.waitFor(() => expect(f.created).toHaveBeenCalledTimes(1))
    expect(f.commands[0]).toMatchObject(
      partner === null
        ? {
            action: 'create',
            contentKind: 'essence',
            definition: {
              sourceDisciplineId: 'discipline.custom',
              skill: { sourceDisciplineId: 'discipline.custom' },
            },
          }
        : {
            action: 'create',
            contentKind: 'resonance',
            definition: { disciplinePair: ['discipline.custom', partner] },
          },
    )
    expect(f.commands[1]).toMatchObject({ action: 'read' })
    expect(f.busy.mock.calls).toEqual([[true], [false]])
    expect(storage.size).toBe(0)
  },
)
it('recovers an uncertain request with the same identity and payload', async () => {
  const f = mount({ failOnce: true })
  f.button().props.onClick!()
  await vi.waitFor(() =>
    expect(find(f.render(), (node) => node.props.role === 'alert')).not.toBeNull(),
  )
  expect(storage.size).toBe(1)
  f.button().props.onClick!()
  await vi.waitFor(() => expect(f.created).toHaveBeenCalledTimes(1))
  expect(f.commands[1]).toEqual(f.commands[0])
  expect(storage.size).toBe(0)
})
it('a stale creation receipt cannot revive a subsequently deleted power', async () => {
  const f = mount({ deleted: true })
  f.button().props.onClick!()
  await vi.waitFor(() =>
    expect(find(f.render(), (node) => node.props.role === 'alert')).not.toBeNull(),
  )
  expect(f.created).not.toHaveBeenCalled()
  expect(storage.size).toBe(0)
})
it('requires a committed Discipline before creating a relationship power', () => {
  const f = mount({ active: false })
  expect(f.button().props.disabled).toBe(true)
  f.button().props.onClick!()
  expect(f.commands).toHaveLength(0)
})

it('the direct Edit trigger creates and opens a new power without a separate selector or Apply step', async () => {
  const f = mount({ compact: true })
  expect(f.button().props.children).toBe('Edit')
  f.button().props.onClick!()
  await vi.waitFor(() => expect(f.created).toHaveBeenCalledOnce())
  expect(f.commands.map((command) => command.action)).toEqual(['create', 'read'])
})
