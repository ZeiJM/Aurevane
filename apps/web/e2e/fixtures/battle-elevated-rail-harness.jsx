import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { createStatBalancedCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { projectBattleStatusStateForViewer } from '@/server/battle/battle-live-viewer-projection'
import {
  createSpectatorBattleViewerEntitlement,
  deriveParticipantBattleViewerEntitlement,
} from '@/server/battle/battle-viewer-entitlement'
import { BattleCombatantEffects } from '@/components/battle/battle-combatant-effects'
import { terrainAdjustedBattleProfile } from '@/lib/battle/battle-elevation-stats'
import './production-styles'

function encounter(height, covert) {
  const units = ['player', 'ally', 'enemy'].map((id, index) => ({
    id,
    teamId: index < 2 ? 'friendly' : 'opposing',
    initiative: 30 - index,
    baseMovementBudget: 4,
    hp: 100,
    maxHp: 100,
    mp: 20,
    maxMp: 20,
  }))
  const battle = startBattle(
    createPendingBattle({
      battleId: 'elevated-rail',
      rulesVersion: 4,
      contentVersion: 4,
      rngSeed: 42,
      combatants: units,
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 3,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: [0, 1, 2].map((x) => ({
      position: { x, y: 0 },
      elevation: x === 1 ? height : 0,
      terrainId: 'open',
    })),
    movementProfiles: [{ id: 'ground', maxElevationStep: 3, terrainCostOverrides: [] }],
    placements: units.map((unit, x) => ({
      combatantId: unit.id,
      position: { x, y: 0 },
      facing: 'east',
      movementProfileId: 'ground',
    })),
  })
  return createStatBalancedCombatEncounterState(
    createCombatEncounterState(
      tactical,
      units.map((unit) => ({
        combatantId: unit.id,
        statuses:
          unit.id === 'ally' && covert
            ? [
                {
                  statusId: 'covert',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'ally',
                },
              ]
            : [],
      })),
    ),
    units.map((unit) => ({
      combatantId: unit.id,
      provenance: { kind: 'scenario', sourceId: `scenario:${unit.id}`, sourceRulesVersion: 4 },
      accuracy: 10000,
      evasion: 400,
      armor: 31,
      ward: 22,
      jump: 3,
      physicalPower: 120,
      mysticPower: 120,
      level: 1,
      criticalChance: 1500,
      statusResistance: 1000,
    })),
  )
}

function ElevatedRail() {
  const [height, setHeight] = useState(1)
  const [covert, setCovert] = useState(false)
  const [mode, setMode] = useState('PvE')
  useEffect(() => {
    window.elevatedRail = { setHeight, setCovert, setMode }
  }, [])
  const state = encounter(height, covert)
  const viewer =
    mode === 'Spectator'
      ? createSpectatorBattleViewerEntitlement()
      : deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
          mode === 'Opponent' ? 'enemy' : mode === 'Self' ? 'ally' : 'player',
        ])
  const statuses = projectBattleStatusStateForViewer(state, viewer).find(
    (row) => row.combatantId === 'ally',
  ).statuses
  const profile = terrainAdjustedBattleProfile(
    state,
    'ally',
    state.statBridge.combatants.find((row) => row.combatantId === 'ally'),
    statuses,
  )
  useEffect(() => {
    window.elevatedRailProjection = statuses
  }, [statuses])
  return (
    <main style={{ padding: 16, maxWidth: 350, color: '#f0e8dc', background: '#0a202b' }}>
      <h1>Elevated rail regression</h1>
      <output
        data-fixture-height={height}
        data-fixture-mode={mode}
        data-fixture-covert={String(covert)}
      >
        {mode} · Height {height}
      </output>
      <section aria-label="Effective terrain stats">
        <dl>
          <dt>Evasion</dt>
          <dd data-stat="evasion">{profile.evasion / 100}%</dd>
          <dt>Physical Defense</dt>
          <dd data-stat="physical">{profile.armor}</dd>
          <dt>Mystic Defense</dt>
          <dd data-stat="mystic">{profile.ward}</dd>
        </dl>
      </section>
      <BattleCombatantEffects name="Archer" compact statuses={statuses} />
    </main>
  )
}
createRoot(document.getElementById('root')).render(<ElevatedRail />)
