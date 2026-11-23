import { appendFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import type { CombatTargetSelection } from '@aurevane/game-core/combat/actions'
import {
  commitCombatAbilityCommand,
  prepareCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import { combatAbilityCommandContext } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { currentBarrierAmount } from '@aurevane/game-core/combat/combat-barrier'
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
const veiled = 'resonance.aetherist-shadehand.veiled-conduit'
const farstrider = legalRosterCycleKits.find(
  (kit) => kit.primary === 'farstrider' && !kit.secondary,
)!
const cinderweaver = legalRosterCycleKits.find(
  (kit) => kit.primary === 'cinderweaver' && !kit.secondary,
)!
const cases = legalRosterCycleKits
  .filter((kit) => kit.name.startsWith(`${veiled}:`))
  .flatMap((kit) =>
    ([1, 100] as const).flatMap((level) =>
      (['pve', 'pvp'] as const).map((context) => ({
        name: `${kit.primary}:${level}:${context}`,
        kit,
        level,
        context,
      })),
    ),
  )
function unit(state: StatDrivenCombatEncounterState, id: string) {
  return state.tactical.battle.combatants.find((row) => row.id === id)!
}
function status(state: StatDrivenCombatEncounterState, id: string, statusId: string) {
  return state.statusState
    .find((row) => row.combatantId === id)!
    .statuses.find((row) => row.statusId === statusId && row.timingState !== 'pending')
}
function restore(state: StatDrivenCombatEncounterState) {
  const next: StatDrivenCombatEncounterState = JSON.parse(JSON.stringify(state))
  expect(validateStatDrivenCombatEncounterState(next)).toEqual([])
  return next
}
function end(state: StatDrivenCombatEncounterState) {
  const id = state.tactical.battle.currentTurn!.combatantId
  return restore(
    finishPv1fTurn(state, state.tactical.placements.find((row) => row.combatantId === id)!.facing)
      .state,
  )
}
function command(
  state: StatDrivenCombatEncounterState,
  actorId: string,
  abilityId: string,
  selection: CombatTargetSelection,
) {
  const source = state.capturedAbilitySources!.find(
    (row) => row.ownerCombatantId === actorId && row.abilityId === abilityId,
  )
  if (!source) throw new Error(`Unequipped command ${abilityId}`)
  return {
    state,
    actorId,
    root: { kind: 'canonical' as const, source },
    selection,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, source),
  }
}
function cast(input: ReturnType<typeof command>) {
  const before = JSON.stringify(input.state)
  const quote = prepareCombatAbilityCommand(input)
  expect(quote.evaluation.legal, JSON.stringify(quote.evaluation.issues)).toBe(true)
  const out = commitCombatAbilityCommand(input)
  expect(JSON.stringify(input.state)).toBe(before)
  return {
    ...out,
    state: restore(
      reattachStatDrivenCombatBridge(
        out.state,
        (out.state as Partial<StatDrivenCombatEncounterState>).statBridge ?? input.state.statBridge,
      ),
    ),
  }
}
async function concealed(
  scenario: (typeof cases)[number],
  opponentKit: typeof farstrider,
  seed: number,
) {
  const duel = await createLegalRosterDuel({ ...scenario, opponentKit, seed })
  const [actor, opponent] = duel.participants
  expect(actor!.committed.disciplineSkills).toHaveLength(4)
  expect(opponent!.committed.disciplineSkills).toHaveLength(4)
  let state = restore(duel.state)
  for (let turn = 0; state.tactical.battle.currentTurn!.combatantId !== actor!.actorId; turn++) {
    expect(turn).toBeLessThan(2)
    state = end(state)
  }
  const initial = state
  const initialMp = unit(state, actor!.actorId).mp
  const shield = cast(command(state, actor!.actorId, 'aetherist.mana-shield', { kind: 'self' }))
  state = shield.state
  expect(status(state, actor!.actorId, 'guarded')).toBeDefined()
  expect(currentBarrierAmount(state, actor!.actorId)).toBe(20)
  const conduit = cast(command(state, actor!.actorId, veiled, { kind: 'self' }))
  state = conduit.state
  expect(status(state, actor!.actorId, 'guarded')).toBeUndefined()
  expect(status(state, actor!.actorId, 'covert')).toBeDefined()
  expect(unit(state, actor!.actorId).mp).toBe(initialMp - 2)
  expect(readPv1fActionEconomy(state, actor!.actorId)!.current).toBe(30)
  const counterWindow = end(state)
  expect(counterWindow.tactical.battle.currentTurn!.combatantId).toBe(opponent!.actorId)
  expect(status(counterWindow, actor!.actorId, 'covert')).toBeDefined()
  return {
    actor: actor!,
    opponent: opponent!,
    state: counterWindow,
    setupStages: [
      { label: 'before-setup', state: initial },
      { label: 'mana-shield', state: shield.state, events: shield.events },
      { label: 'veiled-conduit', state: conduit.state, events: conduit.events },
      { label: 'opponent-turn', state: counterWindow },
    ],
  }
}

function recordCase(
  kind: string,
  scenario: (typeof cases)[number],
  seed: number,
  stages: readonly {
    label: string
    state: StatDrivenCombatEncounterState
    events?: readonly unknown[]
  }[],
) {
  const destination = process.env.AUREVANE_CONCEALMENT_COUNTER_EVIDENCE
  if (!destination) return
  appendFileSync(
    destination,
    JSON.stringify({
      kind,
      primary: scenario.kit.primary,
      level: scenario.level,
      context: scenario.context,
      seed,
      captures: stages[0]!.state.capturedAbilitySources!.map((source) => ({
        ownerId: source.ownerCombatantId,
        sourceKind: source.sourceKind,
        id: source.abilityId,
        contentVersion: source.contentVersion,
      })),
      stages: stages.map(({ label, state, events }) => ({
        label,
        round: state.tactical.battle.round,
        turnNumber: state.tactical.battle.turnNumber,
        actorId: state.tactical.battle.currentTurn?.combatantId,
        lifecycle: state.tactical.battle.lifecycle,
        combatants: state.tactical.battle.combatants.map((unit) => ({
          id: unit.id,
          hp: unit.hp,
          mp: unit.mp,
          ap: readPv1fActionEconomy(state, unit.id)?.current,
          barrier: currentBarrierAmount(state, unit.id),
          statuses: state.statusState.find((row) => row.combatantId === unit.id)!.statuses,
        })),
        events: events ?? [],
      })),
    }) + '\n',
  )
}

it.each(cases)(
  '$name pays for real Sensory removal of Veiled Conduit and its finite reveal',
  async (scenario) => {
    const { actor, opponent, state, setupStages } = await concealed(scenario, farstrider, 1)
    const hp = unit(state, actor.actorId).hp
    const mp = unit(state, opponent.actorId).mp
    const response = cast(
      command(state, opponent.actorId, 'farstrider.scouts-mark', {
        kind: 'unit',
        combatantId: actor.actorId,
      }),
    )
    expect(readPv1fActionEconomy(response.state, opponent.actorId)!.current).toBe(70)
    expect(unit(response.state, opponent.actorId).mp).toBe(mp - 2)
    expect(unit(response.state, actor.actorId).hp).toBe(hp)
    expect(
      status(response.state, actor.actorId, 'covert'),
      JSON.stringify(response.events),
    ).toBeUndefined()
    expect(
      status(response.state, actor.actorId, 'revealed'),
      JSON.stringify(response.events),
    ).toBeDefined()
    expect(response.events).toContainEqual(
      expect.objectContaining({
        event: 'status_removed',
        targetCombatantId: actor.actorId,
        statusId: 'covert',
      }),
    )
    expect(response.events).toContainEqual(
      expect.objectContaining({
        event: 'status_applied',
        targetCombatantId: actor.actorId,
        statusId: 'revealed',
      }),
    )
    const unchanged = JSON.stringify(response.state)
    const repeat = command(response.state, opponent.actorId, 'farstrider.scouts-mark', {
      kind: 'unit',
      combatantId: actor.actorId,
    })
    expect(prepareCombatAbilityCommand(repeat).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(repeat)).toThrow()
    expect(JSON.stringify(response.state)).toBe(unchanged)
    const revealedQuote = prepareCombatAbilityCommand(
      command(response.state, actor.actorId, 'shadehand.smoke-vial', { kind: 'self' }),
    )
    expect(revealedQuote.costs.find((row) => row.resource === 'ap')!.amount).toBe(70)
    const ownerTurn = end(response.state)
    expect(ownerTurn.tactical.battle.currentTurn!.combatantId).toBe(actor.actorId)
    expect(status(ownerTurn, actor.actorId, 'revealed')).toMatchObject({
      remainingOwnerTurnEnds: 1,
      timingState: 'active',
    })
    const mpBeforeSmoke = unit(ownerTurn, actor.actorId).mp
    const smoke = cast(command(ownerTurn, actor.actorId, 'shadehand.smoke-vial', { kind: 'self' }))
    expect(readPv1fActionEconomy(smoke.state, actor.actorId)!.current).toBe(30)
    expect(unit(smoke.state, actor.actorId).mp).toBe(mpBeforeSmoke)
    expect(status(smoke.state, actor.actorId, 'covert')).toBeUndefined()
    expect(status(smoke.state, actor.actorId, 'invisible')).toBeDefined()
    const expired = end(smoke.state)
    expect(status(expired, actor.actorId, 'revealed')).toBeUndefined()
    const after = prepareCombatAbilityCommand(
      command(expired, actor.actorId, 'shadehand.smoke-vial', { kind: 'self' }),
    )
    expect(after.costs.find((row) => row.resource === 'ap')!.amount).toBe(35)
    recordCase('sensory-hit', scenario, 1, [
      ...setupStages,
      { label: 'sensory', state: response.state, events: response.events },
      { label: 'revealed-owner-turn', state: ownerTurn },
      { label: 'paid-penalty-smoke', state: smoke.state, events: smoke.events },
      { label: 'revealed-expired', state: expired },
    ])
  },
)
it.each(cases)(
  '$name remains vulnerable to actual directional area pressure while Covert',
  async (scenario) => {
    const { actor, opponent, state, setupStages } = await concealed(scenario, cinderweaver, 1)
    const hp = unit(state, actor.actorId).hp
    const barrier = currentBarrierAmount(state, actor.actorId)
    const mp = unit(state, opponent.actorId).mp
    const response = cast(
      command(state, opponent.actorId, 'cinderweaver.ember-line', {
        kind: 'direction',
        direction: 'west',
      }),
    )
    expect(readPv1fActionEconomy(response.state, opponent.actorId)!.current).toBe(50)
    expect(unit(response.state, opponent.actorId).mp).toBe(mp - 6)
    const hpAfter = unit(response.state, actor.actorId).hp
    const barrierAfter = currentBarrierAmount(response.state, actor.actorId)
    const damage = response.events.filter(
      (event) => event.event === 'damage_applied' && event.targetCombatantId === actor.actorId,
    )
    const absorbed = response.events.filter(
      (event) => event.event === 'barrier_absorbed' && event.targetCombatantId === actor.actorId,
    )
    expect(damage).toHaveLength(1)
    expect(damage[0]).toMatchObject({
      actionId: 'cinderweaver.ember-line',
      hpBefore: hp,
      hpAfter,
      amount: hp - hpAfter,
    })
    expect(absorbed).toHaveLength(1)
    expect(absorbed[0]).toMatchObject({
      actionId: 'cinderweaver.ember-line',
      before: barrier,
      after: barrierAfter,
      amount: barrier - barrierAfter,
    })
    expect(hp - hpAfter).toBeGreaterThan(0)
    expect(barrier - barrierAfter).toBeGreaterThan(0)
    expect(status(response.state, actor.actorId, 'covert')).toBeDefined()
    expect(response.state.tactical.battle.lifecycle).toBe('active')
    recordCase('area-hit', scenario, 1, [
      ...setupStages,
      { label: 'ember-line', state: response.state, events: response.events },
    ])
  },
)
it.each(cases)(
  '$name pays for a real missed Sensory without stripping concealment',
  async (scenario) => {
    const { actor, opponent, state, setupStages } = await concealed(scenario, farstrider, 27)
    const hp = unit(state, actor.actorId).hp
    const mp = unit(state, opponent.actorId).mp
    const response = cast(
      command(state, opponent.actorId, 'farstrider.scouts-mark', {
        kind: 'unit',
        combatantId: actor.actorId,
      }),
    )
    expect(response.events).toContainEqual(
      expect.objectContaining({
        event: 'combat_accuracy_resolved',
        actionId: 'farstrider.scouts-mark',
        sourceCombatantId: opponent.actorId,
        targetCombatantId: actor.actorId,
        hit: false,
      }),
    )
    expect(readPv1fActionEconomy(response.state, opponent.actorId)!.current).toBe(70)
    expect(unit(response.state, opponent.actorId).mp).toBe(mp - 2)
    expect(unit(response.state, actor.actorId).hp).toBe(hp)
    expect(
      status(response.state, actor.actorId, 'covert'),
      JSON.stringify(response.events),
    ).toBeDefined()
    expect(
      status(response.state, actor.actorId, 'revealed'),
      JSON.stringify(response.events),
    ).toBeUndefined()
    expect(response.events).not.toContainEqual(
      expect.objectContaining({
        event: 'status_removed',
        targetCombatantId: actor.actorId,
        statusId: 'covert',
      }),
    )
    expect(response.events).not.toContainEqual(
      expect.objectContaining({
        event: 'status_applied',
        targetCombatantId: actor.actorId,
        statusId: 'revealed',
      }),
    )
    recordCase('sensory-miss', scenario, 27, [
      ...setupStages,
      { label: 'sensory-miss', state: response.state, events: response.events },
    ])
  },
)
