import 'server-only'

import { copiedSkillCommandId } from '@aurevane/game-core/combat/combat-skill-copy'
import { normalizeCombatEffectState } from '@aurevane/game-core/combat/combat-effect-state'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { Pv1fMatureSkillCopyContext } from '@aurevane/game-core/combat/pv1f-action-economy'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'

import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'

import {
  battleBuildAuthorityForCombatant,
  resolveBattleDisciplineSkillDefinitions,
  resolveBattleTemporarySkillDefinition,
  type BattleBuildAuthoritySnapshot,
} from './battle-build-authority'

export type BattleSkillCopyAuthorityState = StatDrivenCombatEncounterState & {
  buildAuthority?: BattleBuildAuthoritySnapshot
}

export interface ResolvedBattleCopiedSkillCommand {
  grant: ReturnType<typeof normalizeCombatEffectState>['temporarySkills'][number]
  definition: MatureSkillDefinition | null
}

export function battleTemporarySkillGrantForCommand(
  state: Pick<BattleSkillCopyAuthorityState, 'effectState'>,
  actorCombatantId: string,
  actionId: string,
) {
  const matches = normalizeCombatEffectState(state.effectState).temporarySkills.filter(
    (grant) =>
      grant.combatantId === actorCombatantId &&
      copiedSkillCommandId(grant.skillId, grant.contentVersion) === actionId,
  )
  return matches.length === 1 ? matches[0]! : null
}

export async function resolveBattleCopiedSkillCommand(
  state: BattleSkillCopyAuthorityState,
  actorCombatantId: string,
  actionId: string,
  resolver?: CombatContentResolver,
): Promise<ResolvedBattleCopiedSkillCommand | null> {
  const grant = battleTemporarySkillGrantForCommand(state, actorCombatantId, actionId)
  if (!grant) return null
  return {
    grant,
    definition: await resolveBattleTemporarySkillDefinition(state.buildAuthority, grant, resolver),
  }
}

export async function resolveBattleSkillCopyContext(
  state: BattleSkillCopyAuthorityState,
  actorCombatantId: string,
  sourceCombatantId: string,
  resolver?: CombatContentResolver,
): Promise<Pv1fMatureSkillCopyContext | null> {
  const sourceBuild = battleBuildAuthorityForCombatant(state.buildAuthority, sourceCombatantId)
  const actorBuild = battleBuildAuthorityForCombatant(state.buildAuthority, actorCombatantId)

  const sourceSkills = sourceBuild
    ? await resolveBattleDisciplineSkillDefinitions(
        state.buildAuthority,
        sourceCombatantId,
        resolver,
      )
    : []
  const actorCommittedSkills = actorBuild
    ? await resolveBattleDisciplineSkillDefinitions(
        state.buildAuthority,
        actorCombatantId,
        resolver,
      )
    : []

  if (sourceSkills === null || actorCommittedSkills === null) return null
  return {
    sourceCombatantId,
    sourceSkills,
    actorCommittedSkills,
  }
}
