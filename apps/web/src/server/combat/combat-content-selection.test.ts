import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import {
  createCombatContentResolver,
  RpcPublishedCombatContentSource,
} from './combat-content-resolver'

const token = 'a'.repeat(32)
const resonance = {
  ...resolveResonanceForPair('vanguard', 'lifebinder')!,
  id: 'resonance.custom',
  contentVersion: 41,
}
const nativeEssence = resolveEssenceForBuild('vanguard', null)!
const essence = {
  ...nativeEssence,
  essenceId: 'essence.custom',
  contentVersion: 42,
  skill: { ...nativeEssence.skill, id: 'essence.custom', contentVersion: 42 },
}
function row(kind: string, definition: object, key: string, version: number) {
  return {
    id: `row:${key}`,
    content_key: key,
    content_kind: kind,
    content_version: version,
    definition,
    published_by: 'owner',
    published_at: '2026-10-20T00:00:00Z',
  }
}
function fixture(
  options: {
    selection?: unknown
    selectedDefinition?: object
    selectionError?: boolean
    capturedToken?: string
  } = {},
) {
  const rpc = vi.fn(async (name: string, args: Readonly<Record<string, unknown>>) => {
    if (name === 'read_combat_content_catalogue_v1')
      return {
        data: {
          token: options.capturedToken ?? token,
          policy: { version: 7, modes: {} },
          publications: [],
        },
        error: null,
      }
    if (name === 'read_current_discipline_selection_v1')
      return {
        data: options.selection ?? {
          selectionVersion: 1,
          catalogueToken: token,
          essence:
            args.p_secondary_discipline_id === null
              ? {
                  essenceId: essence.essenceId,
                  contentVersion: 42,
                  sourceDisciplineId: 'vanguard',
                  skillId: essence.essenceId,
                  skillContentVersion: 42,
                }
              : null,
          resonance:
            args.p_secondary_discipline_id === null
              ? null
              : {
                  resonanceId: resonance.id,
                  contentVersion: 41,
                  disciplinePair: ['lifebinder', 'vanguard'],
                },
        },
        error: options.selectionError
          ? { code: '22023', message: 'COMBAT_CONTENT_SELECTION_DISABLED' }
          : null,
      }
    if (name === 'read_combat_content_version_v1')
      return {
        data:
          args.p_content_key === resonance.id
            ? [row('resonance', options.selectedDefinition ?? resonance, resonance.id, 41)]
            : args.p_content_key === essence.essenceId
              ? [row('essence', options.selectedDefinition ?? essence, essence.essenceId, 42)]
              : [],
        error: null,
      }
    return { data: [], error: null }
  })
  return { rpc, resolver: createCombatContentResolver(new RpcPublishedCombatContentSource(rpc)) }
}
it('actual RPC current resolver follows selected custom identities and exact versions for both pair orders and pure Essence', async () => {
  const { resolver, rpc } = fixture()
  for (const [a, b] of [
    ['vanguard', 'lifebinder'],
    ['lifebinder', 'vanguard'],
  ] as const)
    expect(await resolver.resolveCurrentResonanceDefinition!(a, b)).toEqual(resonance)
  expect(await resolver.resolveCurrentEssenceDefinition!('vanguard', null)).toEqual(essence)
  expect(rpc).toHaveBeenCalledWith('read_combat_content_version_v1', {
    p_content_key: resonance.id,
    p_content_kind: 'resonance',
    p_content_version: 41,
  })
  expect(rpc.mock.calls.some(([name]) => name === 'read_current_combat_content_v1')).toBe(false)
})
it('explicit absent selection does not resurrect a builtin', async () => {
  const { resolver } = fixture({
    selection: { selectionVersion: 1, catalogueToken: token, essence: null, resonance: null },
  })
  expect(await resolver.resolveCurrentEssenceDefinition!('vanguard', null)).toBeNull()
  expect(await resolver.resolveCurrentResonanceDefinition!('vanguard', 'lifebinder')).toBeNull()
})
it.each([
  { selectionError: true },
  {
    selection: {
      selectionVersion: 1,
      catalogueToken: token,
      essence: null,
      resonance: {
        resonanceId: resonance.id,
        contentVersion: 41,
        disciplinePair: ['arcanist', 'vanguard'],
      },
    },
  },
  { selectedDefinition: { ...resonance, enabled: false } },
  { selectedDefinition: { ...resonance, disciplinePair: ['arcanist', 'vanguard'] } },
])(
  'rejects unavailable, disabled or mismatched selected content without fallback: %j',
  async (options) => {
    const { resolver } = fixture(options)
    await expect(
      resolver.resolveCurrentResonanceDefinition!('vanguard', 'lifebinder'),
    ).rejects.toThrow()
  },
)
it('captured admission rejects selection from a different catalogue generation', async () => {
  const { resolver } = fixture({ capturedToken: 'b'.repeat(32) })
  const captured = await resolver.captureCurrentCatalogue!()
  await expect(
    captured.resolver.resolveCurrentResonanceDefinition!('vanguard', 'lifebinder'),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
})
it('exact historical custom pins remain readable after current selection is removed', async () => {
  const { resolver, rpc } = fixture({
    selection: { selectionVersion: 1, catalogueToken: token, essence: null, resonance: null },
  })
  expect(
    await resolver.resolvePinnedResonanceDefinition!('vanguard', 'lifebinder', resonance.id, 41),
  ).toEqual(resonance)
  expect(
    await resolver.resolvePinnedEssenceDefinition!('vanguard', null, essence.essenceId, 42),
  ).toEqual(essence)
  expect(rpc.mock.calls.some(([name]) => name === 'read_current_discipline_selection_v1')).toBe(
    false,
  )
})
it('one captured admission shares the same in-flight selection for Essence and Resonance, while fresh captures reread authority', async () => {
  const { resolver, rpc } = fixture()
  const first = await resolver.captureCurrentCatalogue!()
  const [selected, absent] = await Promise.all([
    first.resolver.resolveCurrentResonanceDefinition!('vanguard', 'lifebinder'),
    first.resolver.resolveCurrentEssenceDefinition!('vanguard', 'lifebinder'),
  ])
  expect(selected).toEqual(resonance)
  expect(absent).toBeNull()
  expect(
    rpc.mock.calls.filter(([name]) => name === 'read_current_discipline_selection_v1'),
  ).toHaveLength(1)
  const second = await resolver.captureCurrentCatalogue!()
  await second.resolver.resolveCurrentResonanceDefinition!('vanguard', 'lifebinder')
  expect(
    rpc.mock.calls.filter(([name]) => name === 'read_current_discipline_selection_v1'),
  ).toHaveLength(2)
})
