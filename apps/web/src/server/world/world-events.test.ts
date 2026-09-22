import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { eventWorldObjectives } from './world-events'
const row = (autoPath: boolean) => ({
  runId: 'run-1',
  title: 'Survey festival',
  phaseName: 'Find the watch',
  objectiveId: 'find',
  navigation: { sectorId: 'verdant-expanse', x: 12, y: 4, autoPath, guidance: 'exact' },
})
it('uses each live event objective policy independently', () => {
  const objectives = eventWorldObjectives([row(false), { ...row(true), runId: 'run-2' }])
  expect(objectives.map((o) => o.autoPath)).toEqual([false, true])
  expect(objectives[0]?.id).not.toBe(objectives[1]?.id)
})
it('rejects uncharted, malformed or blocked event destinations', () => {
  expect(
    eventWorldObjectives([
      { ...row(true), navigation: { ...row(true).navigation, sectorId: 'survey-01' } },
      { ...row(true), navigation: { ...row(true).navigation, x: 0, y: 0 } },
      null,
    ]),
  ).toEqual([])
})
