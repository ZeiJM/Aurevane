import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import { createCombatContentTestDatabase } from '../../../../../packages/db/src/test-support/combat-content-test-database'
const session = vi.hoisted(() => ({
  userId: '00000000-0000-4000-8000-000000000001',
  rpc: vi.fn(),
}))
const hooks = vi.hoisted(() => ({
  index: 0,
  cells: [] as unknown[],
  effects: [] as (() => void)[],
  cleanups: [] as (() => void)[],
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState(initial: unknown) {
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
  useRef(initial: unknown) {
    const index = hooks.index++
    if (!(index in hooks.cells)) hooks.cells[index] = { current: initial }
    return hooks.cells[index]
  },
  useEffect(effect: () => void | (() => void), dependencies: unknown[]) {
    const index = hooks.index++
    const previous = hooks.cells[index] as unknown[] | undefined
    if (!previous || dependencies.some((value, ordinal) => !Object.is(value, previous[ordinal]))) {
      hooks.cells[index] = dependencies
      hooks.effects.push(() => {
        const cleanup = effect()
        if (cleanup) hooks.cleanups.push(cleanup)
      })
    }
  },
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: session.rpc }) }))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: async () => ({ userId: session.userId }),
}))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: async () => null,
}))
import { POST } from '@/app/api/master/combat-content/route'
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
import { ContentRecordModal } from '@/components/master/combat-content/content-record-modal'
import { ContentDefinitionFields } from '@/components/master/combat-content/content-definition-fields'
import { AbilityText } from '@/components/master/combat-content/ability-editor-fields'

const owner = session.userId
let db: Awaited<ReturnType<typeof createCombatContentTestDatabase>>
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  await db.query('insert into auth.users(id) values($1),($2)', [
    owner,
    '00000000-0000-4000-8000-000000000002',
  ])
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [owner],
  )
}, 60000)
afterAll(async () => {
  await db?.close()
})
beforeEach(async () => {
  session.userId = owner
  hooks.index = 0
  hooks.cells = []
  hooks.effects = []
  hooks.cleanups = []
  await db.exec('begin')
  session.rpc
    .mockReset()
    .mockImplementation(async (name: string, parameters: Record<string, unknown>) => {
      const keys = Object.keys(parameters)
      if (![name, ...keys].every((value) => /^[a-z_][a-z0-9_]*$/u.test(value)))
        throw new Error('Invalid test RPC identifier')
      const invocation = `public.${name}(${keys.map((key, index) => `${key} => $${index + 1}`).join(',')})`
      const rowsResult = [
        'read_master_panel_operator_v1',
        'read_combat_content_version_v1',
      ].includes(name)
      await db.exec('savepoint rpc_call')
      try {
        const rows = (
          await db.query<Record<string, unknown>>(
            rowsResult ? `select * from ${invocation}` : `select ${invocation} value`,
            Object.values(parameters),
          )
        ).rows
        await db.exec('release savepoint rpc_call')
        return { data: JSON.parse(JSON.stringify(rowsResult ? rows : rows[0]?.value)), error: null }
      } catch (error) {
        await db.exec('rollback to savepoint rpc_call; release savepoint rpc_call')
        return {
          data: null,
          error: { code: (error as { code?: string }).code, message: (error as Error).message },
        }
      }
    })
})
afterEach(async () => {
  hooks.cleanups.forEach((cleanup) => cleanup())
  vi.unstubAllGlobals()
  await db.exec('rollback')
})
async function command(command: Record<string, unknown>) {
  const response = await POST(
    new Request('https://example.test/api/master/combat-content', {
      method: 'POST',
      body: JSON.stringify({ operation: 'record', command }),
    }),
  )
  return {
    status: response.status,
    body: (await response.json()) as {
      record: CompleteCombatContentRecord
      error?: { code: string; message: string }
    },
  }
}

