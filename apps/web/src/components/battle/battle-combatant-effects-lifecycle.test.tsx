import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatEncounterState,
} from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import {
  createTacticalBattleState,
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  selectCurrentFinalFacing,
} from '@aurevane/game-core/combat/board'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'

vi.mock('server-only', () => ({}))

import { projectBattleStatusStateForViewer } from '@/server/battle/battle-live-viewer-projection'
import { createSpectatorBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'
import { BattleCombatantEffects } from './battle-combatant-effects'

const content = { statuses: [] }

function encounter(): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:rail-effect-lifecycle',
      rulesVersion: 3,
      contentVersion: 2,
      rngSeed: 123,
      combatants: ['source', 'target'].map((id, index) => ({
        id,
        teamId: id,
        initiative: 2 - index,
        baseMovementBudget: 2,
        hp: 100,
        maxHp: 100,
        mp: 20,
        maxMp: 30,
      })),
    }),
  ).state
  return {
    ...createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 2,
        height: 1,
        tiles: [0, 1].map((x) => ({
          position: { x, y: 0 },
          elevation: 0,
          terrainId: 'open-ground',
        })),
        terrains: P2_2_VERTICAL_SLICE_TERRAINS,
        movementProfiles: [P2_2_ORDINARY_GROUND_PROFILE],
        placements: ['source', 'target'].map((combatantId, x) => ({
          combatantId,
          position: { x, y: 0 },
          facing: 'east' as const,
          movementProfileId: 'ordinary-ground',
        })),
      }),
    ),
    effectTimingPolicy: { version: 1, modes: {} },
  }
}

function cast(state: CombatEncounterState, effects: readonly CombatEffectDefinition[]) {
  const action: CombatActionDefinition = {
    id: 'test.rail-lifecycle',
    version: 1,
    sourceType: 'test',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 2,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects,
  }
  const result = executeCombatAction(
    state,
    action,
    { kind: 'unit', combatantId: 'target' },
    content,
  )
  return result.state
}

function end(state: CombatEncounterState) {
  return endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
    content,
  ).state
}

function rail(state: CombatEncounterState) {
  const statuses =
    projectBattleStatusStateForViewer(state, createSpectatorBattleViewerEntitlement()).find(
      (row) => row.combatantId === 'target',
    )?.statuses ?? []
  return renderToStaticMarkup(<BattleCombatantEffects compact name="Target" statuses={statuses} />)
}

describe('authoritative persistent effect rail lifecycle', () => {
  it('keeps finite typed Poison visible from pending activation through its final affected turn', () => {
    let state = cast(encounter(), [
      { type: 'poison', recipient: 'primary-unit', durationTurns: 2, power: 5 },
    ])
    expect(rail(state)).toContain('data-effect-timing="pending"')
    expect(rail(state)).toContain('>POI</i>')
    expect(rail(state)).toContain('data-effect-duration="true">2</small>')
    state = end(end(state))
    expect(state.tactical.battle.round).toBe(2)
    expect(state.effectState?.poison).toHaveLength(1)
    expect(
      state.statusState
        .flatMap((row) => row.statuses)
        .some((status) => status.statusId === 'poison'),
    ).toBe(false)
    expect(rail(state)).toContain('>POI</i>')
    expect(rail(state)).toContain('data-effect-timing="active"')
    expect(rail(state)).toContain(combatStatusDetails('poison').description)
    expect(rail(state)).toContain('2 turns remaining')
    state = end(end(state))
    expect(rail(state)).toContain('data-effect-duration="true">1</small>')
    state = end(end(state))
    expect(state.effectState?.poison).toHaveLength(0)
    expect(rail(state)).not.toContain('>POI</i>')
  })

  it('keeps untuned typed Poison visible without a fabricated expiry countdown', () => {
    let state = cast(encounter(), [{ type: 'poison', recipient: 'primary-unit' }])
    expect(rail(state)).toContain('Pending')
    expect(rail(state)).toContain('Until removed')
    expect(rail(state)).not.toContain('data-effect-duration="true"')
    state = end(end(state))
    expect(state.effectState?.poison).toHaveLength(1)
    expect(rail(state)).toContain('>POI</i>')
    expect(rail(state)).toContain('Active · Until removed')
    expect(rail(state)).not.toContain('data-effect-duration="true"')
  })

  it('keeps the real Barrier icon after activation and removes it when damage depletes the pool', () => {
    let state = cast(encounter(), [
      { type: 'barrier-change', recipient: 'primary-unit', amount: 10 },
    ])
    expect(rail(state)).toContain('data-effect-timing="pending"')
    expect(rail(state)).toContain('>BAR</i>')
    expect(rail(state)).toContain('Until depleted')
    expect(rail(state)).not.toContain('data-effect-duration="true"')
    state = end(end(state))
    expect(state.effectState?.barriers?.[0]?.amount).toBe(10)
    expect(rail(state)).toContain('data-effect-timing="active"')
    expect(rail(state)).toContain('>BAR</i>')
    expect(rail(state)).toContain('Until depleted')
    state = cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 20 }])
    expect(state.effectState?.barriers?.[0]?.amount ?? 0).toBe(0)
    expect(rail(state)).not.toContain('>BAR</i>')
  })
})
