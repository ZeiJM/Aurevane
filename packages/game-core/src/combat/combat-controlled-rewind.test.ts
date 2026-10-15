import {
  issueCommittedCombatExecution,
  consumeCommittedCombatExecution,
} from './combat-committed-execution'
import { expect, it } from 'vitest'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  createStatBalancedCombatEncounterState,
  reattachStatDrivenCombatBridge,
} from './stat-driven-combat'
import {
  preparePv1fTurnEconomy,
  executePv1fMovement,
  finishPv1fTurn,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import {
  primeCombatControlledAbility,
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { validateCombatAbilityState } from './combat-ability-state'
import type { CombatEncounterState } from './actions'

function setup(delayed = false, conditional = false) {
  const base = percentageDotEncounter()
  const balanced = preparePv1fTurnEconomy(
    createStatBalancedCombatEncounterState(
      base,
      base.statBridge.combatants.map((profile) => ({
        ...profile,
        physicalPower: profile.physicalPower!,
        mysticPower: profile.mysticPower!,
        level: 50,
        criticalChance: 0,
        statusResistance: 0,
      })),
    ),
  )
  const captured = captureCombatAbilitySource({
    ...source({
      classification: 'utility',
      attackFamily: undefined,
      targeting: {
        kind: 'self',
        teamPolicy: 'self',
        friendlyFire: 'allies-only',
        minimumRange: 0,
        maximumRange: 0,
        maximumSelections: 1,
        maximumElevationDifference: null,
        requiresLineOfSight: false,
        shape: { kind: 'single' },
      },
      effects: [
        ...(delayed
          ? [
              {
                id: 'prime-gate',
                timing: 'controlled' as const,
                payload: { type: 'healing' as const, recipient: 'actor' as const, amount: 1 },
              },
            ]
          : []),
        {
          id: 'rewind',
          ...(conditional
            ? {
                requirements: {
                  kind: 'resource-state' as const,
                  subject: 'owner' as const,
                  resource: 'mp' as const,
                  comparison: 'at-least' as const,
                  amount: 999999,
                },
              }
            : {}),
          timing: delayed ? 'delayed' : 'controlled',
          payload: {
            type: 'return-to-turn-start',
            recipient: 'actor',
            anchorMode: 'cast-position',
          },
        },
      ],
    }),
    tags: [],
    abilityId: 'chronist.controlled-rewind',
  })
  const admitted = reconcileCombatAbilitySources(balanced, [captured])
  const moved = executePv1fMovement(reattachStatDrivenCombatBridge(admitted, balanced.statBridge), [
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ]).state
  const primed = primeCombatControlledAbility({
    state: moved,
    actorId: 'actor',
    sourceInstanceId: captured.sourceInstanceId,
    behaviorId: 'strike',
  }).state
  const state = executePv1fMovement(reattachStatDrivenCombatBridge(primed, balanced.statBridge), [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ]).state
  return { state, primed, captured, bridge: balanced.statBridge }
}

function command(state: CombatEncounterState, captured: ReturnType<typeof setup>['captured']) {
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'self' as const },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
}
const position = (state: CombatEncounterState) =>
  state.tactical.placements.find((row) => row.combatantId === 'actor')!.position

it('rewind_prime_anchor is the prime tile, preserving turn history, spent Movement and one activation cost', () => {
  const { state, primed, captured } = setup()
  expect(primed.abilityRuntime!.controlled!.primes[0]!.returnAnchor).toEqual({ x: 1, y: 0 })
  expect(position(state)).toEqual({ x: 2, y: 0 })
  const before = state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!
  const quoted = prepareCombatAbilityCommand(command(state, captured))
  expect(quoted.evaluation.legal).toBe(true)
  expect(quoted.evaluation.projectedEvents).toContainEqual(
    expect.objectContaining({ event: 'combatant_rewound', to: { x: 1, y: 0 } }),
  )
  const released = commitCombatAbilityCommand(command(state, captured))
  expect(position(released.state)).toEqual({ x: 1, y: 0 })
  expect(released.state.turnOrigin).toEqual(state.turnOrigin)
  expect(released.state.tactical.battle.currentTurn!.movementRemaining).toBe(
    state.tactical.battle.currentTurn!.movementRemaining,
  )
  const after = released.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!
  expect(after.hp).toBe(before.hp - 1)
  expect(after.mp).toBe(before.mp - 2)
  expect(after.temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current).toBe(
    before.temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current - 11,
  )
  expect(
    released.events.filter(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        'event' in event &&
        event.event === 'combat_action_used',
    ),
  ).toHaveLength(1)
  expect(released.state.pendingEffects ?? []).toEqual([])
  expect(validateCombatAbilityState(released.state)).toEqual([])
})

it('restored Rewind keeps its prime tile after another full round and a new turn origin', () => {
  const { state, captured, bridge } = setup()
  let next: CombatEncounterState = JSON.parse(JSON.stringify(state))
  expect(validateCombatAbilityState(next)).toEqual([])
  for (let index = 0; index < 4; index++)
    next = finishPv1fTurn(reattachStatDrivenCombatBridge(next, bridge), 'west').state
  expect(next.turnOrigin!.position).toEqual({ x: 2, y: 0 })
  const released = commitCombatAbilityCommand(command(next, captured))
  expect(position(released.state)).toEqual({ x: 1, y: 0 })
  expect(released.state.turnOrigin).toEqual(next.turnOrigin)
})

it.each(['occupied', 'impassable', 'elevation', 'root'] as const)(
  'a %s prime tile blocks release without consuming the prime or paying',
  (kind) => {
    const { state, captured } = setup()
    let blocked = state
    if (kind === 'occupied')
      blocked = {
        ...state,
        tactical: {
          ...state.tactical,
          placements: state.tactical.placements.map((p) =>
            p.combatantId === 'enemy' ? { ...p, position: { x: 1, y: 0 } } : p,
          ),
        },
      }
    if (kind === 'impassable')
      blocked = {
        ...state,
        tactical: {
          ...state.tactical,
          terrains: [...state.tactical.terrains, { id: 'sealed', traversalCost: null }],
          tiles: state.tactical.tiles.map((tile) =>
            tile.position.x === 1 && tile.position.y === 0
              ? { ...tile, terrainId: 'sealed' }
              : tile,
          ),
        },
      }
    if (kind === 'elevation')
      blocked = {
        ...state,
        tactical: {
          ...state.tactical,
          tiles: state.tactical.tiles.map((tile) =>
            tile.position.x === 1 && tile.position.y === 0 ? { ...tile, elevation: 2 } : tile,
          ),
        },
      }
    if (kind === 'root')
      blocked = {
        ...state,
        statusState: state.statusState.map((row) =>
          row.combatantId === 'actor'
            ? {
                ...row,
                statuses: [
                  ...row.statuses,
                  {
                    statusId: 'root',
                    statusVersion: 1,
                    stacks: 1,
                    remainingOwnerTurnStarts: 2,
                    sourceCombatantId: 'enemy',
                  },
                ],
              }
            : row,
        ),
      }
    const before = JSON.stringify(blocked)
    expect(prepareCombatAbilityCommand(command(blocked, captured)).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(command(blocked, captured))).toThrow()
    expect(JSON.stringify(blocked)).toBe(before)
    expect(blocked.abilityRuntime!.controlled!.primes).toHaveLength(1)
  },
)

it('mixed delayed Rewind snapshots the prime tile into actual pending work only after paid release', () => {
  const { state, captured, bridge } = setup(true)
  const released = commitCombatAbilityCommand(command(state, captured))
  expect(position(released.state)).toEqual({ x: 2, y: 0 })
  expect(released.state.pendingEffects).toMatchObject([
    { returnAnchor: { x: 1, y: 0 }, activationRound: state.tactical.battle.round + 2 },
  ])
  let next = released.state
  for (let index = 0; index < 8; index++)
    next = finishPv1fTurn(reattachStatDrivenCombatBridge(next, bridge), 'west').state
  expect(position(next)).toEqual({ x: 1, y: 0 })
  expect(next.pendingEffects ?? []).toEqual([])
})

it('private restore rejects missing, foreign and misplaced Rewind anchors', () => {
  const { state } = setup()
  for (const anchor of [undefined, { x: 100, y: 100 }, { x: 1, y: 0, hp: 999 }, { x: 1.5, y: 0 }]) {
    const saved = JSON.parse(JSON.stringify(state))
    saved.abilityRuntime.controlled.primes[0].returnAnchor = anchor
    expect(validateCombatAbilityState(saved)).toContainEqual(
      expect.objectContaining({ field: 'abilityRuntime.controlled' }),
    )
  }
})

it('a before-use Root interrupts paid Rewind without restoring the prime, position or costs', () => {
  const { state: initial, captured } = setup()
  const counter = captureCombatAbilitySource({
    ...source(
      {
        id: 'counter',
        activation: 'automatic',
        classification: 'utility',
        attackFamily: undefined,
        costs: [],
        activationLimits: ['once-per-action'],
        automaticTarget: { subject: 'owner' },
        requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
        targeting: captured.definition.behaviors[0]!.targeting,
        effects: [
          {
            id: 'root',
            payload: {
              type: 'apply-status',
              recipient: 'actor',
              statusId: 'root',
              stacks: 1,
              durationTurns: 2,
            },
          },
        ],
      },
      'root-counter',
    ),
    abilityId: 'test.root-counter',
  })
  const state = reconcileCombatAbilitySources(initial, [captured, counter])
  const released = commitCombatAbilityCommand(command(state, captured))
  expect(released.events).toContainEqual(
    expect.objectContaining({ event: 'combat_action_interrupted', reason: 'selection-invalid' }),
  )
  expect(released.events.filter((event) => event.event === 'ap_spent')).toMatchObject([
    { amount: 11 },
  ])
  expect(position(released.state)).toEqual(position(state))
  expect(released.state.abilityRuntime!.controlled!.primes).toEqual([])
  expect(released.state.abilityRuntime!.controlled!.used).toHaveLength(1)
  expect(released.state.pendingEffects ?? []).toEqual([])
})

it('an ineligible Rewind packet cannot block another eligible packet in a primed whole action', () => {
  const { state: initial, captured } = setup(true, true)
  const state = {
    ...initial,
    tactical: {
      ...initial.tactical,
      placements: initial.tactical.placements.map((p) =>
        p.combatantId === 'enemy' ? { ...p, position: { x: 1, y: 0 } } : p,
      ),
    },
  }
  const quoted = prepareCombatAbilityCommand(command(state, captured))
  expect(quoted.evaluation.legal).toBe(true)
  const released = commitCombatAbilityCommand(command(state, captured))
  expect(position(released.state)).toEqual(position(state))
  expect(released.state.pendingEffects ?? []).toEqual([])
  expect(released.state.abilityRuntime!.controlled!.primes).toEqual([])
})

it('the issued return anchor is detached from prime memory and only returned once after bound admission', () => {
  const { state, captured } = setup()
  const input = command(state, captured)
  const prepared = prepareCombatAbilityCommand(input)
  const anchor = { ...prepared.returnAnchor! }
  const token = issueCommittedCombatExecution(
    state,
    input.actorId,
    prepared.action,
    input.selection,
    prepared.context,
    true,
    undefined,
    anchor,
  )
  anchor.x = 0
  expect(JSON.stringify(token)).toBe('{}')
  expect(() =>
    consumeCommittedCombatExecution(
      token,
      state,
      { ...prepared.action, id: 'forged' },
      input.selection,
      prepared.context,
    ),
  ).toThrow('invalid-committed-execution-authority')
  expect(
    consumeCommittedCombatExecution(
      token,
      state,
      prepared.action,
      input.selection,
      prepared.context,
    ),
  ).toEqual({ x: 1, y: 0 })
  expect(() =>
    consumeCommittedCombatExecution(
      token,
      state,
      prepared.action,
      input.selection,
      prepared.context,
    ),
  ).toThrow('invalid-committed-execution-authority')
  const controlled = state.abilityRuntime!.controlled!
  expect(controlled.primes[0]!.returnAnchor).not.toBe(controlled.used[0]!.returnAnchor)
})

it('an occupied delayed landing consumes pending work without recovering its prime or refunding payment', () => {
  const { state, captured, bridge } = setup(true)
  const released = commitCombatAbilityCommand(command(state, captured))
  let next: CombatEncounterState = {
    ...released.state,
    tactical: {
      ...released.state.tactical,
      placements: released.state.tactical.placements.map((p) =>
        p.combatantId === 'enemy' ? { ...p, position: { x: 1, y: 0 } } : p,
      ),
    },
  }
  const events: unknown[] = []
  for (let index = 0; index < 8; index++) {
    const transition = finishPv1fTurn(reattachStatDrivenCombatBridge(next, bridge), 'west')
    events.push(...transition.events)
    next = transition.state
  }
  expect(events).toContainEqual(
    expect.objectContaining({ event: 'combatant_rewind_blocked', reason: 'occupied' }),
  )
  expect(position(next)).toEqual({ x: 2, y: 0 })
  expect(next.pendingEffects ?? []).toEqual([])
  expect(next.abilityRuntime!.controlled!.primes).toEqual([])
  expect(next.abilityRuntime!.controlled!.used).toHaveLength(1)
  expect(
    events.filter(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        'event' in event &&
        event.event === 'combat_action_used',
    ),
  ).toEqual([])
})
