'use client'

import {
  PV1F_BASIC_ATTACK_COST,
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_GUARD_COST,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_MP_RECOVER_COST,
  PV1F_RECOVER_ACTION_ID,
  PV1F_RECOVER_COST,
} from '@aurevane/game-core/combat/pv1f-skills'
import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
import type { RecruitTurnView } from '@/server/battle/battle-recruit-ai-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { pvpParticipantAccent } from './battle-combatant-colors'
import { BattleFacingIndicator } from './battle-facing-indicator'
import { useBattleInteractionLifecycle } from './battle-interaction-lifecycle'
import {
  buildReachablePaths,
  facingGlyph,
  meterPercent,
  MOVE_COST_PER_TERRAIN_POINT,
  positionKey,
  positionsEqual,
  type BattleFacing,
  type BattleGridPosition,
} from './battle-geometry'
import {
  battleParticipantName,
  buildBattleViewModel,
  deriveBattleCapabilities,
  type BattlePresentationParticipant,
  type BattleRuntime,
} from './battle-runtime'
import { BattleSkillCommand } from './battle-skill-command'
import { BATTLE_COMMAND_ARTWORK, battleSkillArtwork } from './battle-skill-presentation'
import { useBattleSkillSelections } from './battle-skill-selection'
import { useBattleSessionUiBoolean } from './battle-session-ui-state'
import styles from './pvp-battle-experience.module.css'
import railStyles from './pvp-six-combatant-rails.module.css'
import bridgeStyles from './unified-battle-experience.module.css'

