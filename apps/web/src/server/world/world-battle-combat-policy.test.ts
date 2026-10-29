import { beforeEach, expect, it, vi } from 'vitest'
import type { CharacterRecord } from '@aurevane/db/character'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
} from '@aurevane/game-core/combat/essence'
import type { CharacterCommittedBuildSnapshotRecord } from '@/server/character/character-build-service'
import type { BattleAuthoritativeEncounterState } from '@/server/battle/battle-session-service'
import {
  isPvpQualityEncounter,
  surrenderPvpCombatant,
  timeoutPvpTurn,
} from '@aurevane/game-core/combat/pvp-quality'
vi.mock('server-only', () => ({}))
const { rpc, findCharacter, loadBuildSnapshot, readWorld, attackAuthority } = vi.hoisted(() => ({
  readWorld: vi.fn(),
  attackAuthority: vi.fn(),
  rpc: vi.fn(),
  findCharacter: vi.fn<(userId: string, id: string) => Promise<CharacterRecord | null>>(),
  loadBuildSnapshot:
    vi.fn<
      (
        userId: string,
        id: string,
        repository?: unknown,
      ) => Promise<CharacterCommittedBuildSnapshotRecord>
    >(),
}))
const startup = vi.hoisted(() => ({ enabled: false }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('./world-repository', () => ({
  readWorld,
  settleWorldAttackAuthority: attackAuthority,
  worldRpcError: (error: unknown) => {
    throw error
  },
}))
vi.mock('./world-service', () => ({ assertEncounterRange: () => {} }))
vi.mock('@/server/character/character-build-service', () => ({
  loadCharacterCommittedBuildSnapshot: loadBuildSnapshot,
}))
vi.mock('@/server/character/supabase-character-build-repository', () => ({
  createSupabaseCharacterBuildRepository: () => ({}),
}))
vi.mock('@/server/character/supabase-character-repository', () => ({
  createSupabaseCharacterRepository: () => ({
    findByOwnerId: findCharacter,
  }),
}))
vi.mock('@/server/combat/combat-content-resolver', async () => {
  const { startupEssence } = await import('../battle/battle-startup.test-utils')
  return {
    createServerCombatContentResolver: () =>
      startup.enabled
        ? {
            resolveCurrentSkillDefinition: async () => null,
            resolvePinnedSkillDefinition: async () => null,
            resolveCurrentEssenceDefinition: async () => startupEssence(),
            resolvePinnedEssenceDefinition: async () => startupEssence(),
          }
        : {},
  }
})
import { attackWorldPlayer } from './world-battle'
const CREATED_AT = '2026-10-07T00:00:00.000Z'
function characterRecord(id: string, userId: string, name: string): CharacterRecord {
  return {
    id,
    userId,
    slotIndex: 0,
    rulesVersion: 1,
    name,
    nameKey: name.toLowerCase(),
    presentationId: 'androgynous',
    pronounPresetId: 'they_them',
    portraitRef: 'portrait.starter.wayfarer-01',
    starterAppearanceRef: 'appearance.starter.roadworn',
    foundationDisciplineId: 'vanguard',
    might: 6,
    finesse: 6,
    vitality: 6,
    agility: 6,
    intellect: 6,
    resolve: 6,
    level: 1,
    xp: 0,
    progressionCycle: 1,
    createdAt: CREATED_AT,
    cycleStartedAt: CREATED_AT,
    lastActiveAt: CREATED_AT,
  }
}

function pureSnapshot(): CharacterCommittedBuildSnapshotRecord {
  const essence = resolveEssenceForBuild('vanguard', null)
  if (!essence) throw new Error('Expected representative Vanguard Essence.')
  return {
    schemaVersion: 2,
    buildVersion: 7,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: null,
    disciplineSkills: [],
    extensions: {
      resonance: null,
      essence: essenceSnapshotReference(essence),
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

beforeEach(() => {
  startup.enabled = false
  readWorld
    .mockReset()
    .mockResolvedValue({ view: { players: [{ characterId: 'target', attackable: true }] } })
  attackAuthority.mockReset().mockResolvedValue({
    state: { version: 2 },
    players: [{ characterId: 'target', attackable: true }],
  })
  rpc.mockReset()
  findCharacter
    .mockReset()
    .mockImplementation(async (userId, id) => characterRecord(id, userId, 'Fighter'))
  loadBuildSnapshot.mockReset().mockImplementation(async () => pureSnapshot())
})

it('captures both map participants and atomically persists real startup costs and receipts', async () => {
  startup.enabled = true
  rpc.mockImplementation(async (name: string) =>
    name === 'start_world_encounter_v2'
      ? { data: { battleSessionId: 'world-battle' }, error: null }
      : successfulAttackRpc(name),
  )
  await attackWorldPlayer('owner', 'actor', 'target', 2)
  const args = rpc.mock.calls.find(([name]) => name === 'start_world_encounter_v2')?.[1] as
    Record<string, unknown> | undefined
  expect(args).toBeDefined()
  const state = args!.p_snapshot as BattleAuthoritativeEncounterState
  expect(state.capturedAbilitySources).toHaveLength(2)
  for (const actor of state.tactical.battle.combatants) expect(actor.mp).toBe(actor.maxMp - 1)
  expect(
    (args!.p_initial_events as { event: string }[]).filter((e) => e.event === 'mp_spent'),
  ).toHaveLength(2)
  expect(args!.p_privacy_journal).toMatchObject({ schemaVersion: 1 })
  expect(args!.p_start_snapshot).not.toHaveProperty('abilityRuntime')
})

it('refreshes each participant before capturing its build while preparing both participants concurrently', async () => {
  function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((accept) => {
      resolve = accept
    })
    return { promise, resolve }
  }
  const characters = [deferred<CharacterRecord>(), deferred<CharacterRecord>()]
  const builds = [
    deferred<CharacterCommittedBuildSnapshotRecord>(),
    deferred<CharacterCommittedBuildSnapshotRecord>(),
  ]
  findCharacter.mockImplementation((_userId, id) => characters[id === 'actor' ? 0 : 1]!.promise)
  loadBuildSnapshot
    .mockImplementationOnce(() => builds[0]!.promise)
    .mockImplementationOnce(() => builds[1]!.promise)
  rpc.mockImplementation(async (name: string) => {
    if (name === 'read_world_encounter_pair_v1')
      return {
        data: { attacker: {}, target: { version: 3 }, targetUserId: 'opponent' },
        error: null,
      }
    if (name === 'read_battlefield_elevation_policy_v1')
      return {
        data: { version: 1, level1BasisPoints: 10000, level2BasisPoints: 0, level3BasisPoints: 0 },
        error: null,
      }
    if (name === 'read_combat_effect_timing_policy_v1')
      return { data: { version: 3, modes: { burn: 'instant' } }, error: null }
    if (name === 'start_world_encounter_v1')
      return { data: { battleSessionId: 'world-battle' }, error: null }
    throw new Error('Unexpected RPC ' + name)
  })
  const attack = attackWorldPlayer('owner', 'actor', 'target', 2)
  try {
    await vi.waitFor(() => expect(findCharacter).toHaveBeenCalledTimes(2))
    expect(loadBuildSnapshot).not.toHaveBeenCalled()
    characters[0]!.resolve(characterRecord('actor', 'owner', 'Attacker'))
    await vi.waitFor(() => expect(loadBuildSnapshot).toHaveBeenCalledTimes(1))
    expect(loadBuildSnapshot).toHaveBeenNthCalledWith(1, 'owner', 'actor', expect.anything())
    characters[1]!.resolve(characterRecord('target', 'opponent', 'Target'))
    await vi.waitFor(() => expect(loadBuildSnapshot).toHaveBeenCalledTimes(2))
    expect(loadBuildSnapshot).toHaveBeenNthCalledWith(2, 'opponent', 'target', expect.anything())
    builds[0]!.resolve(pureSnapshot())
    await builds[0]!.promise
    expect(rpc.mock.calls.some(([name]) => name === 'start_world_encounter_v1')).toBe(false)
  } finally {
    // Release all deferred reads even when an assertion fails.
    characters[0]!.resolve(characterRecord('actor', 'owner', 'Attacker'))
    characters[1]!.resolve(characterRecord('target', 'opponent', 'Target'))
    builds[0]!.resolve(pureSnapshot())
    builds[1]!.resolve({ ...pureSnapshot(), buildVersion: 8 })
    await attack
  }
  expect(rpc).toHaveBeenCalledWith(
    'start_world_encounter_v1',
    expect.objectContaining({
      p_user_id: 'owner',
      p_character_id: 'actor',
      p_target_id: 'target',
      p_expected_version: 2,
      p_target_version: 3,
      p_build_versions: { actor: 7, target: 8 },
    }),
  )
})

it.each([undefined, 'independent-highest'] as const)(
  'persists current combat policies and configured heights (%s) for a new world encounter',
  async (model) => {
    attackAuthority.mockResolvedValueOnce({
      state: { version: 1 },
      players: [{ characterId: 'target', attackable: true }],
    })
    const policy = {
      ...(model ? { model } : {}),
      version: 9,
      level1BasisPoints: 0,
      level2BasisPoints: 0,
      level3BasisPoints: 10000,
    }
    let saved: BattleAuthoritativeEncounterState | undefined
    rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === 'read_world_encounter_pair_v1')
        return {
          data: { attacker: {}, target: { version: 1 }, targetUserId: 'opponent' },
          error: null,
        }
      if (name === 'read_battlefield_elevation_policy_v1') return { data: policy, error: null }
      if (name === 'read_combat_effect_timing_policy_v1')
        return { data: { version: 3, modes: { burn: 'instant' } }, error: null }
      if (name === 'start_world_encounter_v1') {
        saved = args.p_snapshot as BattleAuthoritativeEncounterState
        return { data: { battleSessionId: 'world-battle' }, error: null }
      }
      throw new Error('Unexpected RPC ' + name)
    })
    expect((await attackWorldPlayer('owner', 'actor', 'target', 1)).battleSessionId).toBe(
      'world-battle',
    )
    expect(saved!.battlefieldElevationPolicy).toEqual(policy)
    expect(saved!.effectTimingPolicy).toEqual({ version: 3, modes: { burn: 'instant' } })
    expect(saved!.percentageDotPolicyVersion).toBe(1)
    expect(saved!.dotTriggerPolicyVersion).toBe(2)
    expect(saved!.groundEffectPolicyVersion).toBe(1)
    expect(saved!.effectStackingPolicyVersion).toBe(1)
    expect(isPvpQualityEncounter(saved!)).toBe(true)
    for (const actor of saved!.tactical.battle.combatants) {
      expect(actor.temporaryResources.filter((r) => r.key === 'pvp.missed-turn-streak')).toEqual([
        { key: 'pvp.missed-turn-streak', current: 0, maximum: 2 },
      ])
    }
    const expired = timeoutPvpTurn(saved!)
    expect(expired.state.tactical.battle.turnNumber).toBe(2)
    expect(expired.state.tactical.battle.lifecycle).toBe('active')
    expect(expired.state.tactical.battle.combatants.map((actor) => actor.hp)).toEqual(
      saved!.tactical.battle.combatants.map((actor) => actor.hp),
    )
    expect(
      expired.events.some((event) => (event as { event?: string }).event === 'battle_completed'),
    ).toBe(false)
    const nextExpiry = timeoutPvpTurn(expired.state)
    expect(nextExpiry.state.tactical.battle.turnNumber).toBe(3)
    expect(nextExpiry.state.tactical.battle.lifecycle).toBe('active')
    const surrendered = surrenderPvpCombatant(nextExpiry.state, 'character:actor')
    expect(surrendered.state.tactical.battle.lifecycle).toBe('completed')
    expect(() => timeoutPvpTurn(surrendered.state)).toThrow('requires an active turn')
    expect(saved!.tactical.tiles.some((tile) => tile.elevation > 0)).toBe(true)
    expect(
      saved!.tactical.tiles
        .filter((tile) => tile.elevation > 0)
        .every((tile) => tile.elevation === 3),
    ).toBe(true)
  },
)

function successfulAttackRpc(name: string) {
  if (name === 'read_world_encounter_pair_v1')
    return { data: { attacker: {}, target: { version: 3 }, targetUserId: 'opponent' }, error: null }
  if (name === 'read_battlefield_elevation_policy_v1')
    return {
      data: { version: 1, level1BasisPoints: 10000, level2BasisPoints: 0, level3BasisPoints: 0 },
      error: null,
    }
  if (name === 'read_combat_effect_timing_policy_v1')
    return { data: { version: 3, modes: { burn: 'instant' } }, error: null }
  if (name === 'start_world_encounter_v1')
    return { data: { battleSessionId: 'world-battle' }, error: null }
  throw new Error('Unexpected RPC ' + name)
}
it('returns only a committed battle redirect without precheck or postcommit World presentation', async () => {
  readWorld.mockRejectedValue(new Error('Presentation must not delay a legal attack'))
  rpc.mockImplementation(async (name: string) => successfulAttackRpc(name))
  expect(await attackWorldPlayer('owner', 'actor', 'target', 2)).toEqual({
    characterId: 'actor',
    battleSessionId: 'world-battle',
  })
  expect(attackAuthority).toHaveBeenCalledExactlyOnceWith('owner', 'actor', 2)
  expect(readWorld).not.toHaveBeenCalled()
})
it('begins both independent policy reads while participant reads are unresolved and waits before atomic creation', async () => {
  let release!: () => void
  const boundary = new Promise<void>((resolve) => {
    release = resolve
  })
  findCharacter.mockImplementation(async (userId, id) => {
    await boundary
    return characterRecord(id, userId, 'Fighter')
  })
  rpc.mockImplementation(async (name: string) => successfulAttackRpc(name))
  const attack = attackWorldPlayer('owner', 'actor', 'target', 2)
  try {
    await vi.waitFor(() => expect(findCharacter).toHaveBeenCalledTimes(2))
    expect(rpc.mock.calls.map(([name]) => name)).toContain('read_battlefield_elevation_policy_v1')
    expect(rpc.mock.calls.map(([name]) => name)).toContain('read_combat_effect_timing_policy_v1')
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain('start_world_encounter_v1')
  } finally {
    release()
    await attack
  }
})
it.each(['', null, 42])(
  'rejects an invalid committed battle identifier %s',
  async (battleSessionId) => {
    rpc.mockImplementation(async (name: string) =>
      name === 'start_world_encounter_v1'
        ? { data: { battleSessionId }, error: null }
        : successfulAttackRpc(name),
    )
    await expect(attackWorldPlayer('owner', 'actor', 'target', 2)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  },
)
it('does not prepare private target/build authority when the visible target is unavailable', async () => {
  attackAuthority.mockResolvedValue({
    state: { version: 2 },
    players: [{ characterId: 'target', attackable: false }],
  })
  await expect(attackWorldPlayer('owner', 'actor', 'target', 2)).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
  })
  expect(rpc).not.toHaveBeenCalled()
  expect(loadBuildSnapshot).not.toHaveBeenCalled()
})

