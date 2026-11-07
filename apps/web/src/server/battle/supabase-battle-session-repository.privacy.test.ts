import type { CommitBattleIntentInput, CreateBattleSessionInput } from '@aurevane/db/battle-session'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}))

import { createSupabaseBattleSessionRepository } from './supabase-battle-session-repository'

const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMMAND_ID = '44444444-4444-4444-8444-444444444444'
const NPC_ID = '55555555-5555-4555-8555-555555555555'
const TICKET_ID = '66666666-6666-4666-8666-666666666666'
const CHARACTER_ID = '77777777-7777-4777-8777-777777777777'

function worldAdmission() {
  return {
    characterId: CHARACTER_ID,
    expectedVersion: 12,
    worldFingerprint: 'sha256:world-command',
    throwWorldError: (error: { message?: string }): never => {
      throw new Error(error.message)
    },
  }
}

const created = {
  battle_session_id: SESSION_ID,
  battle_version: 1,
  snapshot: { state: 'final' },
  created_at: '2026-10-10T21:00:00Z',
  replayed: false,
}

function commitInput(): CommitBattleIntentInput {
  return {
    actorKey: USER_ID,
    userId: USER_ID,
    battleSessionId: SESSION_ID,
    expectedBattleVersion: 4,
    idempotencyKey: '44444444-4444-4444-8444-444444444444',
    requestFingerprint: 'sha256:test',
    nextSnapshot: { state: 'next' },
    events: [{ event: 'combat_action_used', actorId: 'character:actor' }],
    privacyJournal: {
      schemaVersion: 1,
      commandVisibility: { kind: 'team-only', teamId: 'team:a' },
      eventVisibilityOverrides: [{ eventIndex: 0, visibility: { kind: 'public' } }],
    },
  }
}

describe('CSR-3 battle privacy persistence', () => {
  it('passes caller visibility metadata unchanged to commit_battle_intent_v3', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          battle_session_id: SESSION_ID,
          battle_version: 5,
          snapshot: { state: 'next' },
          committed_at: '2026-09-17T12:00:00.000Z',
          replayed: false,
        },
      ],
      error: null,
    })

    const repository = createSupabaseBattleSessionRepository()
    const input = commitInput()
    await repository.commitBattleIntent(input)

    expect(rpc).toHaveBeenCalledWith(
      'commit_battle_intent_v3',
      expect.objectContaining({
        p_privacy_journal: input.privacyJournal,
      }),
    )
  })
})

it.each([false, true])(
  'preserves absent startup legacy calls and sends complete startup data atomically when present (%s)',
  async (withStartup) => {
    rpc.mockClear()
    rpc.mockResolvedValueOnce({
      data: [
        {
          battle_session_id: SESSION_ID,
          battle_version: 1,
          snapshot: { state: 'final' },
          created_at: '2026-10-10T21:00:00Z',
          replayed: false,
        },
      ],
      error: null,
    })
    const input: CreateBattleSessionInput = {
      actorKey: USER_ID,
      userId: USER_ID,
      idempotencyKey: '44444444-4444-4444-8444-444444444444',
      requestFingerprint: 'sha256:creation',
      battleId: 'battle:startup',
      rulesVersion: 1,
      contentVersion: 1,
      initialSnapshot: { state: 'final' },
      participants: [
        {
          combatantId: 'actor',
          participantRole: 'player',
          characterId: '11111111-1111-4111-8111-111111111111',
        },
      ],
      ...(withStartup
        ? {
            startup: {
              startSnapshot: { state: 'start' },
              events: [{ event: 'mp_spent', amount: 1 }],
              privacyJournal: {
                schemaVersion: 1 as const,
                commandVisibility: { kind: 'public' as const },
                eventVisibilityOverrides: [],
              },
            },
          }
        : {}),
    }
    await createSupabaseBattleSessionRepository().createBattleSession(input)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0]![0]).toBe(
      withStartup ? 'create_battle_session_v2' : 'create_battle_session_v1',
    )
    const args = rpc.mock.calls[0]![1]
    expect(args.p_initial_snapshot).toEqual(input.initialSnapshot)
    if (withStartup)
      expect(args).toMatchObject({
        p_start_snapshot: input.startup!.startSnapshot,
        p_initial_events: input.startup!.events,
        p_privacy_journal: input.startup!.privacyJournal,
      })
    else expect(args).not.toHaveProperty('p_initial_events')
  },
)

