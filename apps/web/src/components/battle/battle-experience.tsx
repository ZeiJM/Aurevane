'use client'

import { BATTLE_EFFECT_KEYBOARD_HELP } from './battle-effect-keyboard-navigation'

import {
  findBattleBasicAction,
  battleBasicCostLabel,
  canAffordBattleBasicAction,
} from '@/lib/battle/battle-basic-actions'
import {
  battleCapturedActionChoices,
  battleCapturedActionCost,
  battleCapturedControlledAvailability,
  battleCapturedSpecialAction,
  battleSkillCastMode,
} from './battle-captured-action-cost'
import { airborneJump } from '@aurevane/game-core/combat/combat-airborne'
import { hasGameplayTag } from '@aurevane/game-core/combat/gameplay-tags'
import { BattleGroundAreaLayer } from './battle-ground-area-layer'

import {
  SkillEffectTimingProvider,
  AirborneAttackElevationContext,
} from '../character/skill-effect-timing-context'

import {
  isBattleShortcutBlocked as isTextEntryTarget,
  restoreBattleKeyboardFocus,
} from './battle-keyboard-scope'
import { useBattleTabCyclePrevention } from './battle-tab-cycle-prevention'
import { routeBattleAbilityShortcut } from './battle-ability-shortcuts'

import {
  isCurrentBattlePreview,
  selectBattleSkillPreviewIntent,
  selectInitialBattleSkillPreviewIntent,
  selectBattleSkillMovementCommitIntent,
  selectDirectionalBattleSkillPreviewIntent,
  battleSkillUsesAreaActivation,
  battleSkillTargetSpec,
  battleActionDescriptorWithElevation,
  canRetainBattleActionPreview,
  resolveBattleCapturedSkill,
  toggleBattleSkillTargetSelection,
  battleTargetDraftIncludesTile,
  bindBattleSkillMovement,
  selectBattleControlledPrimeIntent,
  type BattleActionMovementDraft,
  type BattlePreviewSkill,
  battleSkillIntentMetadata,
} from './battle-preview-selection'
import {
  battleModifierChoices,
  battleModifierContextForAction,
  battleRecoveryActionId,
  battleModifierActionMode,
} from './battle-modifier-picker-model'
import {
  battleManualModifierReferences,
  resolveBattleModifierDraft,
  type BattleModifierDraft,
} from './battle-modifier-draft'
import { combatNativeModifierRootFacts } from '@aurevane/game-core/combat/combat-modifier-compatibility'
import { BattleActionPreview } from './battle-action-preview'
import { useBattleRangePreviews } from './use-battle-range-previews'
import { battleRangePreviewIntents } from './battle-range-previews'
import { requestBattlePreview } from './battle-preview-request'
import { BattleChronicleHeading } from './battle-chronicle-heading'
import { BattleTerrainToggle } from './battle-terrain-toggle'
import { BattleInfoPopover } from './battle-info-popover'
import { terrainOverlayAt } from '@aurevane/game-core/combat/terrain-overlays'
import { getTacticalHallRecordFromScenarioSourceId } from '@aurevane/game-core/combat/tactical-hall-records'
import { terrainOverlayDescription } from '../../lib/battle/combat-interaction-presentation'
import { describeTerrainLabel } from './battle-inspect-terrain-context'

import {
  PV1F_BASIC_ATTACK_COST,
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_MP_RECOVER_COST,
  PV1F_RECOVER_ACTION_ID,
  PV1F_RECOVER_COST,
  pv1fSkillByActionId,
} from '@aurevane/game-core/combat/pv1f-skills'
import {
  DEFAULT_SUPPORT_ACTION_ID,
  parseSupportActionId,
} from '@aurevane/game-core/combat/support-actions'
import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import { useRouter } from 'next/navigation'
import { battleReturnNavigation } from './battle-return-navigation'
import {
  battleRecoveryNotice,
  participantPollDelay,
  shouldPollParticipant,
} from './battle-recovery-navigation'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
import type { RecruitTurnView } from '@/server/battle/battle-recruit-ai-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'
import { getImageAsset } from '@/media/registry'

import { pvpParticipantAccent } from './battle-combatant-colors'
import { BattleFacingIndicator } from './battle-facing-indicator'
import { useBattleInteractionLifecycle } from './battle-interaction-lifecycle'
import {
  buildMovementPaths,
  buildReachablePaths,
  buildDisplayedPlacementByTile,
  facingGlyph,
  meterPercent,
  MOVE_COST_PER_TERRAIN_POINT,
  positionKey,
  positionsEqual,
  type BattleGridPosition,
} from './battle-geometry'
import {
  battleParticipantName,
  buildBattleViewModel,
  deriveBattleCapabilities,
  type BattlePresentationParticipant,
  type BattleRuntime,
} from './battle-runtime'
import { BattleCombatantCard } from './battle-combatant-card'
import {
  selectBattleCombatantRails,
  type BattleAllyInspection,
} from './battle-combatant-rail-selection'
import { BattleVersusEmblem } from './battle-versus-emblem'
import { BattleLogPanel } from './battle-log-panel'
import {
  DEFAULT_COMBAT_KEYBINDS,
  COMBAT_KEYBIND_ACTIONS,
  parseCombatKeybindMap,
  formatCombatKeybind,
  type CombatKeybindMap,
} from '@aurevane/validation/player/combat-controls'
import { BattleSelectedSkills } from './battle-selected-skills'
import { battleActionCooldownTurns } from './battle-action-cooldown'

