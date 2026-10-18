import { describe, expect, it, vi } from 'vitest'
import {
  chooseBuildAwareRecruitAiDecision,
  executeBuildAwareRecruitAiAction,
  projectedCombatEffectUtility,
} from '@aurevane/game-core/combat/recruit-ai-build'
import { prepareCombatAbilityCommand } from '@aurevane/game-core/combat/combat-ability-command'
import { combatAbilityCommandContext } from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  executePv1fMovement,
  evaluatePv1fAction,
  PV1F_BASIC_ATTACK_ID,
  PV1F_COMBAT_CONTENT,
  readPv1fActionEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { createLegalRosterDuel, legalRosterCycleKits } from './roster-legal-duel.test-utils'
vi.mock('server-only', () => ({}))
const kit = legalRosterCycleKits.find((k) => k.primary === 'farstrider' && !k.secondary)!
const cases = ([1, 100] as const).flatMap((level) =>
  (['pve', 'pvp'] as const).map((context) => ({ name: `${level}:${context}`, level, context })),
)
describe('actual legal ranged AI paid spacing opportunity', () => {
  it.each(cases)(
    '$name preserves a feasible repeated Basic turn instead of a lower-value single-target walk and shot',
    async ({ level, context }) => {
      const kit = legalRosterCycleKits.find(
        (k) => k.name === 'resonance.farstrider-wildwarden.linked-sequence:primary:wildwarden',
      )!
      const duel = await createLegalRosterDuel({ kit, level, context, seed: 12345 })
      const actorId = duel.state.tactical.battle.currentTurn!.combatantId
      const enemyId = duel.participants.find((p) => p.actorId !== actorId)!.actorId
      const before = JSON.stringify(duel.state)
      const basic = evaluatePv1fAction(duel.state, PV1F_BASIC_ATTACK_ID, {
        kind: 'unit',
        combatantId: enemyId,
      })
      expect(basic.evaluation.legal).toBe(true)
      const available = readPv1fActionEconomy(duel.state, actorId)!.current
      const basicTurnValue =
        Math.floor(available / basic.cost) *
        projectedCombatEffectUtility(basic.evaluation, basic.prepared, basic.action.effects)
      const origin = duel.state.tactical.placements.find((p) => p.combatantId === actorId)!.position
      const moved = executePv1fMovement(duel.state, [origin, { x: origin.x, y: origin.y - 1 }])
      const source = moved.state.capturedAbilitySources!.find(
        (s) => s.ownerCombatantId === actorId && s.abilityId === 'farstrider.aimed-shot',
      )!
      const shot = prepareCombatAbilityCommand({
        state: moved.state,
        actorId,
        root: { kind: 'canonical', source },
        selection: { kind: 'unit', combatantId: enemyId },
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(moved.state, source),
      })
      expect(shot.evaluation.legal).toBe(true)
      expect(basicTurnValue).toBeGreaterThan(
        projectedCombatEffectUtility(shot.evaluation, moved.state, shot.action.effects),
      )
      let ordinary = duel.state
      for (let i = 0; i < Math.floor(available / basic.cost); i++)
        ordinary = executeBuildAwareRecruitAiAction(ordinary, PV1F_BASIC_ATTACK_ID, {
          kind: 'unit',
          combatantId: enemyId,
        }).state
      expect(readPv1fActionEconomy(ordinary, actorId)!.current).toBe(available % basic.cost)
      expect(ordinary.tactical.battle.combatants.find((u) => u.id === enemyId)!.hp).toBeLessThan(
        duel.state.tactical.battle.combatants.find((u) => u.id === enemyId)!.hp,
      )
      expect(
        chooseBuildAwareRecruitAiDecision({ state: duel.state, tieBreakSeed: 12345 }).intent,
      ).toMatchObject({ kind: 'action', actionId: PV1F_BASIC_ATTACK_ID })
      expect(JSON.stringify(duel.state)).toBe(before)
    },
  )
  it.each(cases)(
    '$name keeps efficient close pressure when a paid retreat shot has lower value per AP',
    async ({ level, context }) => {
      const duel = await createLegalRosterDuel({ kit, level, context, seed: 1 })
      const actorId = duel.participants[0]!.actorId,
        enemyId = duel.participants[1]!.actorId
      const before = JSON.stringify(duel.state)
      const basic = evaluatePv1fAction(duel.state, PV1F_BASIC_ATTACK_ID, {
        kind: 'unit',
        combatantId: enemyId,
      })
      const basicValue =
        projectedCombatEffectUtility(basic.evaluation, basic.prepared, basic.action.effects) /
        basic.cost
      const retreat = executePv1fMovement(duel.state, [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ])
      const source = retreat.state.capturedAbilitySources!.find(
        (s) => s.ownerCombatantId === actorId && s.abilityId === 'farstrider.aimed-shot',
      )!
      const shot = prepareCombatAbilityCommand({
        state: retreat.state,
        actorId,
        root: { kind: 'canonical', source },
        selection: { kind: 'unit', combatantId: enemyId },
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(retreat.state, source),
      })
      expect(shot.evaluation.legal).toBe(true)
      const shotCost = shot.costs
        .filter((c) => c.resource === 'ap')
        .reduce((n, c) => n + c.amount, 0)
      expect(
        projectedCombatEffectUtility(shot.evaluation, retreat.state, shot.action.effects) /
          (20 + shotCost),
      ).toBeLessThan(basicValue)
      const decision = chooseBuildAwareRecruitAiDecision({ state: duel.state, tieBreakSeed: 1 })
      expect(decision.intent).toMatchObject({ kind: 'action', actionId: PV1F_BASIC_ATTACK_ID })
      expect(JSON.stringify(duel.state)).toBe(before)
    },
  )
  it.each(cases)(
    '$name repositions for an affordable three-target Volley that improves paid value',
    async ({ level, context }) => {
      const input = {
        kit,
        additionalKits: [kit, kit],
        level,
        context,
        seed: 1,
        board: {
          width: 7,
          height: 3,
          positions: [
            { x: 2, y: 1 },
            { x: 1, y: 1 },
            { x: 1, y: 0 },
            { x: 1, y: 2 },
          ],
          facings: ['west', 'east', 'south', 'north'] as const,
        },
      }
      const duel = await createLegalRosterDuel(input)
      expect(duel.participants).toHaveLength(4)
      const actorId = duel.participants[1]!.actorId,
        enemies = duel.participants.filter((p) => p.actorId !== actorId).map((p) => p.actorId)
      expect(duel.state.tactical.battle.currentTurn!.combatantId).toBe(actorId)
      const before = JSON.stringify(duel.state)
      const basic = evaluatePv1fAction(duel.state, PV1F_BASIC_ATTACK_ID, {
        kind: 'unit',
        combatantId: enemies[0]!,
      })
      const basicValue =
        projectedCombatEffectUtility(basic.evaluation, basic.prepared, basic.action.effects) /
        basic.cost
      const retreat = executePv1fMovement(duel.state, [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ])
      const source = retreat.state.capturedAbilitySources!.find(
        (s) => s.ownerCombatantId === actorId && s.abilityId === 'farstrider.volley',
      )!
      const volley = prepareCombatAbilityCommand({
        state: retreat.state,
        actorId,
        root: { kind: 'canonical', source },
        selection: {
          kind: 'selections',
          selections: enemies.map((combatantId) => ({ kind: 'unit', combatantId })),
        },
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(retreat.state, source),
      })
      expect(volley.evaluation.legal).toBe(true)
      const cost = volley.costs.filter((c) => c.resource === 'ap').reduce((n, c) => n + c.amount, 0)
      expect(
        projectedCombatEffectUtility(volley.evaluation, retreat.state, volley.action.effects) /
          (20 + cost),
      ).toBeGreaterThan(basicValue)
      const decision = chooseBuildAwareRecruitAiDecision({ state: duel.state, tieBreakSeed: 1 })
      expect(decision.intent.kind).toBe('move')
      if (decision.intent.kind !== 'move') throw Error('Expected paid firing-lane reposition')
      const moved = executePv1fMovement(duel.state, decision.intent.path)
      expect(readPv1fActionEconomy(moved.state, actorId)!.current).toBe(80)
      const next = chooseBuildAwareRecruitAiDecision({ state: moved.state, tieBreakSeed: 2 })
      expect(next.intent).toMatchObject({ kind: 'action', actionId: 'farstrider.volley' })
      if (next.intent.kind !== 'action') throw Error('Expected actual multi-target shot')
      expect(next.intent.target.kind).toBe('selections')
      if (next.intent.target.kind !== 'selections') throw Error('Expected all three recipients')
      expect(
        new Set(
          next.intent.target.selections.flatMap((target) =>
            target.kind === 'unit' ? [target.combatantId] : [],
          ),
        ),
      ).toEqual(new Set(enemies))
      const out = executeBuildAwareRecruitAiAction(
        moved.state,
        next.intent.actionId,
        next.intent.target,
        {},
        next.intent,
      )
      expect(readPv1fActionEconomy(out.state, actorId)!.current).toBe(25)
      expect(
        enemies.filter(
          (id) =>
            out.state.tactical.battle.combatants.find((u) => u.id === id)!.hp <
            duel.state.tactical.battle.combatants.find((u) => u.id === id)!.hp,
        ).length,
      ).toBeGreaterThan(0)
      expect(JSON.stringify(duel.state)).toBe(before)
    },
  )
})
