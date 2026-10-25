import { afterEach, describe, expect, it, vi } from 'vitest'

import { measurePeerMotionStep, observeWorldMovement } from './world-timing-metrics'

const pose = (frameAt: number, x: number, at = frameAt + 40, y = 0) => ({
  frameAt,
  at,
  x,
  y,
  tileSize: 64,
  identityRatio: 1,
})

describe('World peer sample timing', () => {
  it('accepts the captured legal walk across a 233.3ms animation gap despite unequal paint delays', () => {
    const step = measurePeerMotionStep(
      pose(6419.9, 773.1580596734188, 6529.5, 257.32783255347596),
      pose(6653.2, 774.2389772086101, 6698.3, 257.33054812834223),
    )
    expect(step.elapsedMs).toBeCloseTo(233.3)
    expect(step.paintElapsedMs).toBeCloseTo(168.8)
    expect(step.deltaX).toBeLessThan(step.maximumDeltaX)
    expect(Math.abs(step.deltaY)).toBeLessThan(step.projectionError)
  })

  it('does not grant extra movement when only paint work takes longer', () => {
    const step = measurePeerMotionStep(pose(0, 0, 1), pose(16, 1, 300))
    expect(step.elapsedMs).toBe(16)
    expect(step.deltaX).toBeGreaterThanOrEqual(step.maximumDeltaX)
  })

  it.each([0.2, 0.75, 0.95, 1, 2])('rejects a %s-tile snap at normal animation cadence', (x) => {
    const step = measurePeerMotionStep(pose(0, 0), pose(16, x))
    expect(step.maximumDeltaX).toBeLessThan(0.14)
    expect(step.deltaX).toBeGreaterThanOrEqual(step.maximumDeltaX)
  })

  it.each([
    [100, 1],
    [200, 1.2],
    [233.3, 1.3],
    [1000, 6],
  ])('rejects movement faster than the approved route after %sms (%s tiles)', (elapsed, x) => {
    const step = measurePeerMotionStep(pose(0, 0), pose(elapsed, x))
    expect(step.deltaX).toBeGreaterThanOrEqual(step.maximumDeltaX)
  })

  it('accepts one full approved step over 200ms without calling elapsed movement a snap', () => {
    const step = measurePeerMotionStep(pose(0, 0), pose(200, 1))
    expect(step.deltaX).toBeLessThan(step.maximumDeltaX)
    // Long-gap approval is bounded by speed, not an arbitrarily enlarged frame cap.
    expect(step.maximumDeltaX).toBeLessThan(1.06)
  })

  it('bounds pixel projection error by the actual tile scale and native identity density', () => {
    const normal = measurePeerMotionStep(pose(0, 0), pose(16, 0.08))
    const dense = measurePeerMotionStep(
      { ...pose(0, 0), identityRatio: 2 },
      { ...pose(16, 0.08), identityRatio: 2 },
    )
    const zoomed = measurePeerMotionStep(
      { ...pose(0, 0), tileSize: 32 },
      { ...pose(16, 0.08), tileSize: 32 },
    )
    expect(normal.projectionError).toBeGreaterThan(0.05)
    expect(normal.projectionError).toBeLessThan(0.054)
    expect(dense.projectionError).toBeCloseTo(normal.projectionError / 2)
    expect(zoomed.projectionError).toBeCloseTo(normal.projectionError * 2)
    expect(normal.deltaX).toBeLessThan(normal.maximumDeltaX)
  })

  it.each([
    { frameAt: undefined },
    { frameAt: NaN },
    { frameAt: Infinity },
    { frameAt: 0 },
    { frameAt: -1 },
    { at: 1 },
    { x: NaN },
    { y: Infinity },
    { tileSize: 0 },
    { identityRatio: 0 },
    { tileSize: 32 },
    { identityRatio: 2 },
  ])('fails closed on invalid or non-increasing sample data: %j', (patch) => {
    expect(() =>
      measurePeerMotionStep(pose(0, 0), { ...pose(16, 0.08), ...patch } as ReturnType<typeof pose>),
    ).toThrow()
  })
})

