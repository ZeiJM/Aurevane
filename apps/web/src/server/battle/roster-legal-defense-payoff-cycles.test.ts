import { describe, expect, it, vi } from 'vitest'
import {
  prepareCombatAbilityCommand,
  commitCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import { combatAbilityCommandContext } from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  finishPv1fTurn,
  PV1F_COMBAT_CONTENT,
  readPv1fActionEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { createLegalRosterDuel, legalRosterCycleKits } from './roster-legal-duel.test-utils'
vi.mock('server-only', () => ({}))

const baseBastion = legalRosterCycleKits.find((kit) => kit.primary === 'bastion' && !kit.secondary)!
const baseDawn = legalRosterCycleKits.find((kit) => kit.primary === 'dawnshield' && !kit.secondary)!
const judgmentKit = {
  ...baseDawn,
  name: 'dawnshield:earned-judgment-kit',
  ids: [
    'dawnshield.radiant-strike',
    'dawnshield.sacred-guard',
    'dawnshield.judgment',
    'dawnshield.aegis',
  ],
}
const baseVanguard = legalRosterCycleKits.find(
  (kit) => kit.primary === 'vanguard' && !kit.secondary,
)!
const breachKit = {
  ...baseVanguard,
  name: 'vanguard:earned-guard-break-kit',
  ids: baseVanguard.ids.map((id) => (id === 'vanguard.cleave' ? 'vanguard.guard-break' : id)),
}
const cases = ([1, 100] as const).flatMap((level) =>
  (['pve', 'pvp'] as const).map((context) => ({ name: `${level}:${context}`, level, context })),
)
function restore(state: StatDrivenCombatEncounterState) {
  const copy: StatDrivenCombatEncounterState = JSON.parse(JSON.stringify(state))
  expect(validateStatDrivenCombatEncounterState(copy)).toEqual([])
  return copy
}
function end(state: StatDrivenCombatEncounterState) {
  const actorId = state.tactical.battle.currentTurn!.combatantId
  const before = JSON.stringify(state)
  const next = finishPv1fTurn(
    state,
    state.tactical.placements.find((row) => row.combatantId === actorId)!.facing,
  )
  expect(JSON.stringify(state)).toBe(before)
  return restore(next.state)
}
function status(state: StatDrivenCombatEncounterState, actorId: string, id: string) {
  return state.statusState
    .find((row) => row.combatantId === actorId)!
    .statuses.find((row) => row.statusId === id)
}
function unit(state: StatDrivenCombatEncounterState, actorId: string) {
  return state.tactical.battle.combatants.find((row) => row.id === actorId)!
}
function command(
  state: StatDrivenCombatEncounterState,
  actorId: string,
  abilityId: string,
  targetId: string,
) {
  const source = state.capturedAbilitySources!.find(
    (row) => row.ownerCombatantId === actorId && row.abilityId === abilityId,
  )
  if (!source) throw Error(`Unequipped actual command ${abilityId}`)
  return {
    state,
    actorId,
    root: { kind: 'canonical' as const, source },
    selection:
      actorId === targetId
        ? { kind: 'self' as const }
        : { kind: 'unit' as const, combatantId: targetId },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, source),
  }
}
function cast(input: ReturnType<typeof command>) {
  const before = JSON.stringify(input.state)
  const quote = prepareCombatAbilityCommand(input)
  expect(quote.evaluation.legal, JSON.stringify(quote.evaluation.issues)).toBe(true)
  const result = commitCombatAbilityCommand(input)
  expect(JSON.stringify(input.state)).toBe(before)
  return {
    ...result,
    state: restore(reattachStatDrivenCombatBridge(result.state, input.state.statBridge)),
  }
}
function rejected(input: ReturnType<typeof command>) {
  const before = JSON.stringify(input.state)
  expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(false)
  expect(() => commitCombatAbilityCommand(input)).toThrow()
  expect(JSON.stringify(input.state)).toBe(before)
}

