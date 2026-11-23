import type { AppearancePose } from '@/appearance/appearance-manifest'
import type { BattleLogEntry } from '@/server/battle/battle-log-service'

export interface BattleAppearanceCue {
  key: string
  pose: AppearancePose
}

type PoseReceipt = Pick<
  BattleLogEntry,
  | 'eventType'
  | 'battleVersion'
  | 'eventIndex'
  | 'actorCombatantId'
  | 'targetCombatantId'
  | 'actionId'
  | 'templateValues'
>

/** Uses only the same viewer-safe receipts as Chronicle. No client intent can animate a cast. */
export function battleAppearanceCues(
  entries: readonly PoseReceipt[],
  version: number,
): ReadonlyMap<string, BattleAppearanceCue> {
  const cues = new Map<string, BattleAppearanceCue>()
  const add = (id: string | null, entry: PoseReceipt, pose: AppearancePose) => {
    if (!id) return
    const existing = cues.get(id)
    if (existing && (pose === 'walk' || (existing.pose === 'attack' && pose === 'cast'))) return
    cues.set(id, { key: `${entry.battleVersion}:${entry.eventIndex}`, pose })
  }
  for (const entry of entries) {
    if (entry.battleVersion !== version) continue
    switch (entry.eventType) {
      case 'combatant_moved':
        add(entry.actorCombatantId, entry, 'walk')
        break
      case 'combat_action_used':
        add(
          entry.actorCombatantId,
          entry,
          entry.actionId?.startsWith('basic.attack.') ? 'attack' : 'cast',
        )
        break
      case 'stat_driven_attack_resolved':
        add(entry.actorCombatantId, entry, 'attack')
        break
      case 'damage_applied':
        if (Number(entry.templateValues.amount) > 0) add(entry.targetCombatantId, entry, 'hit')
        break
    }
  }
  return cues
}
