import { readFileSync } from 'node:fs'
import { expect } from 'vitest'
import { calculateDerivedStats } from '@aurevane/game-core/character/derived-stats'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import {
  createPendingBattle,
  startBattle,
  type BattleFacing,
} from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState, type GridPosition } from '@aurevane/game-core/combat/board'
import { attachCombatBuildBridge } from '@aurevane/game-core/combat/build-snapshot'
import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { activateCombatAbilitySources } from '@aurevane/game-core/combat/combat-ability-command'
import {
  createCharacterDerivedCombatProfile,
  createDuelBalancedCombatEncounterState,
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import {
  calculatePv1fBasicAttackDamage,
  createPv1fTemporaryResources,
  executePv1fMovement,
  finishPv1fTurn,
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  chooseBuildAwareRecruitAiDecision,
  executeBuildAwareRecruitAiAction,
} from '@aurevane/game-core/combat/recruit-ai-build'
import {
  loadCharacterCommittedBuildSnapshot,
  saveCharacterDisciplineSkills,
} from '@/server/character/character-build-service'
import { toCombatBuildSnapshot } from '@/server/character/character-combat-build-snapshot'
import {
  captureBattleBuildAbilitySources,
  createResolvedBattleBuildAuthoritySnapshot,
  parseBattleBuildAuthoritySnapshot,
  resolveBattleDisciplineSkillDefinitions,
} from './battle-build-authority'
import {
  fixture,
  publishProposedRoster,
  resolver,
  rows,
  type Kit,
} from './roster-legal-build.test-utils'

const coverage: { classes: { disciplineId: string; approachableLoadout: string[] }[] } = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-coverage.json',
      import.meta.url,
    ),
    'utf8',
  ),
)
export const legalRosterCycleKits: Kit[] = [
  ...coverage.classes.map((row) => ({
    name: `${row.disciplineId}:approved-entry-kit`,
    primary: row.disciplineId,
    secondary: null,
    ids: row.approachableLoadout,
  })),
  ...rows
    .filter((row) => row.kind === 'resonance')
    .flatMap((row) =>
      row.after.disciplinePair.map((primary, index) => ({
        name: `${row.id}:primary:${primary}`,
        primary,
        secondary: row.after.disciplinePair[1 - index]!,
        ids: row.playIdentity!.earnedFourSkillKit.map((skill) => skill.id),
      })),
    ),
]

