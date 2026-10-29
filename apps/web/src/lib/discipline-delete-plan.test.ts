import { expect, it } from 'vitest'
import { parseDisciplineDeletePlan, disciplineDeleteBlockerLink } from './discipline-delete-plan'
const plan = {
  token: 'a'.repeat(32),
  records: [
    { contentKey: 'discipline.test', name: 'Test', contentKind: 'discipline', revision: 1 },
  ],
  blockers: [],
  blockerCount: 0,
}
it('accepts the bounded authoritative impact', () => {
  expect(parseDisciplineDeletePlan(plan)).toEqual(plan)
})
it.each([
  { ...plan, token: '' },
  { ...plan, records: [] },
  { ...plan, blockerCount: -1 },
  { ...plan, records: Array.from({ length: 258 }, () => plan.records[0]) },
  { ...plan, records: [{ ...plan.records[0], revision: 0 }] },
  {
    ...plan,
    blockers: [
      { kind: 'player-grant', key: 'account', name: 'Player', contentKey: 'discipline.test' },
    ],
  },
])('rejects an incomplete or inconsistent deletion response', (value) => {
  expect(() => parseDisciplineDeletePlan(value)).toThrow('deletion review')
})
it('opens the correct editor for shared content and the Discipline for grants', () => {
  const blocker = {
    contentKey: 'discipline.test',
    name: 'Test',
    key: 'discipline.shared',
    kind: 'definition-current',
  }
  expect(disciplineDeleteBlockerLink(blocker)).toBe(
    '/master/combat-content?contentKey=discipline.shared',
  )
  expect(disciplineDeleteBlockerLink({ ...blocker, kind: 'player-grant', key: 'account' })).toBe(
    '/master/combat-content?contentKey=discipline.test',
  )
})
