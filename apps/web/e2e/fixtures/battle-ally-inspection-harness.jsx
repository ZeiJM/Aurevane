import { SkillGroundEditor } from '@/components/master/combat-content/skill-ground-editor'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BattleExperience } from '@/components/battle/battle-experience'
import { BattlefieldPresentationBundle } from '@/components/battle/battlefield-presentation-bundle'
import { AudioProvider } from '@/components/audio/audio-provider'
import { PvpSpectatorExperience } from '@/components/battle/pvp-spectator-experience'
import { DesktopBattleCombatantInspect } from '@/components/battle/desktop-battle-combatant-inspect'
import { MobileBattleCombatantPopup } from '@/components/battle/mobile-battle-combatant-popup'
import { BattleInteractionLifecycleProvider } from '@/components/battle/battle-interaction-lifecycle'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createStatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import {
  evaluatePv1fMatureSkill,
  executePv1fMatureSkill,
  readPv1fActionEconomy,
  evaluatePv1fAction,
  executePv1fAction,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { createPv1fTemporaryResources } from '@aurevane/game-core/combat/pv1f-action-economy'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { SkillDetails } from '@/components/character/skill-details'
import { BattleSkillParameters } from '@/components/battle/battle-skill-parameters'
import { projectPercentageDotFixtureState } from './percentage-dot-viewer-state'
import './production-styles'

const targetingCase = new URLSearchParams(location.search).get('targeting')
const dotCase = new URLSearchParams(location.search).get('dot')
const dotPhase = new URLSearchParams(location.search).get('phase') || 'active'
const ids = ['character:player', 'ally', 'enemy-one', 'enemy-two']
const positions = [
  { x: 3, y: 3 },
  { x: 3, y: 4 },
  { x: 4, y: 3 },
  { x: 2, y: 3 },
]
if (targetingCase || dotCase) positions[3] = { x: 5, y: 3 }

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
    physicalPower: 20,
    mysticPower: 20,
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
const groundPreset = new URLSearchParams(location.search).get('ground')
if (groundPreset) {
  // Serialized public render data only; mechanics and concealment have separate canonical tests.
  initialBattle.snapshot = {
    ...snapshot,
    groundAreas: [
      {
        id: 'ground.area.fixture',
        tiles: [
          { x: 2, y: 2 },
          { x: 3, y: 3 },
        ],
        activationRound: 2,
        expiresAtRound: 5,
        visualPresetId: groundPreset,
      },
    ],
  }
}

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
const mend = resolveMatureSkillVersion('lifebinder.mend')
const runtime = {
  kind: mode,
  metadata,
  playerName: 'Zei',
  playerLevel: 1,
  playerPortraitAssetId: 'character.adventure.male-01',
  playerProfileImageUrl: null,
  supportActionId: 'basic.guard',
  techniques: [
    [mend, 'heal', 'Mend'],
    [resolveMatureSkillVersion('dawnshield.sacred-guard'), 'defense', 'Sacred Guard'],
    [resolveMatureSkillVersion('bastion.steady-footing'), 'defense', 'Steady Footing'],
  ].map(([definition, category, name]) => ({
    definition,
    id: definition.id,
    contentVersion: definition.contentVersion,
    name,
    sourceDisciplineId: definition.sourceDisciplineId,
    category,
    apCost: definition.apCost,
    mpCost: definition.mpCost ?? 0,
    cooldownOwnerTurns: definition.cooldown?.ownerTurns ?? null,
    iconKey: definition.media.iconKey,
    targetKind: definition.target.kind,
    targetTeamPolicy: definition.target.teamPolicy,
    minimumRange: definition.target.minimumRange,
    maximumRange: definition.target.maximumRange,
    tags: definition.tags,
    effectDescriptions: [],
    requirementDescriptions: [],
  })),
  essence: null,
  copiedSkills: [],
}
if (targetingCase) {
  // Current percentage attacks use the same explicit policy as newly started battles.
  initialBattle.snapshot = { ...initialBattle.snapshot, percentageDotPolicyVersion: 1 }
  const base = resolveMatureSkillVersion(
    targetingCase === 'heal'
      ? 'lifebinder.mend'
      : targetingCase === 'buff' || targetingCase === 'all-any'
        ? 'bastion.steady-footing'
        : targetingCase === 'ground-circle1'
          ? 'cinderweaver.flame-burst'
          : targetingCase === 'all-ground'
            ? 'frostweaver.chilling-mist'
            : targetingCase.startsWith('circle')
              ? 'vanguard.cleave'
              : 'wildwarden.thorn-line',
  )
  const shape =
    targetingCase === 'single'
      ? { kind: 'single' }
      : targetingCase === 'line' || targetingCase === 'legacy'
        ? { kind: 'line', length: 3 }
        : targetingCase.includes('circle')
          ? { kind: 'circle', radius: Number(targetingCase.slice(-1)) }
          : { kind: 'all' }
  const historical =
    targetingCase === 'legacy' ? resolveMatureSkillVersion(base.id, base.contentVersion - 1) : null
  const definition = historical ?? {
    ...base,
    target: {
      ...base.target,
      geometryVersion: 2,
      maximumElevationDifference: base.target.maximumElevationDifference ?? 2,
      kind:
        targetingCase === 'all-ground' || targetingCase === 'ground-circle1'
          ? 'ground-tile'
          : 'unit',
      teamPolicy:
        targetingCase === 'all-any' || targetingCase === 'all-ground'
          ? 'any'
          : targetingCase === 'heal' || targetingCase === 'buff'
            ? 'ally'
            : 'enemy',
      friendlyFire:
        targetingCase === 'all-any' || targetingCase === 'all-ground'
          ? 'all-units'
          : targetingCase === 'heal' || targetingCase === 'buff'
            ? 'allies-only'
            : 'enemies-only',
      shape,
      minimumRange: shape.kind === 'single' ? 1 : 0,
      maximumRange:
        shape.kind === 'line'
          ? shape.length
          : shape.kind === 'circle'
            ? shape.radius
            : shape.kind === 'single'
              ? 1
              : 0,
      requiresLineOfSight: shape.kind === 'all' ? false : base.target.requiresLineOfSight,
    },
    effects: base.effects.map((effect) =>
      'recipient' in effect && effect.recipient !== 'affected-tiles'
        ? { ...effect, recipient: 'affected-units' }
        : effect,
    ),
  }
  runtime.techniques = [
    {
      ...runtime.techniques[0],
      definition,
      id: definition.id,
      contentVersion: definition.contentVersion,
      apCost: definition.apCost,
      mpCost: definition.mpCost ?? 0,
      cooldownOwnerTurns: definition.cooldown?.ownerTurns ?? null,
      sourceDisciplineId: definition.sourceDisciplineId,
      iconKey: definition.media.iconKey,
      name: 'Targeting Test',
      category:
        targetingCase === 'heal'
          ? 'heal'
          : targetingCase === 'buff' ||
              targetingCase === 'all-any' ||
              targetingCase === 'all-ground'
            ? 'defense'
            : 'attack',
      target: definition.target,
      targetKind: definition.target.kind,
      targetTeamPolicy: definition.target.teamPolicy,
      minimumRange: definition.target.minimumRange,
      maximumRange: definition.target.maximumRange,
      tags: definition.tags,
    },
  ]
  window.targetingDefinition = definition
}
if (dotCase) {
  const essence = dotCase.startsWith('essence-')
    ? resolveEssenceForBuild(dotCase === 'essence-burn' ? 'cinderweaver' : 'ravager', null)
    : null
  const definition =
    essence?.skill ??
    resolveMatureSkillVersion(
      { burn: 'cinderweaver.cinder-bolt', poison: 'wildwarden.venom-shot', bleed: 'ravager.gash' }[
        dotCase
      ],
    )
  const dot = definition.effects.find((effect) => ['burn', 'poison', 'bleed'].includes(effect.type))
  const source = {
    ...snapshot,
    percentageDotPolicyVersion: 1,
    effectStackingPolicyVersion: 1,
    effectTimingPolicy: {
      version: 1,
      modes: { damage: 'instant', [dot.type]: dotPhase === 'pending' ? 'next-round' : 'instant' },
    },
  }
  const target =
    definition.target.geometryVersion === 2 && definition.target.shape.kind !== 'single'
      ? definition.target.shape.kind === 'line'
        ? { kind: 'direction', direction: 'east' }
        : { kind: 'activate' }
      : { kind: 'unit', combatantId: 'enemy-one' }
  const transition = executePv1fMatureSkill(
    source,
    definition,
    target,
    mode === 'pvp' ? 'pvp' : 'pve',
  )
  initialBattle.snapshot = projectPercentageDotFixtureState(transition.state)
  const presentation = {
    ...runtime.techniques[0],
    definition,
    id: definition.id,
    contentVersion: definition.contentVersion,
    name: essence?.name ?? dotCase,
    apCost: definition.apCost,
    mpCost: definition.mpCost ?? 0,
    cooldownOwnerTurns: definition.cooldown?.ownerTurns ?? null,
    sourceDisciplineId: definition.sourceDisciplineId,
    iconKey: definition.media.iconKey,
    category: 'attack',
    target: definition.target,
    targetKind: definition.target.kind,
    targetTeamPolicy: definition.target.teamPolicy,
    minimumRange: definition.target.minimumRange,
    maximumRange: definition.target.maximumRange,
    tags: definition.tags,
  }
  runtime.techniques = essence ? [] : [presentation]
  runtime.essence = essence ? { ...presentation, description: essence.description } : null
  window.dotDefinition = definition
  window.dotReceipt = transition.events
  window.dotType = dot.type
  window.dotPresentation = presentation
  window.dotCapturedDamage = transition.events
    .filter(
      (event) =>
        event.event === 'damage_applied' &&
        event.targetCombatantId === 'enemy-one' &&
        event.actionId === definition.id,
    )
    .reduce((sum, event) => sum + event.amount, 0)
}
window.fixtureBattle = initialBattle
window.calls = []
window.fetch = async (url, options = {}) => {
  const path = String(url)
  const body = options.body ? JSON.parse(options.body) : null
  window.calls.push({ path, method: options.method || 'GET', body })
  if (path.endsWith('/events')) return new Response(JSON.stringify({ battleLog: { entries: [] } }))
  if (targetingCase && path.endsWith('/preview')) {
    if (window.previewFailure === 'http')
      return Response.json(
        { error: { code: 'TEMPORARY', message: 'Forecast unavailable.' } },
        { status: 503 },
      )
    if (window.previewFailure === 'network') throw new Error('Forecast connection failed.')

    const intent = body.intent
    const source = window.fixtureBattle.snapshot
    const { evaluation, cost, prepared } =
      intent.actionId === window.targetingDefinition.id
        ? evaluatePv1fMatureSkill(
            source,
            window.targetingDefinition,
            intent.target,
            mode === 'pvp' ? 'pvp' : 'pve',
          )
        : evaluatePv1fAction(source, intent.actionId, intent.target)
    const before = readPv1fActionEconomy(prepared)?.current ?? 0
    window.forecasts ??= []
    window.forecasts.push({
      version: window.fixtureBattle.battleVersion,
      intent,
      preview: evaluation,
    })
    return Response.json({
      battlePreview: {
        battleSessionId: 'fixture',
        battleVersion:
          window.fixtureBattle.battleVersion + (window.previewFailure === 'stale' ? -1 : 0),
        preview: {
          ...evaluation,
          kind: 'action',
          legal: evaluation.legal && before >= cost,
          actionEconomyCost: cost,
          actionEconomyBefore: before,
          actionEconomyAfter: before - cost,
          projectedStatuses: [],
        },
      },
    })
  }
  if (targetingCase && /\/(commit|intents)$/.test(path)) {
    if (body.expectedBattleVersion !== window.fixtureBattle.battleVersion)
      return Response.json({ message: 'Stale battle version.' }, { status: 409 })
    try {
      const intent = body.intent
      const transition =
        intent.actionId === window.targetingDefinition.id
          ? executePv1fMatureSkill(
              window.fixtureBattle.snapshot,
              window.targetingDefinition,
              intent.target,
              mode === 'pvp' ? 'pvp' : 'pve',
            )
          : executePv1fAction(window.fixtureBattle.snapshot, intent.actionId, intent.target)
      window.receipts = transition.events
      window.fixtureBattle = {
        ...window.fixtureBattle,
        battleVersion: window.fixtureBattle.battleVersion + 1,
        snapshot: transition.state,
      }
      return Response.json({ battle: window.fixtureBattle })
    } catch (error) {
      return Response.json({ message: error.message }, { status: 409 })
    }
  }
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
                      effectType: intent.actionId === mend.id ? 'healing' : 'damage',
                      combatantId: targetId,
                      before: combatant.hp,
                      after:
                        intent.actionId === mend.id
                          ? Math.min(combatant.maxHp, combatant.hp + 12)
                          : combatant.hp - damage,
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
window.publishBattle = () =>
  window.dispatchEvent(
    new CustomEvent(mode === 'pvp' ? 'aurevane:pvp-battle-state' : 'aurevane:battle-state', {
      detail: window.fixtureBattle,
    }),
  )
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
function DotDefinitionReport() {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button
        style={{ position: 'fixed', left: 8, top: 8, zIndex: 2002 }}
        onClick={() => setOpen(!open)}
      >
        {open ? 'Close pinned percentage definition' : 'Read pinned percentage definition'}
      </button>
      {open ? (
        <section
          aria-label="Pinned percentage definition"
          style={{
            position: 'fixed',
            left: 8,
            top: 48,
            zIndex: 2001,
            background: '#0a202b',
            color: '#f0e8dc',
            padding: 12,
            maxWidth: 'calc(100vw - 16px)',
            width: 700,
            maxHeight: '85vh',
            overflow: 'auto',
          }}
        >
          <dl>
            <BattleSkillParameters skill={window.dotPresentation} />
          </dl>
          <SkillDetails skill={window.dotDefinition} expanded />
        </section>
      ) : null}
    </>
  )
}
function GroundEditorHarness() {
  const skill = resolveMatureSkillVersion('cinderweaver.flame-burst')
  const [area, setArea] = React.useState(skill.groundArea)
  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Ground authoring preview</h1>
      <SkillGroundEditor
        target={skill.target}
        effects={skill.effects}
        value={area}
        onChange={setArea}
      />
      <pre data-ground-draft style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {JSON.stringify(area)}
      </pre>
    </main>
  )
}
if (mode === 'master-ground') fixtureRoot.render(<GroundEditorHarness />)
else
  fixtureRoot.render(
    <AudioProvider>
      {dotCase ? <DotDefinitionReport /> : null}
      <BattlefieldPresentationBundle
        battleSessionId="fixture"
        initialVersion={initialBattle.battleVersion}
        mode={mode === 'pve' ? 'pve' : 'pvp'}
        playerName={mode === 'pve' ? 'Zei' : undefined}
      />
      {mode === 'spectator' ? (
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
      )}
    </AudioProvider>,
  )
