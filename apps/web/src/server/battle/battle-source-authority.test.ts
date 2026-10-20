import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { assertPreparedBattleSource, battleSourceHash } from './battle-source-authority'

const character = {
  level: 4,
  xp: 700,
  progressionCycle: 1,
  might: 12,
  finesse: 5,
  vitality: 7,
  agility: 4,
  intellect: 4,
  resolve: 5,
}
const snapshot = () => ({ buildVersion: 8, sourceHash: battleSourceHash(character) })
describe('actual preparation source authority', () => {
  it('hashes the exact level, XP, cycle and six Core facts with an SQL-reproducible encoding', () => {
    expect(battleSourceHash(character)).toBe(
      createHash('sha256').update('4:700:1:12:5:7:4:4:5').digest('hex'),
    )
  })
  it('rejects old CharacterRecord mixed with a new committed build after a Primary correction', () => {
    const committed = snapshot()
    expect(() => assertPreparedBattleSource({ ...character, might: 11 }, committed)).toThrow(
      /changed/,
    )
  })
  it('rejects parallel active-build 7 with committed snapshot 8 before creating PvE', () => {
    expect(() => assertPreparedBattleSource(character, snapshot(), 7)).toThrow(/changed/)
  })
  it('accepts fresh coherent preparation and preserves pre-migration compatibility', () => {
    expect(() => assertPreparedBattleSource(character, snapshot(), 8)).not.toThrow()
    expect(() => assertPreparedBattleSource(character, { buildVersion: 8 }, 8)).not.toThrow()
  })
  it.each([null, '', 12, 'wrong'])('rejects malformed present capture %s', (sourceHash) => {
    expect(() => assertPreparedBattleSource(character, { buildVersion: 8, sourceHash })).toThrow()
  })
})

import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
it('recursively removes private source captures from every public envelope', () => {
  expect(
    projectPublicCombat({
      sourceHash: 'root',
      snapshot: { combatants: [{ sourceHash: 'private', hp: 8 }] },
    }),
  ).toEqual({ snapshot: { combatants: [{ hp: 8 }] } })
})
