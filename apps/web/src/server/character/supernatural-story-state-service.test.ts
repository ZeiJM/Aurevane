import type {
  CommitSupernaturalStoryTransitionInput,
  SupernaturalStoryStateRecord,
  SupernaturalStoryStateRepository,
} from '@aurevane/db/supernatural-state'
import type { SupernaturalStoryTransitionDefinition } from '@aurevane/game-core/character/supernatural-state'
import { describe, expect, it, vi } from 'vitest'

import {
  commitAuthoredSupernaturalStoryTransition,
  commitSupernaturalStoryTransition,
  loadOrInitializeAuthoredSupernaturalStoryState,
  loadOrInitializeSupernaturalStoryState,
} from './supernatural-story-state-service'

vi.mock('server-only', () => ({}))

const userId = '00000000-0000-4000-8000-000000000911'
const characterId = '00000000-0000-4000-8000-000000000912'
const story = {
  id: 'supernatural.main',
  contentVersion: 1,
  initialNodeId: 'awakening.threshold',
} as const

function state(
  overrides: Partial<SupernaturalStoryStateRecord> = {},
): SupernaturalStoryStateRecord {
  return {
    characterId,
    schemaVersion: 1,
    stateVersion: 1,
    storyId: story.id,
    storyVersion: story.contentVersion,
    nodeId: story.initialNodeId,
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

function ascendTransition(): SupernaturalStoryTransitionDefinition {
  return {
    id: 'supernatural.main.choose-ascension',
    contentVersion: 1,
    storyId: story.id,
    storyVersion: story.contentVersion,
    fromNodeId: story.initialNodeId,
    toNodeId: 'awakening.bound',
    result: {
      path: 'ascended',
      ascension: { id: 'ascension.proof', contentVersion: 1 },
    },
  }
}

function repository(
  overrides: Partial<SupernaturalStoryStateRepository> = {},
): SupernaturalStoryStateRepository {
  return {
    find: vi.fn(async () => state()),
    initialize: vi.fn(async (input) =>
      state({
        storyId: input.storyId,
        storyVersion: input.storyVersion,
        nodeId: input.initialNodeId,
      }),
    ),
    commitTransition: vi.fn(async (input) => ({
      state: state({
        stateVersion: input.expectedStateVersion + 1,
        nodeId: input.toNodeId,
        path: input.nextPath,
        ascensionId: input.ascensionId,
        ascensionContentVersion: input.ascensionContentVersion,
        severenceId: input.severenceId,
        severenceContentVersion: input.severenceContentVersion,
        chosenAt: input.nextPath === 'unawakened' ? null : '2026-09-23T12:05:00.000Z',
        updatedAt: '2026-09-23T12:05:00.000Z',
      }),
      replayed: false,
    })),
    ...overrides,
  }
}

describe('supernatural story-state authority service', () => {
  it('initializes an absent character story as Unawakened from server-owned story metadata', async () => {
    const initialize = vi.fn(async () => state())
    const repo = repository({
      find: vi.fn(async () => null),
      initialize,
    })

    const result = await loadOrInitializeSupernaturalStoryState(userId, characterId, story, repo)

    expect(initialize).toHaveBeenCalledWith({
      userId,
      characterId,
      storyId: 'supernatural.main',
      storyVersion: 1,
      initialNodeId: 'awakening.threshold',
    })
    expect(result.path).toBe('unawakened')
    expect(result.stateVersion).toBe(1)
  })

  it('does not silently move a character onto a different published story version', async () => {
    await expect(
      loadOrInitializeSupernaturalStoryState(
        userId,
        characterId,
        { ...story, contentVersion: 2 },
        repository(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('initializes the canonical authored story without accepting caller-owned story metadata', async () => {
    const initialize = vi.fn(async () => state())
    const repo = repository({
      find: vi.fn(async () => null),
      initialize,
    })

    const result = await loadOrInitializeAuthoredSupernaturalStoryState(
      userId,
      characterId,
      repo,
    )

    expect(initialize).toHaveBeenCalledWith({
      userId,
      characterId,
      storyId: 'supernatural.main',
      storyVersion: 1,
      initialNodeId: 'awakening.threshold',
    })
    expect(result.path).toBe('unawakened')
  })

  it('resolves an authored choice by exact server-owned id and version before persistence', async () => {
    let captured: CommitSupernaturalStoryTransitionInput | undefined
    const repo = repository({
      commitTransition: vi.fn(async (input) => {
        captured = input
        return {
          state: state({
            stateVersion: 2,
            nodeId: 'awakening.bound',
            path: 'ascended',
            ascensionId: 'ascension.proof',
            ascensionContentVersion: 1,
            chosenAt: '2026-09-23T12:05:00.000Z',
            updatedAt: '2026-09-23T12:05:00.000Z',
          }),
          replayed: false,
        }
      }),
    })

    const result = await commitAuthoredSupernaturalStoryTransition(
      userId,
      characterId,
      {
        expectedStateVersion: 1,
        idempotencyKey: '00000000-0000-4000-8000-000000000917',
        transitionId: 'supernatural.main.choose-ascension',
        transitionContentVersion: 1,
      },
      repo,
    )

    expect(captured).toMatchObject({
      transitionId: 'supernatural.main.choose-ascension',
      transitionContentVersion: 1,
      storyId: 'supernatural.main',
      storyVersion: 1,
      fromNodeId: 'awakening.threshold',
      toNodeId: 'awakening.bound',
      nextPath: 'ascended',
      ascensionId: 'ascension.proof',
      ascensionContentVersion: 1,
    })
    expect(result.state.path).toBe('ascended')
  })

  it('initializes the canonical story once before committing a valid first authored choice', async () => {
    const find = vi
      .fn<SupernaturalStoryStateRepository['find']>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(state())
    const initialize = vi.fn(async () => state())
    const commitTransition = vi.fn(async (input: CommitSupernaturalStoryTransitionInput) => ({
      state: state({
        stateVersion: 2,
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
    }))
    const repo = repository({ find, initialize, commitTransition })

    const result = await commitAuthoredSupernaturalStoryTransition(
      userId,
      characterId,
      {
        expectedStateVersion: 1,
        idempotencyKey: '00000000-0000-4000-8000-000000000920',
        transitionId: 'supernatural.main.choose-ascension',
        transitionContentVersion: 1,
      },
      repo,
    )

    expect(initialize).toHaveBeenCalledTimes(1)
    expect(commitTransition).toHaveBeenCalledTimes(1)
    expect(result.state.path).toBe('ascended')
  })

  it('rejects invented or stale authored choice references before reading or writing persistence', async () => {
    for (const input of [
      {
        transitionId: 'supernatural.main.choose-ascension',
        transitionContentVersion: 2,
      },
      {
        transitionId: 'supernatural.main.choose-anomaly',
        transitionContentVersion: 1,
      },
    ]) {
      const find = vi.fn()
      const commitTransition = vi.fn()

      await expect(
        commitAuthoredSupernaturalStoryTransition(
          userId,
          characterId,
          {
            expectedStateVersion: 1,
            idempotencyKey: '00000000-0000-4000-8000-000000000918',
            ...input,
          },
          repository({ find, commitTransition }),
        ),
      ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })

      expect(find).not.toHaveBeenCalled()
      expect(commitTransition).not.toHaveBeenCalled()
    }
  })

  it('commits an authored Ascension transition with a deterministic fingerprint', async () => {
    let captured: CommitSupernaturalStoryTransitionInput | undefined
    const repo = repository({
      commitTransition: vi.fn(async (input) => {
        captured = input
        return {
          state: state({
            stateVersion: 2,
            nodeId: 'awakening.bound',
            path: 'ascended',
            ascensionId: 'ascension.proof',
            ascensionContentVersion: 1,
            chosenAt: '2026-09-23T12:05:00.000Z',
            updatedAt: '2026-09-23T12:05:00.000Z',
          }),
          replayed: true,
        }
      }),
    })

    const result = await commitSupernaturalStoryTransition(
      userId,
      characterId,
      {
        expectedStateVersion: 1,
        idempotencyKey: '00000000-0000-4000-8000-000000000913',
        transition: ascendTransition(),
      },
      repo,
    )

    expect(captured).toMatchObject({
      userId,
      characterId,
      expectedStateVersion: 1,
      transitionId: 'supernatural.main.choose-ascension',
      transitionContentVersion: 1,
      fromNodeId: 'awakening.threshold',
      toNodeId: 'awakening.bound',
      nextPath: 'ascended',
      ascensionId: 'ascension.proof',
      ascensionContentVersion: 1,
      severenceId: null,
      severenceContentVersion: null,
    })
    expect(captured?.requestFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(result.replayed).toBe(true)
    expect(result.state.path).toBe('ascended')
  })

  it('rejects stale expected versions before attempting persistence', async () => {
    const commit = vi.fn()
    await expect(
      commitSupernaturalStoryTransition(
        userId,
        characterId,
        {
          expectedStateVersion: 2,
          idempotencyKey: '00000000-0000-4000-8000-000000000914',
          transition: ascendTransition(),
        },
        repository({ commitTransition: commit }),
      ),
    ).rejects.toMatchObject({ code: 'STALE_VERSION' })
    expect(commit).not.toHaveBeenCalled()
  })

  it('rejects ordinary cross-path switching before the repository can write it', async () => {
    const commit = vi.fn()
    const repo = repository({
      find: vi.fn(async () =>
        state({
          stateVersion: 2,
          nodeId: 'awakening.bound',
          path: 'ascended',
          ascensionId: 'ascension.proof',
          ascensionContentVersion: 1,
          chosenAt: '2026-09-23T12:05:00.000Z',
        }),
      ),
      commitTransition: commit,
    })

    await expect(
      commitSupernaturalStoryTransition(
        userId,
        characterId,
        {
          expectedStateVersion: 2,
          idempotencyKey: '00000000-0000-4000-8000-000000000915',
          transition: {
            id: 'supernatural.main.illegal-severence',
            contentVersion: 1,
            storyId: story.id,
            storyVersion: 1,
            fromNodeId: 'awakening.bound',
            toNodeId: 'awakening.illegal',
            result: {
              path: 'severed',
              severence: { id: 'severence.proof', contentVersion: 1 },
            },
          },
        },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(commit).not.toHaveBeenCalled()
  })

  it('fails closed if persistence returns a different identity than the authored transition', async () => {
    await expect(
      commitSupernaturalStoryTransition(
        userId,
        characterId,
        {
          expectedStateVersion: 1,
          idempotencyKey: '00000000-0000-4000-8000-000000000916',
          transition: ascendTransition(),
        },
        repository({
          commitTransition: vi.fn(async () => ({
            state: state({
              stateVersion: 2,
              nodeId: 'awakening.bound',
              path: 'ascended',
              ascensionId: 'ascension.other',
              ascensionContentVersion: 1,
              chosenAt: '2026-09-23T12:05:00.000Z',
            }),
            replayed: false,
          })),
        }),
      ),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  })
})
