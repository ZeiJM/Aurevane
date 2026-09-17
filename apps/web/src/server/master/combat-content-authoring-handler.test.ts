import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { AurevaneError } from '@aurevane/game-core/errors'

import {
  handleCombatContentAuthoringRequest,
  type CombatContentAuthoringHandlerDependencies,
} from './combat-content-authoring-handler'
import type { CombatContentAuthoringService } from './combat-content-authoring-service'

const ACTOR = '11111111-1111-4111-8111-111111111111'

function serviceMock(): CombatContentAuthoringService {
  return {
    requireOperator: vi.fn(async () => 'owner'),
    validateSkillDefinition: vi.fn(() => ({ valid: true, issues: [], derivedTags: [] })),
    previewSkillDefinition: vi.fn(async () => {
      throw new Error('Not used by handler tests yet.')
    }),
    diffSkillDefinitions: vi.fn(() => ({ changedPaths: [] })),
    loadSkillAuthoringState: vi.fn(async () => ({
      skillId: 'vanguard.forceful-strike',
      currentSource: 'static',
      baseVersion: 2,
      currentDefinition: { id: 'vanguard.forceful-strike', contentVersion: 2 } as never,
      draft: null,
      publishedVersions: [],
      validation: { valid: true, issues: [], derivedTags: ['Enemy', 'Single', 'Dmg'] },
      diff: { changedPaths: [] },
      draftIsStale: false,
    })),
    saveSkillDraft: vi.fn(async () => ({
      contentKey: 'vanguard.forceful-strike',
      contentKind: 'skill',
      definition: { id: 'vanguard.forceful-strike' },
      baseVersion: 2,
      draftVersion: 1,
      updatedBy: ACTOR,
      updatedAt: '2026-09-17T22:00:00.000Z',
    })),
    publishSkill: vi.fn(async () => ({
      id: '22222222-2222-4222-8222-222222222222',
      contentKey: 'vanguard.forceful-strike',
      contentKind: 'skill',
      contentVersion: 3,
      definition: { id: 'vanguard.forceful-strike', contentVersion: 3 },
      publishedBy: ACTOR,
      publishedAt: '2026-09-17T22:01:00.000Z',
    })),
    rollbackSkill: vi.fn(async () => undefined),
  }
}

function dependencies(service = serviceMock()): CombatContentAuthoringHandlerDependencies {
  return {
    getActor: async () => ({ userId: ACTOR }),
    createService: vi.fn(() => service),
  }
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/master/combat-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('combat content authoring handler', () => {
  it('requires explicit Master Panel authorization before validate/diff operations', async () => {
    const service = serviceMock()
    vi.mocked(service.requireOperator).mockRejectedValue(
      new AurevaneError('FORBIDDEN', 'Master Panel unavailable.'),
    )

    const response = await handleCombatContentAuthoringRequest(
      post({ operation: 'validate', definition: {} }),
      dependencies(service),
    )

    expect(response.status).toBe(403)
    expect(service.validateSkillDefinition).not.toHaveBeenCalled()
  })

  it('returns canonical validation for an authorized operator', async () => {
    const service = serviceMock()
    vi.mocked(service.validateSkillDefinition).mockReturnValue({
      valid: true,
      issues: [],
      derivedTags: ['Enemy', 'Single', 'Dmg'],
    })

    const response = await handleCombatContentAuthoringRequest(
      post({ operation: 'validate', definition: { id: 'vanguard.forceful-strike' } }),
      dependencies(service),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      validation: { valid: true, issues: [], derivedTags: ['Enemy', 'Single', 'Dmg'] },
    })
  })

  it('loads authoritative Skill authoring state through the protected handler', async () => {
    const service = serviceMock()

    const response = await handleCombatContentAuthoringRequest(
      post({ operation: 'load', skillId: 'vanguard.forceful-strike' }),
      dependencies(service),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      state: {
        skillId: 'vanguard.forceful-strike',
        currentSource: 'static',
        baseVersion: 2,
        draftIsStale: false,
      },
    })
    expect(service.loadSkillAuthoringState).toHaveBeenCalledWith({
      actorUserId: ACTOR,
      skillId: 'vanguard.forceful-strike',
    })
  })

  it('injects the authenticated actor into draft writes', async () => {
    const service = serviceMock()

    const response = await handleCombatContentAuthoringRequest(
      post({
        operation: 'save-draft',
        definition: { id: 'vanguard.forceful-strike' },
        baseVersion: 2,
        expectedDraftVersion: null,
      }),
      dependencies(service),
    )

    expect(response.status).toBe(200)
    expect(service.saveSkillDraft).toHaveBeenCalledWith({
      actorUserId: ACTOR,
      definition: { id: 'vanguard.forceful-strike' },
      baseVersion: 2,
      expectedDraftVersion: null,
    })
  })

  it('routes publish and rollback through the protected service', async () => {
    const service = serviceMock()
    const deps = dependencies(service)

    const publishResponse = await handleCombatContentAuthoringRequest(
      post({
        operation: 'publish',
        definition: { id: 'vanguard.forceful-strike' },
        expectedBaseVersion: 2,
      }),
      deps,
    )
    const rollbackResponse = await handleCombatContentAuthoringRequest(
      post({
        operation: 'rollback',
        skillId: 'vanguard.forceful-strike',
        targetVersion: 2,
      }),
      deps,
    )

    expect(publishResponse.status).toBe(200)
    expect(rollbackResponse.status).toBe(200)
    expect(service.publishSkill).toHaveBeenCalledWith({
      actorUserId: ACTOR,
      definition: { id: 'vanguard.forceful-strike' },
      expectedBaseVersion: 2,
    })
    expect(service.rollbackSkill).toHaveBeenCalledWith({
      actorUserId: ACTOR,
      skillId: 'vanguard.forceful-strike',
      targetVersion: 2,
    })
  })

  it('rejects malformed operations as invalid requests', async () => {
    const response = await handleCombatContentAuthoringRequest(
      post({ operation: 'publish', expectedBaseVersion: 'two' }),
      dependencies(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_REQUEST' },
    })
  })
})
