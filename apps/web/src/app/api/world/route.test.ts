import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  loadSelectedCharacter: vi.fn(),
  previewRoute: vi.fn(),
  commitWorldCommand: vi.fn(),
  readWorld: vi.fn(),
  attackWorldPlayer: vi.fn(),
}))

vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: mocks.getActor,
}))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: mocks.loadSelectedCharacter,
}))
vi.mock('@/server/world/world-repository', () => ({
  previewWorldRouteForCharacter: mocks.previewRoute,
  commitWorldCommand: mocks.commitWorldCommand,
  readWorld: mocks.readWorld,
}))
vi.mock('@/server/world/world-battle', () => ({
  attackWorldPlayer: mocks.attackWorldPlayer,
}))

import { POST } from './route'

const userId = '00000000-0000-4000-8000-000000000010'
const characterId = '00000000-0000-4000-8000-000000000011'
const destination = { sectorId: 'verdant-expanse', x: 8, y: 4 }

function request(body: unknown) {
  return new Request('http://aurevane.test/api/world', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('World API route preview', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
    mocks.getActor.mockResolvedValue({ userId })
    mocks.loadSelectedCharacter.mockResolvedValue({ id: characterId })
  })

  it('serves a read-only route preview without committing world state', async () => {
    mocks.previewRoute.mockResolvedValue({
      stateVersion: 3,
      destination,
      stepCount: 3,
      durationMs: 3300,
    })

    const response = await POST(
      request({
        operation: 'preview-route',
        characterId,
        expectedVersion: 3,
        destination,
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      stateVersion: 3,
      destination,
      stepCount: 3,
      durationMs: 3300,
    })
    expect(mocks.previewRoute).toHaveBeenCalledWith(userId, characterId, {
      operation: 'preview-route',
      characterId,
      expectedVersion: 3,
      destination,
    })
    expect(mocks.commitWorldCommand).not.toHaveBeenCalled()
    expect(mocks.attackWorldPlayer).not.toHaveBeenCalled()
  })

  it('keeps ordinary travel commands on the existing mutation path', async () => {
    const view = { version: 4 }
    mocks.commitWorldCommand.mockResolvedValue(view)

    const response = await POST(
      request({
        characterId,
        expectedVersion: 3,
        commandId: '00000000-0000-4000-8000-000000000099',
        intent: { kind: 'walk', destination },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(view)
    expect(mocks.commitWorldCommand).toHaveBeenCalledOnce()
    expect(mocks.previewRoute).not.toHaveBeenCalled()
  })

  it('rejects a preview prepared for a different selected character before authority calls', async () => {
    const response = await POST(
      request({
        operation: 'preview-route',
        characterId: '00000000-0000-4000-8000-000000000012',
        expectedVersion: 3,
        destination,
      }),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'STALE_VERSION' },
    })
    expect(mocks.previewRoute).not.toHaveBeenCalled()
    expect(mocks.commitWorldCommand).not.toHaveBeenCalled()
    expect(mocks.attackWorldPlayer).not.toHaveBeenCalled()
  })
})
