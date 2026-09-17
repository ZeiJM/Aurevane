import { describe, expect, it, vi } from 'vitest'

vi.mock('@/server/master/combat-content-authoring-handler', () => ({
  handleCombatContentAuthoringRequest: vi.fn(async () =>
    Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } }),
  ),
}))

import { handleCombatContentAuthoringRequest } from '@/server/master/combat-content-authoring-handler'

import { POST } from './route'

describe('Master Panel combat content API route', () => {
  it('delegates POST requests to the protected authoring handler', async () => {
    const request = new Request('http://localhost/api/master/combat-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'load', skillId: 'vanguard.forceful-strike' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(handleCombatContentAuthoringRequest).toHaveBeenCalledWith(request)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })
})