describe('real learned four-Skill defensive setup and conditional payoff', () => {
  it.each(cases)(
    '$name Fortress is a paid finite setup for Stalwart Strike',
    async ({ level, context }) => {
      const duel = await createLegalRosterDuel({ kit: baseBastion, level, context, seed: 1 })
      const actorId = duel.state.tactical.battle.currentTurn!.combatantId
      const enemyId = duel.participants.find((p) => p.actorId !== actorId)!.actorId
      const before = JSON.stringify(duel.state)
      expect(status(duel.state, actorId, 'fortified')).toBeUndefined()
      const ordinary = cast(command(duel.state, actorId, 'bastion.stalwart-strike', enemyId))
      const setup = cast(command(duel.state, actorId, 'bastion.fortress', actorId))
      expect(readPv1fActionEconomy(setup.state, actorId)!.current).toBe(65)
      expect(status(setup.state, actorId, 'fortified')).toBeDefined()
      const payoff = cast(
        command(restore(setup.state), actorId, 'bastion.stalwart-strike', enemyId),
      )
      expect(readPv1fActionEconomy(payoff.state, actorId)!.current).toBe(15)
      expect(unit(payoff.state, actorId).mp).toBe(unit(duel.state, actorId).mp)
      const hits = payoff.events.filter(
        (event) => event.event === 'damage_applied' && event.targetCombatantId === enemyId,
      )
      expect(hits).toHaveLength(2)
      expect(
        ordinary.events.filter(
          (event) => event.event === 'damage_applied' && event.targetCombatantId === enemyId,
        ),
      ).toHaveLength(1)
      expect(hits.every((event) => event.event === 'damage_applied' && event.amount > 0)).toBe(true)
      expect(status(payoff.state, actorId, 'fortified')).toBeDefined()
      let expired = payoff.state
      for (let turns = 0; status(expired, actorId, 'fortified') && turns < 8; turns++)
        expired = end(expired)
      expect(status(expired, actorId, 'fortified')).toBeUndefined()
      expect(JSON.stringify(duel.state)).toBe(before)
    },
  )
  it.each(cases)(
    '$name Sacred Guard opens an exact paid Judgment window without consuming Guarded',
    async ({ level, context }) => {
      const duel = await createLegalRosterDuel({ kit: judgmentKit, level, context, seed: 1 })
      const actorId = duel.state.tactical.battle.currentTurn!.combatantId
      const enemyId = duel.participants.find((p) => p.actorId !== actorId)!.actorId
      const before = JSON.stringify(duel.state)
      rejected(command(duel.state, actorId, 'dawnshield.judgment', enemyId))
      const setup = cast(command(duel.state, actorId, 'dawnshield.sacred-guard', actorId))
      expect(readPv1fActionEconomy(setup.state, actorId)!.current).toBe(55)
      expect(unit(setup.state, actorId).mp).toBe(unit(duel.state, actorId).mp - 6)
      expect(unit(setup.state, actorId).hp).toBe(unit(duel.state, actorId).hp)
      expect(status(setup.state, actorId, 'guarded')).toBeDefined()
      const guarded = JSON.stringify(status(setup.state, actorId, 'guarded'))
      const payoff = cast(command(restore(setup.state), actorId, 'dawnshield.judgment', enemyId))
      expect(readPv1fActionEconomy(payoff.state, actorId)!.current).toBe(0)
      expect(unit(payoff.state, actorId).mp).toBe(unit(duel.state, actorId).mp - 13)
      expect(JSON.stringify(status(payoff.state, actorId, 'guarded'))).toBe(guarded)
      expect(
        payoff.events.some(
          (event) =>
            event.event === 'damage_applied' &&
            event.targetCombatantId === enemyId &&
            event.amount > 0,
        ),
      ).toBe(true)
      expect(JSON.stringify(duel.state)).toBe(before)
    },
  )
  it.each(cases)(
    '$name a connected paid Guard Break actually removes the owner setup and closes Judgment',
    async ({ level, context }) => {
      expect(breachKit.ids).toHaveLength(4)
      expect(breachKit.ids).toContain('vanguard.guard-break')
      const duel = await createLegalRosterDuel({
        kit: judgmentKit,
        opponentKit: breachKit,
        level,
        context,
        seed: 1,
      })
      const actorId = duel.participants[0]!.actorId
      const enemyId = duel.participants[1]!.actorId
      const before = JSON.stringify(duel.state)
      let ownerTurn = duel.state
      while (ownerTurn.tactical.battle.currentTurn!.combatantId !== actorId)
        ownerTurn = end(ownerTurn)
      const setup = cast(command(ownerTurn, actorId, 'dawnshield.sacred-guard', actorId))
      expect(status(setup.state, actorId, 'guarded')).toBeDefined()
      expect(
        prepareCombatAbilityCommand(command(setup.state, actorId, 'dawnshield.judgment', enemyId))
          .evaluation.legal,
      ).toBe(true)
      const enemyTurn = end(setup.state)
      expect(enemyTurn.tactical.battle.currentTurn!.combatantId).toBe(enemyId)
      expect(status(enemyTurn, actorId, 'guarded')).toBeDefined()
      const counter = cast(command(enemyTurn, enemyId, 'vanguard.guard-break', actorId))
      expect(readPv1fActionEconomy(counter.state, enemyId)!.current).toBe(50)
      expect(
        counter.events.some(
          (event) =>
            event.event === 'damage_applied' &&
            event.targetCombatantId === actorId &&
            event.amount > 0,
        ),
      ).toBe(true)
      expect(status(counter.state, actorId, 'guarded')).toBeUndefined()
      const denied = end(counter.state)
      expect(denied.tactical.battle.currentTurn!.combatantId).toBe(actorId)
      rejected(command(denied, actorId, 'dawnshield.judgment', enemyId))
      expect(JSON.stringify(duel.state)).toBe(before)
    },
  )
})
