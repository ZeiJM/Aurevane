import { describe, expect, it, vi } from 'vitest'
import { readCombatBuildSnapshot } from '@aurevane/game-core/combat/build-snapshot'
import { finishPv1fTurn } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  createLegalRosterDuel,
  legalRosterCycleKits,
  playLegalRosterDuel,
} from './roster-legal-duel.test-utils'

vi.mock('server-only', () => ({}))

describe('actual proposed roster through two legally committed combatants', () => {
  it('keeps a diagnostic horizon active and rejects commands only after a real terminal result', async () => {
    const kit = legalRosterCycleKits.find(
      (entry) => entry.primary === 'vanguard' && !entry.secondary,
    )!
    const duel = await createLegalRosterDuel({ kit, level: 1, context: 'pvp', seed: 12345 })
    const capped = playLegalRosterDuel(duel, { maximumRounds: 1 })
    expect(capped.state.tactical.battle.lifecycle).toBe('active')
    expect(capped.state.tactical.battle.combatants.every((unit) => unit.hp > 0)).toBe(true)
    const complete = playLegalRosterDuel(duel, { maximumRounds: 32 })
    expect(complete.errors).toEqual([])
    expect(complete.state.tactical.battle.lifecycle).toBe('completed')
    expect(complete.state.tactical.battle.combatants.filter((unit) => unit.hp === 0)).toHaveLength(
      1,
    )
    expect(
      complete.events.some(
        (event) =>
          event !== null &&
          typeof event === 'object' &&
          'event' in event &&
          event.event === 'battle_completed',
      ),
    ).toBe(true)
    const before = JSON.stringify(complete.state)
    expect(() => finishPv1fTurn(complete.state, 'east')).toThrow()
    expect(JSON.stringify(complete.state)).toBe(before)
  }, 30_000)
  it('uses the approved17 entry kits and exact136 pair kits in both Primary orders', () => {
    expect(legalRosterCycleKits).toHaveLength(289)
    expect(legalRosterCycleKits.filter((kit) => !kit.secondary)).toHaveLength(17)
    expect(legalRosterCycleKits.filter((kit) => kit.secondary)).toHaveLength(272)
    for (const kit of legalRosterCycleKits) expect(new Set(kit.ids).size).toBe(4)
  })

  it.each([1, 100] as const)(
    'admits both actual mirror builds at Level%i and plays real turns',
    async (level) => {
      const kit = legalRosterCycleKits.find(
        (entry) => entry.primary === 'vanguard' && !entry.secondary,
      )!
      for (const context of ['pve', 'pvp'] as const) {
        const duel = await createLegalRosterDuel({ kit, level, context, seed: 12345 })
        expect(duel.authority.combatants).toHaveLength(2)
        for (const participant of duel.participants) {
          expect(
            readCombatBuildSnapshot(duel.state, participant.actorId)?.disciplineSkills,
          ).toHaveLength(4)
          expect(participant.definitions.map((row) => row.id)).toEqual(kit.ids)
          expect(participant.committed.disciplineSkills).toHaveLength(4)
          expect(
            participant.sources.filter((source) => source.sourceKind === 'essence'),
          ).toHaveLength(1)
          expect(
            participant.sources.filter((source) => source.sourceKind === 'resonance'),
          ).toHaveLength(0)
          expect(
            participant.sources.every((source) => source.ownerCombatantId === participant.actorId),
          ).toBe(true)
          expect(
            duel.state.statBridge.combatants.find((row) => row.combatantId === participant.actorId)
              ?.provenance.sourceId,
          ).toBe(participant.actorId)
        }
        if (level === 100)
          expect(duel.state.tactical.battle.combatants.map((unit) => unit.maxHp)).toEqual([
            500, 500,
          ])
        const result = playLegalRosterDuel(duel, { maximumRounds: 4 })
        expect(result.commands.length).toBeGreaterThan(4)
        expect(new Set(result.commands.map((command) => command.actorId)).size).toBe(2)
        expect(
          result.commands.some((command) => command.abilityId === 'vanguard.forceful-strike'),
        ).toBe(true)
        expect(
          result.events.some(
            (event) =>
              event !== null &&
              typeof event === 'object' &&
              'event' in event &&
              event.event === 'damage_applied',
          ),
        ).toBe(true)
        expect(result.state.tactical.battle.round).toBeGreaterThan(1)
        expect(result.errors).toEqual([])
      }
    },
    30_000,
  )
})
