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
    const rpc = vi.fn(() => rpcResult([{ user_id: ACTOR, role: 'owner', enabled: true }]))
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

  it('normalizes string-encoded bigint draft versions from PostgREST', async () => {
    const rpc = vi.fn(() =>
      rpcResult([
        {
          content_key: 'vanguard.forceful-strike',
          content_kind: 'skill',
          definition: { id: 'vanguard.forceful-strike', contentVersion: 2 },
          base_version: 2,
          draft_version: '2',
          updated_by: ACTOR,
          updated_at: '2026-09-17T22:00:00.000Z',
        },
      ]),
    )
    const store = new RpcCombatContentAuthoringStore(rpc, ACTOR)

    await expect(store.findDraft('vanguard.forceful-strike')).resolves.toMatchObject({
      draftVersion: 2,
    })
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

describe('typed Essence and Resonance publication transport', () => {
  it.each(['essence', 'resonance'] as const)(
    'retains %s through draft, publish, current and history reads',
    async (kind) => {
      const key = `typed.${kind}`
      const version = {
        id: '22222222-2222-4222-8222-222222222222',
        content_key: key,
        content_kind: kind,
        content_version: 8,
        definition: { id: key, contentVersion: 8 },
        published_by: ACTOR,
        published_at: '2026-10-15T18:00:00.000Z',
      }
      const draft = {
        content_key: key,
        content_kind: kind,
        definition: version.definition,
        base_version: 7,
        draft_version: 2,
        updated_by: ACTOR,
        updated_at: version.published_at,
      }
      const rpc = async (name: string, parameters: Readonly<Record<string, unknown>>) => {
        if (name === 'read_current_combat_content_v1')
          return rpcResult(parameters.p_content_kind === kind ? [version] : [])
        if (name === 'save_combat_content_draft_v1' || name === 'read_combat_content_draft_v1')
          return rpcResult([draft])
        return rpcResult([version])
      }
      const store = new RpcCombatContentAuthoringStore(rpc, ACTOR)
      await expect(
        store.saveDraft({
          actorUserId: ACTOR,
          contentKey: key,
          contentKind: kind,
          definition: version.definition,
          baseVersion: 7,
          expectedDraftVersion: 1,
        }),
      ).resolves.toMatchObject({ contentKind: kind, draftVersion: 2 })
      await expect(store.findDraft(key)).resolves.toMatchObject({ contentKind: kind })
      await expect(
        store.publish({
          actorUserId: ACTOR,
          contentKey: key,
          contentKind: kind,
          definition: version.definition,
          expectedBaseVersion: 7,
        }),
      ).resolves.toMatchObject({ contentKind: kind, contentVersion: 8 })
      await expect(store.findPublished(key, kind)).resolves.toMatchObject({
        contentKind: kind,
        contentVersion: 8,
      })
      await expect(store.listPublishedVersions(key)).resolves.toEqual([
        expect.objectContaining({ contentKind: kind, contentVersion: 8 }),
      ])
    },
  )
  it.each(['essence', 'resonance'] as const)(
    'restores the actual %s pointer with the typed RPC contract',
    async (kind) => {
      let pointer = 9
      const store = new RpcCombatContentAuthoringStore(async (name, parameters) => {
        if (name === 'set_combat_content_publication_v1' && parameters.p_content_kind === kind) {
          pointer = parameters.p_target_version as number
          return rpcResult(null)
        }
        return rpcResult(null, { code: '22023', message: 'COMBAT_CONTENT_VERSION_NOT_FOUND' })
      }, ACTOR)
      await store.setCurrentPublication(`typed.${kind}`, 8, ACTOR, kind)
      expect(pointer).toBe(8)
      await expect(
        store.setCurrentPublication(`typed.${kind}`, 7, 'other', kind),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      expect(pointer).toBe(8)
    },
  )
})
