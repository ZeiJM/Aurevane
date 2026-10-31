import 'server-only'
import { createHash, randomUUID } from 'node:crypto'

import {
  buildBattlePrivacyJournalInput,
  type BattlePrivacyCommandKind,
} from './battle-history-privacy'
import type { BattleSessionRepository } from '@aurevane/db/battle-session'
import {
  executeBuildAwareRecruitAiAction,
  chooseBuildAwareRecruitAiDecision,
  type BuildAwareRecruitAiSkillOptions,
} from '@aurevane/game-core/combat/recruit-ai-build'
import {
  normalizeCombatEffectState,
  type CombatSummonInstance,
} from '@aurevane/game-core/combat/combat-effect-state'
import {
  chooseRecruitAiDecision,
  getRecruitAiProfile,
  type RecruitAiDecision,
  type RecruitAiDifficulty,
  type RecruitAiIntent,
} from '@aurevane/game-core/combat/recruit-ai'
import {
  executePv1fMovement,
  executePv1fSummonAbility,
  finishPv1fTurn,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { chooseSummonAiDecision } from '@aurevane/game-core/combat/summon-ai'
import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError, StaleBattleVersionError } from '@aurevane/game-core/errors'
import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'
import {
  resolveBattleDisciplineSkillDefinition,
  battleBuildAuthorityForCombatant,
  capturedBattleActionSource,
  resolvePinnedBattleEssenceDefinition,
  type BattleBuildAuthoritySnapshot,
} from './battle-build-authority'
import { essenceCombatSkill } from '@aurevane/game-core/combat/essence'
import { refreezeCapturedCombatAbilityState } from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  createBattleSessionChangedInvalidation,
  type BattleSessionChangedInvalidation,
} from '@aurevane/realtime'

import { projectBattleSnapshot, type BattleSessionProjection } from './battle-session-service'
import { deriveParticipantBattleViewerEntitlement } from './battle-viewer-entitlement'

const MAX_RECRUIT_DECISIONS_PER_REQUEST = 16
type BuildExtendedEncounterState = StatDrivenCombatEncounterState & {
  readonly buildAuthority?: BattleBuildAuthoritySnapshot
  readonly buildBridge?: unknown
}

export interface RecruitTurnView {
  battleSessionId: string
  battleVersion: number
  snapshot: BattleSessionProjection
  decisions: readonly {
    combatantId: string
    reason: RecruitAiDecision['reason']
    utility: number
  }[]
  invalidation: BattleSessionChangedInvalidation
}

export interface RunRecruitTurnCommand {
  userId: string
  battleSessionId: string
  expectedBattleVersion: number
}

export interface RecruitTieBreakSeedInput {
  battleId: string
  round: number
  turnNumber: number
  battleVersion: number
  step: number
  combatantId: string
}

export interface BattleRecruitAiService {
  runTurn(command: RunRecruitTurnCommand): Promise<RecruitTurnView>
}

function recruitIntentPrivacyKind(kind: RecruitAiIntent['kind']): BattlePrivacyCommandKind {
  if (kind === 'action') return 'action'
  if (kind === 'move') return 'move'
  if (kind === 'face') return 'face'
  return 'system'
}

function battleUnavailable(): AurevaneError {
  return new AurevaneError('FORBIDDEN', 'That battle is not available to this account.')
}

function persistenceInvalid(message = 'The stored battle state is invalid.'): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

function readPersistedEncounter(snapshot: unknown): BuildExtendedEncounterState {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw persistenceInvalid()
  }
  try {
    const candidate = snapshot as BuildExtendedEncounterState
    const issues = validateStatDrivenCombatEncounterState(candidate)
    if (issues.length > 0) throw persistenceInvalid()
    return refreezeCapturedCombatAbilityState(candidate)
  } catch (error) {
    if (error instanceof AurevaneError) throw error
    throw persistenceInvalid()
  }
}

function preserveFrozenBuildMetadata(
  previous: BuildExtendedEncounterState,
  next: StatDrivenCombatEncounterState,
): BuildExtendedEncounterState {
  return {
    ...next,
    ...(previous.buildAuthority !== undefined ? { buildAuthority: previous.buildAuthority } : {}),
    ...(previous.buildBridge !== undefined ? { buildBridge: previous.buildBridge } : {}),
  }
}

