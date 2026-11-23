import { describe, expect, it, vi } from 'vitest'
import type { WorldView } from './types'
import {
  mergeWorldRefresh,
  retainWorldSceneReferences,
  readWorldSceneRefresh,
  worldRefreshResponse,
  worldRefreshUrl,
} from './presence'
import { worldSyncDelayMs } from './travel'
import { prepareLocalRoute } from '@/components/world/world-motion'

const view = {
  characterId: 'owner',
  version: 7,
  serverNow: 1000,
  position: { sectorId: 'a', x: 2, y: 4 },
  route: [],
  players: [],
  sectors: [{ id: 'a', cells: [] }],
  atlas: [{ id: 'a' }],
  movementBlocked: null,
  battleSessionId: null,
  environment: { weather: 'clear' },
} as unknown as WorldView

describe('scoped World presence refresh', () => {
  it('requests full scenery for the real viewport instead of an unchanged-version presence receipt', () => {
    const url = worldRefreshUrl(view, { width: 2560, height: 1440 })
    expect(url).toBe('/api/world?sceneWidth=2560&sceneHeight=1440')
    expect(worldRefreshResponse(view, url)).toBe(view)
  })
  it('refreshes live event objectives even when owned movement version is unchanged', () => {
    const previous = { ...view, objectives: [] }
    const next = {
      ...previous,
      objectives: [{ id: 'live-event', name: 'Explore the event' }],
    } as WorldView
    expect(
      mergeWorldRefresh(previous, worldRefreshResponse(next, worldRefreshUrl(previous))).objectives,
    ).toEqual(next.objectives)
  })
  it('refreshes local conversation availability without downloading unchanged terrain', () => {
    const previous = { ...view, interactions: [{ id: 'local-topic' }] } as WorldView
    const next = { ...previous, interactions: [] }
    const refreshed = mergeWorldRefresh(
      previous,
      worldRefreshResponse(next, worldRefreshUrl(previous)),
    )
    expect(refreshed.interactions).toEqual([])
    expect(refreshed.sectors).toBe(previous.sectors)
  })
  it('refreshes and clears ferry projection without replacing the world geometry', () => {
    const atDock = {
      ...view,
      ferry: { port: 'mainland', nextDepartureAt: 300_000, fareCrowns: 0 },
    } as const
    const dock = mergeWorldRefresh(view, worldRefreshResponse(atDock, worldRefreshUrl(view)))
    expect(dock.ferry).toEqual(atDock.ferry)
    expect(dock.sectors).toBe(view.sectors)
    const elsewhere = mergeWorldRefresh(dock, worldRefreshResponse(view, worldRefreshUrl(dock)))
    expect(elsewhere.ferry).toBeUndefined()
    expect(elsewhere.sectors).toBe(view.sectors)
  })
  it('observes the local scene promptly while preserving authored own-step deadlines', () => {
    const idle = {
      routeLength: 0,
      movementBlocked: false,
      nextStepAt: null,
      serverNow: 0,
      observePlayers: true,
      onlinePlayers: 1,
    }
    expect(worldSyncDelayMs(idle)).toBe(1000)
    expect(worldSyncDelayMs({ ...idle, onlinePlayers: 0 })).toBe(2000)
    expect(worldSyncDelayMs({ ...idle, observePlayers: false })).toBe(10000)
    expect(worldSyncDelayMs({ ...idle, routeLength: 2, nextStepAt: 4000 })).toBe(4000)
  })
  it('uses compact confirmed presence without reserializing unchanged terrain', () => {
    const next = { ...view, serverNow: 2000, players: [{ characterId: 'peer' }] } as WorldView
    const reply = worldRefreshResponse(next, worldRefreshUrl(view))
    expect(reply).toMatchObject({ kind: 'presence', version: 7, characterId: 'owner' })
    expect(reply).not.toHaveProperty('sectors')
    expect(reply).not.toHaveProperty('atlas')
    const merged = mergeWorldRefresh(view, reply)
    expect(merged.players).toBe(next.players)
    expect(merged.sectors).toBe(view.sectors)
    expect(merged.position).toBe(view.position)
    expect(merged.serverNow).toBe(2000)
  })
  it('falls back to a complete authority receipt when version or selected character changes', () => {
    const newer = { ...view, version: 8 }
    expect(worldRefreshResponse(newer, worldRefreshUrl(view))).toBe(newer)
    const other = { ...view, characterId: 'other' }
    expect(worldRefreshResponse(other, worldRefreshUrl(view))).toBe(other)
    expect(worldRefreshResponse(view, '/api/world')).toBe(view)
    expect(
      worldRefreshUrl({ ...view, route: [{ position: view.position, durationMs: 200 }] }),
    ).toBe('/api/world')
  })
  it('retains battle, training and environment changes without granting newer position authority', () => {
    const next = {
      ...view,
      movementBlocked: 'Return to your active battle.',
      battleSessionId: 'battle',
      environment: { ...view.environment, weather: 'rain' as const },
    }
    const reply = worldRefreshResponse(next, worldRefreshUrl(view))
    expect(mergeWorldRefresh(view, reply)).toMatchObject({
      battleSessionId: 'battle',
      movementBlocked: next.movementBlocked,
      environment: next.environment,
    })
    expect(() => mergeWorldRefresh({ ...view, version: 8 }, reply)).toThrow()
    expect(() => mergeWorldRefresh({ ...view, characterId: 'other' }, reply)).toThrow()
  })
})