import {
  battleTargetReachTiles,
  battleActionDealsDamage,
  type BattleTargetAim,
} from './battle-attack-path'
import { combatCardinalDirections } from '@aurevane/game-core/combat/combat-targeting-shapes'
import { battleActionUsesRecoverySelection } from './battle-recovery-selection'
import {
  PV1F_COMBAT_CONTENT,
  createPv1fBasicAttackDefinition,
  PV1F_GUARD_ACTION,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { BattleSkillCommand } from './battle-skill-command'
import {
  BATTLE_COMMAND_ARTWORK,
  BATTLE_MISSING_ARTWORK,
  battleSkillArtwork,
  battleResonanceArtwork,
} from './battle-skill-presentation'
import { useBattleSkillSelections } from './battle-skill-selection'
import styles from './pvp-battle-experience.module.css'
import surrenderStyles from './battle-surrender-dialog.module.css'
import bridgeStyles from './unified-battle-experience.module.css'

const BASIC_ATTACK_ID = PV1F_BASIC_ATTACK_ID
const COCKPIT_ORNAMENT_STYLE = {
  '--av-battle-cockpit-ornament': `url("${getImageAsset('ui.battle.cockpit-ornament.v01').src}")`,
} as CSSProperties
const GUARD_ID = PV1F_GUARD_ACTION_ID
const RECOVER_ID = PV1F_RECOVER_ACTION_ID
const MP_RECOVER_ID = PV1F_MP_RECOVER_ACTION_ID
const ACTION_ECONOMY_KEY = 'pv1f.action-economy'
const ATTACK_COST = PV1F_BASIC_ATTACK_COST
const RECOVER_COST = PV1F_RECOVER_COST
const MP_RECOVER_COST = PV1F_MP_RECOVER_COST
const COMMIT_POLL_RETRY_MS = 120

const HEAL_SELECTOR_OPTIONS = [
  {
    id: RECOVER_ID,
    label: 'HP Recovery',
    cost: `${RECOVER_COST} AP`,
    artworkSrc: battleSkillArtwork(RECOVER_ID),
    tags: ['Self', 'Healing'],
  },
  {
    id: MP_RECOVER_ID,
    label: 'MP Recovery',
    cost: `${MP_RECOVER_COST} AP`,
    artworkSrc: battleSkillArtwork(MP_RECOVER_ID),
    tags: ['Self', 'MP Restore'],
  },
] as const

const BATTLE_SKILL_CATEGORIES = {
  heal: {
    defaultSkillId: RECOVER_ID,
    skillIds: HEAL_SELECTOR_OPTIONS.map((option) => option.id),
  },
} as const

type Mode = 'none' | 'inspect' | 'move' | 'attack' | 'guard' | 'recover' | 'finish'
type Tactical = BattleSessionView['snapshot']['tactical']
type Combatant = Tactical['battle']['combatants'][number]

type ApiErrorBody = {
  error?: {
    code?: string
    message?: string
    currentVersion?: number
  }
}

type ReadyBattlePreview = { intent: BattleIntent; version: number; sequence: number }

function readEconomy(combatant: Combatant | null): number {
  if (!combatant) return 0
  return (
    combatant.temporaryResources.find((resource) => resource.key === ACTION_ECONOMY_KEY)?.current ??
    0
  )
}

function teamLabel(teamIndex: number, teamCount: number): string {
  if (teamCount === 3) return `Faction ${String.fromCharCode(65 + teamIndex)}`
  return teamIndex === 0 ? 'Vanguard' : 'Challengers'
}

function livingTeamIndexes(
  battle: BattleSessionView,
  participants: ReadonlyMap<string, BattlePresentationParticipant>,
): Set<number> {
  const result = new Set<number>()
  for (const combatant of battle.snapshot.tactical.battle.combatants) {
    if (combatant.hp <= 0) continue
    const participant = participants.get(combatant.id)
    if (participant) result.add(participant.teamIndex)
  }
  return result
}

export function describeRecruitTurn(
  before: BattleSessionView,
  after: BattleSessionView,
  decisions: RecruitTurnView['decisions'],
  recruitId: string | null,
  recruitName: string,
  participants: ReadonlyMap<string, BattlePresentationParticipant>,
): string {
  if (!recruitId) return `${recruitName} turn resolved.`

  const beforeRecruitPlacement = before.snapshot.tactical.placements.find(
    (placement) => placement.combatantId === recruitId,
  )
  const afterRecruitPlacement = after.snapshot.tactical.placements.find(
    (placement) => placement.combatantId === recruitId,
  )
  const beforeRecruit = before.snapshot.tactical.battle.combatants.find(
    (combatant) => combatant.id === recruitId,
  )
  const afterRecruit = after.snapshot.tactical.battle.combatants.find(
    (combatant) => combatant.id === recruitId,
  )
  const beforeBattle = before.snapshot.tactical.battle
  const afterBattle = after.snapshot.tactical.battle
  const beforeTurn = beforeBattle.currentTurn
  const economy = beforeRecruit?.temporaryResources.find(
    (resource) => resource.key === ACTION_ECONOMY_KEY,
  )
  if (
    beforeBattle.lifecycle === 'active' &&
    beforeTurn?.combatantId === recruitId &&
    beforeTurn.actionState === 'ready' &&
    beforeTurn.movementSpent === 0 &&
    economy &&
    economy.current === economy.maximum &&
    (afterBattle.turnNumber > beforeBattle.turnNumber || afterBattle.lifecycle === 'completed') &&
    decisions.length > 0 &&
    decisions.every(
      (decision) =>
        decision.combatantId === recruitId &&
        (decision.reason === 'face-threat' || decision.reason === 'safe-end-turn'),
    )
  ) {
    return `${recruitName} stands around and does nothing.`
  }
  const recruitStatuses =
    after.snapshot.statusState.find((row) => row.combatantId === recruitId)?.statuses ?? []
  const parts: string[] = []

  if (
    beforeRecruitPlacement &&
    afterRecruitPlacement &&
    !positionsEqual(beforeRecruitPlacement.position, afterRecruitPlacement.position)
  ) {
    parts.push(
      `moved ${beforeRecruitPlacement.position.x + 1},${beforeRecruitPlacement.position.y + 1} → ${afterRecruitPlacement.position.x + 1},${afterRecruitPlacement.position.y + 1}`,
    )
  }
  const damageTargets = before.snapshot.tactical.battle.combatants.flatMap((combatant) => {
    const afterCombatant = after.snapshot.tactical.battle.combatants.find(
      (row) => row.id === combatant.id,
    )
    const damage = afterCombatant ? combatant.hp - afterCombatant.hp : 0
    return combatant.id !== recruitId && damage > 0
      ? [`${participants.get(combatant.id)?.name ?? combatant.id} for ${damage}`]
      : []
  })
  if (damageTargets.length) parts.push(`hit ${damageTargets.join(', ')}`)
  else if (decisions.some((decision) => decision.reason === 'legal-damage'))
    parts.push('attacked but dealt no damage')
  if (beforeRecruit && afterRecruit && afterRecruit.hp > beforeRecruit.hp) {
    parts.push(`recovered ${afterRecruit.hp - beforeRecruit.hp} HP`)
  }
  if (recruitStatuses.some((status) => status.statusId === 'guarded')) {
    parts.push('Guarded (-15% damage)')
  }
  if (afterRecruitPlacement) {
    parts.push(`finished facing ${afterRecruitPlacement.facing}`)
  }

  return parts.length > 0
    ? `${recruitName}: ${parts.join(' → ')}.`
    : `${recruitName} turn resolved.`
}

export function BattleExperience(props: {
  initialBattle: BattleSessionView
  runtime: BattleRuntime
}) {
  useBattleTabCyclePrevention()
  return (
    <SkillEffectTimingProvider
      policy={props.initialBattle.snapshot.effectTimingPolicy ?? null}
      dotTriggerPolicyVersion={props.initialBattle.snapshot.dotTriggerPolicyVersion ?? null}
      frozenGroundPolicyVersion={props.initialBattle.snapshot.frozenGroundPolicyVersion ?? null}
      elementalDamagePolicyVersion={
        props.initialBattle.snapshot.elementalDamagePolicyVersion ?? null
      }
      airbornePolicyVersion={props.initialBattle.snapshot.airbornePolicyVersion ?? null}
      airborneJumpPolicyVersion={props.initialBattle.snapshot.airborneJumpPolicyVersion ?? null}
      healingDownPolicyVersion={props.initialBattle.snapshot.healingDownPolicyVersion ?? null}
      blindsideActivationPolicyVersion={
        props.initialBattle.snapshot.blindsideActivationPolicyVersion ?? null
      }
    >
      <BattleExperienceContent {...props} />
    </SkillEffectTimingProvider>
  )
}

function BattleExperienceContent({
  initialBattle,
  runtime,
}: {
  initialBattle: BattleSessionView
  runtime: BattleRuntime
}) {
  const router = useRouter()
  const [battle, setBattleState] = useState(initialBattle)
  const [mode, setMode] = useState<Mode>('none')
  const [path, setPath] = useState<BattleGridPosition[]>([])
  const pathRef = useRef<BattleGridPosition[]>([])
  const [pendingIntent, setPendingIntent] = useState<BattleIntent | null>(null)
  const pluralSelection = useRef<Extract<BattleIntent, { kind: 'action' }> | null>(null)
  const [actionMovementDraft, setActionMovementDraft] = useState<BattleActionMovementDraft | null>(
    null,
  )
  const [selectedBehavior, setSelectedBehavior] = useState<{
    actionId: string
    behaviorId: string
  } | null>(null)
  const [modifierDraft, setModifierDraftState] = useState<BattleModifierDraft | null>(null)
  const modifierDraftRef = useRef<BattleModifierDraft | null>(null)
  const replaceModifierDraft = useCallback((next: BattleModifierDraft | null) => {
    modifierDraftRef.current = next
    setModifierDraftState(next)
  }, [])
  const [preview, setPreview] = useState<(BattlePreviewView & { intent: BattleIntent }) | null>(
    null,
  )
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [targetAim, setTargetAim] = useState<BattleTargetAim>({ aimSource: 'implicit' })
  const [inspectedUnitId, setInspectedUnitId] = useState<string | null>(null)
  const [inspectedEnemyUnitId, setInspectedEnemyUnitId] = useState<string | null>(null)
  const [allyInspection, setAllyInspection] = useState<BattleAllyInspection | null>(null)
  const [inspectedTile, setInspectedTile] = useState<BattleGridPosition | null>(null)
  const [bindings, setBindings] = useState<CombatKeybindMap>(DEFAULT_COMBAT_KEYBINDS)
  const executionLock = useRef(false)
  const [executionPending, setExecutionPending] = useState(false)
  useEffect(() => {
    let cancelled = false
    void fetch('/api/account/controls', { cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json()) as { controls?: { combatKeybinds?: unknown } }
        const parsed = parseCombatKeybindMap(body.controls?.combatKeybinds)
        if (!cancelled && response.ok && parsed) {
          setBindings(parsed)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  const [notice, setNotice] = useState(
    runtime.kind === 'pvp'
      ? 'Arena linked. Waiting for the authoritative turn state.'
      : 'Your turn. Choose any action when you are ready.',
  )
  const [previewPending, setPreviewPending] = useState(false)
  const [commitPending, setCommitPending] = useState(false)
  const [copyNotice, setCopyNotice] = useState(false)
  const [recruitPending, setRecruitPending] = useState(false)
  const [recruitFailed, setRecruitFailed] = useState(false)
  const [surrenderOpen, setSurrenderOpen] = useState(false)
  const [surrenderPending, setSurrenderPending] = useState(false)

  const previewSequence = useRef(0)
  const mounted = useRef(true)
  const previewController = useRef<AbortController | null>(null)
  const readyPreview = useRef<ReadyBattlePreview | null>(null)
  const inFlightPreview = useRef<
    (ReadyBattlePreview & { result: Promise<ReadyBattlePreview | null | undefined> }) | null
  >(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      previewSequence.current += 1
      readyPreview.current = null
      inFlightPreview.current = null
      previewController.current?.abort()
    }
  }, [])
  const commitLock = useRef(false)
  const battleRef = useRef(initialBattle)
  const setBattle = useCallback(
    (next: BattleSessionView) => {
      replaceModifierDraft(null)
      setBattleState(next)
    },
    [replaceModifierDraft],
  )
  const battlePollInFlight = useRef(false)
  const battlePollController = useRef<AbortController | null>(null)
  const recruitAttemptedVersion = useRef<number | null>(null)
  const recruitLock = useRef(false)
  const rearmActionAfterCommit = useRef<{
    intent: Extract<BattleIntent, { kind: 'action' | 'ability-prime' | 'ability-cancel-prime' }>
    version: number
  } | null>(null)
  const modeRef = useRef<Mode>('none')
  useLayoutEffect(() => {
    modeRef.current = mode
  }, [mode])
  const { registerFinishTurnHandler, registerInspectCloseHandler } = useBattleInteractionLifecycle()

  const { selectedSkillId } = useBattleSkillSelections(
    initialBattle.battleSessionId,
    BATTLE_SKILL_CATEGORIES,
  )
  const selectedHealActionId = selectedSkillId('heal')
  const selectableTechniques = useMemo(
    () =>
      (runtime.techniques ?? [])
        .filter((skill) => battleSkillCastMode(skill).canCast)
        .map((skill) => ({
          ...skill,
          groundIntentCapable:
            (battle.snapshot.elementalDamagePolicyVersion === 1 ||
              battle.snapshot.elementalDamagePolicyVersion === 2) &&
            (skill.targetKind === 'unit' ||
              (battle.snapshot.elementalDamagePolicyVersion === 2 &&
                skill.targetKind === 'ground-tile')) &&
            skill.targetTeamPolicy === 'enemy' &&
            skill.definition?.effects.some(
              (effect) => effect.type === 'damage' && effect.element === 'fire',
            ),
        })),
    [runtime.techniques, battle.snapshot.elementalDamagePolicyVersion],
  )
  const attackTechniques = selectableTechniques.filter(
    (technique) => technique.category === 'attack',
  )
  const defenseTechniques = selectableTechniques.filter(
    (technique) => technique.category === 'defense',
  )
  const healTechniques = selectableTechniques.filter((technique) => technique.category === 'heal')
  const skillArtwork = (technique: (typeof selectableTechniques)[number]) =>
    battleSkillArtwork(technique.id, technique.iconKey)
  const capabilities = useMemo(() => deriveBattleCapabilities(runtime), [runtime])
  const viewModel = useMemo(() => buildBattleViewModel(battle, runtime), [battle, runtime])
  const localCombatantId = viewModel.localCombatantId
  const localCombatant = localCombatantId
    ? (battle.snapshot.tactical.battle.combatants.find(
        (combatant) => combatant.id === localCombatantId,
      ) ?? null)
    : null
  const manualActionTargets = useMemo(
    () =>
      (battle.snapshot.manualActionTargets ?? []).filter(
        (row) => !row.ownerCombatantId || row.ownerCombatantId === localCombatantId,
      ),
    [battle.snapshot.manualActionTargets, localCombatantId],
  )
  const modifierNames = useMemo(
    () => [
      ...(runtime.techniques ?? []).map((row) => ({
        id: row.id,
        contentVersion: row.contentVersion,
        name: row.name,
      })),
      ...(runtime.essence
        ? [
            {
              id: runtime.essence.id,
              contentVersion: runtime.essence.contentVersion,
              name: runtime.essence.name,
            },
          ]
        : []),
      ...(runtime.resonance
        ? [
            {
              id: runtime.resonance.id,
              contentVersion: runtime.resonance.contentVersion,
              name: runtime.resonance.name,
            },
          ]
        : []),
      ...(battle.snapshot.basicActions ?? [])
        .filter((row) => row.ownerCombatantId === localCombatantId)
        .map((row) => ({ id: row.actionId, contentVersion: row.contentVersion, name: row.name })),
    ],
    [
      runtime.techniques,
      runtime.essence,
      runtime.resonance,
      battle.snapshot.basicActions,
      localCombatantId,
    ],
  )
  const ownedModifierChoices = useMemo(
    () =>
      battleModifierChoices(
        battle.snapshot.manualModifierAvailability ?? [],
        localCombatantId,
        modifierNames,
      ),
    [battle.snapshot.manualModifierAvailability, localCombatantId, modifierNames],
  )
  const modifierPins = useMemo(
    () => ownedModifierChoices.flatMap((choice) => (choice.pin ? [choice.pin] : [])),
    [ownedModifierChoices],
  )
  const special = useMemo(
    () =>
      battleCapturedSpecialAction(
        runtime,
        manualActionTargets,
        localCombatantId,
        battle.snapshot.elementalDamagePolicyVersion,
        selectedBehavior && selectedBehavior.actionId === runtime.resonance?.id
          ? selectedBehavior.behaviorId
          : undefined,
      ),
    [
      runtime,
      manualActionTargets,
      localCombatantId,
      battle.snapshot.elementalDamagePolicyVersion,
      selectedBehavior,
    ],
  )
  const selectableSpecial = special?.skill
  const specialOption = selectableSpecial
    ? {
        id: selectableSpecial.id,
        label: selectableSpecial.name,
        artworkSrc:
          special.kind === 'resonance'
            ? battleResonanceArtwork(selectableSpecial.id)
            : battleSkillArtwork(selectableSpecial.id, selectableSpecial.iconKey),
        tags: selectableSpecial.tags,
      }
    : undefined
  const skillCostLabel = (skill: { id: string; apCost: number; mpCost: number }) =>
    battleCapturedActionCost(
      battleCapturedActionChoices(manualActionTargets, skill.id, localCombatantId),
      [
        { resource: 'ap', amount: skill.apCost },
        { resource: 'mp', amount: skill.mpCost },
      ],
      {
        ap: readEconomy(localCombatant),
        mp: localCombatant?.mp ?? 0,
        hp: localCombatant?.hp ?? 0,
      },
      selectedBehavior?.actionId === skill.id ? selectedBehavior.behaviorId : undefined,
    ).costLabel
  const basicMove = findBattleBasicAction(battle.snapshot, localCombatantId, 'basic.move')
  const basicAttack = findBattleBasicAction(battle.snapshot, localCombatantId, BASIC_ATTACK_ID)
  const attackLabel = basicAttack?.name ?? 'Basic Attack'
  const basicBehaviorId = useCallback(
    (actionId: string) =>
      selectedBehavior?.actionId === actionId ? selectedBehavior.behaviorId : undefined,
    [selectedBehavior],
  )
  const [selectedAttackActionId, setSelectedAttackActionId] = useState<string>(BASIC_ATTACK_ID)
  const supportActionId = String(
    parseSupportActionId(runtime.supportActionId) ?? DEFAULT_SUPPORT_ACTION_ID,
  )
  const basicSupport = findBattleBasicAction(battle.snapshot, localCombatantId, supportActionId)
  const basicPracticeGuard = findBattleBasicAction(battle.snapshot, localCombatantId, GUARD_ID)
  const supportSkill = pv1fSkillByActionId(supportActionId)!
  const supportLabel = basicSupport?.name ?? supportSkill.name
  const supportCost = supportSkill.cost.kind === 'flat' ? supportSkill.cost.amount : 0
  const guidedGuardPractice =
    runtime.kind === 'pve' &&
    supportActionId !== GUARD_ID &&
    battle.snapshot.statBridge.combatants.some(
      (profile) =>
        profile.provenance.kind === 'scenario' &&
        getTacticalHallRecordFromScenarioSourceId(profile.provenance.sourceId)?.id ===
          'guided-fundamentals',
    )
  const [selectedDefenseActionId, setSelectedDefenseActionId] = useState<string>(supportActionId)
  const [selectedTechniqueHealId, setSelectedTechniqueHealId] = useState<string | null>(null)
  const attackOptions = [
    {
      id: BASIC_ATTACK_ID,
      label: attackLabel,
      cost: battleBasicCostLabel(
        basicAttack,
        `${ATTACK_COST} AP`,
        basicBehaviorId(BASIC_ATTACK_ID),
      ),
      artworkSrc: BATTLE_COMMAND_ARTWORK.attack,
      tags: ['Enemy', 'Single target', 'Damage'],
    },
    ...attackTechniques.map((technique) => ({
      id: technique.id,
      label: technique.name,
      cost: skillCostLabel(technique),
      artworkSrc: skillArtwork(technique),
      tags: technique.tags,
    })),
    ...(specialOption && special?.category === 'attack'
      ? [{ ...specialOption, cost: skillCostLabel(selectableSpecial!) }]
      : []),
  ]
  const defenseOptions = [
    {
      id: supportActionId,
      label: supportLabel,
      cost: battleBasicCostLabel(
        basicSupport,
        `${supportCost} AP`,
        basicBehaviorId(supportActionId),
      ),
      artworkSrc: battleSkillArtwork(supportActionId),
      tags: ['Self', 'Support Action'],
    },
    ...(guidedGuardPractice
      ? [
          {
            id: GUARD_ID,
            label: 'Guard',
            cost: battleBasicCostLabel(basicPracticeGuard, '30 AP', basicBehaviorId(GUARD_ID)),
            artworkSrc: battleSkillArtwork(GUARD_ID, basicPracticeGuard?.iconKey),
            tags: ['Self', 'Guard'],
          },
        ]
      : []),
    ...defenseTechniques.map((technique) => ({
      id: technique.id,
      label: technique.name,
      cost: skillCostLabel(technique),
      artworkSrc: skillArtwork(technique),
      tags: technique.tags,
    })),
    ...(specialOption && special?.category === 'defense'
      ? [{ ...specialOption, cost: skillCostLabel(selectableSpecial!) }]
      : []),
  ]
  const recoveryOptions = [
    ...HEAL_SELECTOR_OPTIONS.filter(
      (option) => findBattleBasicAction(battle.snapshot, localCombatantId, option.id) !== null,
    ).map((option) => ({
      ...option,
      label:
        findBattleBasicAction(battle.snapshot, localCombatantId, option.id)?.name ?? option.label,
      cost: battleBasicCostLabel(
        findBattleBasicAction(battle.snapshot, localCombatantId, option.id),
        option.cost,
        basicBehaviorId(option.id),
      ),
    })),
    ...healTechniques.map((technique) => ({
      id: technique.id,
      label: technique.name,
      cost: skillCostLabel(technique),
      artworkSrc: skillArtwork(technique),
      tags: technique.tags,
    })),
    ...(specialOption && special?.category === 'heal'
      ? [{ ...specialOption, cost: skillCostLabel(selectableSpecial!) }]
      : []),
  ]
  const selectedAttack =
    attackOptions.find((option) => option.id === selectedAttackActionId) ?? attackOptions[0]!
  const selectedDefense =
    defenseOptions.find((option) => option.id === selectedDefenseActionId) ?? defenseOptions[0]!
  const preferredHealId = String(selectedTechniqueHealId ?? selectedHealActionId)
  const selectedOwnedRecoveryGroups =
    selectableTechniques.some((row) => row.id === preferredHealId) ||
    selectableSpecial?.id === preferredHealId
      ? manualActionTargets.filter(
          (row) =>
            row.actionId === preferredHealId &&
            (selectedBehavior?.actionId !== preferredHealId ||
              row.behaviorId === selectedBehavior.behaviorId),
        )
      : []
  const effectiveHealActionId = String(
    battleRecoveryActionId(
      preferredHealId,
      recoveryOptions.map((option) => option.id),
      selectedOwnedRecoveryGroups,
    ),
  )
  const tactical = battle.snapshot.tactical
  const battleState = tactical.battle
  const localParticipant = viewModel.localParticipant
  const canPrimeAction = useCallback(
    (actionId: string) => {
      const behaviorId =
        selectedBehavior?.actionId === actionId ? selectedBehavior.behaviorId : undefined
      return manualActionTargets.some(
        (row) =>
          row.actionId === actionId &&
          (!behaviorId || row.behaviorId === behaviorId) &&
          row.controlled?.canPrime,
      )
    },
    [manualActionTargets, selectedBehavior],
  )
  const primeAvailableIds = [
    ...new Set(
      manualActionTargets.filter((row) => canPrimeAction(row.actionId)).map((row) => row.actionId),
    ),
  ]
  const controlledAvailabilityForAction = useCallback(
    (actionId: string) =>
      battleCapturedControlledAvailability(
        battleCapturedActionChoices(manualActionTargets, actionId, localCombatantId),
        selectedBehavior?.actionId === actionId ? selectedBehavior.behaviorId : undefined,
      ),
    [manualActionTargets, localCombatantId, selectedBehavior],
  )
  const actionCooldownTurns = useCallback(
    (actionId: string) =>
      canPrimeAction(actionId) || controlledAvailabilityForAction(actionId).chooseAction
        ? 0
        : battleActionCooldownTurns(
            battleRef.current,
            runtime,
            localCombatantId,
            actionId,
            selectedBehavior?.actionId === actionId ? selectedBehavior.behaviorId : undefined,
          ),
    [canPrimeAction, controlledAvailabilityForAction, localCombatantId, runtime, selectedBehavior],
  )
  const cooldowns = useMemo(
    () =>
      Object.fromEntries(
        [
          'basic.move',
          BASIC_ATTACK_ID,
          GUARD_ID,
          RECOVER_ID,
          MP_RECOVER_ID,
          ...selectableTechniques.map((skill) => skill.id),
          ...(selectableSpecial ? [selectableSpecial.id] : []),
        ].map((id) => [
          id,
          battleActionCooldownTurns(
            battle,
            runtime,
            localCombatantId,
            id,
            selectedBehavior?.actionId === id ? selectedBehavior.behaviorId : undefined,
          ),
        ]),
      ),
    [battle, localCombatantId, runtime, selectableTechniques, selectableSpecial, selectedBehavior],
  )
  const localProfile = battle.snapshot.statBridge.combatants.find(
    (row) => row.combatantId === localCombatantId,
  )
  const characterStats = {
    move: localCombatant?.baseMovementBudget,
    jump:
      localCombatantId && localProfile
        ? airborneJump(battle.snapshot, localCombatantId, localProfile.jump, PV1F_COMBAT_CONTENT)
        : localProfile?.jump,
    physicalPower: localProfile?.physicalPower,
    mysticPower: localProfile?.mysticPower,
  }
  const localPlacement = localCombatantId
    ? (tactical.placements.find((placement) => placement.combatantId === localCombatantId) ?? null)
    : null
  const localTeamIndex = viewModel.localTeamIndex ?? -1
  const { local: localRailParticipant, enemy: enemyParticipant } = selectBattleCombatantRails({
    viewModel,
    battleVersion: battle.battleVersion,
    allyInspection,
    selectedUnitId,
    inspectedEnemyUnitId,
  })
  const localTurn = Boolean(
    localCombatantId && battleState.currentTurn?.combatantId === localCombatantId,
  )
  const actionEconomy = localTurn ? Number(readEconomy(localCombatant)) : 0
  const planningDisabled =
    !localTurn ||
    battleState.lifecycle !== 'active' ||
    commitPending ||
    recruitPending ||
    executionPending
  const planningDisabledRef = useRef(planningDisabled)
  useLayoutEffect(() => {
    planningDisabledRef.current = planningDisabled
  }, [planningDisabled])
  const activeName = battleParticipantName(viewModel, battleState.currentTurn?.combatantId)
  const selectedHealName =
    recoveryOptions.find((option) => option.id === effectiveHealActionId)?.label ??
    selectableTechniques.find((row) => row.id === effectiveHealActionId)?.name ??
    (selectableSpecial?.id === effectiveHealActionId
      ? selectableSpecial.name
      : 'Recovery unavailable')
  const selectedAttackTechnique =
    selectableTechniques.find((technique) => technique.id === selectedAttackActionId) ??
    (selectableSpecial?.id === selectedAttackActionId ? selectableSpecial : undefined)
  const selectedDefenseTechnique =
    selectableTechniques.find((technique) => technique.id === selectedDefenseActionId) ??
    (selectableSpecial?.id === selectedDefenseActionId ? selectableSpecial : undefined)
  const selectedHealTechnique =
    selectableTechniques.find((technique) => technique.id === effectiveHealActionId) ??
    (selectableSpecial?.id === effectiveHealActionId ? selectableSpecial : undefined)
  const activeTechnique =
    mode === 'attack'
      ? selectedAttackTechnique
      : mode === 'guard'
        ? selectedDefenseTechnique
        : mode === 'recover'
          ? selectedHealTechnique
          : null
  const armedActionId =
    pendingIntent?.kind === 'action'
      ? pendingIntent.actionId
      : mode === 'guard'
        ? selectedDefenseActionId
        : mode === 'recover'
          ? effectiveHealActionId
          : null
  const meaningActionId =
    mode === 'attack'
      ? selectedAttackActionId
      : mode === 'guard'
        ? selectedDefenseActionId
        : effectiveHealActionId
  const meaningGroups = manualActionTargets.filter((row) => row.actionId === meaningActionId)
  const meaningGroup =
    selectedBehavior?.actionId === meaningActionId
      ? meaningGroups.find((row) => row.behaviorId === selectedBehavior.behaviorId)
      : meaningGroups.length === 1
        ? meaningGroups[0]
        : undefined
  const healingSelection = meaningGroup?.classification
    ? meaningGroup.classification === 'recovery'
    : battleActionUsesRecoverySelection(armedActionId, activeTechnique)
  const previewCombatants = useMemo(
    () =>
      tactical.placements.flatMap((placement) => {
        const combatant = battleState.combatants.find((item) => item.id === placement.combatantId)
        const participant = viewModel.participantByCombatant.get(placement.combatantId)
        return combatant && participant
          ? [
              {
                combatantId: combatant.id,
                teamIndex: participant.teamIndex,
                hp: combatant.hp,
                position: placement.position,
              },
            ]
          : []
      }),
    [battleState.combatants, tactical.placements, viewModel.participantByCombatant],
  )

  const placementByTile = useMemo(() => buildDisplayedPlacementByTile(tactical), [tactical])
  const moveBehaviorId =
    selectedBehavior?.actionId === 'basic.move' ? String(selectedBehavior.behaviorId) : undefined
  const reachablePaths = useMemo(
    () =>
      localTurn
        ? buildMovementPaths(battle.snapshot, localPlacement, actionEconomy, moveBehaviorId)
        : new Map<string, BattleGridPosition[]>(),
    [actionEconomy, battle.snapshot, localPlacement, localTurn, moveBehaviorId],
  )
  const maximumMoveDistance = Math.max(
    0,
    ...Array.from(reachablePaths.values(), (path) => path.length - 1),
  )

  const selectedParticipant = selectedUnitId
    ? (viewModel.participantByCombatant.get(selectedUnitId) ?? null)
    : null
  const selectedCombatant = selectedUnitId
    ? (battleState.combatants.find((combatant) => combatant.id === selectedUnitId) ?? null)
    : null
  const selectedPlacement = selectedUnitId
    ? (tactical.placements.find((placement) => placement.combatantId === selectedUnitId) ?? null)
    : null
  const proposedCost =
    preview?.preview.kind === 'move' || preview?.preview.kind === 'action'
      ? preview.preview.actionEconomyCost
      : 0
  const livingTeams = livingTeamIndexes(battle, viewModel.participantByCombatant)
  const objectiveComplete = battleState.lifecycle === 'completed'

  const updatePlanningPath = useCallback((nextPath: BattleGridPosition[]) => {
    pathRef.current = nextPath
    setPath(nextPath)
  }, [])

  const clearPlanning = useCallback(
    (nextMode: Mode = 'none') => {
      previewSequence.current += 1
      readyPreview.current = null
      inFlightPreview.current = null
      previewController.current?.abort()
      rearmActionAfterCommit.current = null
      modeRef.current = nextMode
      setMode(nextMode)
      updatePlanningPath([])
      setPendingIntent(null)
      setActionMovementDraft(null)
      pluralSelection.current = null
      setPreview(null)
      setSelectedUnitId(null)
      setTargetAim({ aimSource: 'implicit' })
      setAllyInspection(null)
      setPreviewPending(false)
    },
    [updatePlanningPath],
  )

  useEffect(() => {
    return registerInspectCloseHandler(() => {
      if (modeRef.current !== 'inspect') return
      clearPlanning()
      setNotice('Inspection closed. Choose your action.')
      restoreBattleKeyboardFocus()
    })
  }, [clearPlanning, registerInspectCloseHandler])

  useEffect(() => {
    return registerFinishTurnHandler(() => {
      if (planningDisabledRef.current) return false
      clearPlanning('finish')
      setNotice('Choose final facing with the buttons, WASD, or arrow keys to end the turn.')
      return true
    })
  }, [clearPlanning, registerFinishTurnHandler])

  const refreshBattle = useCallback(
    async (message = 'Battle state reloaded.', retainArmedAction = false) => {
      const response = await fetch(`/api/battles/${battle.battleSessionId}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
      if (!response.ok || !body.battle) {
        throw new Error(body.error?.message ?? 'The battle state could not be reloaded.')
      }
      const retainMode =
        retainArmedAction &&
        ['attack', 'guard', 'recover'].includes(modeRef.current) &&
        canRetainBattleActionPreview(battleRef.current, body.battle, localCombatantId)
      battleRef.current = body.battle
      setBattle(body.battle)
      clearPlanning(retainMode ? modeRef.current : 'none')
      setNotice(message)
      return body.battle
    },
    [battle.battleSessionId, clearPlanning, localCombatantId, setBattle],
  )

  const handleApiFailure = useCallback(
    async (response: Response, body: ApiErrorBody, fallback: string, retainArmedAction = false) => {
      if (response.status === 401) {
        router.replace('/')
        router.refresh()
        return
      }
      if (response.status === 409 && body.error?.code === 'STALE_VERSION') {
        try {
          await refreshBattle(
            'The battle changed elsewhere. Your unfinished selection was cleared.',
            retainArmedAction,
          )
        } catch (refreshError) {
          setNotice(
            refreshError instanceof Error
              ? refreshError.message
              : 'The battle changed and could not be reloaded.',
          )
        }
        return
      }
      setNotice(body.error?.message ?? fallback)
    },
    [refreshBattle, router],
  )

  const applyRemoteBattle = useCallback(
    (next: BattleSessionView) => {
      const current = battleRef.current
      if (next.battleVersion <= current.battleVersion) return

      const wasLocal =
        current.snapshot.tactical.battle.currentTurn?.combatantId === localCombatantId
      const nextBattleState = next.snapshot.tactical.battle
      const isLocal = nextBattleState.currentTurn?.combatantId === localCombatantId

      battleRef.current = next
      setBattle(next)

      if (nextBattleState.lifecycle === 'abandoned') {
        clearPlanning()
        setNotice(battleRecoveryNotice(next.snapshot))
      } else if (nextBattleState.lifecycle === 'completed') {
        clearPlanning()
        setNotice('Battle complete.')
      } else if (
        isLocal &&
        (!wasLocal || current.snapshot.tactical.battle.turnNumber !== nextBattleState.turnNumber)
      ) {
        clearPlanning()
        setNotice('Your turn. Choose your action.')
      } else if (wasLocal && !isLocal) {
        clearPlanning()
        setNotice(
          `Turn committed. Waiting for ${battleParticipantName(
            viewModel,
            nextBattleState.currentTurn?.combatantId,
          )}.`,
        )
      } else {
        // A new authoritative version invalidates drafts and quotes even within the same turn.
        const retainMode = canRetainBattleActionPreview(current, next, localCombatantId)
        clearPlanning(retainMode ? modeRef.current : 'none')
        setNotice('The battle changed elsewhere. Choose your targets again.')
      }
    },
    [clearPlanning, localCombatantId, viewModel, setBattle],
  )

  useEffect(() => {
    battleRef.current = battle
    window.dispatchEvent(
      new CustomEvent<BattleSessionView>('aurevane:battle-state', { detail: battle }),
    )
    if (runtime.kind === 'pvp') {
      window.dispatchEvent(
        new CustomEvent<BattleSessionView>('aurevane:pvp-battle-state', { detail: battle }),
      )
    }
  }, [battle, runtime.kind])

  useEffect(() => {
    const stateEvent =
      runtime.kind === 'pvp' ? 'aurevane:pvp-battle-state' : 'aurevane:battle-state'

    const receiveExternalBattleState = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const next = event.detail as BattleSessionView | undefined
      if (!next || next.battleSessionId !== battle.battleSessionId) return
      applyRemoteBattle(next)
    }

    window.addEventListener(stateEvent, receiveExternalBattleState)
    return () => window.removeEventListener(stateEvent, receiveExternalBattleState)
  }, [applyRemoteBattle, battle.battleSessionId, runtime.kind])

  useEffect(() => {
    if (!shouldPollParticipant(runtime.kind, battleState.lifecycle)) return
    let cancelled = false
    let timer: number | null = null

    const schedule = (delay: number) => {
      if (cancelled) return
      timer = window.setTimeout(poll, delay)
    }

    const nextNormalDelay = () => {
      const currentTurnId = battleRef.current.snapshot.tactical.battle.currentTurn?.combatantId
      return participantPollDelay(runtime.kind, currentTurnId === localCombatantId)
    }

    async function poll() {
      timer = null
      if (cancelled) return
      if (commitLock.current || battlePollInFlight.current) {
        schedule(COMMIT_POLL_RETRY_MS)
        return
      }

      battlePollInFlight.current = true
      const controller = new AbortController()
      battlePollController.current = controller
      try {
        const response = await fetch(`/api/battles/${battle.battleSessionId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
        if (!response.ok || !body.battle || cancelled || controller.signal.aborted) return
        if (body.battle.battleVersion > battleRef.current.battleVersion) {
          applyRemoteBattle(body.battle)
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          // The next poll repairs transient connectivity without disturbing local planning.
        }
      } finally {
        if (battlePollController.current === controller) battlePollController.current = null
        battlePollInFlight.current = false
        if (!cancelled) schedule(commitLock.current ? COMMIT_POLL_RETRY_MS : nextNormalDelay())
      }
    }

    schedule(nextNormalDelay())
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
      battlePollController.current?.abort()
      battlePollController.current = null
      battlePollInFlight.current = false
    }
  }, [
    applyRemoteBattle,
    battle.battleSessionId,
    battleState.lifecycle,
    localCombatantId,
    runtime.kind,
  ])

  const recoveryReturnHref = battleReturnNavigation(
    runtime.kind === 'pvp' ? runtime.metadata.origin : 'battle-hall',
    runtime.kind === 'pvp' ? runtime.returnTo : undefined,
  ).href
  useEffect(() => {
    if (battleState.lifecycle !== 'abandoned') return
    router.replace(recoveryReturnHref)
    router.refresh()
  }, [battleState.lifecycle, recoveryReturnHref, router])

  const requestPreview = useCallback(
    (intent: BattleIntent) => {
      if (!mounted.current) return null
      if (intent.kind === 'action' && actionCooldownTurns(intent.actionId) > 0) return null
      const pending = inFlightPreview.current
      if (
        pending &&
        previewController.current &&
        !previewController.current.signal.aborted &&
        isCurrentBattlePreview(
          pending,
          intent,
          battleRef.current.battleVersion,
          previewSequence.current,
        )
      ) {
        return pending.result
      }
      previewController.current?.abort()
      const controller = new AbortController()
      previewController.current = controller
      const sequence = ++previewSequence.current
      readyPreview.current = null
      setPreview(null)
      setPreviewPending(true)
      setPendingIntent(intent)
      const result = (async () => {
        try {
          const response = await requestBattlePreview({
            battleSessionId: battle.battleSessionId,
            battleVersion: battle.battleVersion,
            intent,
            signal: controller.signal,
          })
          const body = (await response.json()) as {
            battlePreview?: BattlePreviewView
          } & ApiErrorBody
          if (!mounted.current || controller.signal.aborted || sequence !== previewSequence.current)
            return
          if (!response.ok || !body.battlePreview) {
            setPreview(null)
            await handleApiFailure(response, body, 'That command could not be checked.', true)
            return
          }
          if (
            body.battlePreview.battleSessionId !== battle.battleSessionId ||
            body.battlePreview.battleVersion !== battle.battleVersion
          ) {
            setNotice('That forecast is out of date. Choose a target to check it again.')
            return
          }
          setPreview({ ...body.battlePreview, intent })
          const result = body.battlePreview.preview
          readyPreview.current = result.legal
            ? { intent, version: battle.battleVersion, sequence }
            : null
          if (!result.legal) {
            setNotice(result.issues[0]?.message ?? 'That command is not legal right now.')
          } else if (result.kind === 'move') {
            setNotice(
              `Movement ready · ${result.actionEconomyCost} AP · ${result.actionEconomyAfter} AP remains.`,
            )
          } else if (result.kind === 'action') {
            const actionName =
              modifierNames.find((row) => row.id === result.actionId)?.name ??
              (battle.snapshot.basicActions === undefined
                ? pv1fSkillByActionId(result.actionId)?.name
                : undefined) ??
              'Action'
            setNotice(
              `${actionName} ${result.controlledReady ? 'ready to release' : 'forecast ready'}.`,
            )
          }
          return readyPreview.current
        } catch (error) {
          if (
            mounted.current &&
            !controller.signal.aborted &&
            sequence === previewSequence.current
          ) {
            setPreview(null)
            setNotice(error instanceof Error ? error.message : 'That command could not be checked.')
          }
        } finally {
          if (mounted.current && sequence === previewSequence.current) setPreviewPending(false)
          if (previewController.current === controller) previewController.current = null
          if (inFlightPreview.current?.sequence === sequence) inFlightPreview.current = null
        }
      })()
      inFlightPreview.current = { intent, version: battle.battleVersion, sequence, result }
      return result
    },
    [
      actionCooldownTurns,
      battle.battleSessionId,
      battle.battleVersion,
      battle.snapshot.basicActions,
      handleApiFailure,
      modifierNames,
    ],
  )

  const commitValue = useCallback(
    async (intent: BattleIntent) => {
      if (
        !mounted.current ||
        commitLock.current ||
        commitPending ||
        battleRef.current.battleVersion !== battle.battleVersion ||
        !localTurn ||
        battleRef.current.snapshot.tactical.battle.lifecycle !== 'active'
      )
        return
      if (intent.kind === 'action' && actionCooldownTurns(intent.actionId) > 0) return
      if (intent.kind === 'action') setTargetAim({ aimSource: 'player', selection: intent.target })
      commitLock.current = true
      if (runtime.kind === 'pvp') {
        battlePollController.current?.abort()
        battlePollController.current = null
      }
      setCommitPending(true)
      const before = battle

      try {
        const endpoint =
          runtime.kind === 'pve' && intent.kind === 'face'
            ? `/api/battles/${battle.battleSessionId}/final-turn`
            : runtime.kind === 'pvp'
              ? `/api/battles/${battle.battleSessionId}/commit`
              : `/api/battles/${battle.battleSessionId}/intents`
        const bodyPayload =
          runtime.kind === 'pve' && intent.kind === 'face'
            ? {
                idempotencyKey: crypto.randomUUID(),
                expectedBattleVersion: battle.battleVersion,
                facing: intent.facing,
              }
            : runtime.kind === 'pvp'
              ? { expectedBattleVersion: battle.battleVersion, intent }
              : {
                  idempotencyKey: crypto.randomUUID(),
                  expectedBattleVersion: battle.battleVersion,
                  intent,
                }

        if (intent.kind === 'face') {
          setNotice(
            runtime.kind === 'pvp'
              ? 'Committing final facing and ending turn…'
              : `Finishing facing ${intent.facing}…`,
          )
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        })
        const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
        if (!response.ok || !body.battle) {
          clearPlanning()
          await handleApiFailure(response, body, 'That action could not be committed.')
          return
        }

        battleRef.current = body.battle
        setBattle(body.battle)
        const nextLocalCombatant = localCombatantId
          ? (body.battle.snapshot.tactical.battle.combatants.find(
              (combatant) => combatant.id === localCombatantId,
            ) ?? null)
          : null
        const nextLocalTurn =
          body.battle.snapshot.tactical.battle.currentTurn?.combatantId === localCombatantId
        const remaining = nextLocalTurn ? readEconomy(nextLocalCombatant) : 0

        const nextBattleState = body.battle.snapshot.tactical.battle
        const keepAction =
          intent.kind !== 'face' &&
          nextBattleState.lifecycle === 'active' &&
          nextLocalTurn &&
          before.snapshot.tactical.battle.turnNumber === nextBattleState.turnNumber &&
          (intent.kind !== 'action' ||
            battleActionCooldownTurns(body.battle, runtime, localCombatantId, intent.actionId) ===
              0) &&
          ['move', 'attack', 'guard', 'recover'].includes(modeRef.current)
        clearPlanning(keepAction ? modeRef.current : 'none')
        if (
          keepAction &&
          ((intent.kind === 'action' && !intent.movementPath) || intent.kind === 'ability-prime')
        ) {
          rearmActionAfterCommit.current = { intent, version: body.battle.battleVersion }
        }

        if (intent.kind === 'ability-prime') {
          setNotice('Ability prepared. Choose a legal target to release it at its full cost.')
        } else if (intent.kind === 'ability-cancel-prime') {
          setNotice('Preparation cancelled. This ability cannot be primed again in this battle.')
        } else if (runtime.kind === 'pvp') {
          if (nextBattleState.lifecycle === 'completed') {
            setNotice('Battle complete.')
          } else if (nextLocalTurn) {
            setNotice(`Action committed. ${remaining} AP remains.`)
          } else {
            setNotice(
              `Turn handed to ${battleParticipantName(viewModel, nextBattleState.currentTurn?.combatantId)}.`,
            )
          }
        } else {
          if (intent.kind === 'face') {
            setNotice(`Finished facing ${intent.facing}. Recruit turn begins.`)
          } else if (intent.kind === 'move') {
            setNotice(`Movement committed. ${remaining} AP remains.`)
          } else if (intent.kind === 'action' && intent.actionId === BASIC_ATTACK_ID) {
            const targetId = intent.target.kind === 'unit' ? intent.target.combatantId : null
            const targetBefore = before.snapshot.tactical.battle.combatants.find(
              (combatant) => combatant.id === targetId,
            )
            const targetAfter = body.battle.snapshot.tactical.battle.combatants.find(
              (combatant) => combatant.id === targetId,
            )
            const damage =
              targetBefore && targetAfter ? Math.max(0, targetBefore.hp - targetAfter.hp) : 0
            setNotice(
              damage > 0
                ? `Basic Attack dealt ${damage} damage. ${remaining} AP remains.`
                : `Basic Attack resolved without damage. ${remaining} AP remains.`,
            )
          } else if (intent.kind === 'action' && intent.actionId === GUARD_ID) {
            setNotice(`Guarded for 2 turns at -15% incoming damage. ${remaining} AP remains.`)
          } else if (intent.kind === 'action' && intent.actionId === RECOVER_ID) {
            const beforeLocal = localCombatantId
              ? before.snapshot.tactical.battle.combatants.find(
                  (combatant) => combatant.id === localCombatantId,
                )
              : null
            const healed =
              beforeLocal && nextLocalCombatant
                ? Math.max(0, nextLocalCombatant.hp - beforeLocal.hp)
                : 0
            setNotice(`Recovered ${healed} HP. ${remaining} AP remains.`)
          } else if (intent.kind === 'action' && intent.actionId === MP_RECOVER_ID) {
            const beforeLocal = localCombatantId
              ? before.snapshot.tactical.battle.combatants.find(
                  (combatant) => combatant.id === localCombatantId,
                )
              : null
            const restored =
              beforeLocal && nextLocalCombatant
                ? Math.max(0, nextLocalCombatant.mp - beforeLocal.mp)
                : 0
            setNotice(`Recovered ${restored} MP. ${remaining} AP remains.`)
          }
        }
      } catch (error) {
        clearPlanning()
        setNotice(error instanceof Error ? error.message : 'That action could not be committed.')
      } finally {
        setCommitPending(false)
        commitLock.current = false
      }
    },
    [
      actionCooldownTurns,
      battle,
      clearPlanning,
      commitPending,
      handleApiFailure,
      localCombatantId,
      localTurn,
      runtime,
      viewModel,
      setBattle,
    ],
  )

  const airborneAttackElevation = Boolean(
    battle.snapshot.airbornePolicyVersion === 1 &&
    localCombatantId &&
    hasGameplayTag(battle.snapshot, localCombatantId, 'Airborne', PV1F_COMBAT_CONTENT),
  )
  const unboundActionDescriptor = useCallback(
    (actionId: string, behaviorId?: string): BattlePreviewSkill => {
      const skill =
        selectableTechniques.find((item) => item.id === actionId) ??
        (selectableSpecial?.id === actionId ? selectableSpecial : undefined)
      const basic = findBattleBasicAction(battle.snapshot, localCombatantId, actionId)
      const isBasic = ['basic.move', BASIC_ATTACK_ID, GUARD_ID, RECOVER_ID, MP_RECOVER_ID].includes(
        actionId,
      )
      const native: BattlePreviewSkill = skill ?? {
        id: actionId,
        groundIntentCapable: false,
        targetKind: actionId === BASIC_ATTACK_ID ? 'unit' : 'self',
        targetTeamPolicy: actionId === BASIC_ATTACK_ID ? 'enemy' : 'self',
        minimumRange: actionId === BASIC_ATTACK_ID ? 1 : 0,
        maximumRange: actionId === BASIC_ATTACK_ID ? 1 : 0,
        target: actionId === BASIC_ATTACK_ID ? undefined : PV1F_GUARD_ACTION.target,
      }
      if (!skill && !isBasic) return { ...native, unavailable: true }
      const resolved = resolveBattleCapturedSkill(
        native,
        manualActionTargets,
        behaviorId ??
          (selectedBehavior?.actionId === actionId ? selectedBehavior.behaviorId : undefined),
      )
      const captured = resolved
        ? bindBattleSkillMovement(
            resolved,
            actionMovementDraft,
            battle.battleVersion,
            localCombatantId,
          )
        : null
      if (!captured || (isBasic && (basic === null || basic?.enabled === false)))
        return { ...native, unavailable: true }
      const category =
        selectableTechniques.find((row) => row.id === actionId)?.category ??
        (selectableSpecial?.id === actionId
          ? special?.category
          : actionId === BASIC_ATTACK_ID
            ? 'attack'
            : actionId === RECOVER_ID || actionId === MP_RECOVER_ID
              ? 'heal'
              : 'defense')
      const classification =
        captured.classification ??
        (category === 'attack' ? 'attack' : category === 'heal' ? 'recovery' : 'utility')
      const target =
        battleSkillTargetSpec(captured) ??
        (actionId === BASIC_ATTACK_ID ? createPv1fBasicAttackDefinition(1).target : undefined)
      const price = pv1fSkillByActionId(actionId)?.cost
      const described: BattlePreviewSkill = {
        ...captured,
        classification,
        costs:
          captured.costs ??
          (skill
            ? [
                { resource: 'ap' as const, amount: skill.apCost },
                { resource: 'mp' as const, amount: skill.mpCost },
              ]
            : price?.kind === 'flat'
              ? [{ resource: 'ap' as const, amount: price.amount }]
              : undefined),
        modifierRoot:
          captured.modifierRoot ??
          (!manualActionTargets.some((row) => row.actionId === actionId) &&
          !skill?.definition?.ability &&
          target
            ? combatNativeModifierRootFacts(target, classification)
            : undefined),
      }
      return battleActionDescriptorWithElevation(described, target, airborneAttackElevation)
    },
    [
      airborneAttackElevation,
      selectableSpecial,
      selectableTechniques,
      battle.snapshot,
      manualActionTargets,
      localCombatantId,
      selectedBehavior,
      actionMovementDraft,
      battle.battleVersion,
      special?.category,
    ],
  )

  const modifierContext = useCallback(
    (descriptor: BattlePreviewSkill) =>
      battleModifierContextForAction(
        battle.battleSessionId,
        battle.battleVersion,
        localCombatantId ?? '',
        descriptor,
        modifierNames.find((row) => row.id === descriptor.id)?.contentVersion ??
          descriptor.definition?.contentVersion ??
          null,
      ),
    [battle.battleSessionId, battle.battleVersion, localCombatantId, modifierNames],
  )
  const actionDescriptor = useCallback(
    (
      actionId: string,
      behaviorId?: string,
      draft: BattleModifierDraft | null = modifierDraft,
    ): BattlePreviewSkill => {
      const descriptor = unboundActionDescriptor(actionId, behaviorId)
      const matching =
        draft?.context.actionId === actionId && draft.context.behaviorId === descriptor.behaviorId
          ? draft
          : null
      const resolved = resolveBattleModifierDraft(
        matching,
        modifierContext(descriptor),
        modifierPins,
        descriptor.controlled,
      )
      return {
        ...descriptor,
        manualModifiers: resolved.manualModifiers,
        unavailable: descriptor.unavailable || resolved.stale,
      }
    },
    [modifierContext, modifierDraft, modifierPins, unboundActionDescriptor],
  )
  const abandonOtherModifierDraft = useCallback(
    (descriptor: BattlePreviewSkill) => {
      const draft = modifierDraftRef.current
      if (
        draft &&
        (draft.context.actionId !== descriptor.id ||
          draft.context.behaviorId !== descriptor.behaviorId)
      )
        replaceModifierDraft(null)
    },
    [replaceModifierDraft],
  )

  // Forecasts are informational. A deliberate gesture goes straight to the server's
  // versioned legality/commit boundary instead of waiting for a second round trip.
  const executeIntent = useCallback(
    async (intent: BattleIntent, keyboardCode?: string) => {
      if (
        !mounted.current ||
        planningDisabledRef.current ||
        executionLock.current ||
        commitLock.current ||
        document.hidden ||
        !document.hasFocus() ||
        isTextEntryTarget(document.activeElement, keyboardCode)
      )
        return
      if (intent.kind === 'action' || intent.kind === 'ability-prime') {
        const draft = modifierDraftRef.current
        const descriptor = actionDescriptor(intent.actionId, intent.behaviorId, draft)
        if (
          descriptor.unavailable ||
          (draft &&
            (draft.context.actionId !== intent.actionId ||
              draft.context.behaviorId !== descriptor.behaviorId)) ||
          JSON.stringify(battleManualModifierReferences(intent.manualModifiers ?? [])) !==
            JSON.stringify(descriptor.manualModifiers ?? [])
        ) {
          setNotice('The modifier selection changed. Prepare this action again.')
          return
        }
      }
      const command =
        intent.kind === 'action'
          ? (selectBattleControlledPrimeIntent(
              manualActionTargets,
              intent.actionId,
              intent.behaviorId,
              intent.manualModifiers,
            ) ?? intent)
          : intent
      if (command.kind === 'action' && actionCooldownTurns(command.actionId) > 0) return
      executionLock.current = true
      setAllyInspection(null)
      setExecutionPending(true)
      previewController.current?.abort()
      previewController.current = null
      previewSequence.current += 1
      readyPreview.current = null
      inFlightPreview.current = null
      setPreviewPending(false)
      try {
        await commitValue(command)
      } finally {
        executionLock.current = false
        if (mounted.current) setExecutionPending(false)
      }
    },
    [actionCooldownTurns, actionDescriptor, manualActionTargets, commitValue],
  )

  const selection = useMemo(
    () => ({
      actorId: localCombatantId,
      selectedTarget: pendingIntent?.kind === 'action' ? pendingIntent.target : null,
      selectedCombatantId: selectedUnitId ?? inspectedUnitId,
      selectedTile:
        pendingIntent?.kind === 'action' && pendingIntent.target.kind === 'tile'
          ? pendingIntent.target.position
          : null,
      combatants: previewCombatants,
      tiles: tactical.tiles.map((tile) => tile.position),
    }),
    [
      inspectedUnitId,
      localCombatantId,
      pendingIntent,
      previewCombatants,
      selectedUnitId,
      tactical.tiles,
    ],
  )

  useEffect(() => {
    const prior = rearmActionAfterCommit.current
    if (
      !prior ||
      battle.battleVersion !== prior.version ||
      battleRef.current.battleVersion !== prior.version
    )
      return
    rearmActionAfterCommit.current = null
    if (!localTurn || battleState.lifecycle !== 'active') return
    const priorTarget = prior.intent.kind === 'action' ? prior.intent.target : null
    const intent = selectInitialBattleSkillPreviewIntent(actionDescriptor(prior.intent.actionId), {
      ...selection,
      selectedCombatantId: priorTarget?.kind === 'unit' ? priorTarget.combatantId : null,
      selectedTile: priorTarget?.kind === 'tile' ? priorTarget.position : null,
      selectedTarget: priorTarget,
    })
    if (intent) {
      setSelectedUnitId(
        intent.target.kind === 'self'
          ? localCombatantId
          : intent.target.kind === 'unit'
            ? intent.target.combatantId
            : null,
      )
      void requestPreview(intent)
    }
  }, [
    actionDescriptor,
    battle.battleVersion,
    battleState.lifecycle,
    localCombatantId,
    localTurn,
    requestPreview,
    selection,
  ])

  const armAction = useCallback(
    (nextMode: 'attack' | 'guard' | 'recover', actionId: string) => {
      if (planningDisabled || executionLock.current) return
      if (actionCooldownTurns(actionId) > 0) return
      const descriptor = actionDescriptor(actionId, undefined, modifierDraftRef.current)
      abandonOtherModifierDraft(descriptor)
      const commandMode = descriptor.classification
        ? battleModifierActionMode(descriptor)
        : nextMode
      if (commandMode === 'attack') setSelectedAttackActionId(actionId)
      else if (commandMode === 'guard') setSelectedDefenseActionId(actionId)
      else if (commandMode === 'recover') setSelectedTechniqueHealId(actionId)
      clearPlanning(commandMode)
      if (controlledAvailabilityForAction(actionId).chooseAction) {
        replaceModifierDraft(null)
        setSelectedBehavior(null)
        setNotice('Choose another action for this ability. No action has been used.')
        return
      }
      if (descriptor.unavailable) {
        setNotice('Choose which action to use for this ability.')
        return
      }
      const prime = selectBattleControlledPrimeIntent(
        manualActionTargets,
        actionId,
        descriptor.behaviorId,
        descriptor.manualModifiers,
      )
      if (prime) {
        void executeIntent(prime)
        return
      }
      const intent = selectInitialBattleSkillPreviewIntent(descriptor, {
        ...selection,
        selectedTarget:
          pendingIntent?.kind === 'action' && pendingIntent.actionId === actionId
            ? pendingIntent.target
            : null,
      })
      if (
        descriptor.controlled?.phase === 'primed' &&
        !descriptor.move &&
        (battleSkillTargetSpec(descriptor)?.maximumSelections ?? 1) === 1 &&
        (intent?.target.kind === 'self' ||
          (intent?.target.kind === 'unit' && intent.target.combatantId === localCombatantId))
      ) {
        void executeIntent(intent)
        return
      }
      if (descriptor.move) {
        setNotice(
          descriptor.move.conditional
            ? 'Choose a highlighted Move destination, or your own tile to attempt a stationary cast when the Move condition is unmet. Movement is included in the Skill cost.'
            : 'Choose a highlighted Move destination, then the Skill target. Movement is included in the Skill cost.',
        )
        return
      }
      if ((battleSkillTargetSpec(descriptor)?.maximumSelections ?? 1) > 1) {
        setNotice('Select targets, then confirm. Select a target again to remove it.')
        return
      }
      if (intent) {
        setSelectedUnitId(
          intent.target.kind === 'self'
            ? localCombatantId
            : intent.target.kind === 'unit'
              ? intent.target.combatantId
              : null,
        )
        void requestPreview(intent)
      } else setNotice('No eligible target is in range. Select a different action or target.')
    },
    [
      actionCooldownTurns,
      actionDescriptor,
      controlledAvailabilityForAction,
      replaceModifierDraft,
      abandonOtherModifierDraft,
      manualActionTargets,
      executeIntent,
      clearPlanning,
      localCombatantId,
      planningDisabled,
      requestPreview,
      selection,
      pendingIntent,
    ],
  )

  const selectAction = useCallback(
    (skillId: string, category: 'attack' | 'defense' | 'heal') => {
      const equipped =
        runtime.techniques?.find((skill) => skill.id === skillId) ??
        (runtime.essence?.id === skillId ? runtime.essence : undefined)
      if (equipped && !battleSkillCastMode(equipped).canCast) return
      if (planningDisabledRef.current || executionLock.current || commitLock.current) return
      if (actionCooldownTurns(skillId) > 0) return
      const classification = actionDescriptor(skillId).classification
      const meaning =
        classification === 'recovery'
          ? 'heal'
          : classification === 'utility'
            ? 'defense'
            : classification === 'attack'
              ? 'attack'
              : category
      if (meaning === 'defense') {
        setSelectedDefenseActionId(skillId)
        armAction('guard', skillId)
      } else if (meaning === 'heal') {
        setSelectedTechniqueHealId(skillId)
        armAction('recover', skillId)
      } else {
        setSelectedAttackActionId(skillId)
        armAction('attack', skillId)
      }
    },
    [
      actionCooldownTurns,
      actionDescriptor,
      armAction,
      runtime,
      setSelectedAttackActionId,
      setSelectedDefenseActionId,
      setSelectedTechniqueHealId,
    ],
  )

  const chooseMode = useCallback(
    (nextMode: Mode) => {
      if (executionLock.current || commitLock.current) return
      if (planningDisabled && nextMode !== 'inspect') return
      if (nextMode === 'guard' && actionCooldownTurns(supportActionId) > 0) return
      if (nextMode === 'recover' && !effectiveHealActionId) {
        setNotice('No Recovery action is equipped in this battle.')
        return
      }
      if (nextMode === 'recover' && actionCooldownTurns(effectiveHealActionId) > 0) return
      setInspectedTile(null)
      if (
        nextMode === 'move' &&
        (basicMove === null ||
          basicMove?.enabled === false ||
          actionCooldownTurns('basic.move') > 0)
      )
        return
      if (nextMode === 'attack') {
        setSelectedAttackActionId(BASIC_ATTACK_ID)
        armAction('attack', BASIC_ATTACK_ID)
        return
      }
      if (nextMode === 'guard') {
        setSelectedDefenseActionId(supportActionId)
        armAction('guard', supportActionId)
        return
      }
      if (nextMode === 'recover') {
        armAction('recover', effectiveHealActionId)
        return
      }
      if (nextMode === 'move') {
        const descriptor = actionDescriptor('basic.move', undefined, modifierDraftRef.current)
        abandonOtherModifierDraft(descriptor)
        if (controlledAvailabilityForAction('basic.move').chooseAction) {
          replaceModifierDraft(null)
          setSelectedBehavior(null)
          clearPlanning('move')
          setNotice('Choose another action for Move. No action has been used.')
          return
        }
        const prime = selectBattleControlledPrimeIntent(
          manualActionTargets,
          'basic.move',
          descriptor.behaviorId,
          descriptor.manualModifiers,
        )
        if (prime) {
          clearPlanning('move')
          void executeIntent(prime)
          return
        }
      }
      clearPlanning(nextMode)
      if (nextMode === 'finish') replaceModifierDraft(null)
      if (nextMode === 'move')
        setNotice(
          basicMove?.movement?.costBasis === 'flat'
            ? 'Choose a highlighted Move destination, then any required Skill target. The overall Skill cost includes movement.'
            : 'Choose any highlighted destination to move the full route, or use WASD for one step. Movement and AP limits apply.',
        )
      else if (nextMode === 'finish')
        setNotice(
          'Choose final facing with WASD or the facing buttons. Press Space again to keep your facing and end the turn.',
        )
      else if (nextMode === 'inspect')
        setNotice('Choose a character or tile to inspect. No AP is spent.')
    },
    [
      actionCooldownTurns,
      actionDescriptor,
      abandonOtherModifierDraft,
      replaceModifierDraft,
      manualActionTargets,
      executeIntent,
      armAction,
      clearPlanning,
      effectiveHealActionId,
      basicMove,
      controlledAvailabilityForAction,
      planningDisabled,
      setSelectedAttackActionId,
      setSelectedDefenseActionId,
      supportActionId,
    ],
  )

  const currentActionId =
    mode === 'none' && modifierDraft
      ? modifierDraft.context.actionId
      : mode === 'move'
        ? 'basic.move'
        : mode === 'attack'
          ? selectedAttackActionId
          : mode === 'guard'
            ? selectedDefenseActionId
            : effectiveHealActionId
  const behaviorChoices = manualActionTargets.filter(
    (choice) => choice.actionId === currentActionId,
  )
  const currentDescriptor = useMemo(
    () => actionDescriptor(currentActionId),
    [actionDescriptor, currentActionId],
  )
  const controlledReadyActionId =
    localTurn &&
    !currentDescriptor.unavailable &&
    !planningDisabled &&
    !executionPending &&
    !previewPending &&
    pendingIntent?.kind === 'action' &&
    preview?.battleVersion === battle.battleVersion &&
    preview.preview.kind === 'action' &&
    preview.preview.controlledReady &&
    JSON.stringify(preview.intent) === JSON.stringify(pendingIntent)
      ? pendingIntent.actionId
      : undefined
  const flatMoveMode = mode === 'move' && basicMove?.movement?.costBasis === 'flat'
  const choosingActionMovement =
    !currentDescriptor.unavailable &&
    Boolean(currentDescriptor.move) &&
    currentDescriptor.movementPath === undefined &&
    (flatMoveMode || ['attack', 'guard', 'recover'].includes(mode))
  const movementMaximum = currentDescriptor.move
    ? Number(currentDescriptor.move.maximumTiles)
    : undefined
  const movementCosts = useMemo(
    () =>
      currentDescriptor.costs?.map((cost) => ({
        resource: cost.resource,
        amount: Number(cost.amount),
      })),
    [currentDescriptor.costs],
  )
  const actionMovementPaths = useMemo(
    () =>
      localTurn && movementMaximum !== undefined && movementCosts
        ? buildReachablePaths(battle.snapshot, localPlacement, actionEconomy, Infinity, undefined, {
            maximumTiles: movementMaximum,
            costs: movementCosts,
          })
        : new Map<string, BattleGridPosition[]>(),
    [battle.snapshot, localPlacement, actionEconomy, localTurn, movementMaximum, movementCosts],
  )
  const movementGuideRange = choosingActionMovement
    ? Math.max(0, ...Array.from(actionMovementPaths.values(), (route) => route.length - 1))
    : maximumMoveDistance
  const maximumSelections = useMemo(
    () => battleSkillTargetSpec(actionDescriptor(currentActionId))?.maximumSelections ?? 1,
    [actionDescriptor, currentActionId],
  )
  const draftTargets =
    pendingIntent?.kind === 'action' && pendingIntent.target.kind === 'selections'
      ? pendingIntent.target.selections
      : []
  const submitTargetGesture = useCallback(
    (intent: Extract<BattleIntent, { kind: 'action' }>, keyboardCode?: string) => {
      if (planningDisabledRef.current || executionLock.current || commitLock.current) return
      if (maximumSelections <= 1) {
        void executeIntent(intent, keyboardCode)
        return
      }
      if (!localCombatantId) return
      const next = toggleBattleSkillTargetSelection(
        pluralSelection.current,
        intent,
        maximumSelections,
        localCombatantId,
      )
      pluralSelection.current = next
      if (next) void requestPreview(next)
      else {
        clearPlanning(mode)
        setActionMovementDraft(actionMovementDraft)
        setNotice('Select targets, then confirm.')
      }
    },
    [
      clearPlanning,
      executeIntent,
      localCombatantId,
      maximumSelections,
      mode,
      requestPreview,
      actionMovementDraft,
    ],
  )
  const commitSelected = useCallback(() => {
    if (maximumSelections > 1) {
      if (pluralSelection.current) void executeIntent(pluralSelection.current, 'Enter')
    } else if (pendingIntent) void executeIntent(pendingIntent, 'Enter')
  }, [executeIntent, maximumSelections, pendingIntent])
  const { rangePreviews, rangePreviewsPending, rangePreviewActionId } = useBattleRangePreviews({
    battleSessionId: battle.battleSessionId,
    battleVersion: battle.battleVersion,
    actorId: localCombatantId,
    skill:
      mode === 'attack' || mode === 'guard' || mode === 'recover' || flatMoveMode
        ? actionDescriptor(currentActionId)
        : null,
    combatants: previewCombatants,
    enabled: !planningDisabled,
  })
  const selectedActionPreview =
    preview?.battleVersion === battle.battleVersion &&
    !currentDescriptor.unavailable &&
    preview.preview.kind === 'action' &&
    preview.preview.actionId === currentActionId &&
    preview.intent.kind === 'action' &&
    JSON.stringify(battleManualModifierReferences(preview.intent.manualModifiers ?? [])) ===
      JSON.stringify(currentDescriptor.manualModifiers ?? [])
      ? preview.preview
      : null
  // Target gestures stay available while informational forecasts load or fail.
  const basicAttackTargets = new Set(
    mode === 'attack' && !activeTechnique
      ? battleRangePreviewIntents(
          actionDescriptor(currentActionId),
          localCombatantId,
          previewCombatants,
        ).flatMap((intent) => (intent.target.kind === 'unit' ? [intent.target.combatantId] : []))
      : [],
  )
  const attackDefinition =
    currentActionId === BASIC_ATTACK_ID
      ? createPv1fBasicAttackDefinition(1)
      : activeTechnique?.definition
  const authoredTargetSpec = currentDescriptor.unavailable
    ? undefined
    : (battleSkillTargetSpec(currentDescriptor, airborneAttackElevation) ??
      attackDefinition?.target)
  const targetSpec = authoredTargetSpec
  const damagingSelection =
    !currentDescriptor.unavailable &&
    battleActionDealsDamage(attackDefinition?.effects ?? [], currentDescriptor.dealsDamage)
  const potentialPath =
    !choosingActionMovement &&
    (mode === 'attack' || mode === 'guard' || mode === 'recover' || flatMoveMode) &&
    localPlacement &&
    targetSpec
      ? battleTargetReachTiles(
          tactical,
          currentDescriptor.movementPath?.at(-1) ?? localPlacement.position,
          targetSpec,
          selectedActionPreview?.affectedTiles,
          targetAim,
          localCombatantId
            ? {
                tactical,
                actorId: localCombatantId,
                terrainOverlays: battle.snapshot.terrainOverlays,
              }
            : undefined,
        )
      : new Set<string>()
  const handleTile = useCallback(
    (position: BattleGridPosition) => {
      const placement = placementByTile.get(positionKey(position))
      if (
        placement &&
        viewModel.participantByCombatant.get(placement.combatantId)?.teamIndex !== localTeamIndex
      )
        setInspectedEnemyUnitId(placement.combatantId)
      // Allied rail inspection is presentation only; armed action targeting still
      // resolves against the local actor and its authored target policy below.
      if ((mode === 'none' || mode === 'inspect') && placement) {
        const participant = viewModel.participantByCombatant.get(placement.combatantId)
        if (participant?.teamIndex === localTeamIndex) {
          setAllyInspection({
            combatantId: placement.combatantId,
            battleVersion: battle.battleVersion,
          })
        }
      }
      if (mode === 'none') {
        if (placement && placement.combatantId !== localCombatantId)
          setInspectedUnitId(placement.combatantId)
        return
      }
      if (mode === 'inspect') {
        setInspectedTile(position)
        setSelectedUnitId(placement?.combatantId ?? null)
        if (placement) setInspectedUnitId(placement.combatantId)
        return
      }
      if (planningDisabled || executionLock.current) return
      const currentDescriptor = actionDescriptor(currentActionId)
      if (flatMoveMode && currentDescriptor.unavailable) {
        setNotice('Choose which action to use for this ability.')
        return
      }
      if (choosingActionMovement) {
        const stationary =
          currentDescriptor.move?.conditional &&
          localPlacement &&
          positionsEqual(position, localPlacement.position)
        const chosenPath = stationary ? [] : actionMovementPaths.get(positionKey(position))
        if (!chosenPath || (!stationary && chosenPath.length < 2) || !localCombatantId) {
          setNotice(
            currentDescriptor.move?.conditional
              ? 'Choose a highlighted destination, or your own tile to attempt a stationary cast when the Move condition is unmet.'
              : 'Choose a highlighted destination within remaining Movement and Jump.',
          )
          return
        }
        const copiedPath = chosenPath.map((point) => ({ ...point }))
        setActionMovementDraft({
          battleVersion: battle.battleVersion,
          actorId: localCombatantId,
          actionId: currentActionId,
          behaviorId: currentDescriptor.behaviorId,
          path: copiedPath,
        })
        const descriptor = { ...currentDescriptor, movementPath: copiedPath }
        const intent = selectInitialBattleSkillPreviewIntent(descriptor, {
          ...selection,
          selectedTarget: null,
          selectedTile: null,
        })
        const commit = selectBattleSkillMovementCommitIntent(descriptor, {
          ...selection,
          selectedTarget: null,
          selectedTile: null,
        })
        if (commit) void executeIntent(commit)
        else {
          setNotice(
            stationary
              ? 'Choose the Skill target. A stationary cast is legal only when the Move condition is unmet.'
              : 'Move destination selected. Choose the Skill target; the server resolves both together.',
          )
          if (intent) void requestPreview(intent)
        }
        return
      }
      if (mode === 'move' && !flatMoveMode) {
        const nextPath = reachablePaths.get(positionKey(position))
        if (!nextPath || nextPath.length < 2) {
          setNotice('Choose a highlighted destination within your remaining Movement and AP.')
          return
        }
        void executeIntent({ kind: 'move', path: nextPath })
      } else if (mode === 'attack' || mode === 'guard' || mode === 'recover' || flatMoveMode) {
        const descriptor = actionDescriptor(currentActionId)
        // An authored self action executes on a deliberate gesture, regardless of which tile was clicked.
        const intent = selectBattleSkillPreviewIntent(descriptor, {
          ...selection,
          selectedCombatantId: placement?.combatantId ?? null,
          selectedTile: position,
        })
        if (
          !intent ||
          (intent.target.kind === 'unit' &&
            descriptor.targetKind === 'unit' &&
            !battleSkillUsesAreaActivation(descriptor) &&
            !descriptor.groundIntentCapable &&
            !placement)
        ) {
          clearPlanning(mode)
          if (descriptor.move) setActionMovementDraft(actionMovementDraft)
          setNotice(
            battleSkillTargetSpec(descriptor)?.shape.kind === 'line'
              ? 'Choose a straight lane: up, down, left or right.'
              : 'Choose an eligible target in range.',
          )
          return
        }
        setSelectedUnitId(
          intent.kind === 'action' && intent.target.kind === 'unit'
            ? intent.target.combatantId
            : localCombatantId,
        )
        submitTargetGesture(intent)
      }
    },
    [
      actionDescriptor,
      actionMovementPaths,
      actionMovementDraft,
      choosingActionMovement,
      flatMoveMode,
      battle.battleVersion,
      clearPlanning,
      currentActionId,
      executeIntent,
      submitTargetGesture,
      localCombatantId,
      localPlacement,
      localTeamIndex,
      mode,
      placementByTile,
      planningDisabled,
      reachablePaths,
      requestPreview,
      selection,
      viewModel.participantByCombatant,
    ],
  )

  // Native hotkeys must observe the selection and legal preview as soon as their DOM is rendered.
  // A passive listener refresh can otherwise drop a fast second press or confirmation.
  useLayoutEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTextEntryTarget(event.target, event.code) ||
        surrenderOpen
      )
        return
      if (
        event.code === 'Enter' &&
        event.target instanceof Element &&
        event.target.closest('button, summary, a, [role="button"]')
      )
        return
      const action = COMBAT_KEYBIND_ACTIONS.find(
        (key) =>
          key !== 'modifiers' &&
          bindings[key].code === event.code &&
          bindings[key].shift === event.shiftKey,
      )
      const arrow = !event.shiftKey
        ? (
            {
              ArrowUp: 'faceNorth',
              ArrowLeft: 'faceWest',
              ArrowDown: 'faceSouth',
              ArrowRight: 'faceEast',
            } as const
          )[event.code as 'ArrowUp']
        : undefined
      const selected = action ?? arrow
      if (!selected) return
      const facing = (
        { faceNorth: 'north', faceWest: 'west', faceSouth: 'south', faceEast: 'east' } as const
      )[selected as 'faceNorth']
      if (facing) {
        if (planningDisabled || !['finish', 'move', 'attack', 'guard', 'recover'].includes(mode))
          return
        event.preventDefault()
        if (mode === 'finish') {
          if (
            (battle.snapshot.elementalDamagePolicyVersion === 1 ||
              battle.snapshot.elementalDamagePolicyVersion === 2) &&
            localCombatantId &&
            localPlacement &&
            hasGameplayTag(battle.snapshot, localCombatantId, 'Frozen', PV1F_COMBAT_CONTENT) &&
            facing !== localPlacement.facing
          ) {
            setNotice('Chilled: keep your current facing to end the turn.')
            return
          }
          void commitValue({ kind: 'face', facing })
          return
        }
        const delta = {
          north: { x: 0, y: -1 },
          west: { x: -1, y: 0 },
          south: { x: 0, y: 1 },
          east: { x: 1, y: 0 },
        }[facing]
        if ((choosingActionMovement || (mode === 'move' && !flatMoveMode)) && localPlacement) {
          handleTile({
            x: localPlacement.position.x + delta.x,
            y: localPlacement.position.y + delta.y,
          })
          return
        }
        const intent = selectDirectionalBattleSkillPreviewIntent(
          actionDescriptor(currentActionId),
          selection,
          delta,
        )
        if (intent) submitTargetGesture(intent, event.code)
        else setNotice('No eligible target in that direction.')
        return
      }
      if (selected === 'nextTarget' || selected === 'previousTarget') {
        if (
          (!['attack', 'guard', 'recover'].includes(mode) && !flatMoveMode) ||
          planningDisabled ||
          choosingActionMovement
        )
          return
        const descriptor = actionDescriptor(currentActionId)
        if (descriptor.unavailable) {
          setNotice('Prepare this action again before choosing a target.')
          return
        }
        const target = battleSkillTargetSpec(descriptor)
        const candidates: Extract<BattleIntent, { kind: 'action' }>[] =
          (target?.geometryVersion === 2 || target?.geometryVersion === 3) &&
          target.shape.kind === 'line'
            ? combatCardinalDirections.map((direction) => ({
                kind: 'action',
                actionId: descriptor.id,
                ...battleSkillIntentMetadata(descriptor),
                target: { kind: 'direction', direction },
              }))
            : previewCombatants.flatMap((row) => {
                const intent = selectBattleSkillPreviewIntent(descriptor, {
                  ...selection,
                  selectedCombatantId: row.combatantId,
                  selectedTile: null,
                })
                return intent?.kind === 'action' && intent.target.kind === 'unit' ? [intent] : []
              })
        if (!candidates.length) return
        event.preventDefault()
        const index = candidates.findIndex((intent) =>
          intent.target.kind === 'unit'
            ? intent.target.combatantId === selectedUnitId
            : intent.target.kind === 'direction' &&
              pendingIntent?.kind === 'action' &&
              pendingIntent.target.kind === 'direction' &&
              intent.target.direction === pendingIntent.target.direction,
        )
        const next =
          candidates[
            (index + (selected === 'nextTarget' ? 1 : candidates.length - 1) + candidates.length) %
              candidates.length
          ]!
        if (next.target.kind === 'unit') setSelectedUnitId(next.target.combatantId)
        setTargetAim({ aimSource: 'player', selection: next.target })
        void requestPreview(next)
        return
      }
      event.preventDefault()
      if (selected === 'cancel') {
        replaceModifierDraft(null)
        clearPlanning()
        setNotice('Selection cleared.')
        restoreBattleKeyboardFocus()
        return
      }
      if (selected === 'combatLog') {
        document.querySelector<HTMLButtonElement>('[data-battle-inline-log] button')?.click()
        return
      }
      if (selected === 'inspect') {
        chooseMode('inspect')
        return
      }
      const executeArmedSelf = (actionId: string, nextMode: Mode) => {
        if (mode !== nextMode || currentActionId !== actionId) return false
        const descriptor = actionDescriptor(actionId)
        const intent = selectBattleSkillPreviewIntent(descriptor, selection)
        if (
          intent?.kind !== 'action' ||
          !(
            intent.target.kind === 'self' ||
            (intent.target.kind === 'unit' && intent.target.combatantId === localCombatantId)
          )
        )
          return false
        submitTargetGesture(intent, event.code)
        return true
      }
      if (
        routeBattleAbilityShortcut(
          selected,
          {
            techniques: runtime.techniques,
            special,
            commandsDisabled: planningDisabled || executionLock.current,
          },
          {
            openInfo: (selector) => document.querySelector<HTMLButtonElement>(selector)?.click(),
            activate: (actionId, category) => {
              const nextMode =
                category === 'defense' ? 'guard' : category === 'heal' ? 'recover' : 'attack'
              if (!executeArmedSelf(actionId, nextMode)) selectAction(actionId, category)
            },
          },
        )
      )
        return
      if (planningDisabled || executionLock.current) return
      if (selected === 'move') chooseMode('move')
      else if (selected === 'basicAttack') chooseMode('attack')
      else if (selected === 'guard') {
        const descriptor = actionDescriptor(supportActionId)
        const supportMode = descriptor.classification
          ? battleModifierActionMode(descriptor)
          : 'guard'
        if (!executeArmedSelf(supportActionId, supportMode)) chooseMode('guard')
      } else if (selected === 'recover') {
        if (!executeArmedSelf(effectiveHealActionId, 'recover')) chooseMode('recover')
      } else if (selected === 'endTurn') {
        if (mode === 'finish' && localPlacement)
          void commitValue({ kind: 'face', facing: localPlacement.facing })
        else chooseMode('finish')
      } else if (selected === 'confirm') commitSelected()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    actionDescriptor,
    bindings,
    replaceModifierDraft,
    battle.snapshot,
    chooseMode,
    clearPlanning,
    commitSelected,
    commitValue,
    currentActionId,
    choosingActionMovement,
    flatMoveMode,
    effectiveHealActionId,
    supportActionId,
    executeIntent,
    submitTargetGesture,
    handleTile,
    localCombatantId,
    localPlacement,
    mode,
    pendingIntent,
    planningDisabled,
    previewCombatants,
    requestPreview,
    selectableSpecial,
    special,
    runtime.techniques,
    selectAction,
    selectedUnitId,
    selection,
    surrenderOpen,
  ])

  const runRecruitTurn = useCallback(async () => {
    if (
      runtime.kind !== 'pve' ||
      recruitLock.current ||
      recruitPending ||
      localTurn ||
      battleState.lifecycle !== 'active' ||
      !battleState.currentTurn ||
      recruitAttemptedVersion.current === battle.battleVersion
    ) {
      return
    }

    recruitLock.current = true
    recruitAttemptedVersion.current = battle.battleVersion
    setRecruitPending(true)
    setRecruitFailed(false)
    clearPlanning()
    setNotice('Recruit is acting…')
    const before = battle

    try {
      const response = await fetch(`/api/battles/${battle.battleSessionId}/recruit-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedBattleVersion: battle.battleVersion }),
      })
      const body = (await response.json()) as { battle?: RecruitTurnView } & ApiErrorBody
      if (!response.ok || !body.battle) {
        await handleApiFailure(response, body, 'The Recruit turn could not be resolved.')
        setRecruitFailed(true)
        return
      }

      const nextBattle: BattleSessionView = {
        battleSessionId: body.battle.battleSessionId,
        battleVersion: body.battle.battleVersion,
        snapshot: body.battle.snapshot,
        replayed: false,
        invalidation: body.battle.invalidation,
      }
      battleRef.current = nextBattle
      setBattle(nextBattle)
      const recruitId = before.snapshot.tactical.battle.currentTurn?.combatantId ?? null
      setNotice(
        describeRecruitTurn(
          before,
          nextBattle,
          body.battle.decisions,
          recruitId,
          battleParticipantName(viewModel, recruitId),
          viewModel.participantByCombatant,
        ),
      )
    } catch (error) {
      setRecruitFailed(true)
      setNotice(error instanceof Error ? error.message : 'The Recruit turn could not be resolved.')
    } finally {
      setRecruitPending(false)
      recruitLock.current = false
    }
  }, [
    battle,
    battleState.currentTurn,
    battleState.lifecycle,
    clearPlanning,
    handleApiFailure,
    localTurn,
    recruitPending,
    runtime,
    viewModel,
    setBattle,
  ])

  useEffect(() => {
    if (
      runtime.kind !== 'pve' ||
      localTurn ||
      battleState.lifecycle !== 'active' ||
      !battleState.currentTurn ||
      recruitPending ||
      recruitFailed
    ) {
      return
    }

    const timer = window.setTimeout(() => void runRecruitTurn(), 0)
    return () => window.clearTimeout(timer)
  }, [
    battleState.currentTurn,
    battleState.lifecycle,
    localTurn,
    recruitFailed,
    recruitPending,
    runRecruitTurn,
    runtime.kind,
  ])

  async function copyBattleKey() {
    if (!viewModel.battleKey) return
    try {
      await navigator.clipboard.writeText(viewModel.battleKey)
      setCopyNotice(true)
      window.setTimeout(() => setCopyNotice(false), 1500)
    } catch {
      setNotice('Battle Key copy is unavailable in this browser.')
    }
  }

  async function confirmPveSurrender() {
    if (runtime.kind !== 'pve' || surrenderPending) return
    setSurrenderPending(true)
    try {
      const response = await fetch(`/api/battles/${battle.battleSessionId}/surrender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          expectedBattleVersion: battle.battleVersion,
        }),
      })
      const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
      if (!response.ok || !body.battle) {
        await handleApiFailure(response, body, 'The AI battle could not be surrendered.')
        return
      }
      battleRef.current = body.battle
      setBattle(body.battle)
      clearPlanning()
      setSurrenderOpen(false)
      setNotice('Battle surrendered.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The AI battle could not be surrendered.')
    } finally {
      setSurrenderPending(false)
    }
  }

  function resultLabel(): string {
    if (livingTeams.size !== 1) return 'Battle Complete'
    return livingTeams.has(localTeamIndex) ? 'Victory' : 'Defeat'
  }

  const boardStyle = {
    '--battle-columns': tactical.width,
    gridTemplateColumns: `repeat(${tactical.width}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${tactical.height}, minmax(0, 1fr))`,
    aspectRatio: `${tactical.width} / ${tactical.height}`,
  } as CSSProperties

  const contextTitle =
    mode === 'inspect' && selectedParticipant && selectedCombatant && selectedPlacement
      ? selectedParticipant.name
      : !localTurn && battleState.lifecycle === 'active'
        ? `${activeName}’s Turn`
        : mode === 'none'
          ? 'Choose your action'
          : mode === 'finish'
            ? 'Choose final facing'
            : mode === 'recover'
              ? selectedHealName
              : mode === 'attack'
                ? selectedAttack.label
                : mode === 'guard'
                  ? selectedDefense.label
                  : mode === 'move'
                    ? flatMoveMode
                      ? (basicMove?.name ?? 'Move')
                      : `Move · up to ${maximumMoveDistance} tiles`
                    : 'Inspect'
  const characterInspection =
    (mode === 'move' && !flatMoveMode) || choosingActionMovement
      ? `Range: ${movementGuideRange} tiles · ${notice}`
      : mode === 'inspect' && selectedParticipant && selectedCombatant && selectedPlacement
        ? `Team ${selectedParticipant.teamIndex + 1} · HP ${selectedCombatant.hp}/${selectedCombatant.maxHp} · MP ${selectedCombatant.mp}/${selectedCombatant.maxMp} · Facing ${selectedPlacement.facing} ${facingGlyph(selectedPlacement.facing)}`
        : notice
  const inspectedTerrain =
    mode === 'inspect' && inspectedTile
      ? tactical.tiles.find((tile) => positionsEqual(tile.position, inspectedTile))
      : null
  const inspectedOverlay = inspectedTerrain
    ? terrainOverlayAt(battle.snapshot, inspectedTerrain.position)
    : null
  const terrainInspection = inspectedTerrain
    ? describeTerrainLabel(
        `Tile ${inspectedTerrain.position.x + 1}, ${inspectedTerrain.position.y + 1}; ${inspectedTerrain.terrainId}; elevation ${inspectedTerrain.elevation}${inspectedOverlay ? `; ${terrainOverlayDescription(inspectedOverlay)}` : ''}`,
      )
    : null
  const contextDescription = terrainInspection
    ? `${terrainInspection.title} · ${terrainInspection.description}${selectedParticipant ? ` · ${characterInspection}` : ''}`
    : characterInspection
  const previewTargetPosition =
    pendingIntent?.kind === 'action' && pendingIntent.target.kind === 'tile'
      ? pendingIntent.target.position
      : null

  return (
    <AirborneAttackElevationContext.Provider value={airborneAttackElevation}>
      <main
        aria-description={BATTLE_EFFECT_KEYBOARD_HELP}
        data-battle-concept="true"
        className={styles.shell}
        data-unified-battle="true"
        data-battle-layout="refined"
        data-battle-action-mode={
          mode === 'guard' &&
          (selectedDefenseActionId === RECOVER_ID || selectedDefenseActionId === MP_RECOVER_ID)
            ? 'recover'
            : mode
        }
        data-battle-kind={runtime.kind}
        data-battle-mode={runtime.kind}
        data-battle-visual-contract="true"
        data-pvp-battle={runtime.kind === 'pvp' ? 'true' : undefined}
        data-local-turn={localTurn || undefined}
        data-battle-keyboard-focus-root="true"
        data-battle-execution-pending={executionPending || commitPending || undefined}
        tabIndex={-1}
        aria-busy={recruitPending || undefined}
      >
        <header className={styles.header} data-unified-battle-header="true">
          <div className={styles.objective}>
            <strong>{viewModel.objective}</strong>
          </div>

          <div
            className={styles.economy}
            data-active={localTurn || undefined}
            data-unified-battle-economy="true"
          >
            <div className={styles.economyCopy}>
              <span data-battle-turn-clock-slot="true" />
              <span>Action Economy</span>
              <strong>{actionEconomy} AP</strong>
              {localTurn && proposedCost > 0 ? (
                <small>− {proposedCost} proposed</small>
              ) : (
                <small aria-hidden="true" />
              )}
            </div>
            <div
              className={styles.economyTrack}
              role="progressbar"
              aria-label="Action Economy remaining"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={actionEconomy}
            >
              <span style={{ width: `${actionEconomy}%` }} />
              {localTurn && proposedCost > 0 ? (
                <i
                  style={{
                    left: `${Math.max(0, actionEconomy - proposedCost)}%`,
                    width: `${Math.min(actionEconomy, proposedCost)}%`,
                  }}
                />
              ) : null}
            </div>
          </div>

          <div data-battle-header-utilities="true">
            {guidedGuardPractice ? (
              <button
                type="button"
                className={bridgeStyles.guidedPractice}
                aria-label={`Practice ${basicPracticeGuard?.name ?? 'Guard'}, ${battleBasicCostLabel(basicPracticeGuard, '30 AP', basicBehaviorId(GUARD_ID))}`}
                title="Practice Guard for this lesson. Your saved Support Action stays in slot 3."
                disabled={
                  planningDisabled ||
                  (basicPracticeGuard === undefined
                    ? actionEconomy < 30
                    : !canAffordBattleBasicAction(
                        basicPracticeGuard,
                        {
                          ap: actionEconomy,
                          mp: localCombatant?.mp ?? 0,
                          hp: localCombatant?.hp ?? 0,
                        },
                        basicBehaviorId(GUARD_ID),
                      )) ||
                  (cooldowns[GUARD_ID] ?? 0) > 0
                }
                onKeyDown={(event) => {
                  if (event.repeat && (event.key === 'Enter' || event.key === ' '))
                    event.preventDefault()
                }}
                onClick={() => {
                  if (executionLock.current || commitLock.current || planningDisabled) return
                  if (mode === 'guard' && currentActionId === GUARD_ID) {
                    const intent = selectBattleSkillPreviewIntent(
                      actionDescriptor(GUARD_ID),
                      selection,
                    )
                    if (intent) void executeIntent(intent)
                    return
                  }
                  setSelectedDefenseActionId(GUARD_ID)
                  armAction('guard', GUARD_ID)
                }}
              >
                <span>Practice {basicPracticeGuard?.name ?? 'Guard'}</span>
              </button>
            ) : null}
            <BattleInfoPopover
              label="Victory Conditions"
              consumeOutsideClick
              trigger={
                <>
                  <span>Victory Conditions</span>
                  <b>{objectiveComplete ? '1/1' : '0/1'}</b>
                </>
              }
            >
              <h2>{viewModel.objective}.</h2>
              <p>
                You win when your side is the only side with at least one combatant still able to
                fight.
              </p>
            </BattleInfoPopover>
          </div>
        </header>

        <section className={styles.roster} aria-label="Battle roster">
          {Array.from({ length: viewModel.teamCount }, (_, teamIndex) => {
            const members = viewModel.participants.filter(
              (participant) => participant.teamIndex === teamIndex,
            )
            return (
              <div
                className={styles.teamRoster}
                key={teamIndex}
                data-local={teamIndex === localTeamIndex || undefined}
              >
                <div className={styles.teamHeading}>
                  <span>Team {teamIndex + 1}</span>
                  <strong>{teamLabel(teamIndex, viewModel.teamCount)}</strong>
                </div>
                <div className={styles.teamMembers}>
                  {members.map((participant) => {
                    const combatant = battleState.combatants.find(
                      (candidate) => candidate.id === participant.combatantId,
                    )
                    const active = battleState.currentTurn?.combatantId === participant.combatantId
                    return (
                      <article
                        key={participant.combatantId}
                        className={styles.rosterCard}
                        data-active={active || undefined}
                        data-defeated={combatant?.hp === 0 || undefined}
                      >
                        {participant.portraitAssetId ? (
                          <CharacterPortraitImage
                            imageUrl={participant.profileImageUrl}
                            fallbackAssetId={participant.portraitAssetId}
                            className={styles.rosterPortrait}
                            sizes="56px"
                            alt=""
                          />
                        ) : (
                          <span
                            className={`${styles.rosterPortrait} ${bridgeStyles.portraitFallback}`}
                            aria-hidden="true"
                          >
                            {participant.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className={styles.rosterIdentity}>
                          <strong>{participant.name}</strong>
                          <small>
                            {participant.level ? `Lv ${participant.level}` : 'Combatant'}
                            {participant.local ? ' · You' : ''}
                          </small>
                          <div className={styles.miniMeters}>
                            <span>
                              <i
                                style={{
                                  width: `${meterPercent(combatant?.hp ?? 0, combatant?.maxHp ?? 1)}%`,
                                }}
                              />
                            </span>
                            <span>
                              <i
                                style={{
                                  width: `${meterPercent(combatant?.mp ?? 0, combatant?.maxMp ?? 1)}%`,
                                }}
                              />
                            </span>
                          </div>
                        </div>
                        {active ? <b>ACTIVE</b> : null}
                      </article>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>

        <section className={styles.content} data-unified-battle-content="true">
          <div
            className={styles.notice}
            data-local-turn={localTurn || undefined}
            data-battle-notice="true"
          >
            <strong>
              {localTurn
                ? 'Your turn'
                : battleState.lifecycle === 'active'
                  ? `Waiting for ${activeName}`
                  : resultLabel()}
            </strong>
            <span>{notice}</span>
          </div>

          <aside data-battle-side="local">
            <BattleCombatantCard
              participant={localRailParticipant}
              battle={battle}
              teamCount={viewModel.teamCount}
              role="local"
            />
            {localParticipant && enemyParticipant ? <BattleVersusEmblem /> : null}
            <BattleCombatantCard
              participant={enemyParticipant}
              battle={battle}
              teamCount={viewModel.teamCount}
              role="selected"
            />
          </aside>

          <section
            id="battlefield"
            onPointerLeave={() => {
              if (
                (targetSpec?.geometryVersion === 2 || targetSpec?.geometryVersion === 3) &&
                targetSpec.shape.kind === 'line'
              )
                setTargetAim({ aimSource: 'implicit' })
            }}
            className={styles.battlefield}
            aria-label={
              runtime.kind === 'pvp' ? 'PvP tactical battlefield' : 'Tactical battlefield'
            }
            data-unified-battlefield="true"
          >
            <div className={styles.boardViewport}>
              <div
                className={styles.board}
                style={boardStyle}
                data-board-auto-fit={`${tactical.width}x${tactical.height}`}
              >
                {tactical.tiles.map((tile) => {
                  const key = positionKey(tile.position)
                  const placement = placementByTile.get(key)
                  const participant = placement
                    ? viewModel.participantByCombatant.get(placement.combatantId)
                    : null
                  const combatant = placement
                    ? battleState.combatants.find(
                        (candidate) => candidate.id === placement.combatantId,
                      )
                    : null
                  const pathIndex = path.findIndex((point) => positionsEqual(point, tile.position))
                  const reachable =
                    (choosingActionMovement
                      ? actionMovementPaths.has(key)
                      : mode === 'move' && !flatMoveMode && reachablePaths.has(key)) &&
                    pathIndex < 0
                  const inAttackRange = Boolean(
                    placement && basicAttackTargets.has(placement.combatantId),
                  )
                  const legalEnemy = Boolean(
                    inAttackRange &&
                    participant &&
                    participant.teamIndex !== localTeamIndex &&
                    combatant &&
                    combatant.hp > 0,
                  )
                  const selfTarget =
                    (mode === 'guard' || mode === 'recover') &&
                    placement?.combatantId === localCombatantId
                  const groundTarget =
                    currentDescriptor.groundIntentCapable ||
                    currentDescriptor.targetKind === 'ground-tile' ||
                    currentDescriptor.targetKind === 'empty-tile' ||
                    targetSpec?.categories?.includes('ground')
                  const skillTarget =
                    activeTechnique &&
                    (groundTarget ||
                      (placement &&
                        (targetSpec?.geometryVersion === 3 ||
                          currentDescriptor.targetKind !== 'self' ||
                          placement.combatantId === localCombatantId)))
                      ? selectBattleSkillPreviewIntent(currentDescriptor, {
                          actorId: localCombatantId,
                          selectedCombatantId: placement?.combatantId ?? null,
                          selectedTile: tile.position,
                          combatants: previewCombatants,
                        })
                      : null
                  const inFootprint = potentialPath.has(key)
                  const targetRelation = !inFootprint
                    ? undefined
                    : activeTechnique
                      ? skillTarget
                        ? groundTarget
                          ? 'ground'
                          : participant?.teamIndex === localTeamIndex
                            ? 'friendly'
                            : 'enemy'
                        : undefined
                      : selfTarget
                        ? 'friendly'
                        : inAttackRange
                          ? legalEnemy
                            ? 'enemy'
                            : 'illegal'
                          : undefined
                  const selected =
                    (mode === 'inspect' && selectedUnitId === placement?.combatantId) ||
                    battleTargetDraftIncludesTile(
                      draftTargets,
                      localCombatantId,
                      combatant && combatant.hp > 0 ? (placement?.combatantId ?? null) : null,
                      tile.position,
                    )
                  const terrain = tile.terrainId === 'rough-ground' ? 'rough' : 'open'
                  const overlay = terrainOverlayAt(battle.snapshot, tile.position)

                  return (
                    <button
                      type="button"
                      key={key}
                      className={styles.tile}
                      data-ground-path={(groundTarget && inFootprint) || undefined}
                      data-attack-path={
                        (!groundTarget && damagingSelection && inFootprint) || undefined
                      }
                      data-buff-path={
                        (!groundTarget && !damagingSelection && !healingSelection && inFootprint) ||
                        undefined
                      }
                      data-self-target={
                        (!groundTarget &&
                          inFootprint &&
                          targetRelation === 'friendly' &&
                          placement?.combatantId === localCombatantId) ||
                        undefined
                      }
                      data-heal-target={
                        (!groundTarget &&
                          inFootprint &&
                          healingSelection &&
                          !damagingSelection &&
                          (targetSpec?.shape.kind !== 'single' ||
                            !placement ||
                            targetRelation === 'friendly')) ||
                        undefined
                      }
                      data-terrain={terrain}
                      data-terrain-overlay={overlay?.kind}
                      data-elevation={tile.elevation > 0 || undefined}
                      data-reachable={reachable || undefined}
                      data-path={pathIndex >= 0 || undefined}
                      data-path-index={pathIndex >= 0 ? pathIndex : undefined}
                      data-target={targetRelation}
                      data-selected={selected || undefined}
                      data-preview-tile={
                        (pendingIntent?.kind === 'action' &&
                          pendingIntent.target.kind === 'tile' &&
                          positionsEqual(pendingIntent.target.position, tile.position)) ||
                        undefined
                      }
                      data-affected={
                        (preview?.preview.kind === 'action' &&
                          placement &&
                          preview.preview.affectedCombatantIds.includes(placement.combatantId)) ||
                        undefined
                      }
                      onClick={() => handleTile(tile.position)}
                      onPointerEnter={(event) => {
                        if (
                          event.pointerType === 'touch' ||
                          planningDisabled ||
                          executionLock.current ||
                          (targetSpec?.geometryVersion !== 2 &&
                            targetSpec?.geometryVersion !== 3) ||
                          targetSpec.shape.kind !== 'line' ||
                          (!['attack', 'guard', 'recover'].includes(mode) && !flatMoveMode)
                        )
                          return
                        const intent = selectBattleSkillPreviewIntent(
                          actionDescriptor(currentActionId),
                          { ...selection, selectedTile: tile.position, selectedCombatantId: null },
                        )
                        if (intent?.target.kind === 'direction') {
                          setTargetAim({ aimSource: 'player', selection: intent.target })
                          void requestPreview(intent)
                        } else setTargetAim({ aimSource: 'implicit' })
                      }}
                      aria-label={`Tile ${tile.position.x + 1}, ${tile.position.y + 1}; ${tile.terrainId}; elevation ${tile.elevation}${participant ? `; occupied by ${participant.name}` : ''}${overlay ? `; ${terrainOverlayDescription(overlay)}` : ''}`}
                    >
                      <BattleGroundAreaLayer
                        steam={overlay?.kind === 'steam'}
                        areas={battle.snapshot.groundAreas}
                        round={tactical.battle.round}
                        position={tile.position}
                      />
                      {overlay ? (
                        <i data-terrain-overlay-marker="true" aria-hidden="true">
                          {overlay.kind === 'frozen' ? '❄' : '≋'}
                          {overlay.remainingRoundBoundaries}
                        </i>
                      ) : null}
                      {tile.elevation > 0 ? <span className={styles.elevation}>▲</span> : null}
                      {participant && placement && combatant && combatant.hp > 0 ? (
                        <BattleFacingIndicator
                          facing={placement.facing}
                          accent={pvpParticipantAccent(
                            participant.teamIndex,
                            participant.seatIndex,
                            viewModel.teamCount,
                          )}
                        />
                      ) : null}
                      {participant && placement ? (
                        <span
                          className={styles.unit}
                          style={
                            {
                              '--battle-combatant-accent': pvpParticipantAccent(
                                participant.teamIndex,
                                participant.seatIndex,
                                viewModel.teamCount,
                              ),
                            } as CSSProperties
                          }
                          data-team={participant.teamIndex}
                          data-active={
                            battleState.currentTurn?.combatantId === participant.combatantId ||
                            undefined
                          }
                          data-defeated={combatant?.hp === 0 || undefined}
                        >
                          {participant.portraitAssetId ? (
                            <CharacterPortraitImage
                              imageUrl={participant.profileImageUrl}
                              fallbackAssetId={participant.portraitAssetId}
                              className={styles.unitPortrait}
                              sizes="96px"
                              alt=""
                            />
                          ) : (
                            <span
                              className={`${bridgeStyles.portraitFallback} ${bridgeStyles.unitPortraitFallback}`}
                              aria-hidden="true"
                            >
                              {participant.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <strong>{participant.name}</strong>
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <aside
            data-battle-side="selected"
            data-battle-flow-log-target="true"
            aria-label="Battle Chronicle"
          >
            <BattleChronicleHeading round={battleState.round} />
            <BattleLogPanel
              presentation="inline"
              battleSessionId={battle.battleSessionId}
              battleVersion={battle.battleVersion}
              currentRound={battleState.round}
              playerName={runtime.playerName}
              combatantNames={Object.fromEntries(
                Array.from(viewModel.participantByCombatant.values()).map((participant) => [
                  participant.combatantId,
                  participant.name,
                ]),
              )}
            />
          </aside>
          <section data-battle-preview-strip="true" aria-label="Target forecast">
            <strong data-battle-instruction-title="true">{contextTitle}</strong>
            <BattleActionPreview
              aimSource={targetAim.aimSource}
              preview={
                preview?.battleVersion === battle.battleVersion &&
                (preview.preview.kind !== 'action' || selectedActionPreview)
                  ? preview.preview
                  : null
              }
              pending={previewPending}
              rangePreviews={rangePreviews}
              rangePreviewsPending={rangePreviewsPending}
              rangePreviewActionId={rangePreviewActionId}
              skill={activeTechnique}
              targetTile={
                previewTargetPosition
                  ? tactical.tiles.find((tile) =>
                      positionsEqual(tile.position, previewTargetPosition),
                    )
                  : undefined
              }
              targetOverlay={
                previewTargetPosition
                  ? terrainOverlayAt(battle.snapshot, previewTargetPosition)?.kind
                  : undefined
              }
              participants={Array.from(viewModel.participantByCombatant.values())}
              notice={contextDescription}
            />
          </section>
          <div data-battle-command-dock="true">
            <section
              className={styles.commandDeck}
              aria-label="Command Deck"
              data-unified-command-deck="true"
              style={COCKPIT_ORNAMENT_STYLE}
            >
              <div className={styles.commands} data-battle-command-group="true">
                <BattleSkillCommand
                  characterStats={characterStats}
                  slot="items"
                  hotkey={formatCombatKeybind(bindings.items)}
                  label="Items"
                  cost="Coming soon"
                  artworkSrc={BATTLE_MISSING_ARTWORK}
                  active={false}
                  disabled
                  onActivate={() => {}}
                >
                  <small data-battle-items-locked="true">Coming soon</small>
                </BattleSkillCommand>
                <BattleSkillCommand
                  characterStats={characterStats}
                  slot="inspect"
                  hotkey={formatCombatKeybind(bindings.inspect)}
                  label="Inspect"
                  cost="Free"
                  artworkSrc={BATTLE_COMMAND_ARTWORK.inspect}
                  active={mode === 'inspect'}
                  disabled={false}
                  onActivate={() => chooseMode('inspect')}
                />
                <BattleSkillCommand
                  characterStats={characterStats}
                  slot="move"
                  hotkey={formatCombatKeybind(bindings.move)}
                  label={basicMove?.name ?? 'Move'}
                  cost={battleBasicCostLabel(
                    basicMove,
                    `${MOVE_COST_PER_TERRAIN_POINT} AP`,
                    basicBehaviorId('basic.move'),
                  )}
                  basicAction={basicMove}
                  behaviorId={basicBehaviorId('basic.move')}
                  primeAvailable={canPrimeAction('basic.move')}
                  controlledAvailability={controlledAvailabilityForAction('basic.move')}
                  controlledReady={controlledReadyActionId === 'basic.move'}
                  cooldownTurns={cooldowns['basic.move'] ?? 0}
                  artworkSrc={
                    basicMove?.iconKey
                      ? battleSkillArtwork('basic.move', basicMove.iconKey)
                      : BATTLE_COMMAND_ARTWORK.move
                  }
                  active={mode === 'move'}
                  disabled={
                    planningDisabled ||
                    (!canPrimeAction('basic.move') &&
                      !controlledAvailabilityForAction('basic.move').chooseAction &&
                      ((reachablePaths.size === 0 &&
                        !basicMove?.behaviors.some((behavior) => behavior.move?.conditional)) ||
                        !canAffordBattleBasicAction(
                          basicMove,
                          {
                            ap: actionEconomy,
                            mp: localCombatant?.mp ?? 0,
                            hp: localCombatant?.hp ?? 0,
                          },
                          basicBehaviorId('basic.move'),
                        )))
                  }
                  onActivate={() => chooseMode('move')}
                />
                <BattleSkillCommand
                  characterStats={characterStats}
                  slot="attack"
                  hotkey={formatCombatKeybind(bindings.basicAttack)}
                  label={attackLabel}
                  cost={battleBasicCostLabel(
                    basicAttack,
                    `${ATTACK_COST} AP`,
                    basicBehaviorId(BASIC_ATTACK_ID),
                  )}
                  basicAction={basicAttack}
                  behaviorId={basicBehaviorId(BASIC_ATTACK_ID)}
                  primeAvailable={canPrimeAction(BASIC_ATTACK_ID)}
                  controlledAvailability={controlledAvailabilityForAction(BASIC_ATTACK_ID)}
                  controlledReady={controlledReadyActionId === BASIC_ATTACK_ID}
                  cooldownTurns={cooldowns[BASIC_ATTACK_ID] ?? 0}
                  artworkSrc={battleSkillArtwork(BASIC_ATTACK_ID, basicAttack?.iconKey)}
                  active={mode === 'attack' && selectedAttackActionId === BASIC_ATTACK_ID}
                  disabled={
                    planningDisabled ||
                    (!canPrimeAction(BASIC_ATTACK_ID) &&
                      !controlledAvailabilityForAction(BASIC_ATTACK_ID).chooseAction &&
                      (basicAttack === undefined
                        ? actionEconomy < ATTACK_COST
                        : !canAffordBattleBasicAction(
                            basicAttack,
                            {
                              ap: actionEconomy,
                              mp: localCombatant?.mp ?? 0,
                              hp: localCombatant?.hp ?? 0,
                            },
                            basicBehaviorId(BASIC_ATTACK_ID),
                          )))
                  }
                  onActivate={() => chooseMode('attack')}
                />
                <BattleSkillCommand
                  characterStats={characterStats}
                  slot="guard"
                  hotkey={formatCombatKeybind(bindings.guard)}
                  label={supportLabel}
                  cost={battleBasicCostLabel(
                    basicSupport,
                    `${supportCost} AP`,
                    basicBehaviorId(supportActionId),
                  )}
                  basicAction={basicSupport}
                  behaviorId={basicBehaviorId(supportActionId)}
                  primeAvailable={canPrimeAction(supportActionId)}
                  controlledAvailability={controlledAvailabilityForAction(supportActionId)}
                  controlledReady={controlledReadyActionId === supportActionId}
                  artworkSrc={battleSkillArtwork(supportActionId, basicSupport?.iconKey)}
                  active={
                    (mode === 'attack' || mode === 'guard' || mode === 'recover') &&
                    currentActionId === supportActionId
                  }
                  disabled={
                    planningDisabled ||
                    (!canPrimeAction(supportActionId) &&
                      !controlledAvailabilityForAction(supportActionId).chooseAction &&
                      (basicSupport === undefined
                        ? actionEconomy < supportCost
                        : !canAffordBattleBasicAction(
                            basicSupport,
                            {
                              ap: actionEconomy,
                              mp: localCombatant?.mp ?? 0,
                              hp: localCombatant?.hp ?? 0,
                            },
                            basicBehaviorId(supportActionId),
                          )))
                  }
                  cooldownTurns={cooldowns[supportActionId] ?? 0}
                  onActivate={() => chooseMode('guard')}
                />
              </div>
              <BattleSelectedSkills
                runtime={runtime}
                activeId={activeTechnique?.id}
                disabled={planningDisabled}
                actionEconomy={actionEconomy}
                actorId={localCombatantId}
                manualActionTargets={manualActionTargets}
                resources={{ mp: localCombatant?.mp ?? 0, hp: localCombatant?.hp ?? 0 }}
                selectedBehavior={selectedBehavior}
                cooldowns={cooldowns}
                primeAvailableIds={primeAvailableIds}
                readyActionId={controlledReadyActionId}
                bindings={bindings}
                onSelect={selectAction}
              />
              <BattleSkillCommand
                characterStats={characterStats}
                slot="finish"
                hotkey={formatCombatKeybind(bindings.endTurn)}
                label="End Turn"
                cost="Choose facing"
                artworkSrc={BATTLE_COMMAND_ARTWORK.finish}
                active={mode === 'finish'}
                disabled={planningDisabled}
                onActivate={() => {
                  if (mode === 'finish' && localPlacement)
                    void commitValue({ kind: 'face', facing: localPlacement.facing })
                  else chooseMode('finish')
                }}
              >
                {mode === 'finish' ? (
                  <div
                    className={styles.facingRow}
                    data-open="true"
                    data-unified-facing-pad="true"
                    role="group"
                    aria-label="Final facing"
                  >
                    {(['north', 'west', 'east', 'south'] as const).map((facing) => (
                      <button
                        type="button"
                        key={facing}
                        onClick={() => void commitValue({ kind: 'face', facing })}
                        aria-label={`Face ${facing}`}
                        disabled={
                          planningDisabled ||
                          ((battle.snapshot.elementalDamagePolicyVersion === 1 ||
                            battle.snapshot.elementalDamagePolicyVersion === 2) &&
                            !!localCombatantId &&
                            hasGameplayTag(
                              battle.snapshot,
                              localCombatantId,
                              'Frozen',
                              PV1F_COMBAT_CONTENT,
                            ) &&
                            facing !== localPlacement?.facing)
                        }
                      >
                        {facingGlyph(facing)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </BattleSkillCommand>
            </section>
          </div>
        </section>

        <footer className={styles.footer} data-unified-battle-footer="true">
          {capabilities.chat ? (
            <button type="button" className={styles.chatButton} aria-expanded="false">
              Chat
            </button>
          ) : null}
          {capabilities.battleLink && viewModel.battleKey ? (
            <button
              type="button"
              className={styles.battleKey}
              data-pvp-spectator-key="true"
              onClick={() => void copyBattleKey()}
            >
              <small>{copyNotice ? 'Copied!' : 'Spectator Key · click to copy'}</small>
              <strong>{viewModel.battleKey}</strong>
            </button>
          ) : null}
          <div className={styles.footerActions} data-battle-footer-actions="true">
            {['move', 'attack', 'guard', 'recover'].includes(mode) && behaviorChoices.length > 1 ? (
              <label className={bridgeStyles.targetChoices}>
                Action{' '}
                <select
                  aria-label="Ability action"
                  value={currentDescriptor.behaviorId ?? ''}
                  disabled={planningDisabled || executionPending}
                  onChange={(event) => {
                    const descriptor = unboundActionDescriptor(currentActionId, event.target.value)
                    if (descriptor.unavailable) return
                    const nextMode = battleModifierActionMode(descriptor)
                    if (nextMode === 'attack') setSelectedAttackActionId(currentActionId)
                    else if (nextMode === 'guard') setSelectedDefenseActionId(currentActionId)
                    else if (nextMode === 'recover') setSelectedTechniqueHealId(currentActionId)
                    replaceModifierDraft(null)
                    clearPlanning(nextMode)
                    setSelectedBehavior({
                      actionId: currentActionId,
                      behaviorId: event.target.value,
                    })
                    setNotice(
                      behaviorChoices.find((choice) => choice.behaviorId === event.target.value)
                        ?.move
                        ? 'Choose a Move destination, then the Skill target.'
                        : 'Select a target for this action.',
                    )
                    restoreBattleKeyboardFocus()
                  }}
                >
                  <option value="" disabled>
                    Choose an action
                  </option>
                  {behaviorChoices.map((choice) => (
                    <option key={choice.behaviorId} value={choice.behaviorId}>
                      {choice.behaviorId.replace(/[._-]+/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <BattleTerrainToggle snapshot={battle.snapshot} />
            {(['attack', 'guard', 'recover'].includes(mode) || flatMoveMode) &&
            maximumSelections > 1 ? (
              <button
                type="button"
                className={styles.cancelAction}
                aria-label="Use selected targets"
                onClick={commitSelected}
                disabled={planningDisabled || executionPending || !draftTargets.length}
              >
                Confirm [{draftTargets.length}/{maximumSelections}]
              </button>
            ) : null}
            <button
              type="button"
              className={styles.cancelAction}
              onClick={() => {
                if (
                  !planningDisabled &&
                  currentDescriptor.controlled?.canCancel &&
                  currentDescriptor.behaviorId
                ) {
                  void executeIntent({
                    kind: 'ability-cancel-prime',
                    actionId: currentActionId,
                    behaviorId: currentDescriptor.behaviorId,
                  })
                  return
                }
                clearPlanning()
                replaceModifierDraft(null)
                setNotice('Selection cleared.')
                restoreBattleKeyboardFocus()
              }}
              disabled={commitPending}
            >
              {currentDescriptor.controlled?.canCancel && !planningDisabled
                ? 'Cancel prime'
                : 'Cancel Action'}
            </button>
            {runtime.kind === 'pve' ? (
              <button
                type="button"
                data-unified-surrender="true"
                onClick={() => setSurrenderOpen(true)}
                disabled={surrenderPending || battleState.lifecycle !== 'active'}
              >
                Surrender
              </button>
            ) : null}
          </div>
        </footer>

        {recruitFailed ? (
          <button
            type="button"
            className={bridgeStyles.retryOpponent}
            onClick={() => {
              recruitAttemptedVersion.current = null
              setRecruitFailed(false)
              void runRecruitTurn()
            }}
          >
            Retry Recruit turn
          </button>
        ) : null}

        {surrenderOpen && runtime.kind === 'pve' ? (
          <div className={surrenderStyles.backdrop} onPointerDown={() => setSurrenderOpen(false)}>
            <section
              className={surrenderStyles.dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="battle-surrender-title"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <span>Controlled Exercise</span>
              <h2 id="battle-surrender-title">Surrender this battle?</h2>
              <p>
                Surrendering ends the battle immediately as a loss. Practice grants no normal
                progression rewards.
              </p>
              <div className={surrenderStyles.actions}>
                <button
                  type="button"
                  className={surrenderStyles.stay}
                  onClick={() => setSurrenderOpen(false)}
                  disabled={surrenderPending}
                >
                  Stay in battle
                </button>
                <button
                  type="button"
                  className={surrenderStyles.confirm}
                  onClick={() => void confirmPveSurrender()}
                  disabled={surrenderPending}
                >
                  {surrenderPending ? 'Surrendering…' : 'Confirm Surrender'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </AirborneAttackElevationContext.Provider>
  )
}