it('forwards the requested version to settlement and stops on its stale-authority rejection', async () => {
  attackAuthority.mockRejectedValueOnce(
    Object.assign(new Error('Stale position'), { code: 'STALE_VERSION' }),
  )
  rpc.mockImplementation(async (name: string) => successfulAttackRpc(name))
  await expect(attackWorldPlayer('owner', 'actor', 'target', 2)).rejects.toMatchObject({
    code: 'STALE_VERSION',
  })
  expect(attackAuthority).toHaveBeenCalledExactlyOnceWith('owner', 'actor', 2)
  expect(rpc).not.toHaveBeenCalled()
  expect(findCharacter).not.toHaveBeenCalled()
  expect(loadBuildSnapshot).not.toHaveBeenCalled()
})

it('waits for the exact timing policy before creating the atomic encounter', async () => {
  let release!: (result: ReturnType<typeof successfulAttackRpc>) => void
  const timing = new Promise<ReturnType<typeof successfulAttackRpc>>((resolve) => {
    release = resolve
  })
  rpc.mockImplementation(async (name: string) =>
    name === 'read_combat_effect_timing_policy_v1' ? timing : successfulAttackRpc(name),
  )
  const attack = attackWorldPlayer('owner', 'actor', 'target', 2)
  try {
    await vi.waitFor(() => expect(loadBuildSnapshot).toHaveBeenCalledTimes(2))
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain('start_world_encounter_v1')
  } finally {
    release(successfulAttackRpc('read_combat_effect_timing_policy_v1'))
    await attack
  }
  expect(rpc).toHaveBeenCalledWith(
    'start_world_encounter_v1',
    expect.objectContaining({
      p_expected_version: 2,
      p_target_version: 3,
      p_build_versions: { actor: 7, target: 7 },
      p_snapshot: expect.objectContaining({
        effectTimingPolicy: { version: 3, modes: { burn: 'instant' } },
      }),
    }),
  )
})
it('does not create an encounter when required policy loading fails', async () => {
  rpc.mockImplementation(async (name: string) =>
    name === 'read_combat_effect_timing_policy_v1'
      ? { data: null, error: { message: 'unavailable' } }
      : successfulAttackRpc(name),
  )
  await expect(attackWorldPlayer('owner', 'actor', 'target', 2)).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
  expect(rpc.mock.calls.map(([name]) => name)).not.toContain('start_world_encounter_v1')
  expect(readWorld).not.toHaveBeenCalled()
})

