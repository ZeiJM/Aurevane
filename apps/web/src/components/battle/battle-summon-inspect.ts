import type { SummonAbilityDefinition } from '@aurevane/game-core/combat/summon-content'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

type BattleSnapshot = BattleSessionView['snapshot']

export interface BattleSummonInspectMetadata {
  readonly policies: Pick<
    BattleSnapshot,
    | 'effectTimingPolicy'
    | 'dotTriggerPolicyVersion'
    | 'frozenGroundPolicyVersion'
    | 'airbornePolicyVersion'
    | 'healingDownPolicyVersion'
  >
  readonly profileId: string
  readonly name: string
  readonly description: string
  readonly flavorLine: string
  readonly portraitKey: string
  readonly tags: readonly string[]
  readonly ownerCombatantId: string
  readonly sourceSkillId: string
  readonly sourceSkillVersion: number
  readonly turnsCompleted: number
  readonly lifetimeTurns: number
  readonly remainingTurns: number
  readonly abilities: readonly SummonAbilityDefinition[]
}

export function readSummonInspectMetadata(
  snapshot: BattleSnapshot,
  combatantId: string,
): BattleSummonInspectMetadata | null {
  const summon = snapshot.effectState?.summons?.find(
    (candidate) => candidate.combatantId === combatantId,
  )
  if (!summon) return null

  return {
    policies: {
      effectTimingPolicy: snapshot.effectTimingPolicy
        ? structuredClone(snapshot.effectTimingPolicy)
        : undefined,
      dotTriggerPolicyVersion: snapshot.dotTriggerPolicyVersion,
      frozenGroundPolicyVersion: snapshot.frozenGroundPolicyVersion,
      airbornePolicyVersion: snapshot.airbornePolicyVersion,
      healingDownPolicyVersion: snapshot.healingDownPolicyVersion,
    },
    profileId: summon.profile.id,
    name: summon.profile.name,
    description: summon.profile.description,
    flavorLine: summon.profile.flavorLine,
    portraitKey: summon.profile.portraitKey,
    tags: [...summon.profile.tags],
    ownerCombatantId: summon.ownerCombatantId,
    sourceSkillId: summon.sourceSkillId,
    sourceSkillVersion: summon.sourceSkillVersion,
    turnsCompleted: summon.turnsCompleted,
    lifetimeTurns: summon.profile.lifetimeTurns,
    remainingTurns: Math.max(0, summon.profile.lifetimeTurns - summon.turnsCompleted),
    abilities: summon.profile.abilities.map((ability) => structuredClone(ability)),
  }
}
