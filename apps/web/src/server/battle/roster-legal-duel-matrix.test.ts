import { describe, expect, it, vi } from 'vitest'
import { appendFileSync } from 'node:fs'
import {
  createLegalRosterDuel,
  legalRosterCycleKits,
  playLegalRosterDuel,
} from './roster-legal-duel.test-utils'

vi.mock('server-only', () => ({}))

// Run the expensive complete matrix explicitly before roster acceptance. Keep
// every class plus the four selected distinct pair contracts in the routine gate.
const selectedPairs = [
  'aetherist-shadehand',
  'edgedancer-wildwarden',
  'runeblade-vanguard',
  'cinderweaver-tidecaller',
]
const replayKits =
  process.env.AUREVANE_FULL_ROSTER_CYCLES === '1'
    ? legalRosterCycleKits
    : legalRosterCycleKits.filter(
        (kit) =>
          !kit.secondary || selectedPairs.some((pair) => kit.name.startsWith(`resonance.${pair}.`)),
      )

describe('bounded current Level100 proposed-roster mirror replays', () => {
  it.each(replayKits)(
    '$name plays four natural PvP rounds or reaches a real terminal result',
    async (kit) => {
      const duel = await createLegalRosterDuel({ kit, level: 100, context: 'pvp', seed: 12345 })
      const before = JSON.stringify(duel.state)
      const result = playLegalRosterDuel(duel, { maximumRounds: 4 })
      expect(JSON.stringify(duel.state)).toBe(before)
      expect(result.errors).toEqual([])
      expect(result.commands.length).toBeGreaterThan(0)
      expect(
        result.state.tactical.battle.round > 4 ||
          result.state.tactical.battle.lifecycle === 'completed',
      ).toBe(true)
      const evidencePath = process.env.AUREVANE_ROSTER_DUEL_EVIDENCE
      if (evidencePath)
        appendFileSync(
          evidencePath,
          JSON.stringify({
            kit: kit.name,
            primary: kit.primary,
            secondary: kit.secondary,
            level: 100,
            context: 'pvp',
            seed: 12345,
            maximumRounds: 4,
            actualRound: result.state.tactical.battle.round,
            lifecycle: result.state.tactical.battle.lifecycle,
            sourceVersions: duel.participants.map((participant) => ({
              actorId: participant.actorId,
              sources: participant.sources.map((source) => ({
                sourceInstanceId: source.sourceInstanceId,
                abilityId: source.abilityId,
                contentVersion: source.contentVersion,
                sourceKind: source.sourceKind,
              })),
            })),
            combatants: result.state.tactical.battle.combatants.map((unit) => ({
              id: unit.id,
              hp: unit.hp,
              maxHp: unit.maxHp,
              mp: unit.mp,
              maxMp: unit.maxMp,
            })),
            commands: result.commands,
          }) + '\n',
        )
    },
    30_000,
  )
})
