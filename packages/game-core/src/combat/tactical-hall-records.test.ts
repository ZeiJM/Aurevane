import { describe, expect, it } from 'vitest'

import {
  P2_7_TACTICAL_HALL_RECORDS,
  getTacticalHallRecord,
  getTacticalHallRecordFromScenarioSourceId,
} from './tactical-hall-records'

describe('P2.7 Battle Hall teaching records', () => {
  it('adds Guided Fundamentals while retaining legacy record compatibility', () => {
    expect(P2_7_TACTICAL_HALL_RECORDS.map((record) => record.id)).toEqual([
      'guided-fundamentals',
      'movement-drill',
      'strike-drill',
      'guard-drill',
      'facing-drill',
      'recruit-sparring',
    ])
    expect(getTacticalHallRecord('guided-fundamentals').combinedDuel).toBe(false)
    expect(getTacticalHallRecord('recruit-sparring').combinedDuel).toBe(true)
    expect(
      P2_7_TACTICAL_HALL_RECORDS.filter((record) => !record.combinedDuel).every(
        (record) => record.defaultArenaId === 'basic-training-floor',
      ),
    ).toBe(true)
  })

  it('gives every lesson concise coach steps without adding progression rewards', () => {
    for (const record of P2_7_TACTICAL_HALL_RECORDS) {
      expect(record.purpose.length).toBeGreaterThan(20)
      expect(record.coachSteps.length).toBeGreaterThanOrEqual(3)
      expect(record.coachSteps.length).toBeLessThanOrEqual(4)
      expect(record.coachSteps.every((step) => step.length > 10)).toBe(true)
    }
    expect(getTacticalHallRecord('guided-fundamentals').coachSteps).toHaveLength(4)
  })

  it('can recover a record only from registered P2.7 scenario provenance', () => {
    expect(
      getTacticalHallRecordFromScenarioSourceId(
        'scenario:p2-7-recruit:basic-training-floor:movement-drill',
      )?.id,
    ).toBe('movement-drill')
    expect(
      getTacticalHallRecordFromScenarioSourceId('scenario:p2-7-recruit:duel-yard:recruit-sparring')
        ?.id,
    ).toBe('recruit-sparring')
    expect(getTacticalHallRecordFromScenarioSourceId('scenario:other')).toBeNull()
  })
})
