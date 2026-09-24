import type {
  CommitSupernaturalStoryTransitionInput,
  SupernaturalStoryStateRecord,
  SupernaturalStoryStateRepository,
} from '@aurevane/db/supernatural-state'
import { AurevaneError } from '@aurevane/game-core/errors'
import { describe, expect, it, vi } from 'vitest'

import {
  handleSupernaturalStoryGet,
  handleSupernaturalStoryPut,
  type SupernaturalStoryHandlerDependencies,
} from './supernatural-story-state-handler'

const userId = '00000000-0000-4000-8000-000000000931'
const characterId = '00000000-0000-4000-8000-000000000932'

function state(
  overrides: Partial<SupernaturalStoryStateRecord> = {},
): SupernaturalStoryStateRecord {
  return {
    characterId,
    schemaVersion: 1,
    stateVersion: 1,
    storyId: 'supernatural.main',
    storyVersion: 1,
    nodeId: 'awakening.threshold',
    path: 'unawakened',
    ascensionId: null,
    ascensionContentVersion: null,
    severenceId: null,
    severenceContentVersion: null,
    chosenAt: null,
    updatedAt: '2026-09-23T12:00:00.000Z',
    ...overrides,
  }
}

function repository(
  overrides: Partial<SupernaturalStoryStateRepository> = {},
): SupernaturalStoryStateRepository {
  return {
    find: vi.fn(async () => state()),
    initialize: vi.fn(async () => state()),
    commitTransition: vi.fn(async (input: CommitSupernaturalStoryTransitionInput) => ({
      state: state({
        stateVersion: input.expectedStateVersion + 1,
        nodeId: input.toNodeId,
        path: input.nextPath,
        ascensionId: input.ascensionId,
        ascensionContentVersion: input.ascensionContentVersion,
        severenceId: input.severenceId,
        severenceContentVersion: input.severenceContentVersion,
        chosenAt: '2026-09-23T12:05:00.000Z',
        updatedAt: '2026-09-23T12:05:00.000Z',
      }),
      replayed: false,
    })),
    ...overrides,
  }
}

function dependencies(
  overrides: Partial<SupernaturalStoryHandlerDependencies> = {},
): SupernaturalStoryHandlerDependencies {
  return {
    getActor: vi.fn(async () => ({ userId })),
    loadSelectedCharacter: vi.fn(async () => ({ id: characterId })),
    assertGameplayMutationAllowed: vi.fn(async () => {}),
    repository: repository(),
    ...overrides,
  }
}

function putRequest(body: unknown) {
  return new Request('http://aurevane.test/api/character/supernatural', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('supernatural story HTTP handler', () => {
  it('keeps GET read-only and returns null for an untouched character', async () => {
    const initialize = vi.fn()
    const response = await handleSupernaturalStoryGet(
      dependencies({
        repository: repository({
          find: vi.fn(async () => null),
          initialize,
        }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ state: null })
    expect(initialize).not.toHaveBeenCalled()
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('requires a selected owned character before reading supernatural state', async () => {
    const response = await handleSupernaturalStoryGet(
      dependencies({ loadSelectedCharacter: vi.fn(async () => null) }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_REQUEST' },
    })
  })

  it('rejects caller-authored transition objects before supernatural persistence', async () => {
    const find = vi.fn()
    const initialize = vi.fn()
    const commitTransition = vi.fn()
    const response = await handleSupernaturalStoryPut(
      putRequest({
        expectedStateVersion: 1,
        idempotencyKey: '00000000-0000-4000-8000-000000000933',
        transitionId: 'supernatural.main.choose-ascension',
        transitionContentVersion: 1,
        transition: {
          result: {
            path: 'ascended',
            ascension: { id: 'ascension.owner-injected', contentVersion: 99 },
          },
        },
      }),
      dependencies({
        repository: repository({ find, initialize, commitTransition }),
      }),
    )

    expect(response.status).toBe(400)
    expect(find).not.toHaveBeenCalled()
    expect(initialize).not.toHaveBeenCalled()
    expect(commitTransition).not.toHaveBeenCalled()
  })

  it('does not create supernatural eligibility through the public choice endpoint', async () => {
    const initialize = vi.fn()
    const commitTransition = vi.fn()
    const response = await handleSupernaturalStoryPut(
      putRequest({
        expectedStateVersion: 1,
        idempotencyKey: '00000000-0000-4000-8000-000000000936',
        transitionId: 'supernatural.main.choose-ascension',
        transitionContentVersion: 1,
      }),
      dependencies({
        repository: repository({
          find: vi.fn(async () => null),
          initialize,
          commitTransition,
        }),
      }),
    )

    expect(response.status).toBe(400)
    expect(initialize).not.toHaveBeenCalled()
    expect(commitTransition).not.toHaveBeenCalled()
  })

  it('checks gameplay mutation eligibility before committing a choice', async () => {
    const guard = vi.fn(async () => {
      throw new AurevaneError('INVALID_REQUEST', 'Blocked while in battle.')
    })
    const commitTransition = vi.fn()

    const response = await handleSupernaturalStoryPut(
      putRequest({
        expectedStateVersion: 1,
        idempotencyKey: '00000000-0000-4000-8000-000000000934',
        transitionId: 'supernatural.main.choose-ascension',
        transitionContentVersion: 1,
      }),
      dependencies({
        assertGameplayMutationAllowed: guard,
        repository: repository({ commitTransition }),
      }),
    )

    expect(response.status).toBe(400)
    expect(guard).toHaveBeenCalledWith(userId)
    expect(commitTransition).not.toHaveBeenCalled()
  })

  it('commits only the exact authored transition reference and returns the authoritative state', async () => {
    const find = vi.fn(async () => state())
    const initialize = vi.fn()
    const commitTransition = vi.fn(async (input: CommitSupernaturalStoryTransitionInput) => ({
      state: state({
        stateVersion: 2,
        nodeId: input.toNodeId,
        path: input.nextPath,
        ascensionId: input.ascensionId,
        ascensionContentVersion: input.ascensionContentVersion,
        chosenAt: '2026-09-23T12:05:00.000Z',
        updatedAt: '2026-09-23T12:05:00.000Z',
      }),
      replayed: false,
    }))

    const response = await handleSupernaturalStoryPut(
      putRequest({
        expectedStateVersion: 1,
        idempotencyKey: '00000000-0000-4000-8000-000000000935',
        transitionId: 'supernatural.main.choose-ascension',
        transitionContentVersion: 1,
      }),
      dependencies({
        repository: repository({ find, initialize, commitTransition }),
      }),
    )

    expect(response.status).toBe(200)
    expect(initialize).not.toHaveBeenCalled()
    expect(commitTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        transitionId: 'supernatural.main.choose-ascension',
        transitionContentVersion: 1,
        nextPath: 'ascended',
        ascensionId: 'ascension.proof',
        ascensionContentVersion: 1,
      }),
    )
    await expect(response.json()).resolves.toMatchObject({
      state: {
        stateVersion: 2,
        path: 'ascended',
        ascension: { id: 'ascension.proof', contentVersion: 1 },
      },
      replayed: false,
    })
  })
})
