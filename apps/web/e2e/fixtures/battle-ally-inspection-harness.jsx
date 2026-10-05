import React from 'react'
import { createRoot } from 'react-dom/client'
import { BattleExperience } from '@/components/battle/battle-experience'
import { PvpSpectatorExperience } from '@/components/battle/pvp-spectator-experience'
import { DesktopBattleCombatantInspect } from '@/components/battle/desktop-battle-combatant-inspect'
import { MobileBattleCombatantPopup } from '@/components/battle/mobile-battle-combatant-popup'
import { BattleInteractionLifecycleProvider } from '@/components/battle/battle-interaction-lifecycle'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createStatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { createPv1fTemporaryResources } from '@aurevane/game-core/combat/pv1f-action-economy'
import './production-styles'

const ids = ['character:player', 'ally', 'enemy-one', 'enemy-two']
const positions = [
  { x: 3, y: 3 },
  { x: 3, y: 4 },
  { x: 4, y: 3 },
  { x: 2, y: 3 },
]
const pending = createPendingBattle({
  battleId: 'fixture',
  rulesVersion: 1,
  contentVersion: 1,
  rngSeed: 12,
  combatants: ids.map((id, index) => ({
    id,
    teamId: index < 2 ? 'players' : 'opponents',
    initiative: 20 - index,
    baseMovementBudget: 4,
    hp: 100 - index * 10,
    maxHp: 100,
    mp: 50 - index * 10,
    maxMp: 50,
    temporaryResources: createPv1fTemporaryResources(50),
  })),
})
const tactical = createTacticalBattleState({
  battle: startBattle(pending).state,
  width: 9,
  height: 7,
  terrains: [{ id: 'open-ground', traversalCost: 1 }],
  tiles: Array.from({ length: 63 }, (_, i) => ({
    position: { x: i % 9, y: Math.floor(i / 9) },
    terrainId: 'open-ground',
    elevation: 0,
  })),
  movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
  placements: ids.map((id, index) => ({
    combatantId: id,
    position: positions[index],
    facing: 'east',
    movementProfileId: 'ground',
  })),
})
const snapshot = createStatDrivenCombatEncounterState(
  createCombatEncounterState(tactical),
  ids.map((id, index) => ({
    combatantId: id,
    provenance: {
      kind: index ? 'scenario' : 'character-derived',
      sourceId: index ? `scenario:${id}` : id,
      sourceRulesVersion: 1,
    },
    accuracy: 10000,
    evasion: 0,
    armor: index,
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
const mode = new URLSearchParams(location.search).get('mode') || 'pve'
const participants = ids.map((id, index) => ({
  combatantId: id,
  characterId: id,
  characterName: ['Zei', 'Ally 1', 'Recruit 1', 'Recruit 2'][index],
  characterLevel: 1,
  portraitRef: 'portrait.adventure.male-01',
  profileImageUrl: null,
  teamIndex: index < 2 ? 0 : 1,
  seatIndex: index % 2,
}))
const metadata = {
  lobbyId: 'fixture',
  mode: '2v2',
  battleKey: 'AVB-TEST-TEST',
  localCharacterId: ids[0],
  participants,
}
const runtime = {
  kind: mode,
  metadata,
  playerName: 'Zei',
  playerLevel: 1,
  playerPortraitAssetId: 'character.adventure.male-01',
  playerProfileImageUrl: null,
  supportActionId: 'basic.guard',
  techniques: [],
  essence: null,
  copiedSkills: [],
}
window.fixtureBattle = initialBattle
window.calls = []
window.fetch = async (url, options = {}) => {
  const path = String(url)
  const body = options.body ? JSON.parse(options.body) : null
  window.calls.push({ path, method: options.method || 'GET', body })
  if (path.endsWith('/events')) return new Response(JSON.stringify({ battleLog: { entries: [] } }))
  if (path.endsWith('/preview')) {
    const intent = body.intent
    const targetId = intent.target.kind === 'unit' ? intent.target.combatantId : ids[0]
    const combatant = window.fixtureBattle.snapshot.tactical.battle.combatants.find(
      (row) => row.id === targetId,
    )
    const damage = targetId === 'enemy-two' ? 9 : 17
    return new Response(
      JSON.stringify({
        battlePreview: {
          battleSessionId: 'fixture',
          battleVersion: window.fixtureBattle.battleVersion,
          preview: {
            kind: 'action',
            legal: true,
            actionId: intent.actionId,
            actorId: ids[0],
            primaryCombatantId: targetId,
            affectedTiles: [],
            affectedCombatantIds: [targetId],
            projectedEffects:
              intent.target.kind === 'unit'
                ? [
                    {
                      effectType: 'damage',
                      combatantId: targetId,
                      before: combatant.hp,
                      after: combatant.hp - damage,
                    },
                  ]
                : [],
            projectedStatuses: [],
            projectedEvents: [],
            mpCost: 0,
            actionEconomyCost: 30,
            actionEconomyBefore: 100,
            actionEconomyAfter: 70,
            hitChanceBasisPoints: targetId === 'enemy-two' ? 4200 : 6900,
            defenseKind: 'armor',
            defenseRating: 5,
            mitigatedBaseDamage: damage,
            issues: [],
            spendsAction: true,
          },
        },
      }),
    )
  }
  if (/\/(commit|intents|final-turn)$/.test(path)) {
    const next = structuredClone(window.fixtureBattle)
    next.battleVersion++
    window.fixtureBattle = next
    return new Response(JSON.stringify({ battle: next }))
  }
  if (path.endsWith('/fixture'))
    return new Response(JSON.stringify({ battle: window.fixtureBattle }))
  return new Response(JSON.stringify({}))
}
window.advanceBattle = (nextActor = 'character:player') => {
  const next = structuredClone(window.fixtureBattle)
  next.battleVersion++
  next.snapshot.tactical.battle.currentTurn.combatantId = nextActor
  next.snapshot.tactical.battle.turnNumber++
  window.fixtureBattle = next
  window.dispatchEvent(
    new CustomEvent(mode === 'pvp' ? 'aurevane:pvp-battle-state' : 'aurevane:battle-state', {
      detail: next,
    }),
  )
}
const fixtureRoot = createRoot(document.getElementById('root'))
window.unmountBattle = () => fixtureRoot.unmount()
fixtureRoot.render(
  mode === 'spectator' ? (
    <PvpSpectatorExperience
      initialSpectator={{
        battle: initialBattle,
        mode: '2v2',
        battleKey: metadata.battleKey,
        participants,
      }}
      initialParticipantTitles={{}}
    />
  ) : (
    <BattleInteractionLifecycleProvider>
      <BattleExperience initialBattle={initialBattle} runtime={runtime} />
      <DesktopBattleCombatantInspect
        battleSessionId="fixture"
        pvpMetadata={mode === 'pvp' ? metadata : null}
        playerName="Zei"
        playerPortraitAssetId="character.adventure.male-01"
        battleView={initialBattle}
      />
      {mode === 'pve' ? (
        <MobileBattleCombatantPopup
          battleSessionId="fixture"
          playerName="Zei"
          playerPortraitAssetId="character.adventure.male-01"
        />
      ) : null}
    </BattleInteractionLifecycleProvider>
  ),
)