export async function createLegalRosterDuel(input: {
  kit: Kit
  opponentKit?: Kit
  additionalKits?: readonly Kit[]
  level: 1 | 100
  context: 'pve' | 'pvp'
  seed: number
  board?: {
    width: number
    height: number
    positions: readonly GridPosition[]
    facings?: readonly BattleFacing[]
  }
}) {
  await publishProposedRoster()
  const kits = [input.kit, input.opponentKit ?? input.kit, ...(input.additionalKits ?? [])]
  const participants = await Promise.all(
    kits.map(async (kit, index) => {
      const identity = {
        owner: `11111111-1111-4111-8111-11111111111${index + 1}`,
        characterId: `22222222-2222-4222-8222-22222222222${index + 1}`,
      }
      const { character, repository, learned } = fixture(kit, input.level, identity)
      const earnedBefore = structuredClone(learned)
      await saveCharacterDisciplineSkills(
        identity.owner,
        character,
        {
          expectedBuildVersion: 1,
          skillIds: kit.ids,
          idempotencyKey: '33333333-3333-4333-8333-333333333333',
        },
        repository,
      )
      const committed = await loadCharacterCommittedBuildSnapshot(
        identity.owner,
        identity.characterId,
        repository,
      )
      expect(learned).toEqual(earnedBefore)
      expect(committed.disciplineSkills).toHaveLength(4)
      return {
        kit,
        character,
        actorId: `character:${character.id}`,
        committed,
        derived: calculateDerivedStats({ attributes: character.attributes, level: input.level }),
      }
    }),
  )
  const battle = startBattle(
    createPendingBattle({
      battleId: 'legal-roster-duel-cycle',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: input.seed,
      combatants: participants.map(({ actorId, derived }) => ({
        id: actorId,
        teamId: actorId,
        initiative: derived.stats.initiative.value,
        baseMovementBudget: derived.stats.movement.value,
        hp: derived.stats.maxHp.value,
        maxHp: derived.stats.maxHp.value,
        mp: derived.stats.maxMp.value,
        maxMp: derived.stats.maxMp.value,
        temporaryResources: createPv1fTemporaryResources(
          calculatePv1fBasicAttackDamage({ physicalPower: derived.stats.physicalPower.value }),
        ),
      })),
    }),
  ).state
  const width = input.board?.width ?? 5
  const height = input.board?.height ?? 3
  const raw = createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width,
      height,
      terrains: [{ id: 'ground', traversalCost: 1 }],
      tiles: Array.from({ length: width * height }, (_, n) => ({
        position: { x: n % width, y: Math.floor(n / width) },
        terrainId: 'ground',
        elevation: 0,
      })),
      movementProfiles: participants.map(({ actorId, derived }) => ({
        id: actorId,
        maxElevationStep: derived.stats.jump.value,
        terrainCostOverrides: [],
      })),
      placements: participants.map(({ actorId }, index) => ({
        combatantId: actorId,
        position: input.board?.positions[index] ?? { x: index + 1, y: 1 },
        facing: input.board?.facings?.[index] ?? (index === 0 ? 'east' : 'west'),
        movementProfileId: actorId,
      })),
    }),
  )
  const current = createDuelBalancedCombatEncounterState(
    {
      ...raw,
      effectTimingPolicy: defaultCombatEffectTimingPolicy(),
      effectStackingPolicyVersion: 1,
      percentageDotPolicyVersion: 1,
      dotTriggerPolicyVersion: 2,
      skillPacketPolicyVersion: 1,
      displacementPolicyVersion: 1,
      frozenGroundPolicyVersion: 1,
      airbornePolicyVersion: 1,
      airborneJumpPolicyVersion: 1,
      elementalDamagePolicyVersion: 2,
      dynamicInitiativePolicyVersion: 1,
      healingDownPolicyVersion: 1,
      blindsideActivationPolicyVersion: 1,
      groundEffectPolicyVersion: 1,
    },
    participants.map(({ actorId, character, derived }) =>
      createCharacterDerivedCombatProfile(actorId, character.id, input.level, derived),
    ),
  )
  const authority = await createResolvedBattleBuildAuthoritySnapshot(
    input.context,
    participants.map(({ actorId, character, committed }) => ({
      combatantId: actorId,
      characterId: character.id,
      snapshot: committed,
    })),
    resolver,
  )
  const restored = parseBattleBuildAuthoritySnapshot(JSON.parse(JSON.stringify(authority)))!
  expect(restored).toEqual(authority)
  const sources = await captureBattleBuildAbilitySources(current, restored, resolver)
  const admitted = await Promise.all(
    participants.map(async (participant) => {
      const definitions = await resolveBattleDisciplineSkillDefinitions(
        restored,
        participant.actorId,
        resolver,
      )
      if (!definitions || definitions.some((definition) => !definition.ability))
        throw new Error('Missing actual canonical four-Skill kit')
      return {
        ...participant,
        definitions,
        sources: sources.filter((source) => source.ownerCombatantId === participant.actorId),
      }
    }),
  )
  const built = attachCombatBuildBridge(
    current,
    participants.map(({ actorId, character, committed }) => {
      const captured = restored.combatants.find((row) => row.combatantId === actorId)!
      return {
        combatantId: actorId,
        characterId: character.id,
        snapshot: toCombatBuildSnapshot({
          ...committed,
          disciplineSkills: captured.disciplineSkills,
          extensions: { ...committed.extensions, ...captured.extensions },
        }),
      }
    }),
  )
  // Match real PvE/PvP creation: activation dispatches the startup frame once;
  // later JSON restores only preserve/reconcile captured authority.
  const initialized = activateCombatAbilitySources(built, sources, PV1F_COMBAT_CONTENT, true)
  const state = preparePv1fTurnEconomy(
    reattachStatDrivenCombatBridge(initialized.state, current.statBridge),
  )
  expect(validateStatDrivenCombatEncounterState(state)).toEqual([])
  return {
    state,
    authority: restored,
    participants: admitted,
    seed: input.seed,
    startupEvents: initialized.events,
  }
}