function resolveRecruitIntent(
  state: StatDrivenCombatEncounterState,
  intent: RecruitAiIntent,
  skillOptions: BuildAwareRecruitAiSkillOptions,
  summon: CombatSummonInstance | null = null,
): { state: StatDrivenCombatEncounterState; events: readonly unknown[] } {
  if (intent.kind === 'ability-prime' || intent.kind === 'ability-cancel-prime') {
    if (summon) throw new TypeError('summon-controlled-command-unsupported')
    return executeBuildAwareRecruitAiAction(
      state,
      intent.actionId,
      intent.kind === 'ability-prime' ? (intent.target ?? { kind: 'self' }) : { kind: 'self' },
      skillOptions,
      {
        behaviorId: intent.behaviorId,
        controlledOperation: intent.kind === 'ability-prime' ? 'prime' : 'cancel',
        ...(intent.kind === 'ability-prime' ? { manualModifiers: intent.manualModifiers } : {}),
      },
    )
  }
  if (intent.kind === 'move') return executePv1fMovement(state, intent.path)
  if (intent.kind === 'action') {
    if (summon && intent.manualModifiers?.length)
      throw new TypeError('summon-modifier-command-unsupported')
    return summon
      ? executePv1fSummonAbility(state, summon, intent.actionId, intent.target)
      : executeBuildAwareRecruitAiAction(state, intent.actionId, intent.target, skillOptions, {
          behaviorId: intent.behaviorId,
          movementPath: intent.movementPath,
          manualModifiers: intent.manualModifiers,
        })
  }
  if (intent.kind === 'face') return finishPv1fTurn(state, intent.facing)

  const activeId = state.tactical.battle.currentTurn?.combatantId
  const placement = activeId
    ? state.tactical.placements.find((candidate) => candidate.combatantId === activeId)
    : null
  if (!placement) throw new Error('AI combatant has no committed facing.')
  return finishPv1fTurn(state, placement.facing)
}

/** Never bypass shared legality: try a simpler AI action, then a legal turn end.
 * The original encounter remains untouched unless the resulting transition commits. */
export function resolveRecruitDecisionWithFallback(
  state: StatDrivenCombatEncounterState,
  selected: RecruitAiDecision,
  skillOptions: BuildAwareRecruitAiSkillOptions,
  tieBreakSeed: number,
  difficulty: RecruitAiDifficulty,
  summon: CombatSummonInstance | null = null,
): {
  decision: RecruitAiDecision
  resolved: ReturnType<typeof resolveRecruitIntent>
  recovery?: 'basic' | 'end-turn'
} {
  try {
    return {
      decision: selected,
      resolved: resolveRecruitIntent(state, selected.intent, skillOptions, summon),
    }
  } catch (error) {
    if (error instanceof AurevaneError) throw error
  }

  // A canonical Skill can have a valid preview but fail at commit. The ordinary
  // AI's independently quoted Basics, movement and facing are safer alternatives.
  if (!summon) {
    try {
      const basic = chooseRecruitAiDecision({
        state,
        profile: getRecruitAiProfile(difficulty),
        tieBreakSeed,
      })
      return {
        decision: basic,
        resolved: resolveRecruitIntent(state, basic.intent, skillOptions),
        recovery: 'basic',
      }
    } catch (error) {
      if (error instanceof AurevaneError) throw error
    }
  }

  // A rejected AI command must never hold the battle hostage. Finish through the
  // same final-facing and turn-boundary authority as a player, preserving Frozen.
  try {
    const ended: RecruitAiDecision = {
      ...selected,
      intent: { kind: 'end-turn' },
      reason: 'safe-end-turn',
      utility: 0,
    }
    return {
      decision: ended,
      resolved: resolveRecruitIntent(state, ended.intent, skillOptions, summon),
      recovery: 'end-turn',
    }
  } catch {
    throw persistenceInvalid('Combat AI produced a command rejected by shared combat legality.')
  }
}