it('starts against only the resulting persisted version after approved owned travel settles', async () => {
  attackAuthority.mockResolvedValueOnce({
    state: { version: 3 },
    serverNow: 5200,
    players: [{ characterId: 'target', attackable: true }],
  })
  rpc.mockImplementation(async (name: string) => successfulAttackRpc(name))
  expect(await attackWorldPlayer('owner', 'actor', 'target', 2)).toEqual({
    characterId: 'actor',
    battleSessionId: 'world-battle',
  })
  expect(attackAuthority).toHaveBeenCalledExactlyOnceWith('owner', 'actor', 2)
  expect(rpc).toHaveBeenCalledWith(
    'start_world_encounter_v1',
    expect.objectContaining({ p_expected_version: 3, p_target_version: 3 }),
  )
})
it('rejects mixed source CharacterRecord and new committed build before actual World admission', async () => {
  rpc.mockImplementation(async (name: string) => successfulAttackRpc(name))
  loadBuildSnapshot.mockImplementation(async () => ({
    ...pureSnapshot(),
    sourceHash: '0'.repeat(64),
  }))
  await expect(attackWorldPlayer('owner', 'actor', 'target', 2)).rejects.toMatchObject({
    code: 'STALE_VERSION',
  })
  expect(rpc.mock.calls.some(([name]) => String(name).startsWith('start_world_encounter'))).toBe(
    false,
  )
})
it('fresh World producer persists both coherent source proofs', async () => {
  const { battleSourceHash } = await import('@/server/battle/battle-source-authority')
  rpc.mockImplementation(async (name: string) => successfulAttackRpc(name))
  loadBuildSnapshot.mockImplementation(async (userId: string, id: string) => ({
    ...pureSnapshot(),
    sourceHash: battleSourceHash(characterRecord(id, userId, 'Fighter')),
  }))
  await attackWorldPlayer('owner', 'actor', 'target', 2)
  const args = rpc.mock.calls.find(([name]) =>
    String(name).startsWith('start_world_encounter'),
  )?.[1] as Record<string, unknown>
  const snapshot = args.p_snapshot as BattleAuthoritativeEncounterState
  expect(snapshot.buildAuthority?.combatants).toHaveLength(2)
  expect(snapshot.buildAuthority?.combatants.every((row) => row.sourceHash?.length === 64)).toBe(
    true,
  )
})
