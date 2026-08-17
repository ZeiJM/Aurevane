import { describe, expect, it } from 'vitest'

import { createPendingBattle, startBattle } from './battle-state'
import {
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  createTacticalBattleState,
  type CombatTile,
} from './board'
import {
  P2_3_COMBAT_CONTENT,
  createCombatEncounterState,
  evaluateCombatAction,
  type CombatActionDefinition,
} from './actions'

const validSelfAction: CombatActionDefinition = {
  id: 'test.schema-probe',
  version: 1,
  sourceType: 'test',
  tags: ['test'],
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
  cost: { spendsAction: true, mp: 0 },
  requirements: [],
  effects: [],
}

function createEncounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'p2-3-schema-hardening',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 0x2468ace1,
      combatants: [
        {
          id: 'wayfarer',
          teamId: 'players',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 5,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 30,
          maxMp: 30,
        },
      ],
    }),
  ).state

  const tiles: CombatTile[] = [
    { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
    { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
  ]

  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 2,
      height: 1,
      terrains: P2_2_VERTICAL_SLICE_TERRAINS,
      tiles,
      movementProfiles: [P2_2_ORDINARY_GROUND_PROFILE],
      placements: [
        {
          combatantId: 'wayfarer',
          position: { x: 0, y: 0 },
          facing: 'east',
          movementProfileId: 'ordinary-ground',
        },
        {
          combatantId: 'recruit',
          position: { x: 1, y: 0 },
          facing: 'west',
          movementProfileId: 'ordinary-ground',
        },
      ],
    }),
  )
}

function evaluate(action: CombatActionDefinition) {
  return evaluateCombatAction(createEncounter(), action, { kind: 'self' }, P2_3_COMBAT_CONTENT)
}

describe('P2.3 runtime action-definition hardening', () => {
  it.each([
    {
      name: 'unknown action source type',
      action: { ...validSelfAction, sourceType: 'remote-script' },
      message: 'action source type',
    },
    {
      name: 'unknown target kind',
      action: {
        ...validSelfAction,
        target: { ...validSelfAction.target, kind: 'cone' },
      },
      message: 'target kind',
    },
    {
      name: 'unknown team policy',
      action: {
        ...validSelfAction,
        target: { ...validSelfAction.target, teamPolicy: 'neutral' },
      },
      message: 'target team policy',
    },
    {
      name: 'unknown friendly-fire policy',
      action: {
        ...validSelfAction,
        target: { ...validSelfAction.target, friendlyFire: 'nearest-only' },
      },
      message: 'friendly-fire policy',
    },
    {
      name: 'unknown shape kind',
      action: {
        ...validSelfAction,
        target: { ...validSelfAction.target, shape: { kind: 'cone', length: 2 } },
      },
      message: 'target shape kind',
    },
    {
      name: 'non-boolean action cost',
      action: {
        ...validSelfAction,
        cost: { ...validSelfAction.cost, spendsAction: 0 },
      },
      message: 'spendsAction',
    },
    {
      name: 'non-boolean line-of-sight flag',
      action: {
        ...validSelfAction,
        target: { ...validSelfAction.target, requiresLineOfSight: 1 },
      },
      message: 'requiresLineOfSight',
    },
    {
      name: 'unknown requirement kind',
      action: {
        ...validSelfAction,
        requirements: [{ kind: 'client-approved' }],
      },
      message: 'requirement kind',
    },
    {
      name: 'unknown effect type',
      action: {
        ...validSelfAction,
        effects: [{ type: 'script', recipient: 'actor' }],
      },
      message: 'effect type',
    },
    {
      name: 'unknown effect recipient',
      action: {
        ...validSelfAction,
        effects: [{ type: 'healing', recipient: 'nearest', amount: 1 }],
      },
      message: 'effect recipient',
    },
  ])('rejects $name instead of falling through to another rule', ({ action, message }) => {
    expect(() => evaluate(action as unknown as CombatActionDefinition)).toThrow(message)
  })
})
