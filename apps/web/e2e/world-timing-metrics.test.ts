import { afterEach, describe, expect, it, vi } from 'vitest'

import { measurePeerMotionStep, observeWorldMovement } from './world-timing-metrics'

describe('World peer sample timing', () => {
  it('retains the original 0.75-tile budget at a nominal frame', () => {
    const step = measurePeerMotionStep({ at: 0, x: 0 }, { at: 16, x: 0.8 })
    expect(step.maximumDeltaX).toBe(0.75)
    expect(step.deltaX).toBeGreaterThanOrEqual(step.maximumDeltaX)
  })

  it('measures progress against elapsed time on delayed samples', () => {
    const step = measurePeerMotionStep({ at: 0, x: 0 }, { at: 24, x: 0.88 })
    expect(step.deltaX).toBeLessThan(step.maximumDeltaX)
  })

  it('rejects a one-tile snap, even after a long render gap', () => {
    const step = measurePeerMotionStep({ at: 0, x: 0 }, { at: 200, x: 1 })
    expect(step.maximumDeltaX).toBe(0.95)
    expect(step.deltaX).toBeGreaterThanOrEqual(step.maximumDeltaX)
  })

  it('does not grant extra movement for non-increasing timestamps', () => {
    expect(measurePeerMotionStep({ at: 10, x: 0 }, { at: 10, x: 0.5 }).maximumDeltaX).toBe(0.75)
  })

  it.each([
    [188.3, 1.0138500632847354],
    [192.7, 0.9694809741440622],
  ])('retains the original failed run violation at %ims and %s tiles', (at, x) => {
    const step = measurePeerMotionStep({ at: 0, x: 0 }, { at, x })
    expect(step.maximumDeltaX).toBe(0.95)
    expect(step.deltaX).toBeGreaterThanOrEqual(step.maximumDeltaX)
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
