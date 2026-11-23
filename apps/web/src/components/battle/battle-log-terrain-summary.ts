import type { BattleLogEntry } from '@/server/battle/battle-log-service'
import {
  combatTerrainSummaries,
  combatTerrainProjectionDescription,
} from '../../lib/battle/combat-interaction-presentation'

function castKey(entry: BattleLogEntry): string {
  return JSON.stringify([
    entry.battleVersion,
    entry.round,
    entry.turnNumber,
    entry.actorCombatantId,
    entry.actionId,
    entry.effectActivationRound,
    entry.actionContext?.contentId ?? entry.actionContext?.skillId,
    entry.actionContext?.contentVersion,
    entry.effectOrigin?.family,
    entry.effectOrigin?.contentId,
    entry.effectOrigin?.contentVersion,
  ])
}

/** Display-only grouping; never infer a cast across a history gap or hidden identity. */
export function summarizeBattleLogTerrain(
  entries: readonly BattleLogEntry[],
): readonly BattleLogEntry[] {
  const result: BattleLogEntry[] = []
  for (let index = 0; index < entries.length; index++) {
    const first = entries[index]!
    if (first.eventType !== 'terrain_overlay_changed' || !first.terrainChange) {
      result.push(first)
      continue
    }
    const batch = [first]
    if (first.actorCombatantId && first.actionId) {
      while (index + 1 < entries.length) {
        const previous = entries[index]!
        const next = entries[index + 1]!
        if (
          previous.historyGapAfter ||
          next.eventType !== 'terrain_overlay_changed' ||
          !next.terrainChange ||
          next.eventIndex !== previous.eventIndex + 1 ||
          castKey(next) !== castKey(first)
        )
          break
        batch.push(next)
        index++
      }
    }
    const descriptions = combatTerrainSummaries(batch.map((entry) => entry.terrainChange!))
    if (
      !descriptions.length ||
      batch.some((entry) => !combatTerrainProjectionDescription(entry.terrainChange!))
    )
      result.push(...batch)
    else {
      const description = descriptions.join('; ')
      result.push({
        ...first,
        message: description,
        messageTemplate: description,
        facts: [{ label: description, tone: 'neutral' }],
      })
    }
  }
  return result
}