it('saves and commits an editable Invocation profile without rewriting Vesper’s literal defaults or text', async () => {
  const initial = await command({ action: 'read', contentKey: 'basic.invocation' })
  expect(initial.status, JSON.stringify(initial.body)).toBe(200)
  const authored = structuredClone(
    initial.body.record.builtinDefinition!,
  ) as unknown as import('@aurevane/game-core/combat/combat-basic-actions').BasicSkillDefinition
  const summon = authored.ability.behaviors
    .flatMap((group) => group.effects)
    .find((effect) => effect.payload.type === 'summon')!
  if (summon.payload.type !== 'summon') throw new Error('Missing default Invocation summon')
  const profile = {
    ...summon.payload.profile,
    neverMoves: false,
    abilities: summon.payload.profile.abilities.map((ability) => ({ ...ability, hpCost: 0 })),
    description: 'An Owner-authored moon drake description.',
    flavorLine: '{actor} calls a tiny moon drake.',
  }
  const definition = {
    ...authored,
    ability: {
      ...authored.ability,
      behaviors: authored.ability.behaviors.map((group) => ({
        ...group,
        effects: group.effects.map((effect) =>
          effect === summon ? { ...effect, payload: { ...summon.payload, profile } } : effect,
        ),
      })),
    },
  }
  const saved = await command({
    action: 'save',
    contentKey: authored.id,
    expectedRevision: initial.body.record.revision,
    definition,
  })
  expect(saved.status, JSON.stringify(saved.body)).toBe(200)
  const committed = await command({
    action: 'commit',
    contentKey: authored.id,
    expectedRevision: saved.body.record.revision,
    definition: saved.body.record.draft!.definition,
  })
  expect(committed.status, JSON.stringify(committed.body)).toBe(200)
  const read = await command({ action: 'read', contentKey: authored.id })
  const published = read.body.record.current!.definition as unknown as typeof authored
  const restored = published.ability.behaviors
    .flatMap((group) => group.effects)
    .find((effect) => effect.payload.type === 'summon')!
  expect(restored.payload).toMatchObject({
    type: 'summon',
    profile: {
      maxHp: 40,
      maxMp: 12,
      aiProfile: 'standard',
      description: profile.description,
      flavorLine: profile.flavorLine,
    },
  })
  if (restored.payload.type === 'summon') expect(restored.payload.profile).toEqual(profile)
})