it.each([
  [
    { npcId: NPC_ID, ticketId: TICKET_ID },
    'start_world_avenger_battle_v1',
    {
      p_npc_id: NPC_ID,
      p_ticket_id: TICKET_ID,
    },
  ],
  [{ npcId: NPC_ID }, 'start_world_npc_battle_v1', { p_npc_id: NPC_ID }],
  [{ runId: TICKET_ID }, 'start_world_personal_realm_battle_v1', { p_run_id: TICKET_ID }],
] as const)('uses the admission RPC and scope for %o', async (scope, procedure, identity) => {
  rpc.mockReset().mockResolvedValueOnce({ data: [created], error: null })
  const input: CreateBattleSessionInput = {
    actorKey: USER_ID,
    userId: USER_ID,
    idempotencyKey: COMMAND_ID,
    requestFingerprint: 'sha256:creation',
    battleId: 'battle:startup',
    rulesVersion: 1,
    contentVersion: 1,
    initialSnapshot: { state: 'final' },
    participants: [
      { combatantId: 'actor', participantRole: 'player', characterId: CHARACTER_ID },
      { combatantId: 'rival', participantRole: 'opponent', characterId: null },
    ],
    startup: {
      startSnapshot: { state: 'start' },
      events: [{ event: 'mp_spent', amount: 1 }],
      privacyJournal: {
        schemaVersion: 1,
        commandVisibility: { kind: 'public' },
        eventVisibilityOverrides: [],
      },
    },
  }

  await createSupabaseBattleSessionRepository({
    ...worldAdmission(),
    ...scope,
  }).createBattleSession(input)

  expect(rpc).toHaveBeenCalledExactlyOnceWith(procedure, {
    p_user_id: USER_ID,
    p_character_id: CHARACTER_ID,
    p_expected_version: 12,
    p_command_id: COMMAND_ID,
    p_world_fingerprint: 'sha256:world-command',
    p_request_fingerprint: input.requestFingerprint,
    p_battle_id: input.battleId,
    p_rules_version: input.rulesVersion,
    p_content_version: input.contentVersion,
    p_initial_snapshot: input.initialSnapshot,
    p_participants: [
      { combatant_id: 'actor', participant_role: 'player', character_id: CHARACTER_ID },
      { combatant_id: 'rival', participant_role: 'opponent', character_id: null },
    ],
    p_start_snapshot: input.startup?.startSnapshot,
    p_initial_events: input.startup?.events,
    p_privacy_journal: input.startup?.privacyJournal,
    ...identity,
  })
})

it.each([
  [
    { npcId: NPC_ID, ticketId: TICKET_ID },
    'read_world_avenger_battle_replay_v1',
    {
      p_ticket_id: TICKET_ID,
    },
  ],
  [{ npcId: NPC_ID }, 'read_world_npc_battle_replay_v1', { p_npc_id: NPC_ID }],
] as const)(
  'rejects a generic creation replay without a matching World receipt for %o',
  async (scope, procedure, identity) => {
    rpc
      .mockReset()
      .mockResolvedValueOnce({ data: [created], error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    const result = createSupabaseBattleSessionRepository({
      ...worldAdmission(),
      ...scope,
    }).findBattleCreationReplay!({
      userId: USER_ID,
      actorKey: USER_ID,
      idempotencyKey: COMMAND_ID,
      requestFingerprint: 'sha256:creation',
    })

    await expect(result).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
    expect(rpc).toHaveBeenLastCalledWith(procedure, {
      p_user_id: USER_ID,
      p_character_id: CHARACTER_ID,
      p_command_id: COMMAND_ID,
      p_world_fingerprint: 'sha256:world-command',
      ...identity,
    })
  },
)
