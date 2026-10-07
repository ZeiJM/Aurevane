import { describe, expect, it } from 'vitest'
import {
  executeCombatAction,
  evaluateCombatAction,
  endCombatTurn,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatResolutionEvent,
} from './actions'
import { createCombatGroundArea } from './combat-ground-areas'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { selectCurrentFinalFacing } from './board'
import {
  createPv1fTemporaryResources,
  evaluatePv1fMovement,
  executePv1fMovement,
  readPv1fActionEconomy,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'
import { resolveMatureSkillVersion, toCombatActionDefinition } from './mature-skills'
import { applyCurrentBurnState, applyCurrentPoisonState } from './combat-dots'
import { grantBarrier } from './combat-barrier'

const content = PV1F_COMBAT_CONTENT
function encounter(): StatDrivenCombatEncounterState {
  const base = percentageDotEncounter()
  return {
    ...base,
    groundEffectPolicyVersion: 1,
    dotTriggerPolicyVersion: 1,
    effectTimingPolicy: {
      version: 1,
      modes: {
        'ground-area': 'instant',
        burn: 'instant',
        poison: 'instant',
        root: 'instant',
        'return-to-turn-start': 'instant',
        displace: 'instant',
      },
    },
    tactical: {
      ...base.tactical,
      battle: {
        ...base.tactical.battle,
        combatants: base.tactical.battle.combatants.map((unit) => ({
          ...unit,
          temporaryResources: createPv1fTemporaryResources(4),
        })),
      },
      placements: base.tactical.placements.map((row) =>
        row.combatantId === 'actor'
          ? row
          : {
              ...row,
              position: {
                x: 4,
                y: row.combatantId === 'enemy' ? 3 : row.combatantId === 'other' ? 2 : 1,
              },
            },
      ),
    },
  }
}
function groundAction(
  amount = 23,
  extra: CombatActionDefinition['effects'] = [],
): CombatActionDefinition {
  return {
    id: 'test.persistent-ground',
    version: 1,
    sourceType: 'discipline-skill',
    tags: ['attack'],
    target: {
      kind: 'ground-tile',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 5,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'affected-units', amount, element: 'fire' }, ...extra],
    groundArea: {
      durationRounds: 3,
      visualPresetId: 'embers',
      entryEffectOrdinals: [0, ...extra.map((_, i) => i + 1)],
      timing: 'instant',
    },
  }
}
function seedArea(state = encounter(), position = { x: 2, y: 1 }, action = groundAction()) {
  return createCombatGroundArea(
    state,
    'enemy',
    action,
    [position],
    content,
  ) as StatDrivenCombatEncounterState
}
function hp(state: CombatEncounterState, id = 'actor') {
  return state.tactical.battle.combatants.find((row) => row.id === id)!.hp
}
function groundDamage(events: readonly unknown[]) {
  return (events as readonly CombatResolutionEvent[]).filter(
    (event) => event.event === 'damage_applied' && event.actionId.startsWith('ground.pulse.'),
  )
}
function move(state: StatDrivenCombatEncounterState, path: readonly { x: number; y: number }[]) {
  return executePv1fMovement(state, path)
}
function endTurn(state: CombatEncounterState) {
  return endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    content,
  ).state as StatDrivenCombatEncounterState
}
function nextActor(state: CombatEncounterState) {
  let next = endTurn(state)
  while (next.tactical.battle.currentTurn?.combatantId !== 'actor') next = endTurn(next)
  return next
}

