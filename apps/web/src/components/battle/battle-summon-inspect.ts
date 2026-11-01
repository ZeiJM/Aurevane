import { contentMediaSource } from '@aurevane/game-core/combat/content-media'
import {
  summonPotencyDescription,
  type SummonAbilityDefinition,
} from '@aurevane/game-core/combat/summon-content'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

type BattleSnapshot = BattleSessionView['snapshot']

export interface BattleSummonInspectMetadata {
  readonly policies: Pick<
    BattleSnapshot,
    | 'effectTimingPolicy'
    | 'dotTriggerPolicyVersion'
    | 'frozenGroundPolicyVersion'
    | 'airbornePolicyVersion'
    | 'airborneJumpPolicyVersion'
    | 'elementalDamagePolicyVersion'
    | 'healingDownPolicyVersion'
    | 'blindsideActivationPolicyVersion'
    | 'reversalPolicyVersion'
    | 'pierceCriticalPolicyVersion'
    | 'summonPotencyPolicyVersion'
    | 'ruinPolicyVersion'
  >
  readonly profileId: string
  readonly name: string
  readonly description: string
  readonly potencyBasisPoints?: number
  readonly potencyDescription?: string
  readonly flavorLine: string
  readonly portraitKey: string
  readonly portraitUrl?: string
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
      summonPotencyPolicyVersion: snapshot.summonPotencyPolicyVersion,
      frozenGroundPolicyVersion: snapshot.frozenGroundPolicyVersion,
      airbornePolicyVersion: snapshot.airbornePolicyVersion,
      airborneJumpPolicyVersion: snapshot.airborneJumpPolicyVersion,
      elementalDamagePolicyVersion: snapshot.elementalDamagePolicyVersion,
      healingDownPolicyVersion: snapshot.healingDownPolicyVersion,
      blindsideActivationPolicyVersion: snapshot.blindsideActivationPolicyVersion,
      ...(snapshot.reversalPolicyVersion === 1 ? { reversalPolicyVersion: 1 as const } : {}),
      ...(snapshot.pierceCriticalPolicyVersion === 1
        ? { pierceCriticalPolicyVersion: 1 as const }
        : {}),
      ...(snapshot.ruinPolicyVersion === 1 ? { ruinPolicyVersion: 1 as const } : {}),
    },
    profileId: summon.profile.id,
    name: summon.profile.name,
    description: summon.profile.description,
    ...(summon.profile.potencyBasisPoints === undefined
      ? {}
      : {
          potencyBasisPoints: summon.profile.potencyBasisPoints,
          potencyDescription: summonPotencyDescription(summon.profile, {
            legacy: snapshot.summonPotencyPolicyVersion !== 1,
          })!,
        }),
    flavorLine: summon.profile.flavorLine,
    portraitKey: summon.profile.portraitKey,
    ...(summon.profile.media?.artwork
      ? { portraitUrl: contentMediaSource(summon.profile.media.artwork) }
      : {}),
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
