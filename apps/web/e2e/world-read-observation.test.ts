import { describe, expect, it, vi } from 'vitest'
import type { WorldView } from '../src/world/types'
import { observeWorldRead, readWorldSnapshot } from './world-read-observation'

function response(status: number, body: unknown) {
  const raw = Response.json(body, { status })
  return { ok: () => raw.ok, status: () => raw.status, json: () => raw.json() }
}
const origin = 'atlas:58:28'
const view = {
  position: { sectorId: 'atlas:59:28', x: 0, y: 4 },
  route: [],
} as unknown as WorldView

describe('authoritative World read observations during movement', () => {
  it('requires a successful fresh snapshot before a negative crossing condition can pass', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(response(409, { error: { code: 'STALE_VERSION' } }))
      .mockResolvedValueOnce(response(200, view))
    const crossed = vi.fn((current: WorldView) => current.position.sectorId !== origin)
    expect(await observeWorldRead(read, crossed)).toBe(false)
    expect(crossed).not.toHaveBeenCalled()
    expect(read).toHaveBeenCalledTimes(1)
    expect(await observeWorldRead(read, crossed)).toBe(true)
    expect(crossed).toHaveBeenCalledExactlyOnceWith(view)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('does not manufacture completion from a successful snapshot still at the origin', async () => {
    const current = { ...view, position: { ...view.position, sectorId: origin } }
    expect(
      await observeWorldRead(
        async () => response(200, current),
        (snapshot) => snapshot.position.sectorId !== origin,
      ),
    ).toBe(false)
  })

  it.each([
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [400, 'INVALID_REQUEST'],
    [409, 'IDEMPOTENCY_CONFLICT'],
    [503, 'PERSISTENCE_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
    [400, 'STALE_VERSION'],
    [409, 'UNKNOWN_RESPONSE'],
  ])('fails immediately for HTTP %s / %s without hiding it as movement', async (status, code) => {
    const read = vi.fn(async () => response(Number(status), { error: { code } }))
    const ready = vi.fn(() => true)
    await expect(observeWorldRead(read, ready)).rejects.toThrow(`HTTP ${status} (${code})`)
    expect(read).toHaveBeenCalledTimes(1)
    expect(ready).not.toHaveBeenCalled()
  })

  it('keeps strict reads strict and emits only status and a stable error code', async () => {
    await expect(
      readWorldSnapshot(
        response(409, {
          error: { code: 'STALE_VERSION', message: 'private message' },
          token: 'secret-token',
        }),
      ),
    ).rejects.toThrow(/^World read returned HTTP 409 \(STALE_VERSION\)\.$/)
  })

  it('does not retry failed transport or unreadable responses', async () => {
    const read = vi.fn(async () => {
      throw new Error('network unavailable')
    })
    await expect(observeWorldRead(read, () => true)).rejects.toThrow('network unavailable')
    expect(read).toHaveBeenCalledTimes(1)
    await expect(
      observeWorldRead(
        async () => ({
          ok: () => false,
          status: () => 409,
          json: async () => {
            throw new Error('private HTML')
          },
        }),
        () => true,
      ),
    ).rejects.toThrow(/^World read returned HTTP 409 with unreadable JSON\.$/)
  })
})
