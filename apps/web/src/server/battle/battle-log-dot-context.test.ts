import { describe, expect, it, vi } from 'vitest'
import type { BattleEventRecord } from '@aurevane/db/battle-session'
vi.mock('server-only', () => ({}))
import { buildBattleLogView } from './battle-log-service'
import { buildBattleChronicle } from '../../components/battle/battle-log-chronicle-model'

function records(events: Record<string, unknown>[], battleVersion = 4): BattleEventRecord[] {
  return events.map((event, eventIndex) => ({
    event,
    eventIndex,
    battleVersion,
    createdAt: '2026-10-08T00:00:00Z',
  }))
}
const tick = {
  event: 'damage_applied',
  statusId: 'bleed',
  actionId: 'severing-cut',
  sourceCombatantId: 'zei',
  targetCombatantId: 'aura',
  amount: 3,
}
const boundary = [
  { event: 'turn_started', combatantId: 'aura', round: 4, turnNumber: 12 },
  { event: 'turn_ended', combatantId: 'aura', round: 4, turnNumber: 12 },
  { event: 'round_started', round: 5 },
  { event: 'turn_started', combatantId: 'archer', round: 5, turnNumber: 13 },
]

describe('scheduled DoT context after initiative advances', () => {
  it('attributes the outgoing tick to the completed round while retaining the next command context', () => {
    const entries = buildBattleLogView(
      'battle',
      records([
        ...boundary,
        tick,
        { event: 'combat_action_used', actorId: 'archer', actionId: 'attack' },
      ]),
    ).entries
    expect(entries[4]).toMatchObject({ round: 4, turnNumber: 12 })
    expect(entries[5]).toMatchObject({ round: 5, turnNumber: 13 })
  })
  it.each([
    { ...tick, targetCombatantId: 'archer' },
    { ...tick, effectActivationRound: 5 },
    { ...tick, damageTrigger: 'burn-backlash', statusId: 'burn' },
    { ...tick, damageTrigger: 'poison-movement', statusId: 'poison' },
  ])('does not move incoming or explicitly triggered damage backward: %j', (event) => {
    const entries = buildBattleLogView('battle', records([...boundary, event])).entries
    expect(entries.at(-1)).toMatchObject({ round: 5, turnNumber: 13 })
  })
  it('does not use a completed turn from another battle version', () => {
    const entries = buildBattleLogView('battle', [
      ...records(boundary),
      ...records([tick], 5),
    ]).entries
    expect(entries.at(-1)).toMatchObject({ round: 5, turnNumber: 13 })
  })
})

describe('extra DoT causes in shared Chronicle', () => {
  it.each([
    ['burn-backlash', 'burn', 'Burn backlash'],
    ['poison-movement', 'poison', 'an extra Poison tick after movement'],
  ])(
    'states the recorded %s cause instead of ordinary scheduled wording',
    (damageTrigger, statusId, expected) => {
      const entries = buildBattleLogView(
        'battle',
        records([{ ...tick, damageTrigger, statusId }]),
      ).entries
      expect(entries[0].messageTemplate).toContain(expected)
      const chronicle = buildBattleChronicle(entries, {
        combatantNames: { aura: 'Aura', zei: 'Zei' },
      })
      expect(JSON.stringify(chronicle)).toContain(`Aura took 3 damage from ${expected}`)
    },
  )
})