describe('canonical persistent Ground cast and entry', () => {
  it('creates exactly one authored footprint on an empty cast without changing previews', () => {
    const state = encounter()
    const action = toCombatActionDefinition(
      resolveMatureSkillVersion('cinderweaver.flame-burst')!,
      'pve',
    )
    const before = JSON.stringify(state)
    const forecast = evaluateCombatAction(state, action, { kind: 'activate' }, content)
    expect(forecast.legal).toBe(true)
    expect(JSON.stringify(state)).toBe(before)
    const cast = executeCombatAction(state, action, { kind: 'activate' }, content)
    expect(cast.state.groundAreas).toHaveLength(1)
    expect(cast.state.groundAreas![0]!.tiles).toEqual(forecast.affectedTiles)
    expect(cast.state.groundAreas![0]!.tiles).toHaveLength(8)
    expect(cast.state.groundAreas![0]!.tiles).not.toContainEqual({ x: 1, y: 1 })
  })
  it('hits a cast occupant once and reserves its Instant area allowance for that cycle', () => {
    const state = encounter()
    const action = {
      ...groundAction(),
      target: {
        ...groundAction().target,
        teamPolicy: 'ally' as const,
        friendlyFire: 'allies-only' as const,
      },
      effects: [{ type: 'healing' as const, recipient: 'affected-units' as const, amount: 23 }],
    }
    state.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp = 500
    const cast = executeCombatAction(
      state,
      action,
      { kind: 'tile', position: { x: 1, y: 1 } },
      content,
    )
    expect(hp(cast.state)).toBe(523)
    expect(cast.state.groundAreas).toHaveLength(1)
    const left = move(cast.state as StatDrivenCombatEncounterState, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
    const back = move(left.state, [
      { x: 2, y: 1 },
      { x: 1, y: 1 },
    ])
    expect(hp(back.state)).toBe(523)
  })
  it('resolves the tile actually crossed, preserves other path tiles and does not reroll damage', () => {
    const initial = seedArea()
    const before = JSON.stringify(initial)
    const preview = evaluatePv1fMovement(initial, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
    expect(preview.movement.legal).toBe(true)
    expect(JSON.stringify(initial)).toBe(before)
    const result = move(initial, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
    expect(hp(result.state)).toBe(977)
    expect(groundDamage(result.events)).toHaveLength(1)
    expect(
      result.state.tactical.placements.find((row) => row.combatantId === 'actor')!.position,
    ).toEqual({ x: 3, y: 1 })
    expect(result.state.tactical.battle.rng).toEqual(initial.tactical.battle.rng)
    expect(readPv1fActionEconomy(result.state)?.current).toBe(
      readPv1fActionEconomy(initial)?.current! - preview.economyCost,
    )
  })
  it('caps re-entry and grants a new allowance only at the recipient’s next turn', () => {
    const first = move(seedArea(), [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
    const back = move(first.state, [
      { x: 3, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
    ])
    expect(hp(back.state)).toBe(977)
    expect(groundDamage(back.events)).toHaveLength(0)
    const next = move(nextActor(back.state), [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
    expect(hp(next.state)).toBe(954)
  })
  it('keeps distinct overlapping casts independent and honors saved source values after defeat', () => {
    const first = seedArea()
    const overlapping = seedArea(first)
    overlapping.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp = 0
    overlapping.tactical.placements.find((row) => row.combatantId === 'enemy')!.position = {
      x: 0,
      y: 4,
    }
    const result = move(overlapping, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
    expect(hp(result.state)).toBe(954)
    expect(hp(result.state, 'enemy')).toBe(0)
    expect(groundDamage(result.events)).toHaveLength(2)
  })
  it('binds a percentage DoT to its own pulse damage even after the source has died', () => {
    const state = seedArea(
      encounter(),
      { x: 2, y: 1 },
      groundAction(23, [
        {
          type: 'burn',
          recipient: 'affected-units',
          durationTurns: 3,
          damageProfile: {
            kind: 'attack-percentage',
            basisPoints: 2000,
            decayBasisPointsPerTick: 500,
          },
        },
      ]),
    )
    state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp = 0
    const result = move(state, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
    expect(
      result.state.effectState!.burn.find((row) => row.targetCombatantId === 'actor'),
    ).toMatchObject({
      remainingTicks: 3,
      percentageDamage: { capturedDamage: 23 },
      skipCurrentOwnerTurnEnd: true,
    })
    expect(
      result.state.pendingEffects?.filter((row) => row.actionId.startsWith('ground.pulse.')) ?? [],
    ).toHaveLength(0)
  })
  it('does not replace a percentage DoT when a Barrier absorbs all pulse damage', () => {
    let state = seedArea(
      encounter(),
      { x: 2, y: 1 },
      groundAction(23, [
        {
          type: 'burn',
          recipient: 'affected-units',
          durationTurns: 3,
          damageProfile: {
            kind: 'attack-percentage',
            basisPoints: 2000,
            decayBasisPointsPerTick: 500,
          },
        },
      ]),
    )
    state = applyCurrentBurnState(state, 'enemy', 'actor', 'old.burn', true, undefined, 3, {
      capturedDamage: 40,
      profile: { kind: 'attack-percentage', basisPoints: 2000, decayBasisPointsPerTick: 500 },
    }) as StatDrivenCombatEncounterState
    state = grantBarrier(state, 'actor', 'actor', 'test.barrier', 100)
      .state as StatDrivenCombatEncounterState
    const result = move(state, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
    expect(hp(result.state)).toBe(1000)
    expect(groundDamage(result.events)).toHaveLength(1)
    expect(result.state.effectState!.burn[0]!.percentageDamage!.capturedDamage).toBe(40)
  })
  it('stops at a lethal entry tile and clears future areas at the terminal verdict', () => {
    const state = seedArea()
    state.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp = 10
    state.tactical.battle.combatants.find((row) => row.id === 'ally')!.hp = 0
    const result = move(state, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
    expect(hp(result.state)).toBe(0)
    expect(
      result.state.tactical.placements.find((row) => row.combatantId === 'actor')!.position,
    ).toEqual({ x: 2, y: 1 })
    expect(result.state.tactical.battle.lifecycle).toBe('completed')
    expect(result.state.groundAreas).toEqual([])
    expect(
      result.events.filter((event) => (event as { event: string }).event === 'battle_completed'),
    ).toHaveLength(1)
  })
  it('applies Root on the entered tile and stops the remaining path', () => {
    const state = seedArea(
      encounter(),
      { x: 2, y: 1 },
      groundAction(1, [
        {
          type: 'apply-status',
          recipient: 'affected-units',
          statusId: 'root',
          stacks: 1,
          durationTurns: 2,
        },
      ]),
    )
    const result = move(state, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
    expect(
      result.state.tactical.placements.find((row) => row.combatantId === 'actor')!.position,
    ).toEqual({ x: 2, y: 1 })
    expect(
      result.state.statusState
        .find((row) => row.combatantId === 'actor')!
        .statuses.some((row) => row.statusId === 'root'),
    ).toBe(true)
  })
  it('checks only a teleport landing without counting a Poison traversal', () => {
    const state = seedArea(encounter(), { x: 1, y: 1 })
    state.tactical.placements.find((row) => row.combatantId === 'actor')!.position = { x: 3, y: 1 }
    state.turnOrigin = {
      combatantId: 'actor',
      turnNumber: state.tactical.battle.turnNumber,
      position: { x: 1, y: 1 },
    }
    const action: CombatActionDefinition = {
      id: 'test.rewind',
      version: 1,
      sourceType: 'discipline-skill',
      tags: [],
      target: {
        kind: 'self',
        teamPolicy: 'self',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 0,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        friendlyFire: 'allies-only',
      },
      cost: { spendsAction: false, mp: 0 },
      requirements: [],
      effects: [{ type: 'return-to-turn-start', recipient: 'actor' }],
    }
    const result = executeCombatAction(state, action, { kind: 'self' }, content)
    expect(hp(result.state)).toBe(977)
    expect(groundDamage(result.events)).toHaveLength(1)
  })
  it('checks Push and Pull at each tile and caps later displacement in the same cycle', () => {
    const initial = encounter()
    initial.tactical.placements.find((row) => row.combatantId === 'enemy')!.position = {
      x: 2,
      y: 1,
    }
    let state = createCombatGroundArea(
      initial,
      'actor',
      groundAction(),
      [
        { x: 3, y: 1 },
        { x: 4, y: 1 },
      ],
      content,
    ) as StatDrivenCombatEncounterState
    // Clear the far landing so Push may cross both affected tiles.
    state.tactical.placements.find((row) => row.combatantId === 'ally')!.position = { x: 0, y: 0 }
    const push: CombatActionDefinition = {
      ...groundAction(),
      id: 'test.push',
      groundArea: undefined,
      target: { ...groundAction().target, kind: 'unit' },
      effects: [{ type: 'displace', recipient: 'primary-unit', direction: 'push', distance: 2 }],
    }
    const pushed = executeCombatAction(state, push, { kind: 'unit', combatantId: 'enemy' }, content)
    expect(hp(pushed.state, 'enemy')).toBe(977)
    expect(groundDamage(pushed.events)).toHaveLength(1)
    expect(
      pushed.state.tactical.placements.find((row) => row.combatantId === 'enemy')!.position,
    ).toEqual({ x: 4, y: 1 })
    const pulled = executeCombatAction(
      pushed.state,
      {
        ...push,
        id: 'test.pull',
        effects: [{ type: 'displace', recipient: 'primary-unit', direction: 'pull', distance: 2 }],
      },
      { kind: 'unit', combatantId: 'enemy' },
      content,
    )
    expect(hp(pulled.state, 'enemy')).toBe(977)
    expect(groundDamage(pulled.events)).toHaveLength(0)
  })
  it('retains saved caster Damage Up while using the entrant’s current Guard', () => {
    const initial = encounter()
    const status = (id: string) => ({
      statusId: id,
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 3,
      sourceCombatantId: 'enemy',
    })
    initial.statusState.find((row) => row.combatantId === 'enemy')!.statuses = [status('inspired')]
    const state = seedArea(initial, undefined, groundAction(100))
    state.statusState.find((row) => row.combatantId === 'enemy')!.statuses = []
    state.statusState.find((row) => row.combatantId === 'actor')!.statuses = [status('guarded')]
    const result = move(state, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
    expect(hp(result.state)).toBe(907)
  })
  it('activates next round, persists through reload and expires at its exact boundary', () => {
    const state = seedArea(encounter(), undefined, {
      ...groundAction(),
      groundArea: { ...groundAction().groundArea!, timing: 'next-round', durationRounds: 2 },
    })
    const first = move(state, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
    expect(hp(first.state)).toBe(1000)
    let next = nextActor(JSON.parse(JSON.stringify(first.state)))
    const entered = move(next, [
      { x: 3, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
    ])
    expect(hp(entered.state)).toBe(977)
    next = nextActor(entered.state)
    expect(next.groundAreas).toHaveLength(1)
    next = nextActor(next)
    expect(next.groundAreas).toEqual([])
  })
  it('teleport does not advance Poison’s traversed-tile counter', () => {
    let state = seedArea(encounter(), { x: 1, y: 1 })
    state = applyCurrentPoisonState(state, 'enemy', 'actor', 'test.poison', true, undefined, 3, {
      capturedDamage: 100,
      profile: { kind: 'attack-percentage', basisPoints: 2000 },
    }) as StatDrivenCombatEncounterState
    state.tactical.placements.find((row) => row.combatantId === 'actor')!.position = { x: 3, y: 1 }
    state.turnOrigin = {
      combatantId: 'actor',
      turnNumber: state.tactical.battle.turnNumber,
      position: { x: 1, y: 1 },
    }
    const action: CombatActionDefinition = {
      ...groundAction(),
      id: 'test.rewind.poison',
      groundArea: undefined,
      target: {
        ...groundAction().target,
        kind: 'self',
        teamPolicy: 'self',
        friendlyFire: 'allies-only',
        maximumRange: 0,
      },
      effects: [{ type: 'return-to-turn-start', recipient: 'actor' }],
    }
    const result = executeCombatAction(state, action, { kind: 'self' }, content)
    expect(hp(result.state)).toBe(977)
    expect(result.state.effectState!.poison[0]!.movementRemainder).toBe(0)
  })
  it('rolls ordinary resistance once on committed entry and never spends RNG in a preview', () => {
    const base = encounter()
    base.statBalancePolicyVersion = 1
    base.statBridge.rulesVersion = 4
    base.statBridge.combatants = base.statBridge.combatants.map((row) => ({
      ...row,
      statusResistance: 1500,
      criticalChance: 0,
      level: 50,
    }))
    base.tactical.placements.find((row) => row.combatantId === 'enemy')!.position = { x: 2, y: 1 }
    base.tactical.placements.find((row) => row.combatantId === 'ally')!.position = { x: 0, y: 0 }
    const ground = groundAction(1, [
      {
        type: 'apply-status',
        recipient: 'affected-units',
        statusId: 'root',
        stacks: 1,
        durationTurns: 2,
      },
    ])
    const state = createCombatGroundArea(base, 'actor', ground, [{ x: 3, y: 1 }], content)
    const push: CombatActionDefinition = {
      ...ground,
      id: 'test.push.resistance',
      groundArea: undefined,
      target: { ...ground.target, kind: 'unit' },
      effects: [{ type: 'displace', recipient: 'primary-unit', direction: 'push', distance: 1 }],
    }
    const before = JSON.stringify(state)
    evaluateCombatAction(state, push, { kind: 'unit', combatantId: 'enemy' }, content)
    expect(JSON.stringify(state)).toBe(before)
    const result = executeCombatAction(state, push, { kind: 'unit', combatantId: 'enemy' }, content)
    expect(
      result.events.filter((event) => event.event === 'combat_status_resistance_resolved'),
    ).toHaveLength(1)
    expect(
      result.events.filter(
        (event) =>
          event.event === 'combat_accuracy_resolved' || event.event === 'combat_critical_resolved',
      ),
    ).toHaveLength(0)
    expect(result.state.tactical.battle.rng.draws).toBe(state.tactical.battle.rng.draws + 1)
  })
})
