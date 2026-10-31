import { expect, it, vi } from 'vitest'
import { createPendingMediaTracker } from './pending-media-boundary'

it('keeps Commit Now blocked until every summon Skill upload is finished or removed', () => {
  const change = vi.fn()
  const tracker = createPendingMediaTracker(change)
  tracker.report('skill1-artwork', true)
  tracker.report('skill2-artwork', true)
  tracker.report('skill1-artwork', false)
  expect(change.mock.calls).toEqual([[true]])
  tracker.report('skill1-artwork', false)
  tracker.report('skill2-artwork', false)
  expect(change.mock.calls).toEqual([[true], [false]])
  tracker.report('skill2-audio', true)
  tracker.clear()
  expect(change.mock.calls).toEqual([[true], [false], [true], [false]])
})
