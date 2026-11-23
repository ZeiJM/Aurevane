import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  RpcPublishedCombatContentSource,
  createServerCombatContentResolver,
  serverCombatCatalogueSnapshotCache,
} from './combat-content-resolver'
import type { PublishedCombatContentCatalogueSnapshot } from './combat-content-resolver'
vi.mock('server-only', () => ({}))
const adminRpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: adminRpc }) }))

function fixture() {
  let token = 'a'.repeat(32)
  let snapshotError = false
  let tokenError = false
  let load: (() => Promise<void>) | undefined
  const cache = new Map<string, Promise<PublishedCombatContentCatalogueSnapshot>>()
  const definition = { ...structuredClone(defaultBasicSkills()[0]!) }
  const snapshot = () => ({
    token,
    policy: { version: 8, modes: {} },
    archivedKeys: [],
    publications: [
      {
        id: `version:${token}`,
        content_key: definition.id,
        content_kind: 'skill',
        content_version: definition.contentVersion,
        definition: structuredClone(definition),
        published_by: 'owner',
        published_at: '2026-10-29T08:00:00Z',
      },
    ],
  })
  const rpc = vi.fn(async (name: string) => {
    if (name === 'read_combat_content_catalogue_token_v1')
      return { data: token, error: tokenError ? { code: 'XX000', message: 'unavailable' } : null }
    if (name !== 'read_combat_content_catalogue_v1') throw new Error(`Unexpected RPC ${name}`)
    await load?.()
    return {
      data: snapshot(),
      error: snapshotError ? { code: 'XX000', message: 'unavailable' } : null,
    }
  })
  return {
    cache,
    rpc,
    definition,
    source: () => new RpcPublishedCombatContentSource(rpc, cache),
    setToken: (next: string) => {
      token = next
    },
    failToken: () => {
      tokenError = true
    },
    failSnapshot: (value: boolean) => {
      snapshotError = value
    },
    setLoad: (value: () => Promise<void>) => {
      load = value
    },
    calls: (name: string) => rpc.mock.calls.filter(([called]) => called === name).length,
  }
}

it('checks database authority on every request while reusing unchanged validated definitions across sources', async () => {
  const f = fixture()
  const first = await f.source().readCatalogueSnapshot()
  const second = await f.source().readCatalogueSnapshot()
  expect(second).toEqual(first)
  expect(f.calls('read_combat_content_catalogue_v1')).toBe(1)
  expect(f.calls('read_combat_content_catalogue_token_v1')).toBe(2)
})

it('uses revision-checked reuse in the real server resolver factory across requests', async () => {
  const f = fixture()
  serverCombatCatalogueSnapshotCache.clear()
  adminRpc.mockImplementation(f.rpc)
  try {
    const first = await createServerCombatContentResolver().captureCurrentCatalogue!()
    const second = await createServerCombatContentResolver().captureCurrentCatalogue!()
    expect(first.policy).toEqual(second.policy)
    expect(f.calls('read_combat_content_catalogue_v1')).toBe(1)
    expect(f.calls('read_combat_content_catalogue_token_v1')).toBe(2)
  } finally {
    serverCombatCatalogueSnapshotCache.clear()
  }
})

it('observes a changed publication on the next request without waiting for expiry', async () => {
  const f = fixture()
  await f.source().readCatalogueSnapshot()
  f.setToken('b'.repeat(32))
  f.definition.name = 'New authored name'
  const next = await f.source().readCatalogueSnapshot()
  expect(next.token).toBe('b'.repeat(32))
  expect(next.publications[0]!.definition.name).toBe('New authored name')
  expect(f.calls('read_combat_content_catalogue_v1')).toBe(2)
})

it('coalesces simultaneous reads of one generation and isolates returned mutations', async () => {
  const f = fixture()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  f.setLoad(() => gate)
  const a = f.source().readCatalogueSnapshot()
  const b = f.source().readCatalogueSnapshot()
  await vi.waitFor(() => expect(f.calls('read_combat_content_catalogue_v1')).toBeGreaterThan(0))
  release()
  const [first, second] = await Promise.all([a, b])
  ;(first.publications[0]!.definition as Record<string, unknown>).name = 'Caller mutation'
  expect(second.publications[0]!.definition.name).not.toBe('Caller mutation')
  expect((await f.source().readCatalogueSnapshot()).publications[0]!.definition.name).not.toBe(
    'Caller mutation',
  )
  expect(f.calls('read_combat_content_catalogue_v1')).toBe(1)
})

it('fails closed on a fresh authority error even with a usable cached generation', async () => {
  const f = fixture()
  await f.source().readCatalogueSnapshot()
  f.failToken()
  await expect(f.source().readCatalogueSnapshot()).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})

it('does not retain a failed generation and can load it after recovery', async () => {
  const f = fixture()
  f.failSnapshot(true)
  await expect(f.source().readCatalogueSnapshot()).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
  f.failSnapshot(false)
  expect((await f.source().readCatalogueSnapshot()).token).toBe('a'.repeat(32))
  expect(f.calls('read_combat_content_catalogue_v1')).toBe(2)
})

it('does not alias a newer snapshot to the token read before an overlapping publication', async () => {
  const f = fixture()
  f.setLoad(async () => {
    f.setToken('b'.repeat(32))
  })
  expect((await f.source().readCatalogueSnapshot()).token).toBe('b'.repeat(32))
  expect(f.cache.has('a'.repeat(32))).toBe(false)
})

it('rejects an invalid fresh revision instead of using cached definitions', async () => {
  const f = fixture()
  await f.source().readCatalogueSnapshot()
  f.setToken('invalid')
  await expect(f.source().readCatalogueSnapshot()).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
  expect(f.calls('read_combat_content_catalogue_v1')).toBe(1)
})

it('never retains an invalid current definition and validates a corrected retry', async () => {
  const f = fixture()
  f.definition.contentVersion = 0
  await expect(f.source().readCatalogueSnapshot()).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
  expect(f.cache.size).toBe(0)
  f.definition.contentVersion = 1
  await expect(f.source().readCatalogueSnapshot()).resolves.toMatchObject({ token: 'a'.repeat(32) })
})

it('bounds retained generations while older callers keep their independent captures', async () => {
  const f = fixture()
  const first = await f.source().readCatalogueSnapshot()
  for (const digit of ['b', 'c', 'd']) {
    f.setToken(digit.repeat(32))
    await f.source().readCatalogueSnapshot()
  }
  expect(f.cache.size).toBeLessThanOrEqual(2)
  expect(first.token).toBe('a'.repeat(32))
})