describe('retained authorized scene references', () => {
  it('retains identical deserialized geometry without replacing incoming owned authority', () => {
    const incoming = { ...structuredClone(view), version: 8, serverNow: 2000 }
    const retained = retainWorldSceneReferences(view, incoming)
    expect(retained.sectors).toBe(view.sectors)
    expect(retained.atlas).toBe(view.atlas)
    expect(retained.position).toBe(incoming.position)
    expect(retained.version).toBe(8)
    expect(mergeWorldRefresh(view, incoming).sectors).toBe(view.sectors)
  })
  it.each(['cells', 'landmarks', 'exits', 'safe', 'charted'] as const)(
    'retains changed %s even when sector IDs are unchanged',
    (field) => {
      const incoming = structuredClone(view)
      incoming.sectors[0] = {
        ...incoming.sectors[0]!,
        [field]: field === 'charted' ? false : [{ changed: true }],
      } as WorldView['sectors'][number]
      const retained = retainWorldSceneReferences(view, incoming)
      expect(retained.sectors).toBe(incoming.sectors)
      expect(retained.atlas).toBe(view.atlas)
    },
  )
  it('retains atlas changes and never shares scene references across characters', () => {
    const changed = structuredClone(view)
    changed.atlas = [{ ...changed.atlas![0]!, name: 'changed' }]
    expect(retainWorldSceneReferences(view, changed).atlas).toBe(changed.atlas)
    const other = { ...structuredClone(view), characterId: 'other' }
    expect(retainWorldSceneReferences(view, other)).toBe(other)
  })
})

describe('optional atlas reuse on full scene hydration', () => {
  const token = 'a'.repeat(64)
  const known: WorldView & { atlasToken: string } = {
    ...view,
    atlasToken: token,
    objectives: [],
    interactions: [],
    anchors: [],
    archive: [],
  }
  const { atlas, ...scene } = known
  const reply = { ...scene, kind: 'scene' as const, serverNow: 1100 }

  it('requests a token on the cold read and preserves all fresh authority on a matching warm reply', async () => {
    const cold = vi.fn(async () => known)
    expect(await readWorldSceneRefresh(view, () => view, cold)).toEqual(known)
    expect(cold).toHaveBeenCalledExactlyOnceWith('owner:full')
    const changed: typeof reply = {
      ...reply,
      version: 8,
      sectors: [{ ...view.sectors[0]!, id: 'new-scene' }],
      interactions: [
        {
          id: 'new-interaction',
          objectiveId: 'new-objective',
          title: 'New topic',
          speaker: 'Guide',
          body: 'Fresh conversation.',
          actionLabel: null,
          progress: 'available',
        },
      ],
      anchors: [{ id: 'new-anchor', name: 'Lookout', sectorId: 'new-scene' }],
    }
    const warm = vi.fn(async () => changed)
    const merged = await readWorldSceneRefresh(known, () => known, warm)
    expect(warm).toHaveBeenCalledExactlyOnceWith(`owner:${token}`)
    const { kind, ...expected } = changed
    expect(merged).not.toHaveProperty('kind', kind)
    expect(merged).toEqual({ ...expected, atlas })
    expect(merged.atlas).toBe(atlas)
  })

  it.each([
    ['foreign receipt', { ...reply, characterId: 'other' }, known],
    ['different token', { ...reply, atlasToken: 'b'.repeat(64) }, known],
    ['stale version', reply, { ...known, version: 8 }],
    ['stale clock', reply, { ...known, serverNow: 1200 }],
    ['changed selection', reply, { ...known, characterId: 'other' }],
    ['changed atlas', reply, { ...known, atlasToken: 'b'.repeat(64) }],
    [
      'omitted private objectives',
      { ...reply, objectives: undefined } as unknown as typeof reply,
      known,
    ],
  ] as const)('retries a full read for %s', async (_name, warm, current) => {
    const full = {
      ...current,
      atlas: [{ id: 'newly-approved' }],
      atlasToken: undefined,
    } as WorldView
    const load = vi.fn<(knownAtlas?: string) => Promise<WorldView | typeof reply>>()
    load.mockResolvedValueOnce(warm).mockResolvedValueOnce(full)
    const merged = await readWorldSceneRefresh(known, () => current, load)
    expect(load.mock.calls).toEqual([[`owner:${token}`], []])
    expect(merged).toEqual(full)
    expect(merged.atlas).not.toBe(known.atlas)
  })

  it('does not accept an atlas omission when the unconditional retry also omits it', async () => {
    const load = vi.fn(async () => reply)
    await expect(readWorldSceneRefresh(view, () => view, load)).rejects.toThrow(
      'The world scene could not be refreshed safely.',
    )
    expect(load.mock.calls).toEqual([['owner:full'], []])
  })
})

it('retains semantic JSON property order and optional omissions without reusing changed cell safety', () => {
  const previous = {
    ...view,
    sectors: [
      {
        id: 'a',
        cells: [{ x: 1, y: 2, terrain: '.', walkable: true, safe: true }],
        landmarks: [],
        exits: [],
      },
    ],
  } as unknown as WorldView
  const incoming = {
    ...structuredClone(previous),
    sectors: [
      {
        exits: [],
        landmarks: [],
        cells: [{ safe: true, walkable: true, terrain: '.', y: 2, x: 1 }],
        id: 'a',
        stepMs: undefined,
      },
    ],
  } as unknown as WorldView
  const retained = retainWorldSceneReferences(previous, incoming)
  expect(retained.sectors).toBe(previous.sectors)
  expect(prepareLocalRoute(retained)).toBe(prepareLocalRoute(previous))
  incoming.sectors[0]!.cells[0]!.safe = false
  const changed = retainWorldSceneReferences(previous, incoming)
  expect(changed.sectors).toBe(incoming.sectors)
  expect(changed.sectors[0]!.cells[0]!.safe).toBe(false)
  expect(prepareLocalRoute(changed)).not.toBe(prepareLocalRoute(previous))
})
