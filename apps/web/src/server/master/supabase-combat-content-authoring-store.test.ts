import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { CombatContentConflictError } from '@aurevane/db/combat-content'

import { RpcCombatContentAuthoringStore } from './supabase-combat-content-authoring-store'

const ACTOR = '11111111-1111-4111-8111-111111111111'

function rpcResult(data: unknown, error: { code?: string; message?: string } | null = null) {
  return Promise.resolve({ data, error })
}

describe('RpcCombatContentAuthoringStore', () => {
  it('reads the explicit enabled operator role', async () => {
    const rpc = vi.fn(() =>
      rpcResult([{ user_id: ACTOR, role: 'owner', enabled: true }]),
    )
    const store = new RpcCombatContentAuthoringStore(rpc, ACTOR)

    await expect(store.getOperatorRole(ACTOR)).resolves.toBe('owner')
    expect(rpc).toHaveBeenCalledWith('read_master_panel_operator_v1', { p_user_id: ACTOR })
  })

  it('saves drafts through the actor-bound optimistic RPC', async () => {
    const rpc = vi.fn(() =>
      rpcResult([
        {
          content_key: 'vanguard.forceful-strike',
          content_kind: 'skill',
          definition: { id: 'vanguard.forceful-strike', contentVersion: 2 },
          base_version: 2,
          draft_version: 1,
          updated_by: ACTOR,
          updated_at: '2026-09-17T22:00:00.000Z',
        },
      ]),
    )
    const store = new RpcCombatContentAuthoringStore(rpc, ACTOR)

    const draft = await store.saveDraft({
      contentKey: 'vanguard.forceful-strike',
      contentKind: 'skill',
      definition: { id: 'vanguard.forceful-strike', contentVersion: 2 },
      baseVersion: 2,
      expectedDraftVersion: null,
      actorUserId: ACTOR,
    })

    expect(draft.draftVersion).toBe(1)
    expect(rpc).toHaveBeenCalledWith(
      'save_combat_content_draft_v1',
      expect.objectContaining({
        p_actor_user_id: ACTOR,
        p_content_key: 'vanguard.forceful-strike',
        p_base_version: 2,
        p_expected_draft_version: null,
      }),
    )
  })

  it('maps transactional stale-base errors to repository conflicts', async () => {
    const rpc = vi.fn(() =>
      rpcResult(null, { code: '40001', message: 'COMBAT_CONTENT_BASE_VERSION_CONFLICT' }),
    )
    const store = new RpcCombatContentAuthoringStore(rpc, ACTOR)

    await expect(
      store.publish({
        contentKey: 'vanguard.forceful-strike',
        contentKind: 'skill',
        definition: { id: 'vanguard.forceful-strike', contentVersion: 2 },
        expectedBaseVersion: 2,
        actorUserId: ACTOR,
      }),
    ).rejects.toBeInstanceOf(CombatContentConflictError)
  })

  it('clears the DB publication pointer with a null target when restoring static fallback', async () => {
    const rpc = vi.fn(() => rpcResult(null))
    const store = new RpcCombatContentAuthoringStore(rpc, ACTOR)

    await store.setCurrentPublication('vanguard.forceful-strike', null, ACTOR)

    expect(rpc).toHaveBeenCalledWith('set_combat_content_publication_v1', {
      p_actor_user_id: ACTOR,
      p_content_key: 'vanguard.forceful-strike',
      p_content_kind: 'skill',
      p_target_version: null,
    })
  })
})