function activeSummonForActor(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
): CombatSummonInstance | null {
  return (
    (normalizeCombatEffectState(state.effectState).summons ?? []).find(
      (summon) => summon.combatantId === combatantId,
    ) ?? null
  )
}

async function resolveRecruitSkillOptions(
  state: BuildExtendedEncounterState,
  actorId: string,
  resolver: CombatContentResolver | undefined,
): Promise<BuildAwareRecruitAiSkillOptions> {
  const authority = state.buildAuthority
  if (!authority) return {}
  if (!resolver) throw persistenceInvalid('Published combat content resolver is unavailable.')

  const build = battleBuildAuthorityForCombatant(authority, actorId)
  if (!build) return { committedSkills: [], canonicalSources: [] }
  const canonicalSources = (state.capturedAbilitySources ?? []).filter(
    (source) =>
      source.ownerCombatantId === actorId &&
      ((source.sourceKind === 'basic' &&
        source.basic !== undefined &&
        state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId)) ||
        capturedBattleActionSource(state, authority, actorId, source.abilityId) === source),
  )
  const regular = []
  for (const reference of build.disciplineSkills) {
    if (canonicalSources.some((source) => source.abilityId === reference.skillId)) continue
    const definition = await resolveBattleDisciplineSkillDefinition(
      authority,
      actorId,
      reference.skillId,
      resolver,
    )
    if (!definition) throw persistenceInvalid('Pinned AI Skill definition is unavailable.')
    regular.push(definition)
  }
  const essence =
    build.extensions.essence &&
    !canonicalSources.some((source) => source.abilityId === build.extensions.essence!.skillId)
      ? await resolvePinnedBattleEssenceDefinition(authority, actorId, resolver)
      : null
  return {
    committedSkills: essence ? [...regular, essenceCombatSkill(essence)] : regular,
    canonicalSources,
  }
}

function recruitDifficultyForActor(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
): RecruitAiDifficulty {
  const profile = state.statBridge.combatants.find(
    (candidate) => candidate.combatantId === combatantId,
  )
  const sourceId = profile?.provenance.sourceId ?? ''
  if (sourceId.endsWith(':easy')) return 'easy'
  if (sourceId.endsWith(':high')) return 'high'
  return 'standard'
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

export function deriveRecruitTieBreakSeed(input: RecruitTieBreakSeedInput): number {
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        domain: 'aurevane.recruit-ai.tie-break.v2',
        battleId: input.battleId,
        round: input.round,
        turnNumber: input.turnNumber,
        battleVersion: input.battleVersion,
        step: input.step,
        combatantId: input.combatantId,
      }),
    )
    .digest()
  return digest.readInt32BE(0)
}

function decisionEvent(
  decision: RecruitAiDecision,
  combatantId: string,
  controller: 'recruit' | 'summon',
  recovery?: 'basic' | 'end-turn',
) {
  return {
    event: controller === 'summon' ? 'summon_ai_decision' : 'recruit_ai_decision',
    combatantId,
    profileId: decision.profileId,
    profileVersion: decision.profileVersion,
    rulesVersion: decision.rulesVersion,
    reason: decision.reason,
    utility: decision.utility,
    candidateCount: decision.candidateCount,
    ...(recovery ? { recovery } : {}),
  }
}

