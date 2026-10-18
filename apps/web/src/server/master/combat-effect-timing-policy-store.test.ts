import { beforeEach, expect, it, vi } from 'vitest'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
vi.mock('server-only', () => ({}))
const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
beforeEach(() => {
  rpc.mockReset()
})
function publicationResult(result: unknown, disabledNative = false) {
  const record = (kind: string, key: string, version: number, definition: object) => ({
    id: `stored:${key}`,
    content_key: key,
    content_kind: kind,
    content_version: version,
    definition: { ...definition, enabled: false },
    published_by: 'owner',
    published_at: '2026-10-15T12:00:00Z',
  })
  const publications = disabledNative
    ? [
        ...latestEnabledMatureSkills().map((d) => record('skill', d.id, d.contentVersion, d)),
        ...currentEssenceDefinitions().map((d) =>
          record('essence', d.essenceId, d.contentVersion, d),
        ),
        ...currentResonanceDefinitions().map((d) => record('resonance', d.id, d.contentVersion, d)),
      ]
    : []
  rpc
    .mockResolvedValueOnce({
      data: { token: 'a'.repeat(32), policy: { version: 3, modes: {} }, publications },
      error: null,
    })
    .mockResolvedValueOnce(result)
}
it('loads the published policy after obsolete Copy and Summoned timing settings retire', async () => {
  const service = await import('./combat-effect-timing-policy-store')
  const stored = { version: 3, modes: { copy: 'instant', summoned: 'instant', summon: 'instant' } }
  rpc.mockResolvedValueOnce({ data: stored, error: null })
  expect(await service.readCombatEffectTimingPolicy()).toEqual({
    version: 3,
    modes: { summon: 'instant' },
  })
  expect(stored.modes).toEqual({ copy: 'instant', summoned: 'instant', summon: 'instant' })
  await expect(
    service.publishCombatEffectTimingPolicy({
      actorUserId: 'owner',
      policy: stored,
      reason: 'test',
    }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
})

it.each([
  { version: 3, modes: { copy: 'invented' } },
  { version: 3, modes: { invented: 'instant' } },
  JSON.parse('{"version":3,"modes":{"__proto__":"instant"}}'),
  { version: 3, modes: { summoned: 'instant' }, invented: true },
])('still rejects malformed or unknown stored timing settings: %j', async (stored) => {
  const service = await import('./combat-effect-timing-policy-store')
  rpc.mockResolvedValueOnce({ data: stored, error: null })
  await expect(service.readCombatEffectTimingPolicy()).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})

it('pins parsed current policy and maps stale publication while rejecting unknown keys', async () => {
  const service = await import('./combat-effect-timing-policy-store')
  rpc.mockResolvedValueOnce({ data: { version: 3, modes: { hexed: 'instant' } }, error: null })
  expect(await service.readCombatEffectTimingPolicy()).toEqual({
    version: 3,
    modes: { hexed: 'instant' },
  })
  const before = rpc.mock.calls.length
  await expect(
    service.publishCombatEffectTimingPolicy({
      actorUserId: 'owner',
      policy: { version: 3, modes: { invented: 'instant' } },
      reason: 'test',
    }),
  ).rejects.toThrow()
  expect(rpc.mock.calls).toHaveLength(before)
  publicationResult({ data: null, error: { message: 'TIMING_POLICY_VERSION_CONFLICT' } })
  await expect(
    service.publishCombatEffectTimingPolicy({
      actorUserId: 'owner',
      policy: { version: 3, modes: {} },
      reason: 'change',
    }),
  ).rejects.toThrow('Refresh')
})

it('publishes Controlled defaults without requiring a human reason', async () => {
  const service = await import('./combat-effect-timing-policy-store')
  publicationResult({ data: { version: 4, modes: { slow: 'controlled' } }, error: null }, true)
  expect(
    await service.publishCombatEffectTimingPolicy({
      actorUserId: 'owner',
      policy: { version: 3, modes: { slow: 'controlled' } },
    }),
  ).toEqual({ version: 4, modes: { slow: 'controlled' } })
  expect(rpc).toHaveBeenLastCalledWith(
    'publish_combat_effect_timing_policy_v2',
    expect.objectContaining({
      p_actor_user_id: 'owner',
      p_expected_version: 3,
      p_modes: { slow: 'controlled' },
    }),
  )
  expect(rpc.mock.calls.at(-1)![1]).not.toHaveProperty('p_reason')
})

it.each([
  [
    { version: 8, tagAuthority: 'global', modes: {} },
    { version: 8, modes: {} },
  ],
  [
    { version: 7, modes: {} },
    { version: 7, tagAuthority: 'global', modes: {} },
  ],
])('rejects a timing edit that changes trusted tag authority', async (stored, submitted) => {
  const service = await import('./combat-effect-timing-policy-store')
  rpc.mockResolvedValueOnce({
    data: { token: 'a'.repeat(32), policy: stored, publications: [] },
    error: null,
  })
  rpc.mockResolvedValueOnce({ data: { ...stored, version: stored.version + 1 }, error: null })
  await expect(
    service.publishCombatEffectTimingPolicy({
      actorUserId: 'owner',
      policy: submitted,
    }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  expect(rpc).toHaveBeenCalledTimes(1)
})