export type LegalRosterDuel = Awaited<ReturnType<typeof createLegalRosterDuel>>

export function playLegalRosterDuel(duel: LegalRosterDuel, options: { maximumRounds: number }) {
  let state: StatDrivenCombatEncounterState = JSON.parse(JSON.stringify(duel.state))
  const commands: {
    actorId: string
    abilityId: string
    kind: string
    round: number
    behaviorId?: string
    manualModifiers: { sourceInstanceId: string; behaviorId: string }[]
    reason: string
    utility: number
    candidateCount: number
  }[] = []
  const events: unknown[] = [...duel.startupEvents]
  const errors: unknown[] = []
  // This is a diagnostic horizon, not a forced victory or artificial round budget.
  const maximumCommands = options.maximumRounds * 40
  while (
    state.tactical.battle.lifecycle === 'active' &&
    state.tactical.battle.round <= options.maximumRounds
  ) {
    if (commands.length >= maximumCommands)
      throw new Error('Legal duel exceeded the finite command horizon')
    const actorId = state.tactical.battle.currentTurn!.combatantId
    const participant = duel.participants.find((row) => row.actorId === actorId)
    const skillOptions = {
      committedSkills: participant?.definitions ?? [],
      canonicalSources: state.capturedAbilitySources ?? [],
    }
    const decision = chooseBuildAwareRecruitAiDecision({
      state,
      tieBreakSeed: duel.seed + commands.length,
      skillOptions,
    })
    const { intent } = decision
    const before = JSON.stringify(state)
    const round = state.tactical.battle.round
    const facing = state.tactical.placements.find((row) => row.combatantId === actorId)!.facing
    const transition =
      intent.kind === 'action'
        ? executeBuildAwareRecruitAiAction(
            state,
            intent.actionId,
            intent.target,
            skillOptions,
            intent,
          )
        : intent.kind === 'ability-prime' || intent.kind === 'ability-cancel-prime'
          ? executeBuildAwareRecruitAiAction(
              state,
              intent.actionId,
              { kind: 'self' },
              skillOptions,
              {
                ...intent,
                controlledOperation: intent.kind === 'ability-prime' ? 'prime' : 'cancel',
              },
            )
          : intent.kind === 'move'
            ? executePv1fMovement(state, intent.path)
            : finishPv1fTurn(state, intent.kind === 'face' ? intent.facing : facing)
    expect(JSON.stringify(state)).toBe(before)
    commands.push({
      actorId,
      round,
      kind: intent.kind,
      abilityId: 'actionId' in intent ? intent.actionId : intent.kind,
      ...('behaviorId' in intent ? { behaviorId: intent.behaviorId } : {}),
      manualModifiers: 'manualModifiers' in intent ? [...(intent.manualModifiers ?? [])] : [],
      reason: decision.reason,
      utility: decision.utility,
      candidateCount: decision.candidateCount,
    })
    events.push(...transition.events)
    state = JSON.parse(JSON.stringify(transition.state))
    errors.push(...validateStatDrivenCombatEncounterState(state))
    for (const unit of state.tactical.battle.combatants) {
      expect(unit.hp).toBeGreaterThanOrEqual(0)
      expect(unit.hp).toBeLessThanOrEqual(unit.maxHp)
      expect(unit.mp).toBeGreaterThanOrEqual(0)
      expect(unit.mp).toBeLessThanOrEqual(unit.maxMp)
    }
  }
  return { state, commands, events, errors }
}