describe('World movement observation scheduling', () => {
  afterEach(() => vi.useRealTimers())

  it('runs delivery, click, idle draws and arrivals while approval is pending', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const approval = Promise.withResolvers<void>()
    const delivery = Promise.withResolvers<void>()
    const click = Promise.withResolvers<void>()
    const phases: { phase: string; at: number }[] = []
    const mark = (phase: string) => phases.push({ phase, at: Date.now() })
    let complete = false
    const check = observeWorldMovement(
      [{ click: click.promise, approval: approval.promise }],
      async () => {
        await delivery.promise
        mark('delivery')
        await click.promise
        mark('idle-draw-poll')
        await new Promise<void>((resolve) => setTimeout(resolve, 4000))
        mark('exact-arrival-poll')
        await new Promise<void>((resolve) => setTimeout(resolve, 12000))
        mark('observer-arrival-poll')
        await new Promise<void>((resolve) => setTimeout(resolve, 5000))
        mark('renderer-checks')
      },
    ).then(() => {
      complete = true
    })
    delivery.resolve()
    await vi.advanceTimersByTimeAsync(100)
    click.resolve()
    await vi.advanceTimersByTimeAsync(21000)
    expect(phases).toEqual([
      { phase: 'delivery', at: 0 },
      { phase: 'idle-draw-poll', at: 100 },
      { phase: 'exact-arrival-poll', at: 4100 },
      { phase: 'observer-arrival-poll', at: 16100 },
      { phase: 'renderer-checks', at: 21100 },
    ])
    expect(complete).toBe(false)
    approval.resolve()
    await check
    expect(complete).toBe(true)
  })

  it('does not extend a failed observation deadline to drain slow approval', async () => {
    vi.useFakeTimers()
    const approval = Promise.withResolvers<void>()
    const timeout = new Error('idle draw deadline')
    const result = observeWorldMovement(
      [{ click: Promise.resolve(), approval: approval.promise }],
      () => new Promise<void>((_, reject) => setTimeout(() => reject(timeout), 4000)),
    ).catch((error: unknown) => error)
    let failure: unknown
    void result.then((error) => {
      failure = error
    })
    await vi.advanceTimersByTimeAsync(4000)
    expect(failure).toBe(timeout)
    // A late approval failure must remain observed without replacing the primary failure.
    approval.reject(new Error('later approval failure'))
    expect(await result).toBe(timeout)
  })

  it('starts rendered progress after both clicks and arrivals without waiting for either approval', async () => {
    vi.useFakeTimers()
    const clicks = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
    const approvals = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
    const arrivals = Promise.withResolvers<void>()
    const phases: string[] = []
    const check = observeWorldMovement(
      approvals.map((approval, index) => ({
        click: clicks[index]!.promise,
        approval: approval.promise,
      })),
      async () => {
        await Promise.all(clicks.map((click) => click.promise))
        phases.push('arrivals')
        await arrivals.promise
        phases.push('first-rendered-progress')
        await new Promise<void>((resolve) => setTimeout(resolve, 5000))
        phases.push('second-rendered-progress')
      },
    )
    clicks[0]!.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(phases).toEqual([])
    clicks[1]!.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(phases).toEqual(['arrivals'])
    arrivals.resolve()
    await vi.advanceTimersByTimeAsync(5000)
    expect(phases).toEqual(['arrivals', 'first-rendered-progress', 'second-rendered-progress'])
    approvals.forEach((approval) => approval.resolve())
    await check
  })

  it.each([0, 1])(
    'fails on approval %i rejection despite successful observations',
    async (index) => {
      const approvals = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
      const rejection = new Error('walk rejected')
      const check = observeWorldMovement(
        approvals.map((approval) => ({ click: Promise.resolve(), approval: approval.promise })),
        async () => {},
      )
      const result = expect(check).rejects.toBe(rejection)
      approvals[1 - index]!.resolve()
      approvals[index]!.reject(rejection)
      await result
    },
  )

  it('preserves an approval failure when an in-flight observation later fails', async () => {
    const approval = Promise.withResolvers<void>()
    const observation = Promise.withResolvers<void>()
    const rejection = new Error('walk rejected first')
    let started = false
    const result = observeWorldMovement(
      [{ click: Promise.resolve(), approval: approval.promise }],
      () => {
        started = true
        return observation.promise
      },
    ).catch((error: unknown) => error)
    expect(started).toBe(true)
    approval.reject(rejection)
    expect(await result).toBe(rejection)
    observation.reject(new Error('page closed during cleanup'))
    expect(await result).toBe(rejection)
  })

  it('preserves an immediate click failure while delivery and approval remain pending', async () => {
    vi.useFakeTimers()
    const click = Promise.withResolvers<void>()
    const approval = Promise.withResolvers<void>()
    const delivery = Promise.withResolvers<void>()
    const rejection = new Error('click failed first')
    let failure: unknown
    // The later awaits are the real delivery-before-click observation order.
    const result = observeWorldMovement(
      [{ click: click.promise, approval: approval.promise }],
      async () => {
        await delivery.promise
        await click.promise
      },
    ).catch((error: unknown) => {
      failure = error
      return error
    })
    // The guard is attached only to keep a deliberately broken implementation's
    // missing click observer from producing an unrelated unhandled rejection.
    void click.promise.catch(() => {})
    click.reject(rejection)
    await vi.advanceTimersByTimeAsync(0)
    expect(failure).toBe(rejection)
    delivery.resolve()
    approval.reject(new Error('approval failed later'))
    expect(await result).toBe(rejection)
  })
})
