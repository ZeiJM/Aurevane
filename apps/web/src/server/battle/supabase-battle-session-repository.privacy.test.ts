import type { CommitBattleIntentInput } from '@aurevane/db/battle-session'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}))

import { createSupabaseBattleSessionRepository } from './supabase-battle-session-repository'

const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '11111111-1111-4111-8111-111111111111'

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
