import { describe, expect, it, vi } from 'vitest'
import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import { requestBattlePreview } from './battle-preview-request'

const intent: BattleIntent = {
  kind: 'action',
  actionId: 'basic.attack.unarmed.basic',
  target: { kind: 'unit', combatantId: 'north' },
}

function transport() {
  const calls: {
    signal: AbortSignal
    payload: unknown
    resolve: (response: Response) => void
    reject: (error: Error) => void
  }[] = []
  const fetchPreview = vi.fn<typeof fetch>(
    (_url, options) =>
      new Promise<Response>((resolve, reject) => {
        calls.push({
          signal: options!.signal as AbortSignal,
          payload: JSON.parse(String(options!.body)),
          resolve,
          reject,
        })
      }),
  )
  const request = (
    controller = new AbortController(),
    version = 4,
    target = intent,
    session = 'battle',
  ) =>
    requestBattlePreview({
      battleSessionId: session,
      battleVersion: version,
      intent: target,
      signal: controller.signal,
      fetchPreview,
    })
  return { calls, request }
}

describe('shared in-flight canonical battle forecasts', () => {
  it('makes one request and gives identical consumers independently readable bodies', async () => {
    const { calls, request } = transport()
    const selected = request()
    const range = request()
    expect(calls).toHaveLength(1)
    expect(calls[0].payload).toEqual({ expectedBattleVersion: 4, intent })
    calls[0].resolve(Response.json({ outcome: 'north', version: 4 }))
    expect(await (await selected).json()).toEqual({ outcome: 'north', version: 4 })
    expect(await (await range).json()).toEqual({ outcome: 'north', version: 4 })
  })

  it('does not substitute a different candidate, battle session or version', async () => {
    const { calls, request } = transport()
    const north = request()
    const south = request(new AbortController(), 4, {
      ...intent,
      target: { kind: 'unit', combatantId: 'south' },
    })
    const fresh = request(new AbortController(), 5)
    const otherBattle = request(new AbortController(), 4, intent, 'another-battle')
    expect(calls).toHaveLength(4)
    calls.forEach((call, index) => call.resolve(Response.json({ result: index })))
    expect(
      await Promise.all(
        [north, south, fresh, otherBattle].map(async (pending) => (await pending).json()),
      ),
    ).toEqual([{ result: 0 }, { result: 1 }, { result: 2 }, { result: 3 }])
  })

  it.each([0, 1])('cancelling consumer %i preserves the other active reader', async (cancelled) => {
    const { calls, request } = transport()
    const controllers = [new AbortController(), new AbortController()]
    const results = controllers.map((controller) => request(controller))
    const rejected = expect(results[cancelled]).rejects.toMatchObject({ name: 'AbortError' })
    controllers[cancelled].abort()
    await rejected
    expect(calls).toHaveLength(1)
    expect(calls[0].signal.aborted).toBe(false)
    calls[0].resolve(Response.json({ outcome: 'still-current' }))
    expect(await (await results[1 - cancelled]).json()).toEqual({ outcome: 'still-current' })
  })

  it('aborts the last reader and immediately admits a fresh same-key request', async () => {
    const { calls, request } = transport()
    const first = new AbortController()
    const second = new AbortController()
    const firstRejected = expect(request(first)).rejects.toMatchObject({ name: 'AbortError' })
    const secondRejected = expect(request(second)).rejects.toMatchObject({ name: 'AbortError' })
    first.abort()
    second.abort()
    await Promise.all([firstRejected, secondRejected])
    expect(calls[0].signal.aborted).toBe(true)
    const fresh = request()
    expect(calls).toHaveLength(2)
    expect(calls[1].signal.aborted).toBe(false)
    // An aborted transport can still settle. It must not evict its replacement.
    calls[0].resolve(Response.json({ outcome: 'obsolete' }))
    await Promise.resolve()
    await Promise.resolve()
    const anotherReader = request()
    expect(calls).toHaveLength(2)
    calls[1].resolve(Response.json({ outcome: 'fresh' }))
    expect(await (await fresh).json()).toEqual({ outcome: 'fresh' })
    expect(await (await anotherReader).json()).toEqual({ outcome: 'fresh' })
  })

  it('evicts completed forecasts rather than caching historical responses', async () => {
    const { calls, request } = transport()
    const first = request()
    calls[0].resolve(Response.json({ outcome: 'first' }))
    await (await first).json()
    const again = request()
    expect(calls).toHaveLength(2)
    calls[1].resolve(Response.json({ outcome: 'new-request' }))
    expect(await (await again).json()).toEqual({ outcome: 'new-request' })
  })

  it('independently rejects readers and evicts a failed transport', async () => {
    const { calls, request } = transport()
    const first = expect(request()).rejects.toThrow('Offline')
    const second = expect(request()).rejects.toThrow('Offline')
    calls[0].reject(new Error('Offline'))
    await Promise.all([first, second])
    const retry = request()
    expect(calls).toHaveLength(2)
    calls[1].resolve(Response.json({ error: { code: 'STALE_VERSION' } }, { status: 409 }))
    const response = await retry
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: { code: 'STALE_VERSION' } })
  })

  it('does not start transport for an already cancelled reader', async () => {
    const { calls, request } = transport()
    const controller = new AbortController()
    controller.abort()
    await expect(request(controller)).rejects.toMatchObject({ name: 'AbortError' })
    expect(calls).toHaveLength(0)
  })
})
