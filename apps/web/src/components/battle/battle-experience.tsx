'use client'

import { SkillEffectTimingProvider } from '../character/skill-effect-timing-context'

import { isBattleShortcutBlocked as isTextEntryTarget } from './battle-keyboard-scope'

import {
  isCurrentBattlePreview,
  selectBattleSkillPreviewIntent,
  selectInitialBattleSkillPreviewIntent,
  selectDirectionalBattleSkillPreviewIntent,
} from './battle-preview-selection'
import { BattleActionPreview } from './battle-action-preview'
import { BattleMapKey } from './battle-map-key'
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
  buildImmediateStepPaths,
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

import { BattleSkillCommand } from './battle-skill-command'
import { BATTLE_COMMAND_ARTWORK, battleSkillArtwork } from './battle-skill-presentation'
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
const ACTIVE_PLAYER_POLL_MS = 900
const WAITING_PLAYER_POLL_MS = 1000
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

function describeRecruitTurn(
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
  return (
    <SkillEffectTimingProvider
      policy={props.initialBattle.snapshot.effectTimingPolicy ?? null}
      copyPolicyVersion={props.initialBattle.snapshot.copyPolicyVersion ?? null}
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
  const [battle, setBattle] = useState(initialBattle)
  const [mode, setMode] = useState<Mode>('none')
  const [path, setPath] = useState<BattleGridPosition[]>([])
  const pathRef = useRef<BattleGridPosition[]>([])
  const [pendingIntent, setPendingIntent] = useState<BattleIntent | null>(null)
  const [preview, setPreview] = useState<BattlePreviewView | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [inspectedUnitId, setInspectedUnitId] = useState<string | null>(null)
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
        if (!cancelled && response.ok && parsed) setBindings(parsed)
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
  const readyPreview = useRef<{ intent: BattleIntent; version: number; sequence: number } | null>(
    null,
  )
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      previewSequence.current += 1
      readyPreview.current = null
      previewController.current?.abort()
    }
  }, [])
  const commitLock = useRef(false)
  const battleRef = useRef(initialBattle)
  const battlePollInFlight = useRef(false)
  const battlePollController = useRef<AbortController | null>(null)
  const recruitAttemptedVersion = useRef<number | null>(null)
  const recruitLock = useRef(false)
  const rearmActionAfterCommit = useRef<{
    intent: Extract<BattleIntent, { kind: 'action' }>
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
    () => [...(runtime.techniques ?? []), ...(runtime.copiedSkills ?? [])],
    [runtime.copiedSkills, runtime.techniques],
  )
  const attackTechniques = selectableTechniques.filter(
    (technique) => technique.category === 'attack',
  )
  const defenseTechniques = selectableTechniques.filter(
    (technique) => technique.category === 'defense',
  )
  const healTechniques = selectableTechniques.filter((technique) => technique.category === 'heal')
  const skillArtwork = (technique: (typeof selectableTechniques)[number]) =>
    battleSkillArtwork(
      'sourceSkillId' in technique ? technique.sourceSkillId : technique.id,
      technique.iconKey,
    )
  const [selectedAttackActionId, setSelectedAttackActionId] = useState<string>(BASIC_ATTACK_ID)
  const supportActionId = parseSupportActionId(runtime.supportActionId) ?? DEFAULT_SUPPORT_ACTION_ID
  const supportSkill = pv1fSkillByActionId(supportActionId)!
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
      label: 'Basic Attack',
      cost: `${ATTACK_COST} AP`,
      artworkSrc: BATTLE_COMMAND_ARTWORK.attack,
      tags: ['Enemy', 'Single target', 'Damage'],
    },
    ...attackTechniques.map((technique) => ({
      id: technique.id,
      label: technique.name,
      cost: `${technique.apCost} AP`,
      artworkSrc: skillArtwork(technique),
      tags: technique.tags,
    })),
    ...(runtime.essence
      ? [
          {
            id: runtime.essence.id,
            label: runtime.essence.name,
            cost: `${runtime.essence.apCost} AP`,
            artworkSrc: battleSkillArtwork(runtime.essence.id, runtime.essence.iconKey),
            tags: runtime.essence.tags,
          },
        ]
      : []),
  ]
  const defenseOptions = [
    {
      id: supportActionId,
      label: supportSkill.name,
      cost: `${supportCost} AP`,
      artworkSrc: battleSkillArtwork(supportActionId),
      tags: ['Self', 'Support Action'],
    },
    ...(guidedGuardPractice
      ? [
          {
            id: GUARD_ID,
            label: 'Guard',
            cost: '30 AP',
            artworkSrc: battleSkillArtwork(GUARD_ID),
            tags: ['Self', 'Guard'],
          },
        ]
      : []),
    ...defenseTechniques.map((technique) => ({
      id: technique.id,
      label: technique.name,
      cost: `${technique.apCost} AP`,
      artworkSrc: skillArtwork(technique),
      tags: technique.tags,
    })),
  ]
  const recoveryOptions = [
    ...HEAL_SELECTOR_OPTIONS,
    ...healTechniques.map((technique) => ({
      id: technique.id,
      label: technique.name,
      cost: `${technique.apCost} AP`,
      artworkSrc: skillArtwork(technique),
      tags: technique.tags,
    })),
  ]
  const selectedAttack =
    attackOptions.find((option) => option.id === selectedAttackActionId) ?? attackOptions[0]!
  const selectedDefense =
    defenseOptions.find((option) => option.id === selectedDefenseActionId) ?? defenseOptions[0]!
  const effectiveHealActionId = selectedTechniqueHealId ?? selectedHealActionId
  const selectedHealOption =
    recoveryOptions.find((option) => option.id === effectiveHealActionId) ?? recoveryOptions[0]!
  const capabilities = useMemo(() => deriveBattleCapabilities(runtime), [runtime])
  const viewModel = useMemo(() => buildBattleViewModel(battle, runtime), [battle, runtime])
  const tactical = battle.snapshot.tactical
  const battleState = tactical.battle
  const localParticipant = viewModel.localParticipant
  const localCombatantId = viewModel.localCombatantId
  const localCombatant = localCombatantId
    ? (battleState.combatants.find((combatant) => combatant.id === localCombatantId) ?? null)
    : null
  const actionCooldownTurns = useCallback(
    (actionId: string) =>
      battleActionCooldownTurns(battleRef.current, runtime, localCombatantId, actionId),
    [localCombatantId, runtime],
  )
  const cooldowns = useMemo(
    () =>
      Object.fromEntries(
        [
          GUARD_ID,
          RECOVER_ID,
          MP_RECOVER_ID,
          ...selectableTechniques.map((skill) => skill.id),
          ...(runtime.essence ? [runtime.essence.id] : []),
        ].map((id) => [id, battleActionCooldownTurns(battle, runtime, localCombatantId, id)]),
      ),
    [battle, localCombatantId, runtime, selectableTechniques],
  )
  const localPlacement = localCombatantId
    ? (tactical.placements.find((placement) => placement.combatantId === localCombatantId) ?? null)
    : null
  const localTeamIndex = viewModel.localTeamIndex ?? -1
  const localTurn = Boolean(
    localCombatantId && battleState.currentTurn?.combatantId === localCombatantId,
  )
  const actionEconomy = localTurn ? readEconomy(localCombatant) : 0
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
  const selectedHealName = selectedHealOption.label
  const selectedAttackTechnique =
    selectableTechniques.find((technique) => technique.id === selectedAttackActionId) ??
    (runtime.essence?.id === selectedAttackActionId ? runtime.essence : undefined)
  const selectedDefenseTechnique = selectableTechniques.find(
    (technique) => technique.id === selectedDefenseActionId,
  )
  const selectedHealTechnique = selectableTechniques.find(
    (technique) => technique.id === effectiveHealActionId,
  )
  const activeTechnique =
    mode === 'attack'
      ? selectedAttackTechnique
      : mode === 'guard'
        ? selectedDefenseTechnique
        : mode === 'recover'
          ? selectedHealTechnique
          : null
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

  const placementByTile = useMemo(
    () =>
      new Map(
        tactical.placements.map(
          (placement) => [positionKey(placement.position), placement] as const,
        ),
      ),
    [tactical.placements],
  )
  const reachablePaths = useMemo(
    () =>
      localTurn
        ? buildImmediateStepPaths(battle.snapshot, localPlacement, actionEconomy)
        : new Map<string, BattleGridPosition[]>(),
    [actionEconomy, battle.snapshot, localPlacement, localTurn],
  )
  const attackRange = useMemo(() => {
    const result = new Set<string>()
    if (!localPlacement) return result
    for (const position of [
      { x: localPlacement.position.x + 1, y: localPlacement.position.y },
      { x: localPlacement.position.x - 1, y: localPlacement.position.y },
      { x: localPlacement.position.x, y: localPlacement.position.y + 1 },
      { x: localPlacement.position.x, y: localPlacement.position.y - 1 },
    ]) {
      if (
        position.x >= 0 &&
        position.x < tactical.width &&
        position.y >= 0 &&
        position.y < tactical.height
      ) {
        result.add(positionKey(position))
      }
    }
    return result
  }, [localPlacement, tactical.height, tactical.width])

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
      previewController.current?.abort()
      rearmActionAfterCommit.current = null
      modeRef.current = nextMode
      setMode(nextMode)
      updatePlanningPath([])
      setPendingIntent(null)
      setPreview(null)
      setSelectedUnitId(null)
      setPreviewPending(false)
    },
    [updatePlanningPath],
  )

  useEffect(() => {
    return registerInspectCloseHandler(() => {
      if (modeRef.current !== 'inspect') return
      clearPlanning()
      setNotice('Inspection closed. Choose your action.')
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('main[data-battle-keyboard-focus-root="true"]')
          ?.focus({ preventScroll: true })
      })
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
    async (message = 'Battle state reloaded.') => {
      const response = await fetch(`/api/battles/${battle.battleSessionId}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
      if (!response.ok || !body.battle) {
        throw new Error(body.error?.message ?? 'The battle state could not be reloaded.')
      }
      battleRef.current = body.battle
      setBattle(body.battle)
      clearPlanning()
      setNotice(message)
      return body.battle
    },
    [battle.battleSessionId, clearPlanning],
  )

  const handleApiFailure = useCallback(
    async (response: Response, body: ApiErrorBody, fallback: string) => {
      if (response.status === 401) {
        router.replace('/')
        router.refresh()
        return
      }
      if (response.status === 409 && body.error?.code === 'STALE_VERSION') {
        try {
          await refreshBattle(
            'The battle changed elsewhere. Your unfinished selection was cleared.',
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

      if (nextBattleState.lifecycle === 'completed') {
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
      }
    },
    [clearPlanning, localCombatantId, viewModel],
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
    if (runtime.kind !== 'pvp' || battleState.lifecycle !== 'active') return
    let cancelled = false
    let timer: number | null = null

    const schedule = (delay: number) => {
      if (cancelled) return
      timer = window.setTimeout(poll, delay)
    }

    const nextNormalDelay = () => {
      const currentTurnId = battleRef.current.snapshot.tactical.battle.currentTurn?.combatantId
      return currentTurnId === localCombatantId ? ACTIVE_PLAYER_POLL_MS : WAITING_PLAYER_POLL_MS
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

  const requestPreview = useCallback(
    async (intent: BattleIntent) => {
      if (!mounted.current) return null
      if (intent.kind === 'action' && actionCooldownTurns(intent.actionId) > 0) return null
      previewController.current?.abort()
      const controller = new AbortController()
      previewController.current = controller
      const sequence = ++previewSequence.current
      readyPreview.current = null
      setPreview(null)
      setPreviewPending(true)
      setPendingIntent(intent)
      try {
        const response = await fetch(`/api/battles/${battle.battleSessionId}/preview`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedBattleVersion: battle.battleVersion, intent }),
        })
        const body = (await response.json()) as { battlePreview?: BattlePreviewView } & ApiErrorBody
        if (!mounted.current || controller.signal.aborted || sequence !== previewSequence.current)
          return
        if (!response.ok || !body.battlePreview) {
          clearPlanning()
          await handleApiFailure(response, body, 'That command could not be checked.')
          return
        }
        setPreview(body.battlePreview)
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
        } else if (result.kind === 'action' && result.actionId === BASIC_ATTACK_ID) {
          setNotice(`Basic Attack ready · ${result.actionEconomyCost} AP.`)
        } else if (result.kind === 'action' && result.actionId === GUARD_ID) {
          setNotice('Guard ready · 30 AP · incoming damage reduced for 2 turns.')
        } else if (result.kind === 'action' && result.actionId === RECOVER_ID) {
          setNotice('HP Recovery ready · 50 AP · restores 10% maximum HP.')
        } else if (result.kind === 'action' && result.actionId === MP_RECOVER_ID) {
          setNotice('MP Recovery ready · 50 AP · restores 10% maximum MP.')
        } else if (result.kind === 'action') {
          setNotice(
            `Skill ready · ${result.actionEconomyCost} AP · click a target or press WASD to execute.`,
          )
        }
        return readyPreview.current
      } catch (error) {
        if (mounted.current && !controller.signal.aborted && sequence === previewSequence.current) {
          setPreview(null)
          setNotice(error instanceof Error ? error.message : 'That command could not be checked.')
        }
      } finally {
        if (mounted.current && sequence === previewSequence.current) setPreviewPending(false)
        if (previewController.current === controller) previewController.current = null
      }
    },
    [
      actionCooldownTurns,
      battle.battleSessionId,
      battle.battleVersion,
      clearPlanning,
      handleApiFailure,
    ],
  )

  const commitValue = useCallback(
    async (intent: BattleIntent) => {
      if (
        !mounted.current ||
        commitLock.current ||
        commitPending ||
        !localTurn ||
        battleRef.current.snapshot.tactical.battle.lifecycle !== 'active'
      )
        return
      if (intent.kind === 'action' && actionCooldownTurns(intent.actionId) > 0) return
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

        const priorCopiedSkills = new Set(
          (before.snapshot.effectState?.temporarySkills ?? [])
            .filter((grant) => grant.combatantId === localCombatantId)
            .map((grant) => `${grant.skillId}@${grant.contentVersion}`),
        )
        const gainedCopiedSkill = (body.battle.snapshot.effectState?.temporarySkills ?? []).some(
          (grant) =>
            grant.combatantId === localCombatantId &&
            !priorCopiedSkills.has(`${grant.skillId}@${grant.contentVersion}`),
        )

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
        if (keepAction && intent.kind === 'action') {
          rearmActionAfterCommit.current = { intent, version: body.battle.battleVersion }
        }

        if (runtime.kind === 'pvp') {
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
        if (gainedCopiedSkill) router.refresh()
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
      router,
      runtime,
      viewModel,
    ],
  )

  const commitSelected = useCallback(() => {
    if (
      !pendingIntent ||
      !preview?.preview.legal ||
      previewPending ||
      !isCurrentBattlePreview(
        readyPreview.current,
        pendingIntent,
        battle.battleVersion,
        previewSequence.current,
      )
    )
      return
    void commitValue(pendingIntent)
  }, [battle.battleVersion, commitValue, pendingIntent, preview, previewPending])

  // A user gesture may refresh its target forecast, but only the current legal receipt can commit.
  const executeIntent = useCallback(
    async (intent: BattleIntent) => {
      if (planningDisabledRef.current || executionLock.current || commitLock.current) return
      if (intent.kind === 'action' && actionCooldownTurns(intent.actionId) > 0) return
      executionLock.current = true
      setExecutionPending(true)
      try {
        const ready = isCurrentBattlePreview(
          readyPreview.current,
          intent,
          battleRef.current.battleVersion,
          previewSequence.current,
        )
          ? readyPreview.current
          : await requestPreview(intent)
        if (
          mounted.current &&
          !isTextEntryTarget(null) &&
          ready &&
          isCurrentBattlePreview(
            readyPreview.current,
            intent,
            battleRef.current.battleVersion,
            ready.sequence,
          )
        ) {
          await commitValue(intent)
        }
      } finally {
        executionLock.current = false
        if (mounted.current) setExecutionPending(false)
      }
    },
    [actionCooldownTurns, commitValue, requestPreview],
  )

  const actionDescriptor = useCallback(
    (actionId: string) =>
      selectableTechniques.find((item) => item.id === actionId) ??
      (runtime.essence?.id === actionId ? runtime.essence : undefined) ?? {
        id: actionId,
        targetKind: actionId === BASIC_ATTACK_ID ? ('unit' as const) : ('self' as const),
        targetTeamPolicy: actionId === BASIC_ATTACK_ID ? ('enemy' as const) : ('self' as const),
        minimumRange: actionId === BASIC_ATTACK_ID ? 1 : 0,
        maximumRange: actionId === BASIC_ATTACK_ID ? 1 : 0,
      },
    [runtime.essence, selectableTechniques],
  )

  const selection = useMemo(
    () => ({
      actorId: localCombatantId,
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
    const intent = selectInitialBattleSkillPreviewIntent(actionDescriptor(prior.intent.actionId), {
      ...selection,
      selectedCombatantId:
        prior.intent.target.kind === 'unit' ? prior.intent.target.combatantId : null,
      selectedTile: prior.intent.target.kind === 'tile' ? prior.intent.target.position : null,
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
      const intent = selectInitialBattleSkillPreviewIntent(actionDescriptor(actionId), selection)
      clearPlanning(nextMode)
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
      clearPlanning,
      localCombatantId,
      planningDisabled,
      requestPreview,
      selection,
    ],
  )

  const selectAction = useCallback(
    (skillId: string, category: 'attack' | 'defense' | 'heal') => {
      if (planningDisabledRef.current || executionLock.current || commitLock.current) return
      if (actionCooldownTurns(skillId) > 0) return
      if (category === 'defense') {
        setSelectedDefenseActionId(skillId)
        armAction('guard', skillId)
      } else if (category === 'heal') {
        setSelectedTechniqueHealId(skillId)
        armAction('recover', skillId)
      } else {
        setSelectedAttackActionId(skillId)
        armAction('attack', skillId)
      }
    },
    [
      actionCooldownTurns,
      armAction,
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
      if (nextMode === 'recover' && actionCooldownTurns(effectiveHealActionId) > 0) return
      setInspectedTile(null)
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
      clearPlanning(nextMode)
      if (nextMode === 'move')
        setNotice(
          'Click a highlighted adjacent tile or press WASD to move one step. The server checks Movement and AP.',
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
      armAction,
      clearPlanning,
      effectiveHealActionId,
      planningDisabled,
      setSelectedAttackActionId,
      setSelectedDefenseActionId,
      supportActionId,
    ],
  )

  const currentActionId =
    mode === 'attack'
      ? selectedAttackActionId
      : mode === 'guard'
        ? selectedDefenseActionId
        : effectiveHealActionId
  const handleTile = useCallback(
    (position: BattleGridPosition) => {
      const placement = placementByTile.get(positionKey(position))
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
      if (mode === 'move') {
        const nextPath = reachablePaths.get(positionKey(position))
        if (!nextPath || nextPath.length < 2) {
          setNotice('Choose a highlighted adjacent tile with enough Movement and AP.')
          return
        }
        updatePlanningPath(nextPath)
        void executeIntent({ kind: 'move', path: nextPath })
      } else if (mode === 'attack' || mode === 'guard' || mode === 'recover') {
        const descriptor = actionDescriptor(currentActionId)
        // An authored self action executes on a deliberate gesture, regardless of which tile was clicked.
        const intent = selectBattleSkillPreviewIntent(descriptor, {
          ...selection,
          selectedCombatantId: placement?.combatantId ?? null,
          selectedTile: position,
        })
        if (!intent || (descriptor.targetKind === 'unit' && !placement)) {
          clearPlanning(mode)
          setNotice('Choose an eligible target in range.')
          return
        }
        setSelectedUnitId(
          intent.kind === 'action' && intent.target.kind === 'unit'
            ? intent.target.combatantId
            : localCombatantId,
        )
        void executeIntent(intent)
      }
    },
    [
      actionDescriptor,
      clearPlanning,
      currentActionId,
      executeIntent,
      localCombatantId,
      mode,
      placementByTile,
      planningDisabled,
      reachablePaths,
      selection,
      updatePlanningPath,
    ],
  )

  useEffect(() => {
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
        (key) => bindings[key].code === event.code && bindings[key].shift === event.shiftKey,
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
          void commitValue({ kind: 'face', facing })
          return
        }
        const delta = {
          north: { x: 0, y: -1 },
          west: { x: -1, y: 0 },
          south: { x: 0, y: 1 },
          east: { x: 1, y: 0 },
        }[facing]
        if (mode === 'move' && localPlacement) {
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
        if (intent) void executeIntent(intent)
        else setNotice('No eligible target in that direction.')
        return
      }
      if (selected === 'nextTarget' || selected === 'previousTarget') {
        if (!['attack', 'guard', 'recover'].includes(mode) || planningDisabled) return
        const descriptor = actionDescriptor(currentActionId)
        const candidates = previewCombatants.flatMap((row) => {
          const intent = selectBattleSkillPreviewIntent(descriptor, {
            ...selection,
            selectedCombatantId: row.combatantId,
          })
          return intent?.kind === 'action' && intent.target.kind === 'unit' ? [intent] : []
        })
        if (!candidates.length) return
        event.preventDefault()
        const index = candidates.findIndex(
          (intent) => intent.target.kind === 'unit' && intent.target.combatantId === selectedUnitId,
        )
        const next =
          candidates[
            (index + (selected === 'nextTarget' ? 1 : candidates.length - 1) + candidates.length) %
              candidates.length
          ]!
        if (next.target.kind === 'unit') setSelectedUnitId(next.target.combatantId)
        void requestPreview(next)
        return
      }
      event.preventDefault()
      if (selected === 'cancel') {
        clearPlanning()
        setNotice('Selection cleared.')
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
      if (planningDisabled || executionLock.current) return
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
        void executeIntent(intent)
        return true
      }
      if (selected === 'move') chooseMode('move')
      else if (selected === 'basicAttack') chooseMode('attack')
      else if (selected === 'guard') {
        if (!executeArmedSelf(supportActionId, 'guard')) chooseMode('guard')
      } else if (selected === 'recover') {
        if (!executeArmedSelf(effectiveHealActionId, 'recover')) chooseMode('recover')
      } else if (selected === 'endTurn') {
        if (mode === 'finish' && localPlacement)
          void commitValue({ kind: 'face', facing: localPlacement.facing })
        else chooseMode('finish')
      } else if (selected === 'confirm') commitSelected()
      else if (selected.startsWith('skill')) {
        const skill = runtime.techniques?.[Number(selected.slice(-1)) - 1]
        if (skill) {
          const nextMode =
            skill.category === 'defense'
              ? 'guard'
              : skill.category === 'heal'
                ? 'recover'
                : 'attack'
          if (!executeArmedSelf(skill.id, nextMode)) selectAction(skill.id, skill.category)
        }
      } else if (selected === 'essence') {
        if (runtime.essence) {
          if (!executeArmedSelf(runtime.essence.id, 'attack'))
            selectAction(runtime.essence.id, 'attack')
        } else
          document
            .querySelector<HTMLButtonElement>(
              '[data-battle-special="resonance"] [data-battle-info-trigger]',
            )
            ?.click()
      } else if (selected === 'supernatural')
        document
          .querySelector<HTMLButtonElement>(
            '[data-battle-special="supernatural"] [data-battle-info-trigger]',
          )
          ?.click()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    actionDescriptor,
    bindings,
    chooseMode,
    clearPlanning,
    commitSelected,
    commitValue,
    currentActionId,
    effectiveHealActionId,
    supportActionId,
    executeIntent,
    handleTile,
    localCombatantId,
    localPlacement,
    mode,
    planningDisabled,
    previewCombatants,
    requestPreview,
    runtime.essence,
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
                    ? 'Move'
                    : 'Inspect'
  const characterInspection =
    mode === 'inspect' && selectedParticipant && selectedCombatant && selectedPlacement
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
    <main
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
              aria-label="Practice Guard, 30 AP"
              title="Practice Guard for this lesson. Your saved Support Action stays in slot 3."
              disabled={planningDisabled || actionEconomy < 30 || (cooldowns[GUARD_ID] ?? 0) > 0}
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
              <span>Practice Guard</span>
            </button>
          ) : null}
          <BattleInfoPopover
            label="Victory Conditions"
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
            participant={localParticipant}
            battle={battle}
            teamCount={viewModel.teamCount}
            role="local"
          />
          <BattleMapKey snapshot={battle.snapshot} />
        </aside>

        <section
          id="battlefield"
          className={styles.battlefield}
          aria-label={runtime.kind === 'pvp' ? 'PvP tactical battlefield' : 'Tactical battlefield'}
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
                const reachable = mode === 'move' && reachablePaths.has(key) && pathIndex < 0
                const inAttackRange = mode === 'attack' && attackRange.has(key)
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
                  activeTechnique?.targetKind === 'ground-tile' ||
                  activeTechnique?.targetKind === 'empty-tile'
                const skillTarget =
                  activeTechnique &&
                  (groundTarget ||
                    (placement &&
                      (activeTechnique.targetKind !== 'self' ||
                        placement.combatantId === localCombatantId)))
                    ? selectBattleSkillPreviewIntent(activeTechnique, {
                        actorId: localCombatantId,
                        selectedCombatantId: placement?.combatantId ?? null,
                        selectedTile: tile.position,
                        combatants: previewCombatants,
                      })
                    : null
                const targetRelation = activeTechnique
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
                const selected = selectedUnitId === placement?.combatantId
                const terrain = tile.terrainId === 'rough-ground' ? 'rough' : 'open'
                const overlay = terrainOverlayAt(battle.snapshot, tile.position)

                return (
                  <button
                    type="button"
                    key={key}
                    className={styles.tile}
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
                    aria-label={`Tile ${tile.position.x + 1}, ${tile.position.y + 1}; ${tile.terrainId}; elevation ${tile.elevation}${participant ? `; occupied by ${participant.name}` : ''}${overlay ? `; ${terrainOverlayDescription(overlay)}` : ''}`}
                  >
                    {overlay ? (
                      <i data-terrain-overlay-marker="true" aria-hidden="true">
                        {overlay.kind === 'frozen' ? '❄' : '≋'}
                        {overlay.remainingRoundBoundaries}
                      </i>
                    ) : null}
                    {tile.elevation > 0 ? <span className={styles.elevation}>▲</span> : null}
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
                        <BattleFacingIndicator facing={placement.facing} />
                        <strong>{participant.name}</strong>
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <aside data-battle-side="selected" data-battle-flow-log-target="true">
          <BattleCombatantCard
            participant={
              viewModel.participantByCombatant.get(selectedUnitId ?? inspectedUnitId ?? '') ??
              viewModel.participants.find(
                (participant) => participant.combatantId !== localCombatantId,
              ) ??
              null
            }
            battle={battle}
            teamCount={viewModel.teamCount}
            role="selected"
          />
          <BattleLogPanel
            presentation="inline"
            battleSessionId={battle.battleSessionId}
            battleVersion={battle.battleVersion}
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
            preview={preview?.battleVersion === battle.battleVersion ? preview.preview : null}
            pending={previewPending}
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
                slot="move"
                hotkey={formatCombatKeybind(bindings.move)}
                label="Move"
                cost={`${MOVE_COST_PER_TERRAIN_POINT} AP`}
                artworkSrc={BATTLE_COMMAND_ARTWORK.move}
                active={mode === 'move'}
                disabled={planningDisabled || actionEconomy < MOVE_COST_PER_TERRAIN_POINT}
                onActivate={() => chooseMode('move')}
              />
              <BattleSkillCommand
                slot="attack"
                hotkey={formatCombatKeybind(bindings.basicAttack)}
                label="Basic Attack"
                cost={`${ATTACK_COST} AP`}
                artworkSrc={BATTLE_COMMAND_ARTWORK.attack}
                active={mode === 'attack' && selectedAttackActionId === BASIC_ATTACK_ID}
                disabled={planningDisabled || actionEconomy < ATTACK_COST}
                onActivate={() => chooseMode('attack')}
              />
              <BattleSkillCommand
                slot="guard"
                hotkey={formatCombatKeybind(bindings.guard)}
                label={supportSkill.name}
                cost={`${supportCost} AP`}
                artworkSrc={battleSkillArtwork(supportActionId)}
                active={mode === 'guard' && selectedDefenseActionId === supportActionId}
                disabled={planningDisabled || actionEconomy < supportCost}
                cooldownTurns={cooldowns[supportActionId] ?? 0}
                onActivate={() => chooseMode('guard')}
              />
            </div>
            <BattleSelectedSkills
              runtime={runtime}
              activeId={activeTechnique?.id}
              disabled={planningDisabled}
              actionEconomy={actionEconomy}
              cooldowns={cooldowns}
              bindings={bindings}
              onSelect={selectAction}
            />
            <BattleSkillCommand
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
                      disabled={planningDisabled}
                      onClick={() => void commitValue({ kind: 'face', facing })}
                      aria-label={`Face ${facing}`}
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
          <button
            type="button"
            className={styles.cancelAction}
            onClick={() => {
              clearPlanning()
              setNotice('Selection cleared.')
            }}
            disabled={commitPending}
          >
            Cancel Action
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
  )
}
