import {
  pv1fCooldownForAction,
  pv1fCooldownForMatureSkill,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { readSkillCooldown } from '@aurevane/game-core/combat/skill-cooldowns'
import type { BattleSessionView } from '@/server/battle/battle-session-service'
import type { BattleRuntime } from './battle-runtime'

/** Reads the pinned action definition and the server snapshot; never advances cooldowns locally. */
export function battleActionCooldownTurns(
  battle: BattleSessionView,
  runtime: BattleRuntime,
  actorId: string | null,
  actionId: string,
): number {
  const actor = battle.snapshot.tactical.battle.combatants.find((row) => row.id === actorId)
  if (!actor) return 0
  const skill = [
    ...(runtime.techniques ?? []),
    ...(runtime.copiedSkills ?? []),
    ...(runtime.essence ? [runtime.essence] : []),
  ].find((row) => row.id === actionId)
  const definition =
    pv1fCooldownForAction(actionId) ??
    (skill?.definition
      ? pv1fCooldownForMatureSkill(
          skill.definition,
          battle.snapshot.buildAuthority?.combatContext ?? runtime.kind,
        )
      : null)
  if (!definition) return 0
  const state = readSkillCooldown(actor, definition)
  return state.active ? Math.min(definition.ownerTurns, state.ticksRemaining) : 0
}

export function battleCooldownLabel(turns: number): string {
  return turns > 0 ? `, Cooldown: ${turns} ${turns === 1 ? 'turn' : 'turns'} remaining` : ''
}