const BASIC_ATTACK_ID = PV1F_BASIC_ATTACK_ID
const GUARD_ID = PV1F_GUARD_ACTION_ID
const RECOVER_ID = PV1F_RECOVER_ACTION_ID
const MP_RECOVER_ID = PV1F_MP_RECOVER_ACTION_ID
const ACTION_ECONOMY_KEY = 'pv1f.action-economy'
const ATTACK_COST = PV1F_BASIC_ATTACK_COST
const GUARD_COST = PV1F_GUARD_COST
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
  },
  {
    id: MP_RECOVER_ID,
    label: 'MP Recovery',
    cost: `${MP_RECOVER_COST} AP`,
    artworkSrc: battleSkillArtwork(MP_RECOVER_ID),
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

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
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
  playerName: string,
  recruitId: string | null,
  playerId: string | null,
): string {
  if (!recruitId) return 'Recruit turn resolved.'

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
  const beforePlayer = before.snapshot.tactical.battle.combatants.find(
    (combatant) => combatant.id === playerId,
  )
  const afterPlayer = after.snapshot.tactical.battle.combatants.find(
    (combatant) => combatant.id === playerId,
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
  if (beforePlayer && afterPlayer && beforePlayer.hp > afterPlayer.hp) {
    parts.push(`hit ${playerName} for ${beforePlayer.hp - afterPlayer.hp}`)
  } else if (decisions.some((decision) => decision.reason === 'legal-damage')) {
    parts.push('attacked but dealt no damage')
  }
  if (beforeRecruit && afterRecruit && afterRecruit.hp > beforeRecruit.hp) {
    parts.push(`recovered ${afterRecruit.hp - beforeRecruit.hp} HP`)
  }
  if (recruitStatuses.some((status) => status.statusId === 'guarded')) {
    parts.push('Guarded (-15% damage)')
  }
  if (afterRecruitPlacement) {
    parts.push(
      `finished facing ${afterRecruitPlacement.facing} ${facingGlyph(afterRecruitPlacement.facing)}`,
    )
  }

  return parts.length > 0 ? `Recruit: ${parts.join(' → ')}.` : 'Recruit turn resolved.'
}

export function BattleExperience({
  initialBattle,
  runtime,
}: {
  initialBattle: BattleSessionView
  runtime: BattleRuntime
}) {
  const [battle, setBattle] = useState(initialBattle)
  const [mode, setMode] = useState<Mode>('none')
  const [path, setPath] = useState<BattleGridPosition[]>([])
  const [pendingIntent, setPendingIntent] = useState<BattleIntent | null>(null)
  const [preview, setPreview] = useState<BattlePreviewView | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [notice, setNotice] = useState(
    runtime.kind === 'pvp'
      ? 'Arena linked. Waiting for the authoritative turn state.'
      : 'Your turn. Choose any action when you are ready.',
  )
  const [previewPending, setPreviewPending] = useState(false)
  const [commitPending, setCommitPending] = useState(false)
  const [copyNotice, setCopyNotice] = useState(false)
  const [victoryOpen, setVictoryOpen] = useState(false)
  const [recruitPending, setRecruitPending] = useState(false)
  const [recruitFailed, setRecruitFailed] = useState(false)
  const [surrenderOpen, setSurrenderOpen] = useState(false)
  const [surrenderPending, setSurrenderPending] = useState(false)

  const previewSequence = useRef(0)
  const commitLock = useRef(false)
  const battleRef = useRef(initialBattle)
  const battlePollInFlight = useRef(false)
  const battlePollController = useRef<AbortController | null>(null)
  const recruitAttemptedVersion = useRef<number | null>(null)
  const recruitLock = useRef(false)
  const modeRef = useRef<Mode>('none')
  modeRef.current = mode
  const { registerFinishTurnHandler, registerInspectCloseHandler } = useBattleInteractionLifecycle()

  const { selectedSkillId, selectSkill } = useBattleSkillSelections(
    initialBattle.battleSessionId,
    BATTLE_SKILL_CATEGORIES,
  )
  const selectedHealActionId = selectedSkillId('heal')
  const attackTechniques = runtime.techniques?.filter((technique) => technique.category === 'attack') ?? []
  const defenseTechniques = runtime.techniques?.filter((technique) => technique.category === 'defense') ?? []
  const healTechniques = runtime.techniques?.filter((technique) => technique.category === 'heal') ?? []
  const [selectedAttackActionId, setSelectedAttackActionId] = useState(BASIC_ATTACK_ID)
  const [selectedDefenseActionId, setSelectedDefenseActionId] = useState(GUARD_ID)
  const [selectedTechniqueHealId, setSelectedTechniqueHealId] = useState<string | null>(null)
  const attackOptions = [
    { id: BASIC_ATTACK_ID, label: 'Basic Attack', cost: `${ATTACK_COST} AP`, artworkSrc: BATTLE_COMMAND_ARTWORK.attack },
    ...attackTechniques.map((technique) => ({ id: technique.id, label: technique.name, cost: `${technique.apCost} AP`, artworkSrc: battleSkillArtwork(technique.id) })),
    ...(runtime.essence ? [{ id: runtime.essence.id, label: runtime.essence.name, cost: `${runtime.essence.apCost} AP`, artworkSrc: battleSkillArtwork(runtime.essence.id) }] : []),
  ]
  const defenseOptions = [
    { id: GUARD_ID, label: 'Guard', cost: `${GUARD_COST} AP`, artworkSrc: BATTLE_COMMAND_ARTWORK.guard },
    ...defenseTechniques.map((technique) => ({ id: technique.id, label: technique.name, cost: `${technique.apCost} AP`, artworkSrc: battleSkillArtwork(technique.id) })),
  ]
  const recoveryOptions = [
    ...HEAL_SELECTOR_OPTIONS,
    ...healTechniques.map((technique) => ({ id: technique.id, label: technique.name, cost: `${technique.apCost} AP`, artworkSrc: battleSkillArtwork(technique.id) })),
  ]
  const selectedAttack = attackOptions.find((option) => option.id === selectedAttackActionId) ?? attackOptions[0]!
  const selectedDefense = defenseOptions.find((option) => option.id === selectedDefenseActionId) ?? defenseOptions[0]!
  const effectiveHealActionId = selectedTechniqueHealId ?? selectedHealActionId
  const selectedHealOption = recoveryOptions.find((option) => option.id === effectiveHealActionId) ?? recoveryOptions[0]!
  const [logOpen, setLogOpen] = useBattleSessionUiBoolean(
    initialBattle.battleSessionId,
    'battleLogOpen',
  )

  const capabilities = useMemo(() => deriveBattleCapabilities(runtime), [runtime])
  const viewModel = useMemo(
    () => buildBattleViewModel(initialBattle, runtime),
    [initialBattle, runtime],
  )
  const tactical = battle.snapshot.tactical
  const battleState = tactical.battle
  const localParticipant = viewModel.localParticipant
  const localCombatantId = viewModel.localCombatantId
  const localCombatant = localCombatantId
    ? (battleState.combatants.find((combatant) => combatant.id === localCombatantId) ?? null)
    : null
  const localPlacement = localCombatantId
    ? (tactical.placements.find((placement) => placement.combatantId === localCombatantId) ?? null)
    : null
  const localTeamIndex = viewModel.localTeamIndex ?? -1
  const localTurn = Boolean(
    localCombatantId && battleState.currentTurn?.combatantId === localCombatantId,
  )
  const actionEconomy = localTurn ? readEconomy(localCombatant) : 0
  const planningDisabled =
    !localTurn || battleState.lifecycle !== 'active' || commitPending || recruitPending
  const planningDisabledRef = useRef(planningDisabled)
  planningDisabledRef.current = planningDisabled
  const activeName = battleParticipantName(viewModel, battleState.currentTurn?.combatantId)
  const selectedHealIsMp = effectiveHealActionId === MP_RECOVER_ID
  const selectedHealName = selectedHealOption.label
  const selectedHealCost = Number.parseInt(selectedHealOption.cost, 10)
  const selectedHealAtMaximum = effectiveHealActionId === MP_RECOVER_ID
    ? !localCombatant || localCombatant.mp >= localCombatant.maxMp
    : effectiveHealActionId === RECOVER_ID
      ? !localCombatant || localCombatant.hp >= localCombatant.maxHp
      : false
  const selectedAttackCost = Number.parseInt(selectedAttack.cost, 10)
  const selectedDefenseCost = Number.parseInt(selectedDefense.cost, 10)
  const selectedAttackTechnique = runtime.techniques?.find((technique) => technique.id === selectedAttackActionId)
  const selectedDefenseTechnique = runtime.techniques?.find((technique) => technique.id === selectedDefenseActionId)
  const selectedHealTechnique = runtime.techniques?.find((technique) => technique.id === effectiveHealActionId)

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
        ? buildReachablePaths(tactical, localPlacement, actionEconomy)
        : new Map<string, BattleGridPosition[]>(),
    [actionEconomy, localPlacement, localTurn, tactical],
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

  const clearPlanning = useCallback((nextMode: Mode = 'none') => {
    previewSequence.current += 1
    setMode(nextMode)
    setPath([])
    setPendingIntent(null)
    setPreview(null)
    setSelectedUnitId(null)
    setPreviewPending(false)
  }, [])

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
        window.location.assign('/')
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
    [refreshBattle],
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
      } else if (!wasLocal && isLocal) {
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
      const sequence = ++previewSequence.current
      setPreviewPending(true)
      setPendingIntent(intent)
      try {
        const response = await fetch(`/api/battles/${battle.battleSessionId}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedBattleVersion: battle.battleVersion, intent }),
        })
        const body = (await response.json()) as { battlePreview?: BattlePreviewView } & ApiErrorBody
        if (sequence !== previewSequence.current) return
        if (!response.ok || !body.battlePreview) {
          setPreview(null)
          await handleApiFailure(response, body, 'That command could not be checked.')
          return
        }
        setPreview(body.battlePreview)
        const result = body.battlePreview.preview
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
        }
      } catch (error) {
        if (sequence === previewSequence.current) {
          setPreview(null)
          setNotice(error instanceof Error ? error.message : 'That command could not be checked.')
        }
      } finally {
        if (sequence === previewSequence.current) setPreviewPending(false)
      }
    },
    [battle.battleSessionId, battle.battleVersion, handleApiFailure],
  )

  const commitValue = useCallback(
    async (intent: BattleIntent) => {
      if (commitLock.current || commitPending || !localTurn) return
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
              : `Finishing facing ${intent.facing} ${facingGlyph(intent.facing)}…`,
          )
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        })
        const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
        if (!response.ok || !body.battle) {
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

        if (runtime.kind === 'pvp') {
          if (
            intent.kind === 'action' &&
            intent.actionId === BASIC_ATTACK_ID &&
            body.battle.snapshot.tactical.battle.lifecycle === 'active' &&
            nextLocalTurn &&
            remaining >= ATTACK_COST
          ) {
            clearPlanning('attack')
            setNotice(
              `Basic Attack committed. ${remaining} AP remains — choose another target or another action.`,
            )
          } else {
            clearPlanning()
            if (body.battle.snapshot.tactical.battle.lifecycle === 'completed') {
              setNotice('Battle complete.')
            } else if (nextLocalTurn) {
              setNotice(`Action committed. ${remaining} AP remains.`)
            } else {
              setNotice(
                `Turn handed to ${battleParticipantName(
                  viewModel,
                  body.battle.snapshot.tactical.battle.currentTurn?.combatantId,
                )}.`,
              )
            }
          }
        } else {
          clearPlanning()
          if (intent.kind === 'face') {
            setNotice(
              `Finished facing ${intent.facing} ${facingGlyph(intent.facing)}. Recruit turn begins.`,
            )
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
        setNotice(error instanceof Error ? error.message : 'That action could not be committed.')
      } finally {
        setCommitPending(false)
        commitLock.current = false
      }
    },
    [
      battle,
      clearPlanning,
      commitPending,
      handleApiFailure,
      localCombatantId,
      localTurn,
      runtime.kind,
      viewModel,
    ],
  )

  const commitSelected = useCallback(() => {
    if (!pendingIntent || !preview?.preview.legal || previewPending) return
    void commitValue(pendingIntent)
  }, [commitValue, pendingIntent, preview, previewPending])

  const chooseMode = useCallback(
    (nextMode: Mode) => {
      if (planningDisabled && nextMode !== 'inspect') return
      clearPlanning(nextMode)
      if (nextMode === 'guard') {
        if (!selectedDefenseTechnique || selectedDefenseTechnique.targetKind === 'self') {
          void requestPreview({ kind: 'action', actionId: selectedDefenseActionId, target: { kind: 'self' } })
        } else {
          setNotice(`${selectedDefense.label} · choose a target on the board.`)
        }
      } else if (nextMode === 'recover') {
        if (!selectedHealTechnique || selectedHealTechnique.targetKind === 'self') {
          void requestPreview({ kind: 'action', actionId: effectiveHealActionId, target: { kind: 'self' } })
        } else {
          setNotice(`${selectedHealName} · choose a target on the board.`)
        }
      } else if (nextMode === 'move') {
        setNotice('Move mode · green tiles are reachable with your remaining AP.')
      } else if (nextMode === 'attack') {
        if (selectedAttackTechnique?.targetKind === 'self') {
          void requestPreview({ kind: 'action', actionId: selectedAttackActionId, target: { kind: 'self' } })
        } else {
          setNotice(`${selectedAttack.label} · choose a legal target on the board.`)
        }
      } else if (nextMode === 'finish') {
        setNotice('Choose final facing with the buttons, WASD, or arrow keys to end the turn.')
      } else if (nextMode === 'inspect') {
        setNotice('Inspect mode · choose any combatant on the board.')
      }
    },
    [
      clearPlanning,
      effectiveHealActionId,
      planningDisabled,
      requestPreview,
      selectedAttack.label,
      selectedAttackActionId,
      selectedAttackTechnique,
      selectedDefense.label,
      selectedDefenseActionId,
      selectedDefenseTechnique,
      selectedHealName,
      selectedHealTechnique,
    ],
  )

  const handleTile = useCallback(
    (position: BattleGridPosition) => {
      const key = positionKey(position)
      const placement = placementByTile.get(key)
      if (mode === 'inspect') {
        setSelectedUnitId(placement?.combatantId ?? null)
        return
      }
      if (planningDisabled) return

      if (mode === 'move') {
        const nextPath = reachablePaths.get(key)
        if (!nextPath || nextPath.length < 2) {
          if (localPlacement && positionsEqual(position, localPlacement.position)) {
            clearPlanning('move')
            setNotice('Move preview returned to your current tile.')
          } else {
            setNotice('That tile is not reachable with the AP you have left.')
          }
          return
        }
        setPath(nextPath)
        void requestPreview({ kind: 'move', path: nextPath })
        return
      }

      if (mode === 'attack' || mode === 'guard' || mode === 'recover') {
        const selectedActionId =
          mode === 'attack'
            ? selectedAttackActionId
            : mode === 'guard'
              ? selectedDefenseActionId
              : effectiveHealActionId
        if (!placement || !localParticipant) {
          setNotice('Choose a combatant target.')
          return
        }
        const target = viewModel.participantByCombatant.get(placement.combatantId)
        const targetCombatant = battleState.combatants.find(
          (combatant) => combatant.id === placement.combatantId,
        )
        if (!attackRange.has(key) || !target || !targetCombatant || targetCombatant.hp <= 0) {
          setNotice('That unit is not in range for the selected Technique.')
          return
        }
        if (mode === 'attack' && selectedActionId === BASIC_ATTACK_ID && target.teamIndex === localParticipant.teamIndex) {
          setNotice('Basic Attack requires an enemy target.')
          return
        }
        setSelectedUnitId(placement.combatantId)
        void requestPreview({
          kind: 'action',
          actionId: selectedActionId,
          target: { kind: 'unit', combatantId: placement.combatantId },
        })
      }
    },
    [
      attackRange,
      battleState.combatants,
      clearPlanning,
      localParticipant,
      localPlacement,
      mode,
      placementByTile,
      planningDisabled,
      reachablePaths,
      requestPreview,
      selectedAttackActionId,
      selectedDefenseActionId,
      effectiveHealActionId,
      viewModel.participantByCombatant,
    ],
  )

  const moveByKeyboard = useCallback(
    (delta: BattleGridPosition) => {
      if (mode !== 'move' || planningDisabled || !localPlacement) return
      const origin = localPlacement.position
      const tip = path.at(-1) ?? origin
      const next = { x: tip.x + delta.x, y: tip.y + delta.y }

      if (path.length > 1) {
        const previous = path[path.length - 2]
        if (previous && positionsEqual(previous, next)) {
          const shorter = path.slice(0, -1)
          if (shorter.length <= 1) {
            setPath([])
            setPendingIntent(null)
            setPreview(null)
            previewSequence.current += 1
            setNotice('Move preview returned to your current tile.')
          } else {
            setPath(shorter)
            void requestPreview({ kind: 'move', path: shorter })
          }
          return
        }
      }

      const nextPath = reachablePaths.get(positionKey(next))
      if (!nextPath || nextPath.length < 2) {
        setNotice('That direction is not reachable with the AP you have left.')
        return
      }
      setPath(nextPath)
      void requestPreview({ kind: 'move', path: nextPath })
    },
    [localPlacement, mode, path, planningDisabled, reachablePaths, requestPreview],
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target)) return
      const lower = event.key.toLowerCase()
      const direction: { delta: BattleGridPosition; facing: BattleFacing } | null =
        lower === 'w' || event.key === 'ArrowUp'
          ? { delta: { x: 0, y: -1 }, facing: 'north' }
          : lower === 'd' || event.key === 'ArrowRight'
            ? { delta: { x: 1, y: 0 }, facing: 'east' }
            : lower === 's' || event.key === 'ArrowDown'
              ? { delta: { x: 0, y: 1 }, facing: 'south' }
              : lower === 'a' || event.key === 'ArrowLeft'
                ? { delta: { x: -1, y: 0 }, facing: 'west' }
                : null

      if (direction && mode === 'finish' && !planningDisabled) {
        event.preventDefault()
        void commitValue({ kind: 'face', facing: direction.facing })
        return
      }
      if (direction && mode === 'move' && !planningDisabled) {
        event.preventDefault()
        moveByKeyboard(direction.delta)
        return
      }
      if (event.key === 'Enter' && pendingIntent && preview?.preview.legal) {
        event.preventDefault()
        commitSelected()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        clearPlanning()
        setNotice('Selection cleared.')
      } else if (event.key === '0') {
        event.preventDefault()
        chooseMode('inspect')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    chooseMode,
    clearPlanning,
    commitSelected,
    commitValue,
    mode,
    moveByKeyboard,
    pendingIntent,
    planningDisabled,
    preview,
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
      const recruitId =
        viewModel.participants.find((participant) => !participant.local)?.combatantId ?? null
      setNotice(
        describeRecruitTurn(
          before,
          nextBattle,
          body.battle.decisions,
          runtime.playerName,
          recruitId,
          localCombatantId,
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
    localCombatantId,
    localTurn,
    recruitPending,
    runtime,
    viewModel.participants,
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

  const boardStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${tactical.width}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${tactical.height}, minmax(0, 1fr))`,
    aspectRatio: `${tactical.width} / ${tactical.height}`,
  }

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
              : mode.replace('-', ' ')
  const contextDescription =
    mode === 'inspect' && selectedParticipant && selectedCombatant && selectedPlacement
      ? `Team ${selectedParticipant.teamIndex + 1} · HP ${selectedCombatant.hp}/${selectedCombatant.maxHp} · MP ${selectedCombatant.mp}/${selectedCombatant.maxMp} · Facing ${selectedPlacement.facing} ${facingGlyph(selectedPlacement.facing)}`
      : notice

  return (
    <main
      className={styles.shell}
      data-unified-battle="true"
      data-battle-kind={runtime.kind}
      data-pvp-battle={runtime.kind === 'pvp' ? 'true' : undefined}
      data-local-turn={localTurn || undefined}
      data-battle-keyboard-focus-root="true"
      tabIndex={-1}
      aria-busy={recruitPending || undefined}
    >
      <header className={styles.header} data-unified-battle-header="true">
        <div className={styles.objective}>
          <span>{viewModel.objectiveEyebrow}</span>
          <strong>{viewModel.objective}</strong>
        </div>

        <div
          className={styles.economy}
          data-active={localTurn || undefined}
          data-unified-battle-economy="true"
        >
          <div className={styles.economyCopy}>
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
          <button
            type="button"
            className={styles.victoryButton}
            onClick={() => setVictoryOpen(true)}
          >
            <span>Victory Conditions</span>
            <strong>{objectiveComplete ? '1/1' : '0/1'}</strong>
          </button>
        </div>

        <button
          type="button"
          className={styles.logButton}
          aria-expanded={logOpen}
          onClick={() => setLogOpen((open) => !open)}
        >
          Round {battleState.round}
          <small>Combat Log</small>
        </button>
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

        <DesktopBattleRail
          side="left"
          battle={battle}
          participants={viewModel.participants.filter(
            (participant) => participant.teamIndex === localTeamIndex,
          )}
          teamCount={viewModel.teamCount}
        />

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
                const targetRelation = selfTarget
                  ? 'friendly'
                  : inAttackRange
                    ? legalEnemy
                      ? 'enemy'
                      : 'illegal'
                    : undefined
                const selected = selectedUnitId === placement?.combatantId
                const terrain = tile.terrainId === 'rough-ground' ? 'rough' : 'open'

                return (
                  <button
                    type="button"
                    key={key}
                    className={styles.tile}
                    data-terrain={terrain}
                    data-elevation={tile.elevation > 0 || undefined}
                    data-reachable={reachable || undefined}
                    data-path={pathIndex >= 0 || undefined}
                    data-target={targetRelation}
                    data-selected={selected || undefined}
                    onClick={() => handleTile(tile.position)}
                    aria-label={`Tile ${tile.position.x + 1}, ${tile.position.y + 1}; ${tile.terrainId}; elevation ${tile.elevation}${participant ? `; occupied by ${participant.name}` : ''}`}
                  >
                    <span className={styles.tileMeta}>
                      {tile.position.x + 1},{tile.position.y + 1}
                    </span>
                    {tile.elevation > 0 ? <span className={styles.elevation}>▲</span> : null}
                    {pathIndex >= 0 ? <span className={styles.pathNumber}>{pathIndex}</span> : null}
                    {participant && placement ? (
                      <span
                        className={styles.unit}
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
                            sizes="64px"
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
          <div className={styles.legend} aria-label="Terrain legend">
            <span className={styles.terrainKey}>
              <i className={styles.roughKey} aria-hidden="true" />
              <span>
                <b>Difficult Terrain</b>
                <small>Higher movement cost</small>
              </span>
            </span>
            <span className={styles.terrainKey}>
              <i className={styles.raisedKey} aria-hidden="true">
                ▲
              </i>
              <span>
                <b>Elevated Ground</b>
                <small>Elevation +1</small>
              </span>
            </span>
          </div>
        </section>

        <DesktopBattleRail
          side="right"
          battle={battle}
          participants={viewModel.participants.filter(
            (participant) => participant.teamIndex !== localTeamIndex,
          )}
          teamCount={viewModel.teamCount}
        />

        <section
          className={styles.commandDeck}
          aria-label="Command Deck"
          data-unified-command-deck="true"
        >
          {runtime.kind === 'pve' ? (
            <div className={styles.context} data-testid="combat-mode-instruction">
              <div className={bridgeStyles.aiQualityPortalSlot} />
              <strong>{contextTitle}</strong>
              <span>{contextDescription}</span>
            </div>
          ) : (
            <div className={styles.context}>
              <strong>{contextTitle}</strong>
              <span>{contextDescription}</span>
            </div>
          )}
          <div className={styles.commands}>
            <BattleSkillCommand
              slot="inspect"
              hotkey="00"
              label="Inspect"
              cost="Free"
              artworkSrc={BATTLE_COMMAND_ARTWORK.inspect}
              active={mode === 'inspect'}
              disabled={false}
              onActivate={() => chooseMode('inspect')}
            />
            <BattleSkillCommand
              slot="move"
              hotkey="01"
              label="Move"
              cost={`${MOVE_COST_PER_TERRAIN_POINT} AP`}
              artworkSrc={BATTLE_COMMAND_ARTWORK.move}
              active={mode === 'move'}
              disabled={planningDisabled || actionEconomy < MOVE_COST_PER_TERRAIN_POINT}
              onActivate={() => chooseMode('move')}
            />
            <BattleSkillCommand
              slot="attack"
              hotkey="02"
              label={selectedAttack.label}
              cost={selectedAttack.cost}
              artworkSrc={selectedAttack.artworkSrc}
              active={mode === 'attack'}
              disabled={planningDisabled || actionEconomy < selectedAttackCost}
              onActivate={() => chooseMode('attack')}
              selector={{
                categoryLabel: 'Attack',
                selectedId: selectedAttackActionId,
                options: attackOptions,
                onSelect: (actionId) => {
                  setSelectedAttackActionId(actionId)
                  if (mode === 'attack') clearPlanning()
                  const option = attackOptions.find((candidate) => candidate.id === actionId)
                  if (option) setNotice(`${option.label} equipped in the Attack slot.`)
                },
              }}
            />
            <BattleSkillCommand
              slot="guard"
              hotkey="03"
              label={selectedDefense.label}
              cost={selectedDefense.cost}
              artworkSrc={selectedDefense.artworkSrc}
              active={mode === 'guard'}
              disabled={planningDisabled || actionEconomy < selectedDefenseCost}
              onActivate={() => chooseMode('guard')}
              selector={{
                categoryLabel: 'Guard',
                selectedId: selectedDefenseActionId,
                options: defenseOptions,
                onSelect: (actionId) => {
                  setSelectedDefenseActionId(actionId)
                  if (mode === 'guard') clearPlanning()
                  const option = defenseOptions.find((candidate) => candidate.id === actionId)
                  if (option) setNotice(`${option.label} equipped in the Guard slot.`)
                },
              }}
            />
            <BattleSkillCommand
              slot="recover"
              hotkey="04"
              label={selectedHealName}
              cost={`${selectedHealCost} AP`}
              artworkSrc={selectedHealOption.artworkSrc}
              active={mode === 'recover'}
              disabled={
                planningDisabled || actionEconomy < selectedHealCost || selectedHealAtMaximum
              }
              onActivate={() => chooseMode('recover')}
              selector={{
                categoryLabel: 'Heal',
                selectedId: effectiveHealActionId,
                options: recoveryOptions,
                onSelect: (skillId) => {
                  if (skillId === RECOVER_ID || skillId === MP_RECOVER_ID) {
                    setSelectedTechniqueHealId(null)
                    selectSkill('heal', skillId)
                  } else {
                    setSelectedTechniqueHealId(skillId)
                  }
                  if (mode === 'recover') clearPlanning()
                  const option = recoveryOptions.find((candidate) => candidate.id === skillId)
                  if (option) setNotice(`${option.label} equipped in the Recovery slot.`)
                },
              }}
            />
            <BattleSkillCommand
              slot="finish"
              hotkey="05"
              label="Finish Turn"
              cost="Choose facing + end"
              artworkSrc={BATTLE_COMMAND_ARTWORK.finish}
              active={mode === 'finish'}
              disabled={planningDisabled}
              onActivate={() => chooseMode('finish')}
            />
          </div>

          <div
            className={styles.facingRow}
            data-open={mode === 'finish' || undefined}
            data-unified-facing-pad="true"
          >
            <span>Final Facing</span>
            {(['north', 'west', 'east', 'south'] as const).map((facing) => (
              <button
                type="button"
                key={facing}
                disabled={mode !== 'finish' || planningDisabled}
                onClick={() => void commitValue({ kind: 'face', facing })}
                aria-label={`Face ${facing}`}
              >
                {facingGlyph(facing)}
              </button>
            ))}
          </div>
        </section>
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
        <div className={styles.footerActions}>
          <button
            type="button"
            onClick={() => {
              clearPlanning()
              setNotice('Selection cleared.')
            }}
            disabled={commitPending}
          >
            Cancel Action
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={commitSelected}
            disabled={commitPending || previewPending || !pendingIntent || !preview?.preview.legal}
          >
            {commitPending ? 'Committing…' : 'Confirm Action'}
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

      {victoryOpen ? (
        <div className={styles.modalBackdrop} onPointerDown={() => setVictoryOpen(false)}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="battle-victory-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span>Victory Conditions · {objectiveComplete ? '1/1' : '0/1'}</span>
            <h2 id="battle-victory-title">{viewModel.objective}.</h2>
            <p>
              You win when your side is the only side with at least one combatant still able to
              fight.
            </p>
            <button type="button" onClick={() => setVictoryOpen(false)}>
              Return to battle
            </button>
          </section>
        </div>
      ) : null}

      {surrenderOpen && runtime.kind === 'pve' ? (
        <div className={styles.modalBackdrop} onPointerDown={() => setSurrenderOpen(false)}>
          <section
            className={styles.modal}
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
            <button
              type="button"
              onClick={() => setSurrenderOpen(false)}
              disabled={surrenderPending}
            >
              Stay in battle
            </button>
            <button
              type="button"
              onClick={() => void confirmPveSurrender()}
              disabled={surrenderPending}
            >
              {surrenderPending ? 'Surrendering…' : 'Confirm Surrender'}
            </button>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function DesktopBattleRail({
  side,
  battle,
  participants,
  teamCount,
}: {
  side: 'left' | 'right'
  battle: BattleSessionView
  participants: readonly BattlePresentationParticipant[]
  teamCount: number
}) {
  const sorted = participants
    .slice()
    .sort((left, right) => left.teamIndex - right.teamIndex || left.seatIndex - right.seatIndex)

  return (
    <aside
      className={`${railStyles.rail} ${side === 'left' ? railStyles.railLeft : railStyles.railRight} ${bridgeStyles.desktopRail}`}
      data-unified-combatant-rail="true"
      aria-label={side === 'left' ? 'Allied combatants' : 'Opposing combatants'}
    >
      <div className={railStyles.stack} data-count={String(sorted.length)}>
        {sorted.map((participant) => {
          const combatant = battle.snapshot.tactical.battle.combatants.find(
            (candidate) => candidate.id === participant.combatantId,
          )
          const placement = battle.snapshot.tactical.placements.find(
            (candidate) => candidate.combatantId === participant.combatantId,
          )
          if (!combatant || !placement) return null
          const active =
            battle.snapshot.tactical.battle.currentTurn?.combatantId === participant.combatantId
          const accent = pvpParticipantAccent(
            participant.teamIndex,
            participant.seatIndex,
            teamCount,
          )
          const accentStyle = { '--battle-combatant-accent': accent } as CSSProperties

          return (
            <article
              key={participant.combatantId}
              className={railStyles.card}
              data-active={active || undefined}
              data-defeated={combatant.hp <= 0 || undefined}
              style={accentStyle}
            >
              <div className={railStyles.heading}>
                <div>
                  <span>
                    {participant.local
                      ? 'Character'
                      : `Opponent · Team ${participant.teamIndex + 1}`}
                  </span>
                  <strong>{participant.name}</strong>
                </div>
                <div className={railStyles.turnState}>
                  <i aria-label={`${participant.name} facing ${placement.facing}`}>
                    {facingGlyph(placement.facing)}
                  </i>
                  {active ? <b>Active</b> : null}
                </div>
              </div>
              <button
                type="button"
                className={railStyles.portraitButton}
                data-desktop-inspect-combatant={participant.combatantId}
                aria-label={`Inspect ${participant.name}`}
              >
                {participant.portraitAssetId ? (
                  <CharacterPortraitImage
                    imageUrl={participant.profileImageUrl}
                    fallbackAssetId={participant.portraitAssetId}
                    className={railStyles.portraitImage}
                    sizes="11rem"
                    alt=""
                  />
                ) : (
                  <span
                    className={`${railStyles.portraitImage} ${bridgeStyles.portraitFallback}`}
                    aria-hidden="true"
                  >
                    {participant.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className={railStyles.meters}>
                  <span aria-label={`${participant.name} HP ${combatant.hp} of ${combatant.maxHp}`}>
                    <i style={{ width: `${meterPercent(combatant.hp, combatant.maxHp)}%` }} />
                  </span>
                  <span aria-label={`${participant.name} MP ${combatant.mp} of ${combatant.maxMp}`}>
                    <i style={{ width: `${meterPercent(combatant.mp, combatant.maxMp)}%` }} />
                  </span>
                </div>
              </button>
            </article>
          )
        })}
      </div>
    </aside>
  )
}