export function createBattleRecruitAiService(
  battles: BattleSessionRepository,
  combatContentResolver?: CombatContentResolver,
): BattleRecruitAiService {
  return {
    async runTurn(command) {
      const initial = await battles.findBattleSession(command.userId, command.battleSessionId)
      if (!initial) throw battleUnavailable()
      if (initial.battleVersion !== command.expectedBattleVersion) {
        throw new StaleBattleVersionError(initial.battleVersion)
      }

      let state = readPersistedEncounter(initial.snapshot)
      const controlledIds = [...initial.controlledCombatantIds]
      if (controlledIds.length === 0 || new Set(controlledIds).size !== controlledIds.length) {
        throw persistenceInvalid()
      }

      const initialTurn = state.tactical.battle.currentTurn
      if (
        state.tactical.battle.lifecycle !== 'active' ||
        !initialTurn ||
        controlledIds.includes(initialTurn.combatantId)
      ) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Recruit AI can run only while an opponent-controlled turn is active.',
        )
      }

      const initialTurnNumber = state.tactical.battle.turnNumber
      let battleVersion = initial.battleVersion
      let committedAt = initial.updatedAt
      const decisions: Array<RecruitTurnView['decisions'][number]> = []
      const committedView = (): RecruitTurnView => ({
        battleSessionId: initial.battleSessionId,
        battleVersion,
        snapshot: projectBattleSnapshot(
          state,
          deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, controlledIds),
        ),
        decisions,
        invalidation: createBattleSessionChangedInvalidation({
          battleSessionId: initial.battleSessionId,
          battleVersion,
          occurredAt: committedAt,
          reason: 'state_changed',
        }),
      })

      for (let step = 0; step < MAX_RECRUIT_DECISIONS_PER_REQUEST; step += 1) {
        const battle = state.tactical.battle
        const turn = battle.currentTurn
        if (
          battle.lifecycle !== 'active' ||
          turn === null ||
          controlledIds.includes(turn.combatantId) ||
          battle.turnNumber !== initialTurnNumber
        ) {
          return committedView()
        }

        const summon = activeSummonForActor(state, turn.combatantId)
        const tieBreakSeed = deriveRecruitTieBreakSeed({
          battleId: battle.battleId,
          round: battle.round,
          turnNumber: battle.turnNumber,
          battleVersion,
          step,
          combatantId: turn.combatantId,
        })
        const difficulty =
          summon?.profile.aiProfile ?? recruitDifficultyForActor(state, turn.combatantId)
        const resolver =
          combatContentResolver ??
          (state.buildAuthority ? createServerCombatContentResolver() : undefined)
        const skillOptions = summon
          ? {}
          : await resolveRecruitSkillOptions(state, turn.combatantId, resolver)
        const selected = summon
          ? chooseSummonAiDecision({
              state,
              summon,
              tieBreakSeed,
            })
          : chooseBuildAwareRecruitAiDecision({
              state,
              profile: getRecruitAiProfile(difficulty),
              tieBreakSeed,
              skillOptions,
            })
        const { decision, resolved, recovery } = resolveRecruitDecisionWithFallback(
          state,
          selected,
          skillOptions,
          tieBreakSeed,
          difficulty,
          summon,
        )
        const nextState = preserveFrozenBuildMetadata(state, resolved.state)
        const freeControlled =
          decision.intent.kind === 'ability-prime' ||
          decision.intent.kind === 'ability-cancel-prime'
        const events = freeControlled
          ? [...resolved.events]
          : [
              decisionEvent(decision, turn.combatantId, summon ? 'summon' : 'recruit', recovery),
              ...resolved.events,
            ]
        const privacyJournal = buildBattlePrivacyJournalInput({
          before: state,
          after: nextState,
          commandKind: recruitIntentPrivacyKind(decision.intent.kind),
          events,
        })
        const requestFingerprint = fingerprint({
          command: summon ? 'battle.summon-ai.v1' : 'battle.recruit-ai.v2',
          battleSessionId: initial.battleSessionId,
          expectedBattleVersion: battleVersion,
          difficulty,
          decision: {
            intent: decision.intent,
            reason: decision.reason,
            profileId: decision.profileId,
            profileVersion: decision.profileVersion,
            rulesVersion: decision.rulesVersion,
          },
        })
        const committed = await battles.commitBattleIntent({
          actorKey: command.userId,
          idempotencyKey: randomUUID(),
          requestFingerprint,
          userId: command.userId,
          battleSessionId: initial.battleSessionId,
          expectedBattleVersion: battleVersion,
          nextSnapshot: nextState,
          events,

          privacyJournal,
        })

        battleVersion = committed.result.battleVersion
        committedAt = committed.result.committedAt
        state = readPersistedEncounter(committed.result.snapshot)
        if (!freeControlled)
          decisions.push({
            combatantId: turn.combatantId,
            reason: decision.reason,
            utility: decision.utility,
          })
      }

      // Each step is already committed. Return that progress so the existing client
      // can request the next bounded page at the new version, preserving the turn.
      return committedView()
    },
  }
}