it.each([
  ['skill', 'basic.recover'],
  ['essence', currentEssenceDefinitions()[0]!.essenceId],
  ['resonance', currentResonanceDefinitions()[0]!.id],
] as const)(
  'the real %s Commit route atomically publishes edits and preserves draft-only Save and historical versions',
  async (kind, key) => {
    const read = await command({ action: 'read', contentKey: key })
    expect(read.status, JSON.stringify(read.body)).toBe(200)
    const initial = read.body.record
    const definition = initial.builtinDefinition!
    expect(definition).toBeTruthy()
    const authored = { ...definition, name: 'First committed name' }
    const committed = await command({
      action: 'commit',
      contentKey: key,
      expectedRevision: initial.revision,
      definition: authored,
    })
    expect(committed.status, JSON.stringify(committed.body)).toBe(200)
    expect(committed.body.record.draft).toBeNull()
    expect(committed.body.record.current!.definition.name).toBe('First committed name')
    const first = committed.body.record.current!
    expect(
      (
        await db.query<{ definition: unknown }>(
          'select definition from public.read_current_combat_content_v1($1,$2)',
          [key, kind],
        )
      ).rows,
    ).toEqual([{ definition: first.definition }])
    expect(
      session.rpc.mock.calls.some(([name]) => name === 'commit_combat_content_record_v1'),
    ).toBe(true)

    const changed = { ...first.definition, name: 'Draft name' }
    const saved = await command({
      action: 'save',
      contentKey: key,
      expectedRevision: committed.body.record.revision,
      definition: changed,
    })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect(saved.body.record.draft!.definition.name).toBe('Draft name')
    expect(saved.body.record.current).toEqual(first)
    const next = await command({
      action: 'commit',
      contentKey: key,
      expectedRevision: saved.body.record.revision,
      definition: changed,
    })
    expect(next.status, JSON.stringify(next.body)).toBe(200)
    expect(next.body.record.draft).toBeNull()
    expect(next.body.record.current).toMatchObject({
      contentVersion: first.contentVersion + 1,
      definition: { name: 'Draft name' },
    })
    expect(
      (
        await db.query<{ definition: unknown }>(
          'select definition from public.read_combat_content_version_v1($1,$2,$3)',
          [key, kind, first.contentVersion],
        )
      ).rows,
    ).toEqual([{ definition: first.definition }])
    const reloaded = await command({ action: 'read', contentKey: key })
    expect(reloaded.body.record.current).toEqual(next.body.record.current)
    expect(reloaded.body.record.draft).toBeNull()
    const unchanged = await command({
      action: 'commit',
      contentKey: key,
      expectedRevision: next.body.record.revision,
      definition: next.body.record.current!.definition,
    })
    expect(unchanged.status, JSON.stringify(unchanged.body)).toBe(200)
    expect(unchanged.body.record).toEqual(next.body.record)
    expect(
      (
        await command({
          action: 'commit',
          contentKey: key,
          expectedRevision: saved.body.record.revision,
          definition: changed,
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await command({
          action: 'commit',
          contentKey: key,
          expectedRevision: next.body.record.revision,
          definition: changed,
          publish: false,
        })
      ).status,
    ).toBe(400)
    session.userId = '00000000-0000-4000-8000-000000000002'
    expect(
      (
        await command({
          action: 'commit',
          contentKey: key,
          expectedRevision: next.body.record.revision,
          definition: changed,
        })
      ).status,
    ).toBe(403)
  },
)

type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (element: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, predicate)
      if (found) return found
    }
  }
  if (!isValidElement<Props>(node)) return null
  return predicate(node) ? node : find(node.props.children, predicate)
}
it.each(['complete', 'newer-edits', 'discipline-edits', 'parent-error'] as const)(
  'the nested Resonance editor Commit Now publishes with truthful %s feedback',
  async (scenario) => {
    const key = currentResonanceDefinitions()[0]!.id
    let pending: Parameters<typeof ContentRecordModal>[0]['pending'] = null
    const requests: Record<string, unknown>[] = []
    vi.stubGlobal('document', { activeElement: null })
    vi.stubGlobal('HTMLElement', class {})
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)).command)
      return POST(new Request('https://example.test/api/master/combat-content', init))
    })
    const render = () => {
      hooks.index = 0
      const tree = ContentRecordModal({
        contentKey: key,
        choices: [],
        pending,
        onChange: (_key, next) => {
          pending = next
        },
        onClose() {},
        onSaved() {},
        async onCommitRelated() {
          if (scenario === 'parent-error') throw new Error('Master discipline changed.')
          return scenario === 'discipline-edits'
        },
      })
      hooks.effects.splice(0).forEach((effect) => effect())
      return tree
    }
    const fields = () => find(render(), (element) => element.type === ContentDefinitionFields)
    await vi.waitFor(() => expect(fields()).not.toBeNull())
    const details = ContentDefinitionFields({
      ...(fields()!.props as Parameters<typeof ContentDefinitionFields>[0]),
      abilitySection: 'details',
    })
    const name = find(
      details,
      (element) => element.type === AbilityText && element.props.label === 'Name',
    )!
    ;(name.props.onChange as (name: string) => void)('Committed Resonance from dialog')
    const button = find(
      render(),
      (element) => element.type === 'button' && element.props.children === 'Commit Now',
    )!
    expect(button.props.disabled).toBe(false)
    ;(button.props.onClick as () => void)()
    if (scenario === 'newer-edits') {
      const nextDetails = ContentDefinitionFields({
        ...(fields()!.props as Parameters<typeof ContentDefinitionFields>[0]),
        abilitySection: 'details',
      })
      const nextName = find(
        nextDetails,
        (element) => element.type === AbilityText && element.props.label === 'Name',
      )!
      ;(nextName.props.onChange as (name: string) => void)('Newer local Resonance edit')
    }
    const expectedMessage = {
      complete: 'Changes committed and available to the game.',
      'newer-edits': 'Changes committed; newer edits remain uncommitted.',
      'discipline-edits': 'Changes committed; discipline edits remain uncommitted.',
      'parent-error':
        'Changes committed; discipline settings are still uncommitted. Master discipline changed.',
    }[scenario]
    await vi.waitFor(() =>
      expect(
        find(
          render(),
          (element) =>
            element.type === 'p' &&
            element.props.role === (scenario === 'parent-error' ? 'alert' : 'status'),
        )?.props.children,
      ).toBe(expectedMessage),
    )
    expect(
      requests.filter((request) => ['save', 'commit', 'publish'].includes(String(request.action))),
    ).toEqual([expect.objectContaining({ action: 'commit', contentKey: key })])
    if (scenario === 'newer-edits')
      expect(pending).toMatchObject({ definition: { name: 'Newer local Resonance edit' } })
    else expect(pending).toBeNull()
    const reloaded = await command({ action: 'read', contentKey: key })
    expect(reloaded.body.record.draft).toBeNull()
    expect(reloaded.body.record.current!.definition.name).toBe('Committed Resonance from dialog')
    expect(
      (
        await db.query<{ definition: { name: string } }>(
          "select definition from public.read_current_combat_content_v1($1,'resonance')",
          [key],
        )
      ).rows[0]!.definition.name,
    ).toBe('Committed Resonance from dialog')
  },
)
