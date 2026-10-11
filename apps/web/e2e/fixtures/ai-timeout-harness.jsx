import React from 'react'
import { createRoot } from 'react-dom/client'
import { AudioProvider } from '@/components/audio/audio-provider'
import { BattleClientBoundary } from '@/components/battle/battle-client-boundary'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createStatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { createPv1fTemporaryResources } from '@aurevane/game-core/combat/pv1f-action-economy'
import './production-styles'
import '@/app/lobby-mobile-final.css'
import '@/app/game/battle/battle-viewport.css'

const ids = ['character:player', 'recruit']
const pending = createPendingBattle({
  battleId: 'fixture',
  rulesVersion: 1,
  contentVersion: 1,
  rngSeed: 12,
  combatants: ids.map((id, index) => ({
    id,
    teamId: index ? 'opponents' : 'players',
    initiative: 20 - index,
    baseMovementBudget: 4,
    hp: 100,
    maxHp: 100,
    mp: 100,
    maxMp: 100,
    temporaryResources: createPv1fTemporaryResources(50),
  })),
})
const tactical = createTacticalBattleState({
  battle: startBattle(pending).state,
  width: 9,
  height: 7,
  terrains: [{ id: 'open-ground', traversalCost: 1 }],
  tiles: Array.from({ length: 63 }, (_, index) => ({
    position: { x: index % 9, y: Math.floor(index / 9) },
    terrainId: 'open-ground',
    elevation: 0,
  })),
  movementProfiles: ids.map((id) => ({ id, maxElevationStep: 1, terrainCostOverrides: [] })),
  placements: ids.map((id, index) => ({
    combatantId: id,
    position: { x: 3 + index, y: 3 },
    facing: index ? 'west' : 'east',
    movementProfileId: id,
  })),
})
const snapshot = createStatDrivenCombatEncounterState(
  createCombatEncounterState(tactical),
  ids.map((id, index) => ({
    combatantId: id,
    provenance: {
      kind: index ? 'scenario' : 'character-derived',
      sourceId: index ? 'scenario:recruit' : 'character:player',
      sourceRulesVersion: 1,
    },
    accuracy: 10000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
  })),
)
const initialBattle = {
  battleSessionId: 'fixture',
  battleVersion: 1,
  snapshot,
  replayed: false,
  invalidation: null,
}
const params = new URLSearchParams(location.search)
const mode = params.get('mode') || 'pve'
const participants = ids.map((id, index) => ({
  combatantId: id,
  characterId: id,
  characterName: index ? 'Recruit' : 'Zei',
  characterLevel: 1,
  portraitRef: 'portrait.adventure.male-01',
  profileImageUrl: index ? null : '/stability-avatar.gif',
  teamIndex: index,
  seatIndex: index,
}))
const runtime = {
  kind: mode,
  metadata: {
    lobbyId: 'fixture',
    mode: '1v1',
    battleKey: 'AVB-TEST-TEST',
    localCharacterId: ids[0],
    participants,
  },
  playerName: 'Zei',
  playerLevel: 1,
  playerPortraitAssetId: 'character.adventure.male-01',
  playerProfileImageUrl: '/stability-avatar.gif',
  supportActionId: 'basic.guard',
  techniques: [],
  essence: null,
  copiedSkills: [],
}
window.fixtureBattle = initialBattle
window.calls = []
window.clockResponse = null
window.snapshotFailures = 0
window.currentBattleVersion = 0
window.addEventListener('aurevane:battle-state', (event) => {
  window.currentBattleVersion = event.detail.battleVersion
})
window.fetch = async (url, options = {}) => {
  const path = String(url)
  window.calls.push({ path, method: options.method || 'GET' })
  if (path.endsWith('/turn-clock')) {
    const payload = JSON.stringify(
      window.clockResponse || {
        tick: {
          clock: {
            active: true,
            turnNumber: 1,
            combatantId: ids[0],
            deadlineAt: new Date(Date.now() + 60000).toISOString(),
            expired: false,
            turnTimerSeconds: 60,
          },
          battle: null,
          timedOut: false,
        },
      },
    )
    if (window.clockResponse) window.clockResponse.tick.timedOut = false
    return new Response(payload)
  }
  if (path.endsWith('/fixture')) {
    if (window.snapshotFailures-- > 0)
      return new Response(
        JSON.stringify({ error: { message: 'Snapshot temporarily unavailable' } }),
        { status: 503 },
      )
    return new Response(JSON.stringify({ battle: window.fixtureBattle }))
  }
  if (path.endsWith('/events')) return new Response(JSON.stringify({ battleLog: { entries: [] } }))
  if (path.endsWith('/preview')) return new Response(JSON.stringify({}))
  return new Response(JSON.stringify({}))
}
window.timeoutBattle = (options = {}) => {
  const next = structuredClone(initialBattle)
  next.battleVersion = options.version || 2
  next.snapshot.tactical.battle.turnNumber = 2
  next.snapshot.tactical.battle.combatants[0].hp = options.terminal ? 0 : 80
  if (options.terminal) {
    next.snapshot.tactical.battle.lifecycle = 'completed'
    next.snapshot.tactical.battle.currentTurn = null
  }
  window.fixtureBattle = next
  window.clockResponse = {
    tick: {
      clock: {
        active: !options.terminal,
        turnNumber: options.terminal ? null : 2,
        combatantId: options.terminal ? null : ids[0],
        deadlineAt: options.terminal ? null : new Date(Date.now() + 60000).toISOString(),
        expired: false,
        turnTimerSeconds: 60,
      },
      battle: options.missing ? null : next,
      timedOut: true,
    },
  }
  window.dispatchEvent(new Event('focus'))
}
createRoot(document.getElementById('root')).render(
  <AudioProvider>
    <BattleClientBoundary initialBattle={initialBattle} runtime={runtime} />
  </AudioProvider>,
)
