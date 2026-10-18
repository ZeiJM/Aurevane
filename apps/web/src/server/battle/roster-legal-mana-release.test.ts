import { describe, expect, it, vi } from 'vitest'
import {
  commitCombatAbilityCommand,
  prepareCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import { combatAbilityCommandContext } from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  PV1F_COMBAT_CONTENT,
  readPv1fActionEconomy,
  finishPv1fTurn,
  executePv1fMovement,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { createLegalRosterDuel, legalRosterCycleKits } from './roster-legal-duel.test-utils'
vi.mock('server-only', () => ({}))
const kits = legalRosterCycleKits.filter((k) =>
  k.name.startsWith('resonance.aetherist-edgedancer.linked-sequence:'),
)
const cases = kits.flatMap((kit) =>
  ([1, 100] as const).flatMap((level) =>
    (['pve', 'pvp'] as const).map((context) => ({
      name: `${kit.primary}:${level}:${context}`,
      kit,
      level,
      context,
    })),
  ),
)
describe('actual legal Aether in Poise release at its required movement opportunity', () => {
  it.each(cases)(
    '$name pays once and reaches the adjacent strike origin',
    async ({ kit, level, context }) => {
      const duel = await createLegalRosterDuel({
        kit,
        level,
        context,
        seed: 1,
        board: {
          width: 7,
          height: 3,
          positions: [
            { x: 1, y: 1 },
            { x: 3, y: 1 },
          ],
        },
      })
      const actorId = duel.participants[0]!.actorId,
        enemyId = duel.participants[1]!.actorId
      expect(duel.state.tactical.battle.currentTurn!.combatantId).toBe(actorId)
      const source = duel.state.capturedAbilitySources!.find(
        (s) =>
          s.ownerCombatantId === actorId &&
          s.abilityId === 'resonance.aetherist-edgedancer.linked-sequence',
      )!
      const input = {
        state: duel.state,
        actorId,
        root: { kind: 'canonical' as const, source, behaviorId: 'release' },
        selection: { kind: 'unit' as const, combatantId: enemyId },
        movementPath: [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
        ],
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(duel.state, source),
      }
      const quote = prepareCombatAbilityCommand(input)
      expect(quote.evaluation.issues).toEqual([])
      expect(quote.evaluation.legal).toBe(true)
      const before = JSON.stringify(duel.state)
      const transition = commitCombatAbilityCommand(input)
      const result = {
        ...transition,
        state: reattachStatDrivenCombatBridge(transition.state, duel.state.statBridge),
      }
      expect(JSON.stringify(duel.state)).toBe(before)
      expect(
        result.state.tactical.placements.find((p) => p.combatantId === actorId)!.position,
      ).toEqual({ x: 2, y: 1 })
      expect(readPv1fActionEconomy(result.state, actorId)!.current).toBe(50)
      expect(result.state.tactical.battle.currentTurn!.movementRemaining).toBe(
        duel.state.tactical.battle.currentTurn!.movementRemaining - 1,
      )
      expect(result.state.tactical.battle.combatants.find((u) => u.id === actorId)!.mp).toBe(
        duel.state.tactical.battle.combatants.find((u) => u.id === actorId)!.mp - 8,
      )
      expect(
        result.state.tactical.battle.combatants.find((u) => u.id === enemyId)!.hp,
      ).toBeLessThan(duel.state.tactical.battle.combatants.find((u) => u.id === enemyId)!.hp)
    },
  )
  it.each(cases)(
    '$name enemy closing removes the mandatory approach, preserving an ordinary attack',
    async ({ kit, level, context }) => {
      const duel = await createLegalRosterDuel({
        kit,
        level,
        context,
        seed: 1,
        board: {
          width: 7,
          height: 3,
          positions: [
            { x: 1, y: 1 },
            { x: 3, y: 1 },
          ],
        },
      })
      const actorId = duel.participants[0]!.actorId,
        enemyId = duel.participants[1]!.actorId
      const waiting = finishPv1fTurn(duel.state, 'east').state
      expect(waiting.tactical.battle.currentTurn!.combatantId).toBe(enemyId)
      const closing = executePv1fMovement(waiting, [
        { x: 3, y: 1 },
        { x: 2, y: 1 },
      ]).state
      expect(readPv1fActionEconomy(closing, enemyId)!.current).toBe(80)
      const state = finishPv1fTurn(closing, 'west').state
      expect(state.tactical.battle.currentTurn!.combatantId).toBe(actorId)
      const source = state.capturedAbilitySources!.find(
        (s) =>
          s.ownerCombatantId === actorId &&
          s.abilityId === 'resonance.aetherist-edgedancer.linked-sequence',
      )!
      const input = {
        state,
        actorId,
        root: { kind: 'canonical' as const, source, behaviorId: 'release' },
        selection: { kind: 'unit' as const, combatantId: enemyId },
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(state, source),
      }
      const before = JSON.stringify(state)
      for (const destination of [
        { x: 1, y: 0 },
        { x: 2, y: 1 },
        { x: 1, y: 2 },
        { x: 0, y: 1 },
      ]) {
        const command = { ...input, movementPath: [{ x: 1, y: 1 }, destination] }
        expect(prepareCombatAbilityCommand(command).evaluation.legal).toBe(false)
        expect(() => commitCombatAbilityCommand(command)).toThrow()
        expect(JSON.stringify(state)).toBe(before)
      }
      const arc = state.capturedAbilitySources!.find(
        (s) => s.ownerCombatantId === actorId && s.abilityId === 'aetherist.arc-bolt',
      )!
      const fallback = {
        ...input,
        root: { kind: 'canonical' as const, source: arc },
        context: combatAbilityCommandContext(state, arc),
      }
      expect(prepareCombatAbilityCommand(fallback).evaluation.legal).toBe(true)
      const transition = commitCombatAbilityCommand(fallback)
      const result = {
        ...transition,
        state: reattachStatDrivenCombatBridge(transition.state, state.statBridge),
      }
      expect(readPv1fActionEconomy(result.state, actorId)!.current).toBe(55)
      expect(result.state.tactical.battle.combatants.find((u) => u.id === actorId)!.mp).toBe(
        state.tactical.battle.combatants.find((u) => u.id === actorId)!.mp - 3,
      )
      expect(JSON.stringify(state)).toBe(before)
    },
  )
})
