import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { WorldState } from '@/world/types'

vi.mock('server-only', () => ({}))
const { rpc, selected, claims, selection } = vi.hoisted(() => ({
  rpc: vi.fn(),
  selected: vi.fn(),
  claims: vi.fn(),
  selection: { value: '00000000-0000-4000-8000-000000000011' as string | null },
}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('@/lib/supabase/auth', () => ({ getVerifiedAuthClaims: claims }))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: selected,
  SELECTED_CHARACTER_COOKIE: 'aurevane_selected_character',
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'aurevane_selected_character' && selection.value
        ? { value: selection.value }
        : undefined,
  }),
}))
vi.mock('@/server/world/world-battle', () => ({ attackWorldPlayer: vi.fn() }))
import { POST } from './route'
import { WorldController } from '@/components/world/world-controller'
import { localRoute, WorldMotion } from '@/components/world/world-motion'
import { projectWorld } from '@/server/world/world-service'
import { mergeWorldMovement } from '@/world/movement-receipt'
import { newWorldState } from '@/world/travel'

const characterId = '00000000-0000-4000-8000-000000000011'
const resourceDelay = () => new Promise<void>((resolve) => setTimeout(resolve, 175))
const request = () =>
  new Request('https://example.test/api/world', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-world-response': 'movement' },
    body: JSON.stringify({
      characterId,
      expectedVersion: 1,
      commandId: '00000000-0000-4000-8000-000000000099',
      intent: { kind: 'walk', destination: { sectorId: 'verdant-expanse', x: 6, y: 0 } },
    }),
  })
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
  claims.mockReset().mockResolvedValue({ sub: 'owner', session_id: 'verified-session' })
  selected.mockReset().mockImplementation(async () => {
    await resourceDelay()
    return { id: characterId }
  })
  rpc.mockReset()
  selection.value = characterId
})
afterEach(() => {
  vi.useRealTimers()
})

it('keeps a first click moving through the preview boundary with delayed identity and database reads', async () => {
  const initial = newWorldState()
  const view = { ...projectWorld(initial, [], 1000), characterId }
  const destination = { sectorId: 'verdant-expanse', x: 6, y: 0 }
  const preview = localRoute(view, view.position, destination)!
  expect(preview.length).toBeGreaterThan(3)
  const motion = new WorldMotion(view, 0)
  motion.plan(preview, view.sectors, 0)
  rpc.mockImplementation(async (name: string, args: { p_next_state?: WorldState }) => {
    await resourceDelay()
    if (name === 'ensure_active_game_session_v1') return { data: true }
    if (name === 'read_world_state_v1')
      return {
        data: {
          state: initial,
          players: [],
          serverNow: 1000 + Math.floor(performance.now()),
          blocked: null,
          trainingExpired: false,
        },
      }
    if (name === 'commit_world_state_v1')
      return { data: { ...args.p_next_state!, version: initial.version + 1 } }
    throw new Error(`Unexpected resource: ${name}`)
  })
  let approvalAt: number | null = null
  const controller = new WorldController(view, {
    command: async (intent, current) => {
      const response = await POST(
        new Request('https://example.test/api/world', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-world-response': 'movement' },
          body: JSON.stringify({
            intent,
            characterId,
            expectedVersion: current.version,
            commandId: '00000000-0000-4000-8000-000000000099',
          }),
        }),
      )
      expect(response.status).toBe(200)
      approvalAt = performance.now()
      return mergeWorldMovement(current, await response.json())
    },
    refresh: async () => view,
    accept: (next, reconcile) => {
      const before = motion.sample(performance.now()).point
      if (reconcile) motion.reconcile(next, performance.now())
      else motion.approveReceipt(next, performance.now())
      expect(motion.sample(performance.now()).point).toEqual(before)
    },
    error: (message) => {
      throw new Error(message)
    },
    busy: () => {},
  })
  const command = controller.send({ kind: 'walk', destination })
  try {
    await vi.advanceTimersByTimeAsync(600)
    expect(motion.sample(performance.now()).moving).toBe(true)
    const before = motion.sample(performance.now()).point
    await vi.advanceTimersByTimeAsync(50)
    expect(motion.sample(performance.now()).moving).toBe(true)
    expect(motion.sample(performance.now()).point).not.toEqual(before)
    expect(approvalAt).toBe(525)
    expect((await command).applied).toBe(true)
    expect(motion.sample(10000).position).toEqual(destination)
  } finally {
    await vi.advanceTimersByTimeAsync(1000)
    await command
    controller.dispose()
  }
})

it('does not read or mutate World state while an active-session check is unresolved', async () => {
  let approve!: (result: { data: boolean }) => void
  rpc.mockImplementation((name: string) =>
    name === 'ensure_active_game_session_v1'
      ? new Promise((resolve) => {
          approve = resolve
        })
      : Promise.reject(new Error('World authority started before authentication')),
  )
  const response = POST(request())
  await vi.advanceTimersByTimeAsync(200)
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(['ensure_active_game_session_v1'])
  approve({ data: false })
  expect((await response).status).toBe(401)
})

it('rejects missing selected characters before any World state read or mutation', async () => {
  selected.mockResolvedValue(null)
  selection.value = null
  rpc.mockResolvedValue({ data: true })
  expect((await POST(request())).status).toBe(403)
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(['ensure_active_game_session_v1'])
})

it.each([null, {}, { sub: 'owner' }])(
  'rejects incomplete verified claims before any World operation (%j)',
  async (value) => {
    claims.mockResolvedValue(value)
    expect((await POST(request())).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  },
)

it.each(['not-a-character', 'abcdef01-0000-4000-8000-000000000011'.toUpperCase()])(
  'rejects a noncanonical selected cookie before any World operation (%s)',
  async (value) => {
    selection.value = value
    rpc.mockResolvedValue({ data: true })
    expect((await POST(request())).status).toBe(403)
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['ensure_active_game_session_v1'])
  },
)

it('requires the canonical ownership/deletion gate before movement can commit', async () => {
  rpc.mockImplementation(async (name: string) =>
    name === 'ensure_active_game_session_v1'
      ? { data: true }
      : { error: { message: 'WORLD_NOT_OWNED' } },
  )
  const response = await POST(request())
  expect(response.status).toBe(403)
  expect(await response.json()).not.toHaveProperty('route')
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    'ensure_active_game_session_v1',
    'read_world_state_v1',
  ])
})
