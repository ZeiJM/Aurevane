import {
  captureBasicSkillSources,
  defaultBasicSkills,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { PV1F_BASIC_ATTACK_ID } from '@aurevane/game-core/combat/pv1f-skills'
import { abilityBehaviorInformation } from '@/components/character/ability-detail-presentation'
import { CombatControlsSettings } from '@/components/settings/combat-controls-settings'
import {
  combatCanonicalModifierRootFacts,
  combatModifierCompatibilityFacts,
} from '@aurevane/game-core/combat/combat-modifier-compatibility'
import { pv1fCooldownForMatureSkill } from '@aurevane/game-core/combat/pv1f-action-economy'
import { readSkillCooldown } from '@aurevane/game-core/combat/skill-cooldowns'
import { DEFAULT_COMBAT_KEYBINDS } from '@aurevane/validation/player/combat-controls'
import { setTerrainOverlay } from '@aurevane/game-core/combat/terrain-overlays'
import { SkillGroundEditor } from '@/components/master/combat-content/skill-ground-editor'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BattleExperience } from '@/components/battle/battle-experience'
import { BattlefieldPresentationBundle } from '@/components/battle/battlefield-presentation-bundle'
import { AudioProvider } from '@/components/audio/audio-provider'
import { PvpSpectatorExperience } from '@/components/battle/pvp-spectator-experience'
import { PvpBattleQualityControls } from '@/components/battle/pvp-battle-quality-controls'
import { PvpBattleChatBridge } from '@/components/battle/pvp-battle-chat-bridge'
import { DesktopBattleCombatantInspect } from '@/components/battle/desktop-battle-combatant-inspect'
import { MobileBattleCombatantPopup } from '@/components/battle/mobile-battle-combatant-popup'
import { BattleInteractionLifecycleProvider } from '@/components/battle/battle-interaction-lifecycle'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import {
  createCurrentStatDrivenCombatEncounterState,
  createStatBalancedCombatEncounterState,
  createStatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import {
  finishPv1fTurn,
  evaluatePv1fMatureSkill,
  executePv1fMatureSkill,
  readPv1fActionEconomy,
  evaluatePv1fAction,
  executePv1fAction,
  evaluatePv1fMovement,
  executePv1fMovement,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { createPv1fTemporaryResources } from '@aurevane/game-core/combat/pv1f-action-economy'
import { spawnCombatSummon } from '@aurevane/game-core/combat/combat-summons'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { SkillDetails } from '@/components/character/skill-details'
import { BattleSkillParameters } from '@/components/battle/battle-skill-parameters'
import { SkillEffectTimingProvider } from '@/components/character/skill-effect-timing-context'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { projectPercentageDotFixtureState } from './percentage-dot-viewer-state'
import { source as canonicalSourceFixture } from '@aurevane/game-core/combat/combat-behavior.test-utils'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  combatManualModifierAvailability,
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
  combatControlledAbilityAvailability,
  primeCombatControlledAbility,
  cancelCombatControlledAbility,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  prepareCombatAbilityCommand,
  commitCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import './production-styles'

const targetingCase = new URLSearchParams(location.search).get('targeting')
const canonicalCase = new URLSearchParams(location.search).get('canonical')
let canonicalState
let canonicalCapture
let canonicalTargets
let canonicalBasics
function canonicalPublicState(state) {
  const publicState = { ...projectPercentageDotFixtureState(state) }
  Reflect.deleteProperty(publicState, 'capturedAbilitySources')
  Reflect.deleteProperty(publicState, 'abilityRuntime')
  return {
    ...publicState,
    manualModifierAvailability: combatManualModifierAvailability(state, ids[0]).map((row) => {
      const source = state.capturedAbilitySources.find(
        (source) => source.sourceInstanceId === row.sourceInstanceId,
      )
      const behavior = source.definition.behaviors.find(
        (behavior) => behavior.id === row.behaviorId,
      )
      return {
        ...row,
        abilityId: source.abilityId,
        contentVersion: source.contentVersion,
        compatibility: combatModifierCompatibilityFacts(behavior),
        report: abilityBehaviorInformation(behavior, {
          timingPolicy: state.effectTimingPolicy ?? null,
        }),
      }
    }),
    manualActionTargets: canonicalTargets?.map((row) => {
      const source = state.capturedAbilitySources?.find(
        (source) =>
          source.ownerCombatantId === ids[0] &&
          (source.abilityId === row.actionId ||
            (source.basic?.execution.kind === 'basic-attack' &&
              row.actionId === PV1F_BASIC_ATTACK_ID)),
      )
      const controlled =
        source &&
        combatControlledAbilityAvailability({
          state,
          actorId: ids[0],
          sourceInstanceId: source.sourceInstanceId,
          behaviorId: row.behaviorId,
        })
      const behavior = source?.definition.behaviors.find(
        (behavior) => behavior.id === row.behaviorId,
      )
      return {
        ...row,
        ...(source && behavior
          ? {
              ownerCombatantId: source.ownerCombatantId,
              classification: behavior.classification,
              modifierRoot: combatCanonicalModifierRootFacts(behavior),
              costs: behavior.costs.map((cost) => ({ ...cost })),
              cooldown: behavior.cooldown ? { ...behavior.cooldown } : null,
              ...(source.basic
                ? {}
                : {
                    report: abilityBehaviorInformation(behavior, {
                      timingPolicy: state.effectTimingPolicy ?? null,
                    }),
                  }),
            }
          : {}),
        ...(controlled ? { controlled } : {}),
      }
    }),
    ...(canonicalBasics ? { basicActions: canonicalBasics } : {}),
  }
}
const elementalCase = new URLSearchParams(location.search).get('elemental')
const dotCase = new URLSearchParams(location.search).get('dot')
const dotPhase = new URLSearchParams(location.search).get('phase') || 'active'
const legacyDotTriggers = new URLSearchParams(location.search).get('triggers') === 'legacy'
const ids = ['character:player', 'ally', 'enemy-one', 'enemy-two']
const positions = [
  { x: 3, y: 3 },
  { x: 3, y: 4 },
  { x: 4, y: 3 },
  { x: 2, y: 3 },
]
if (targetingCase || dotCase) positions[3] = { x: 5, y: 3 }
if (
  (canonicalCase?.startsWith('move-') && canonicalCase !== 'move-stationary') ||
  canonicalCase === 'controlled-move'
) {
  positions[2] = { x: 4, y: 2 }
  positions[3] = { x: 5, y: 2 }
}

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
const fixtureMapParameters = new URLSearchParams(location.search)
const fixtureColumns = Number(fixtureMapParameters.get('columns'))
const [fixtureMapWidth, fixtureMapHeight] = [9, 12, 15].includes(fixtureColumns)
  ? [fixtureColumns, 7]
  : ({ small: [9, 7], medium: [12, 7], large: [13, 9] }[fixtureMapParameters.get('mapSize')] ?? [
      9, 7,
    ])
const tactical = createTacticalBattleState({
  battle: startBattle(pending).state,
  width: fixtureMapWidth,
  height: fixtureMapHeight,
  terrains: [{ id: 'open-ground', traversalCost: 1 }],
  tiles: Array.from({ length: fixtureMapWidth * fixtureMapHeight }, (_, i) => ({
    position: { x: i % fixtureMapWidth, y: Math.floor(i / fixtureMapWidth) },
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
if (new URLSearchParams(location.search).get('airborne') === '1') {
  initialBattle.snapshot = createStatBalancedCombatEncounterState(
    initialBattle.snapshot,
    initialBattle.snapshot.statBridge.combatants.map((profile) => ({
      ...profile,
      physicalPower: 20,
      mysticPower: 20,
      level: 1,
      criticalChance: 0,
    })),
  )
}
const groundPreset = new URLSearchParams(location.search).get('ground')
if (new URLSearchParams(location.search).get('summon') === '1') {
  const skill = resolveMatureSkillVersion('wildwarden.renewing-herbs')
  const current = createCurrentStatDrivenCombatEncounterState(
    snapshot,
    snapshot.statBridge.combatants.map((profile) => ({ ...profile, level: 1, criticalChance: 0 })),
  )
  initialBattle.snapshot = spawnCombatSummon(current, {
    ownerCombatantId: 'character:player',
    sourceSkillId: skill.id,
    sourceSkillVersion: skill.contentVersion,
    profile: skill.summonProfile,
    position: { x: 1, y: 1 },
    facing: 'east',
  }).state
}

if (new URLSearchParams(location.search).get('compass') === 'edges') {
  const directions = ['north', 'east', 'south', 'west']
  const corners = [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 0, y: 6 },
    { x: 8, y: 6 },
  ]
  initialBattle.snapshot.tactical.placements.forEach((placement, index) => {
    placement.facing = directions[index]
    placement.position = corners[index]
  })
}

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

const participantNames = ['Zei', 'Ally 1', 'Recruit 1', 'Recruit 2']
const turnName = new URLSearchParams(location.search).get('turnName')
const participants = ids.map((id, index) => ({
  combatantId: id,
  characterId: id,
  characterName: index === 2 && turnName ? turnName : participantNames[index],
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
if (new URLSearchParams(location.search).get('passivePreview') === '1') {
  const skill = runtime.techniques[2]
  const group = defaultBasicSkills()[0].ability.behaviors[0]
  runtime.techniques[2] = {
    ...skill,
    definition: {
      ...skill.definition,
      ability: {
        schemaVersion: 1,
        behaviors: [
          {
            ...group,
            activation: 'ongoing',
            mode: 'modifier',
            classification: 'utility',
            attackFamily: undefined,
            costs: [],
            cooldown: null,
            targeting: null,
            effects: [
              {
                id: 'passive-bonus',
                payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11000 },
              },
            ],
          },
        ],
      },
    },
  }
  const definition = resolveResonanceForPair('chronist', 'tidecaller')
  runtime.resonance = {
    id: definition.id,
    contentVersion: definition.contentVersion,
    name: definition.name,
    description: definition.description,
    definition,
  }
  if (new URLSearchParams(location.search).get('passiveEssence') === '1') {
    const essence = resolveEssenceForBuild('aetherist', null)
    runtime.essence = {
      ...runtime.techniques[2],
      id: essence.skill.id,
      name: essence.name,
      iconKey: essence.skill.media.iconKey,
      description: essence.description,
      definition: { ...essence.skill, ability: runtime.techniques[2].definition.ability },
    }
    runtime.resonance = null
  }
}
if (targetingCase) {
  // Current percentage attacks use the same explicit policy as newly started battles.
  initialBattle.snapshot = {
    ...initialBattle.snapshot,
    percentageDotPolicyVersion: 1,
    dotTriggerPolicyVersion: 1,
    ...(targetingCase === 'catalog-fire' ? { groundEffectPolicyVersion: 1 } : {}),
    frozenGroundPolicyVersion: 1,
    airbornePolicyVersion: 1,
    displacementPolicyVersion: 1,
  }
  const base = resolveMatureSkillVersion(
    targetingCase === 'heal'
      ? 'lifebinder.mend'
      : targetingCase === 'buff' || targetingCase === 'all-any'
        ? 'bastion.steady-footing'
        : targetingCase === 'ground-circle1' || targetingCase === 'catalog-fire'
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
  const definition =
    historical ??
    (targetingCase === 'catalog-fire'
      ? base
      : {
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
        })
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
    dotTriggerPolicyVersion: legacyDotTriggers ? undefined : 1,
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
if (elementalCase) {
  initialBattle.snapshot = {
    ...initialBattle.snapshot,
    elementalDamagePolicyVersion:
      new URLSearchParams(location.search).get('elementalPolicy') === 'legacy'
        ? undefined
        : new URLSearchParams(location.search).get('elementalPolicy') === '1'
          ? 1
          : 2,
    dynamicInitiativePolicyVersion: 1,
    effectTimingPolicy: { version: 7, modes: { damage: 'instant', 'remove-status': 'instant' } },
  }
  if (elementalCase === 'steam' || elementalCase.startsWith('fire')) {
    initialBattle.snapshot = setTerrainOverlay(
      initialBattle.snapshot,
      { x: 3, y: 2 },
      'frozen',
      'enemy-one',
      'fixture.freeze',
    ).state
    if (elementalCase === 'steam')
      initialBattle.snapshot.terrainOverlays[0] = {
        ...initialBattle.snapshot.terrainOverlays[0],
        kind: 'steam',
        remainingRoundBoundaries: 1,
      }
  }
  if (elementalCase === 'chilled' || elementalCase.startsWith('fire'))
    initialBattle.snapshot.statusState = initialBattle.snapshot.statusState.map((row) =>
      row.combatantId === 'character:player'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'frozen',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 3,
                remainingOwnerTurnEnds: 2,
                sourceCombatantId: 'enemy-one',
              },
            ],
          }
        : row,
    )
  if (elementalCase.startsWith('fire') && targetingCase) {
    const definition =
      elementalCase === 'fire-catalog'
        ? window.targetingDefinition
        : {
            ...window.targetingDefinition,
            // Repeatable fixture Skills exercise retained target selection after a legal commit.
            cooldown: null,
            requirements: [{ kind: 'actor-status-absent', statusId: 'guarded' }],
            effects: [
              {
                type: 'damage',
                recipient:
                  window.targetingDefinition.target.shape.kind === 'single'
                    ? 'primary-unit'
                    : 'affected-units',
                amount: 10,
                element: 'fire',
              },
              { type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] },
            ],
          }
    window.targetingDefinition = definition
    runtime.techniques[0] = {
      ...runtime.techniques[0],
      definition,
      cooldownOwnerTurns: definition.cooldown?.ownerTurns ?? null,
    }
    if (elementalCase === 'fire-area' || elementalCase === 'fire-catalog')
      initialBattle.snapshot.statusState = initialBattle.snapshot.statusState.map((row) =>
        row.combatantId === 'enemy-one'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'airborne',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 3,
                  sourceCombatantId: 'enemy-one',
                },
              ],
            }
          : row,
      )
  }
}
const suppressCase = new URLSearchParams(location.search).get('suppress')
if (suppressCase) {
  initialBattle.snapshot.effectTimingPolicy = { version: 7, modes: {} }
  if (suppressCase === 'pending') {
    initialBattle.snapshot.pendingEffects = [
      {
        actorId: 'enemy-one',
        actionId: 'fixture.suppress',
        recipientIds: ['character:player'],
        affectedTiles: [],
        activationRound: 3,
        statusDurationScope: 'rounds',
        content: PV1F_COMBAT_CONTENT,
        effect: {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'suppress',
          stacks: 1,
          potencyBasisPoints: 2534,
          durationTurns: 2,
        },
      },
    ]
    initialBattle.snapshot = projectPercentageDotFixtureState(initialBattle.snapshot)
  } else {
    initialBattle.snapshot.statusState.find(
      (row) => row.combatantId === 'character:player',
    ).statuses = [
      {
        statusId: 'suppress',
        statusVersion: 1,
        stacks: 1,
        potencyBasisPoints: 2534,
        remainingOwnerTurnStarts: 2,
        remainingOwnerTurnEnds: 2,
        timingState: 'active',
        sourceCombatantId: 'enemy-one',
      },
    ]
  }
}
const suppressChronicleEntries = suppressCase
  ? (() => {
      const pending = suppressCase === 'pending'
      const percent = pending ? 25.34 : 100
      const base = {
        battleVersion: 1,
        occurredAt: '2026-10-09T00:00:00Z',
        round: 1,
        turnNumber: 1,
        actorCombatantId: 'enemy-one',
        targetCombatantId: 'character:player',
        actionId: 'fixture.suppress',
        actionLabel: 'Recorded Suppress',
        message: '',
        messageTemplate: '',
        templateValues: {},
        facts: [],
        headline: '',
        tone: 'neutral',
      }
      return [
        { ...base, eventIndex: 0, eventType: 'combat_action_used', kind: 'skill' },
        {
          ...base,
          eventIndex: 1,
          eventType: pending ? 'effect_pending' : 'status_applied',
          kind: 'status',
          statusId: 'suppress',
          potencyBasisPoints: percent * 100,
          templateValues: {
            status: `Suppress [${percent}%]`,
            effect: `Suppress [${percent}%]`,
            round: '3',
          },
          facts: [{ label: pending ? 'Pending until round 3' : '2 turns', tone: 'neutral' }],
          ...(pending
            ? { effectTiming: { remainingRoundBoundaries: 2, durationScope: 'rounds' } }
            : {}),
        },
      ]
    })()
  : []
if (canonicalCase) {
  const definition = runtime.techniques[0].definition
  const target = {
    geometryVersion: 3,
    categories: ['enemy', 'ground'],
    maximumSelections: 3,
    kind: 'unit',
    teamPolicy: 'enemy',
    friendlyFire: 'enemies-only',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 4,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
  }
  const controlled =
    canonicalCase.startsWith('controlled-') || canonicalCase === 'modifier-controlled'
  const controlledSelf =
    controlled && canonicalCase !== 'controlled-move' && canonicalCase !== 'modifier-controlled'
  const movement = canonicalCase.startsWith('move-') || canonicalCase === 'controlled-move'
  const mixed = canonicalCase === 'move-mixed'
  const stationary = canonicalCase === 'move-stationary'
  const source = canonicalSourceFixture({
    targeting: controlledSelf
      ? {
          ...target,
          categories: ['self'],
          kind: 'self',
          teamPolicy: 'self',
          friendlyFire: 'allies-only',
          maximumSelections: 1,
          maximumRange: 0,
        }
      : movement
        ? {
            ...target,
            maximumSelections: 1,
            minimumRange: mixed ? 0 : 1,
            maximumRange: 1,
            categories: mixed ? ['self', 'enemy'] : ['enemy', 'ground'],
            ...(mixed ? { kind: 'self', teamPolicy: 'self' } : {}),
          }
        : target,
    ...(canonicalCase === 'move-paid'
      ? {
          costs: [
            { resource: 'ap', amount: 100 },
            { resource: 'mp', amount: 2 },
            { resource: 'hp', amount: 1 },
          ],
        }
      : {}),
    accuracy: controlledSelf ? undefined : { kind: 'fixed', chanceBasisPoints: 10000 },
    effects: [
      ...(movement
        ? [
            {
              id: 'walk',
              payload: { type: 'move', recipient: 'actor', maximumTiles: 2 },
              ...(stationary
                ? {
                    requirements: {
                      kind: 'status-presence',
                      subject: 'owner',
                      statusId: 'guarded',
                      present: true,
                    },
                  }
                : {}),
            },
          ]
        : []),
      controlledSelf
        ? {
            id: 'ward',
            timing: 'controlled',
            payload: { type: 'barrier-change', recipient: 'actor', amount: 10 },
          }
        : {
            id: 'hit',
            ...(controlled ? { timing: 'controlled' } : {}),
            payload: { type: 'damage', recipient: 'affected-units', amount: 10 },
          },
    ],
  })
  source.ownerCombatantId = ids[0]
  source.abilityId = definition.id
  if (canonicalCase === 'choices' || canonicalCase === 'controlled-choices')
    source.definition.behaviors.push({ ...source.definition.behaviors[0], id: 'second' })
  if (canonicalCase.startsWith('modifier-')) {
    source.definition.behaviors[0].targeting = {
      ...target,
      categories: ['enemy'],
      maximumSelections: 1,
    }
  }
  if (canonicalCase === 'modifier-recovery') {
    source.definition.behaviors.push({
      ...source.definition.behaviors[0],
      id: 'recovery',
      classification: 'recovery',
      attackFamily: undefined,
      accuracy: undefined,
      targeting: {
        ...target,
        categories: ['ally'],
        maximumSelections: 1,
        teamPolicy: 'ally',
        friendlyFire: 'allies-only',
      },
      effects: [{ id: 'mend', payload: { type: 'healing', recipient: 'primary-unit', amount: 5 } }],
    })
  }
  canonicalCapture = captureCombatAbilitySource(source)
  canonicalState = reconcileCombatAbilitySources(initialBattle.snapshot, [canonicalCapture])
  if (canonicalCase === 'controlled-price') {
    // Execution costs 11 AP / 2 MP / 1 HP; the old presentation envelope says 15 AP.
    runtime.techniques[0].apCost = 15
    canonicalState = {
      ...canonicalState,
      tactical: {
        ...canonicalState.tactical,
        battle: {
          ...canonicalState.tactical.battle,
          combatants: canonicalState.tactical.battle.combatants.map((unit) =>
            unit.id === ids[0]
              ? {
                  ...unit,
                  mp: 2,
                  hp: 2,
                  temporaryResources: unit.temporaryResources.map((resource) =>
                    resource.key === 'pv1f.action-economy'
                      ? { ...resource, current: 12 }
                      : resource,
                  ),
                }
              : unit,
          ),
        },
      },
    }
  }
  if (canonicalCase === 'controlled-poor')
    canonicalState = {
      ...canonicalState,
      tactical: {
        ...canonicalState.tactical,
        battle: {
          ...canonicalState.tactical.battle,
          combatants: canonicalState.tactical.battle.combatants.map((unit) =>
            unit.id === ids[0] ? { ...unit, mp: 0 } : unit,
          ),
        },
      },
    }
  canonicalTargets = canonicalCapture.definition.behaviors.map((behavior) => ({
    actionId: source.abilityId,
    behaviorId: behavior.id,
    target: behavior.targeting,
    ...(movement
      ? {
          move: { maximumTiles: 2, conditional: stationary },
          costs: behavior.costs.map((cost) => ({ ...cost })),
        }
      : {}),
  }))
  if (stationary)
    canonicalState = {
      ...canonicalState,
      tactical: {
        ...canonicalState.tactical,
        battle: {
          ...canonicalState.tactical.battle,
          currentTurn: {
            ...canonicalState.tactical.battle.currentTurn,
            movementRemaining: 0,
            movementSpent: canonicalState.tactical.battle.currentTurn.movementMaximum,
          },
        },
      },
    }
  if (canonicalCase.startsWith('modifier-')) {
    const count = canonicalCase === 'modifier-long' ? 24 : 1
    const modifiers = Array.from({ length: count }, (_, index) => {
      const modifier = canonicalSourceFixture(
        {
          mode: 'modifier',
          classification: 'attack',
          targeting: null,
          accuracy: undefined,
          costs: [
            { resource: 'ap', amount: 1 },
            { resource: 'mp', amount: 1 },
          ],
          cooldown: { key: `fixture-modifier-${index}`, ownerTurns: 2 },
          effects: [
            { id: 'extra-hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 1 } },
          ],
        },
        index === 0 ? 'fixture-modifier' : `fixture-modifier-${index}`,
      )
      modifier.ownerCombatantId = ids[0]
      modifier.abilityId = `fixture.modifier.${index}`
      return captureCombatAbilitySource(modifier)
    })
    canonicalState = reconcileCombatAbilitySources(canonicalState, [canonicalCapture, ...modifiers])
  }
  initialBattle.snapshot = canonicalPublicState(canonicalState)
}
if (canonicalCase === 'controlled-basic') {
  const definitions = defaultBasicSkills().map((row) =>
    row.id !== 'basic.guard'
      ? row
      : {
          ...row,
          ability: {
            ...row.ability,
            behaviors: row.ability.behaviors.map((behavior) => ({
              ...behavior,
              costs: [
                { resource: 'ap', amount: 11 },
                { resource: 'mp', amount: 2 },
                { resource: 'hp', amount: 1 },
              ],
              effects: behavior.effects.map((effect) => ({ ...effect, timing: 'controlled' })),
            })),
          },
        },
  )
  const captures = captureBasicSkillSources({
    ownerCombatantId: ids[0],
    supportActionId: 'basic.guard',
    definitions,
  })
  canonicalCapture = captures.find((source) => source.abilityId === 'basic.guard')
  canonicalState = reconcileCombatAbilitySources(initialBattle.snapshot, captures)
  canonicalTargets = captures.flatMap((source) =>
    source.definition.behaviors.map((behavior) => ({
      actionId:
        source.basic?.execution.kind === 'basic-attack' ? PV1F_BASIC_ATTACK_ID : source.abilityId,
      behaviorId: behavior.id,
      target: behavior.targeting,
    })),
  )
  initialBattle.snapshot = canonicalPublicState(canonicalState)
}
if (canonicalCase?.startsWith('move-basic')) {
  const line = canonicalCase === 'move-basic-line'
  const price = canonicalCase === 'move-basic-100' ? 100 : 23
  const definitions = defaultBasicSkills().map((basic) =>
    basic.id !== 'basic.move'
      ? basic
      : {
          ...basic,
          contentVersion: 2,
          name: 'Swift Step',
          execution: { kind: 'basic-move', costBasis: 'flat' },
          ability: {
            ...basic.ability,
            behaviors: basic.ability.behaviors.map((behavior) => ({
              ...behavior,
              costs: [{ resource: 'ap', amount: price }],
              ...(line
                ? {
                    classification: 'attack',
                    attackFamily: 'physical',
                    targeting: {
                      ...behavior.targeting,
                      kind: 'unit',
                      teamPolicy: 'enemy',
                      friendlyFire: 'enemies-only',
                      categories: ['enemy'],
                      shape: { kind: 'line', length: 2 },
                      maximumRange: 2,
                    },
                  }
                : {}),
              effects: [
                {
                  ...behavior.effects[0],
                  payload: { ...behavior.effects[0].payload, maximumTiles: 2 },
                },
                ...(line
                  ? [
                      {
                        id: 'hit',
                        payload: { type: 'damage', recipient: 'affected-units', amount: 10 },
                      },
                    ]
                  : []),
              ],
            })),
          },
        },
  )
  const captures = captureBasicSkillSources({
    ownerCombatantId: ids[0],
    supportActionId: 'basic.guard',
    definitions,
  })
  canonicalCapture = captures.find((source) => source.abilityId === 'basic.move')
  canonicalState = reconcileCombatAbilitySources(initialBattle.snapshot, captures)
  canonicalTargets = captures.flatMap((source) =>
    source.definition.behaviors.map((behavior) => ({
      actionId: source.abilityId === 'unarmed.basic' ? PV1F_BASIC_ATTACK_ID : source.abilityId,
      behaviorId: behavior.id,
      target: behavior.targeting,
      ...(source.abilityId === 'basic.move'
        ? {
            move: { maximumTiles: 2, conditional: false },
            costs: behavior.costs.map((cost) => ({ ...cost })),
          }
        : {}),
    })),
  )
  // Local display fixture derived from the same real capture and shared report adapter.
  // Owner entitlement/public transport is covered by the production service tests.
  canonicalBasics = captures.map((source) => {
    const basic = source.basic
    return {
      ownerCombatantId: source.ownerCombatantId,
      actionId: source.abilityId === 'unarmed.basic' ? PV1F_BASIC_ATTACK_ID : source.abilityId,
      contentVersion: source.contentVersion,
      name: basic.name,
      description: basic.description,
      enabled: basic.enabled,
      iconKey: basic.media.iconKey,
      ...(source.abilityId === 'basic.move'
        ? { movement: { costBasis: 'flat', maximumTiles: 2 } }
        : {}),
      behaviors: source.definition.behaviors.map((behavior) => ({
        behaviorId: behavior.id,
        classification: behavior.classification,
        costs: behavior.costs.map((cost) => ({ ...cost })),
        cooldown: behavior.cooldown,
        target: behavior.targeting,
        ...(source.abilityId === 'basic.move'
          ? { move: { maximumTiles: 2, conditional: false } }
          : {}),
        ...abilityBehaviorInformation(behavior, {
          basic,
          stats: { move: 4, jump: 1, physicalPower: 20, mysticPower: 20 },
        }),
      })),
    }
  })
  initialBattle.snapshot = canonicalPublicState(canonicalState)
}
const fixtureControls = {
  ...DEFAULT_COMBAT_KEYBINDS,
  ...(canonicalCase?.startsWith('modifier-') || mode === 'controls'
    ? { inspect: { code: 'KeyM', shift: false }, modifiers: { code: 'KeyM', shift: true } }
    : {}),
  ...(new URLSearchParams(location.search).get('cycleTarget') === 'custom'
    ? { nextTarget: { code: 'KeyN', shift: false } }
    : {}),
}
if (new URLSearchParams(location.search).has('cooldownOverlay')) {
  const skill = runtime.techniques[0]
  const cooldown = pv1fCooldownForMatureSkill(skill.definition, mode)
  if (!cooldown) throw new Error('Fixture Skill needs a real cooldown')
  initialBattle.snapshot.tactical.battle.combatants[0].temporaryResources.push({
    key: `p3.skill-cooldown.${cooldown.key}`,
    current: 2,
    maximum: 2,
  })
}
window.fixtureBattle = initialBattle
window.calls = []
window.fetch = async (url, options = {}) => {
  const path = String(url)
  const body = options.body ? JSON.parse(options.body) : null
  window.calls.push({ path, method: options.method || 'GET', body })
  if (path.endsWith('/turn-clock'))
    return Response.json({
      tick: {
        clock: {
          active: false,
          turnNumber: null,
          combatantId: null,
          deadlineAt: null,
          expired: false,
          turnTimerSeconds: null,
        },
        battle: null,
        timedOut: false,
      },
    })
  if (canonicalCase && (path.endsWith('/preview') || /\/(commit|intents)$/.test(path))) {
    const intent = body.intent
    const input = {
      state: canonicalState,
      actorId: ids[0],
      root: { kind: 'canonical', source: canonicalCapture, behaviorId: intent.behaviorId },
      selection: intent.target,
      movementPath: intent.movementPath,
      manualModifiers: intent.manualModifiers,
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(canonicalState, canonicalCapture),
    }
    try {
      if (path.endsWith('/preview')) {
        const quote = prepareCombatAbilityCommand(input)
        const before = readPv1fActionEconomy(canonicalState)?.current ?? 0
        const cost = quote.costs.find((cost) => cost.resource === 'ap')?.amount ?? 0
        return Response.json({
          battlePreview: {
            battleSessionId: 'fixture',
            battleVersion: window.fixtureBattle.battleVersion,
            preview: {
              ...quote.evaluation,
              // Fixture DTO only: all fixture participants are explicitly public owner captures.
              commandCosts: ['ap', 'mp', 'hp'].map((resource) => ({
                resource,
                amount: quote.costs.find((cost) => cost.resource === resource)?.amount ?? 0,
              })),
              commandCooldowns: quote.participants.flatMap((participant, index) =>
                participant.cooldown
                  ? [
                      {
                        actionId: participant.abilityId,
                        contentVersion: participant.contentVersion,
                        behaviorId: participant.behaviorId,
                        role: index === 0 ? 'root' : 'manual-modifier',
                        ownerTurns: participant.cooldown.ownerTurns,
                        ticksRemaining: readSkillCooldown(
                          canonicalState.tactical.battle.combatants[0],
                          participant.cooldown,
                        ).ticksRemaining,
                      },
                    ]
                  : [],
              ),
              hitChanceBasisPoints:
                quote.evaluation.targetHitChances?.find(
                  (row) => row.targetCombatantId === quote.evaluation.primaryCombatantId,
                )?.hitChanceBasisPoints ?? null,
              defenseKind: null,
              defenseRating: null,
              mitigatedBaseDamage: null,
              ...(canonicalCase.startsWith('controlled-') || canonicalCase === 'modifier-controlled'
                ? {
                    controlledReady:
                      quote.evaluation.legal &&
                      before >= cost &&
                      combatControlledAbilityAvailability({
                        state: canonicalState,
                        actorId: ids[0],
                        sourceInstanceId: canonicalCapture.sourceInstanceId,
                        behaviorId: intent.behaviorId,
                      })?.phase === 'primed',
                  }
                : {}),
              kind: 'action',
              actionEconomyCost: cost,
              actionEconomyBefore: before,
              actionEconomyAfter: before - cost,
              projectedStatuses: [],
            },
          },
        })
      }
      if (body.expectedBattleVersion !== window.fixtureBattle.battleVersion)
        return Response.json({ error: { message: 'Stale battle version.' } }, { status: 409 })
      const transition =
        intent.kind === 'ability-prime' || intent.kind === 'ability-cancel-prime'
          ? (intent.kind === 'ability-prime'
              ? primeCombatControlledAbility
              : cancelCombatControlledAbility)({
              state: canonicalState,
              actorId: ids[0],
              sourceInstanceId: canonicalCapture.sourceInstanceId,
              behaviorId: intent.behaviorId,
              manualModifiers: intent.manualModifiers,
            })
          : commitCombatAbilityCommand(input)
      canonicalState = transition.state
      window.receipts = transition.events
      window.fixtureBattle = {
        ...window.fixtureBattle,
        battleVersion: window.fixtureBattle.battleVersion + 1,
        snapshot: canonicalPublicState(canonicalState),
      }
      return Response.json({ battle: window.fixtureBattle })
    } catch (error) {
      return Response.json({ error: { message: error.message } }, { status: 409 })
    }
  }
  if (path === '/api/account/controls') {
    if (options.method === 'PUT')
      return Response.json({ controls: { combatKeybinds: body.combatKeybinds } })
    if (new URLSearchParams(location.search).get('controls') === 'delayed')
      await new Promise((resolve) => {
        window.releaseControls = resolve
      })
    return Response.json({ controls: { combatKeybinds: fixtureControls } })
  }
  if (path.includes('/chat')) {
    if (options.method === 'POST')
      return Response.json({ error: { message: 'Fixture send unavailable.' } }, { status: 503 })
    return Response.json({
      messages: [
        {
          id: 1,
          body: 'A local fixture message for checking battle chat layout.',
          senderCharacterId: metadata.localCharacterId,
          senderCharacterName: 'Wayfarer',
          createdAt: '2026-10-12T19:50:00.000Z',
        },
      ],
      spectators: [],
      spectatorCount: 0,
    })
  }
  if (path.endsWith('/events'))
    return new Response(JSON.stringify({ battleLog: { entries: suppressChronicleEntries } }))
  if (targetingCase && path.endsWith('/preview')) {
    if (window.previewFailure === 'http')
      return Response.json(
        { error: { code: 'TEMPORARY', message: 'Forecast unavailable.' } },
        { status: 503 },
      )
    if (window.previewFailure === 'network') throw new Error('Forecast connection failed.')

    const intent = body.intent
    const source = window.fixtureBattle.snapshot
    if (intent.kind === 'move') {
      const result = evaluatePv1fMovement(source, intent.path)
      const before = readPv1fActionEconomy(result.prepared)?.current ?? 0
      return Response.json({
        battlePreview: {
          battleSessionId: 'fixture',
          battleVersion: window.fixtureBattle.battleVersion,
          preview: {
            ...result.movement,
            kind: 'move',
            legal: result.movement.legal && before >= result.economyCost,
            actionEconomyCost: result.economyCost,
            actionEconomyBefore: before,
            actionEconomyAfter: before - result.economyCost,
          },
        },
      })
    }
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
  if (targetingCase && /\/(commit|intents|final-turn)$/.test(path)) {
    if (body.expectedBattleVersion !== window.fixtureBattle.battleVersion)
      return Response.json({ message: 'Stale battle version.' }, { status: 409 })
    try {
      const intent = body.intent ?? { kind: 'face', facing: body.facing }
      const transition =
        intent.kind === 'face'
          ? finishPv1fTurn(window.fixtureBattle.snapshot, intent.facing)
          : intent.kind === 'move'
            ? executePv1fMovement(window.fixtureBattle.snapshot, intent.path)
            : intent.actionId === window.targetingDefinition.id
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
      window.commitFailure = error.message
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
window.restoreCanonicalBattle = () => {
  canonicalState = JSON.parse(JSON.stringify(canonicalState))
  window.fixtureBattle = {
    ...window.fixtureBattle,
    battleVersion: window.fixtureBattle.battleVersion + 1,
    snapshot: canonicalPublicState(canonicalState),
  }
  window.publishBattle()
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
if (mode === 'controls')
  fixtureRoot.render(<CombatControlsSettings initialBindings={fixtureControls} />)
else if (mode === 'master-ground') fixtureRoot.render(<GroundEditorHarness />)
else
  fixtureRoot.render(
    <AudioProvider>
      {dotCase ? (
        <SkillEffectTimingProvider
          policy={initialBattle.snapshot.effectTimingPolicy ?? null}
          dotTriggerPolicyVersion={initialBattle.snapshot.dotTriggerPolicyVersion ?? null}
        >
          <DotDefinitionReport />
        </SkillEffectTimingProvider>
      ) : null}
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
          {mode === 'pvp' && new URLSearchParams(location.search).has('chat') ? (
            <>
              <PvpBattleChatBridge battleSessionId="fixture" metadata={metadata} />
              <PvpBattleQualityControls
                battleSessionId="fixture"
                initialBattle={initialBattle}
                metadata={metadata}
              />
            </>
          ) : null}
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
