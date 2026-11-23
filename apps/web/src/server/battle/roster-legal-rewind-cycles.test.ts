import { appendFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import type { CombatEncounterState } from '@aurevane/game-core/combat/actions'
import type { GridPosition } from '@aurevane/game-core/combat/board'
import {
  commitCombatAbilityCommand,
  prepareCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import {
  cancelCombatControlledAbility,
  combatAbilityCommandContext,
  primeCombatControlledAbility,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  executePv1fMovement,
  finishPv1fTurn,
  PV1F_BASIC_ATTACK_ID,
  PV1F_COMBAT_CONTENT,
  readPv1fActionEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { executeBuildAwareRecruitAiAction } from '@aurevane/game-core/combat/recruit-ai-build'
import {
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { createLegalRosterDuel, legalRosterCycleKits } from './roster-legal-duel.test-utils'

vi.mock('server-only', () => ({}))

const rewindId = 'chronist.rewind-step'
const chronist = legalRosterCycleKits.find((kit) => kit.primary === 'chronist' && !kit.secondary)!
const kit = {
  ...chronist,
  name: `${chronist.name}:earned-rewind`,
  ids: chronist.ids.map((id) => (id === 'chronist.temporal-ward' ? rewindId : id)),
}
const opponentKit = legalRosterCycleKits.find(
  (kit) => kit.primary === 'vanguard' && !kit.secondary,
)!
const cases = ([1, 100] as const).flatMap((level) =>
  (['pve', 'pvp'] as const).map((context) => ({ name: `${level}:${context}`, level, context })),
)
type State = StatDrivenCombatEncounterState
type Stage = { label: string; state: State; events?: readonly unknown[] }
function unit(state: State, id: string) {
  return state.tactical.battle.combatants.find((row) => row.id === id)!
}
function placement(state: State, id: string) {
  return state.tactical.placements.find((row) => row.combatantId === id)!
}
function ap(state: State, id: string) {
  return readPv1fActionEconomy(state, id)!.current
}
function restore(state: State) {
  const restored: State = JSON.parse(JSON.stringify(state))
  expect(validateStatDrivenCombatEncounterState(restored)).toEqual([])
  return restored
}
function transition<T extends { state: CombatEncounterState }>(state: State, run: () => T) {
  const before = JSON.stringify(state)
  const result = run()
  expect(JSON.stringify(state)).toBe(before)
  return {
    ...result,
    state: restore(
      reattachStatDrivenCombatBridge(
        result.state,
        (result.state as Partial<State>).statBridge ?? state.statBridge,
      ),
    ),
  }
}
function end(state: State) {
  const id = state.tactical.battle.currentTurn!.combatantId
  return transition(state, () => finishPv1fTurn(state, placement(state, id).facing)).state
}
function walk(state: State, ...path: GridPosition[]) {
  const id = state.tactical.battle.currentTurn!.combatantId
  return transition(state, () =>
    executePv1fMovement(state, [placement(state, id).position, ...path]),
  )
}
function source(state: State, actorId: string) {
  const captured = state.capturedAbilitySources!.find(
    (row) => row.ownerCombatantId === actorId && row.abilityId === rewindId,
  )!
  expect(captured.contentVersion).toBe(6)
  return captured
}
function primeInput(state: State, actorId: string) {
  return {
    state,
    actorId,
    sourceInstanceId: source(state, actorId).sourceInstanceId,
    behaviorId: 'rewind-step',
  }
}
function command(state: State, actorId: string) {
  const captured = source(state, actorId)
  return {
    state,
    actorId,
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'self' as const },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
}
function release(state: State, actorId: string) {
  const input = command(state, actorId)
  const quote = prepareCombatAbilityCommand(input)
  expect(quote.evaluation.legal, JSON.stringify(quote.evaluation.issues)).toBe(true)
  const result = transition(state, () => commitCombatAbilityCommand(input))
  expect(ap(result.state, actorId)).toBe(ap(state, actorId) - 40)
  expect(unit(result.state, actorId).mp).toBe(unit(state, actorId).mp - 4)
  expect(unit(result.state, actorId).hp).toBe(unit(state, actorId).hp)
  expect(result.state.turnOrigin).toEqual(state.turnOrigin)
  expect(result.state.tactical.battle.currentTurn).toMatchObject({
    combatantId: actorId,
    movementRemaining: state.tactical.battle.currentTurn!.movementRemaining,
    movementMaximum: state.tactical.battle.currentTurn!.movementMaximum,
  })
  expect(result.state.tactical.battle.turnNumber).toBe(state.tactical.battle.turnNumber)
  expect(result.state.tactical.battle.round).toBe(state.tactical.battle.round)
  expect(placement(result.state, actorId)).toEqual({
    ...placement(state, actorId),
    position: { x: 1, y: 1 },
  })
  expect(result.state.abilityRuntime!.controlled!.primes).toHaveLength(0)
  expect(result.state.abilityRuntime!.controlled!.used).toHaveLength(1)
  expect(result.events.filter((e) => e.event === 'ap_spent' && e.combatantId === actorId)).toEqual([
    expect.objectContaining({ amount: 40, remaining: ap(state, actorId) - 40 }),
  ])
  expect(result.events.filter((e) => e.event === 'mp_spent' && e.combatantId === actorId)).toEqual([
    expect.objectContaining({ amount: 4, remaining: unit(state, actorId).mp - 4 }),
  ])
  expect(result.events.filter((e) => e.event === 'skill_cooldown_started')).toEqual([
    expect.objectContaining({ actionId: rewindId, combatantId: actorId, ownerTurns: 3 }),
  ])
  expect(result.events.filter((e) => e.event === 'combat_action_used')).toEqual([
    expect.objectContaining({ actionId: rewindId, actorId }),
  ])
  expect(result.events.filter((e) => e.event === 'combatant_rewound')).toEqual([
    expect.objectContaining({
      actionId: rewindId,
      combatantId: actorId,
      from: placement(state, actorId).position,
      to: { x: 1, y: 1 },
    }),
  ])
  return result
}
function noFurtherPrimeOrRelease(state: State, actorId: string) {
  const before = JSON.stringify(state)
  expect(() => primeCombatControlledAbility(primeInput(state, actorId))).toThrow(
    'controlled-prime-used',
  )
  expect(prepareCombatAbilityCommand(command(state, actorId)).evaluation.legal).toBe(false)
  expect(() => commitCombatAbilityCommand(command(state, actorId))).toThrow()
  expect(JSON.stringify(state)).toBe(before)
}
async function primedAway(scenario: (typeof cases)[number]) {
  const duel = await createLegalRosterDuel({
    ...scenario,
    kit,
    opponentKit,
    seed: 1,
    board: {
      width: 5,
      height: 4,
      positions: [
        { x: 0, y: 1 },
        { x: 2, y: 2 },
      ],
    },
  })
  const [actor, opponent] = duel.participants
  expect(actor!.committed.disciplineSkills).toHaveLength(4)
  expect(actor!.committed.disciplineSkills.map((row) => row.skillId)).toContain(rewindId)
  let state = restore(duel.state)
  for (let i = 0; state.tactical.battle.currentTurn!.combatantId !== actor!.actorId; i++) {
    expect(i).toBeLessThan(2)
    state = end(state)
  }
  const origin = state
  const approached = walk(state, { x: 1, y: 1 })
  state = approached.state
  expect(ap(state, actor!.actorId)).toBe(80)
  expect(state.turnOrigin!.position).toEqual({ x: 0, y: 1 })
  const primed = transition(state, () =>
    primeCombatControlledAbility(primeInput(state, actor!.actorId)),
  )
  expect(primed.events).toEqual([])
  expect(primed.state.tactical).toEqual(state.tactical)
  expect(primed.state.statusState).toEqual(state.statusState)
  expect(primed.state.abilityRuntime!.usage).toEqual(state.abilityRuntime!.usage)
  expect(primed.state.abilityRuntime!.controlled!.primes).toHaveLength(1)
  expect(primed.state.abilityRuntime!.controlled!.primes[0]!.returnAnchor).toEqual({ x: 1, y: 1 })
  const beforeDuplicate = JSON.stringify(primed.state)
  expect(() => primeCombatControlledAbility(primeInput(primed.state, actor!.actorId))).toThrow(
    'controlled-prime-used',
  )
  expect(JSON.stringify(primed.state)).toBe(beforeDuplicate)
  const departed = walk(primed.state, { x: 2, y: 1 })
  state = departed.state
  expect(ap(state, actor!.actorId)).toBe(60)
  expect(state.tactical.battle.currentTurn!.movementRemaining).toBe(0)
  expect(state.abilityRuntime!.controlled!.primes[0]!.returnAnchor).toEqual({ x: 1, y: 1 })
  const stages: Stage[] = [
    { label: 'turn-origin', state: origin },
    { label: 'walk-to-prime-tile', state: approached.state, events: approached.events },
    { label: 'free-prime', state: primed.state, events: primed.events },
    { label: 'walk-away', state, events: departed.events },
  ]
  return { actor: actor!, opponent: opponent!, state, stages }
}
type Window = Awaited<ReturnType<typeof primedAway>>
function opposingHit(window: Window, occupyAnchor: boolean) {
  const { actor, opponent, stages } = window
  let state = end(window.state)
  expect(state.tactical.battle.currentTurn!.combatantId).toBe(opponent.actorId)
  if (occupyAnchor) {
    const moved = walk(state, { x: 1, y: 2 }, { x: 1, y: 1 })
    expect(ap(moved.state, opponent.actorId)).toBe(60)
    stages.push({ label: 'opponent-occupies-anchor', state: moved.state, events: moved.events })
    state = moved.state
  }
  const hp = unit(state, actor.actorId).hp
  const hit = transition(state, () =>
    executeBuildAwareRecruitAiAction(
      state,
      PV1F_BASIC_ATTACK_ID,
      { kind: 'unit', combatantId: actor.actorId },
      { committedSkills: opponent.definitions, canonicalSources: opponent.sources },
    ),
  )
  expect(
    hit.events.filter(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        'event' in event &&
        event.event === 'damage_applied',
    ),
  ).toEqual([
    expect.objectContaining({
      event: 'damage_applied',
      actionId: PV1F_BASIC_ATTACK_ID,
      sourceCombatantId: opponent.actorId,
      targetCombatantId: actor.actorId,
      hpBefore: hp,
      hpAfter: unit(hit.state, actor.actorId).hp,
      amount: hp - unit(hit.state, actor.actorId).hp,
    }),
  ])
  expect(unit(hit.state, actor.actorId).hp).toBeLessThan(hp)
  expect(ap(hit.state, opponent.actorId)).toBe(ap(state, opponent.actorId) - 30)
  stages.push({ label: 'actual-opposing-basic', state: hit.state, events: hit.events })
  state = end(hit.state)
  expect(state.tactical.battle.currentTurn!.combatantId).toBe(actor.actorId)
  expect(state.turnOrigin!.position).toEqual({ x: 2, y: 1 })
  const moved = walk(state, { x: 3, y: 1 })
  expect(ap(moved.state, actor.actorId)).toBe(80)
  expect(moved.state.tactical.battle.currentTurn!.movementRemaining).toBe(1)
  stages.push({ label: 'new-turn-walk-away-again', state: moved.state, events: moved.events })
  return moved.state
}
function record(kind: string, scenario: (typeof cases)[number], stages: Stage[]) {
  const destination = process.env.AUREVANE_REWIND_CYCLE_EVIDENCE
  if (!destination) return
  appendFileSync(destination, JSON.stringify({ kind, ...scenario, seed: 1, stages }) + '\n')
}

it.each(cases)(
  '$name pays once to return to its earned Rewind prime tile, not turn origin',
  async (scenario) => {
    const { actor, state, stages } = await primedAway(scenario)
    const result = release(state, actor.actorId)
    expect(ap(result.state, actor.actorId)).toBe(20)
    expect(result.state.tactical.battle.currentTurn!.movementRemaining).toBe(0)
    noFurtherPrimeOrRelease(result.state, actor.actorId)
    record('same-turn-return', scenario, [...stages, { label: 'paid-return', ...result }])
  },
)

it.each(cases)(
  '$name restores neither actual opposing damage nor later Movement/history',
  async (scenario) => {
    const window = await primedAway(scenario)
    const state = opposingHit(window, false)
    const result = release(state, window.actor.actorId)
    expect(ap(result.state, window.actor.actorId)).toBe(40)
    expect(result.state.tactical.battle.currentTurn!.movementRemaining).toBe(1)
    noFurtherPrimeOrRelease(result.state, window.actor.actorId)
    record('wounded-later-return', scenario, [
      ...window.stages,
      { label: 'paid-return', ...result },
    ])
  },
)

it.each(cases)(
  '$name retains its unpaid prime while an actual opponent occupies the anchor',
  async (scenario) => {
    const window = await primedAway(scenario)
    const { actor, opponent, stages } = window
    let state = opposingHit(window, true)
    expect(placement(state, opponent.actorId).position).toEqual({ x: 1, y: 1 })
    const before = JSON.stringify(state)
    expect(prepareCombatAbilityCommand(command(state, actor.actorId)).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(command(state, actor.actorId))).toThrow()
    expect(JSON.stringify(state)).toBe(before)
    expect(state.abilityRuntime!.controlled!.primes[0]!.returnAnchor).toEqual({ x: 1, y: 1 })
    stages.push({ label: 'blocked-unpaid-release', state })
    state = end(state)
    expect(state.tactical.battle.currentTurn!.combatantId).toBe(opponent.actorId)
    const vacated = walk(state, { x: 1, y: 2 })
    expect(ap(vacated.state, opponent.actorId)).toBe(80)
    stages.push({ label: 'opponent-vacates-anchor', ...vacated })
    state = end(vacated.state)
    expect(state.turnOrigin!.position).toEqual({ x: 3, y: 1 })
    const result = release(state, actor.actorId)
    expect(ap(result.state, actor.actorId)).toBe(60)
    noFurtherPrimeOrRelease(result.state, actor.actorId)
    record('occupied-then-vacated-anchor', scenario, [
      ...stages,
      { label: 'paid-return', ...result },
    ])
  },
)

it.each(cases)(
  '$name holds across ordinary completed rounds without release or arbitrary expiry',
  async (scenario) => {
    const { actor, state: primed, stages } = await primedAway(scenario)
    const held = structuredClone(primed.abilityRuntime!.controlled)
    let state = primed
    // Deliberate End Turn is not an idle timeout or a Controlled activation.
    for (let turns = 0; turns < 8; turns++) state = end(state)
    expect(state.tactical.battle.round).toBeGreaterThan(primed.tactical.battle.round)
    expect(state.tactical.battle.currentTurn!.combatantId).toBe(actor.actorId)
    expect(state.abilityRuntime!.controlled).toEqual(held)
    expect(placement(state, actor.actorId).position).toEqual({ x: 2, y: 1 })
    expect(unit(state, actor.actorId).hp).toBe(unit(primed, actor.actorId).hp)
    expect(unit(state, actor.actorId).mp).toBe(unit(primed, actor.actorId).mp)
    expect(state.abilityRuntime!.usage).toEqual(primed.abilityRuntime!.usage)
    stages.push({ label: 'held-through-four-rounds', state })
    const result = release(state, actor.actorId)
    noFurtherPrimeOrRelease(result.state, actor.actorId)
    record('held-then-returned', scenario, [...stages, { label: 'paid-return', ...result }])
  },
)

it.each(cases)(
  '$name cancellation cannot restore a free prime or execute its return',
  async (scenario) => {
    const { actor, state, stages } = await primedAway(scenario)
    const result = transition(state, () =>
      cancelCombatControlledAbility(primeInput(state, actor.actorId)),
    )
    expect(result.events).toEqual([])
    expect(result.state.tactical).toEqual(state.tactical)
    expect(result.state.abilityRuntime!.controlled!.primes).toHaveLength(0)
    expect(result.state.abilityRuntime!.controlled!.used).toEqual(
      state.abilityRuntime!.controlled!.used,
    )
    expect(result.state.abilityRuntime!.usage).toEqual(state.abilityRuntime!.usage)
    noFurtherPrimeOrRelease(result.state, actor.actorId)
    record('cancelled-without-return', scenario, [...stages, { label: 'cancelled', ...result }])
  },
)
