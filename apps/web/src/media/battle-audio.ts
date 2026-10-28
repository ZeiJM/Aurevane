import { isFinalizedContentMedia } from '@aurevane/game-core/combat/content-media'
import { sharedSkillFxGroups } from '@aurevane/audio'
import type { BattleEventRecord } from '@aurevane/db/battle-session'

import { resolveSkillAudioCueHook } from './skill-media-hooks'

export interface BattleAudioCue {
  assetId: string
  priority: number
}

/** At most two cues from one recent committed command; never infer outcomes from previews. */
export function selectBattleAudioCues(
  records: readonly BattleEventRecord[],
  version: number,
  now: number,
): BattleAudioCue[] {
  const selected = new Map<string, BattleAudioCue>()
  for (const record of records.slice(0, 100)) {
    const age = now - Date.parse(record.createdAt)
    if (record.battleVersion !== version || !Number.isFinite(age) || age < 0 || age > 5000) continue
    if (!record.event || typeof record.event !== 'object' || Array.isArray(record.event)) continue
    const event = record.event as Record<string, unknown>
    if (
      (event.event === 'combat_action_used' || event.event === 'resonance_activated') &&
      isFinalizedContentMedia(event.audioMedia) &&
      event.audioMedia.kind === 'audio'
    ) {
      const assetId = `content-media.${event.audioMedia.id}`
      selected.set(assetId, {
        assetId,
        priority:
          event.event === 'resonance_activated'
            ? 80
            : String(event.actionId).startsWith('essence.')
              ? 90
              : 70,
      })
      continue
    }
    const storedAction = typeof event.actionId === 'string' ? event.actionId : ''
    const action = storedAction
    let group: string | null = null
    let priority = 20
    if (event.event === 'combat_action_used') {
      if (Object.hasOwn(event, 'audioCueKey') && event.audioCueKey === null) continue
      const authoredAudio =
        typeof event.audioCueKey === 'string'
          ? resolveSkillAudioCueHook(event.audioCueKey)
          : resolveSkillAudioCueHook(
              action.startsWith('essence.') ? `${action}.audio` : `skill.${action}.audio`,
            )
      if (authoredAudio?.audioGroup && authoredAudio.available) {
        selected.set(authoredAudio.audioGroup, {
          assetId: `${authoredAudio.audioGroup}-${(version % 3) + 1}`,
          priority: action.startsWith('essence.') ? 90 : 70,
        })
        continue
      }
    } else if (event.event === 'resonance_activated') {
      group = sharedSkillFxGroups.resonance
      priority = 80
    } else if (event.event === 'status_removed') {
      group = sharedSkillFxGroups.cleanse
      priority = 50
    } else if (
      event.event === 'healing_applied' &&
      typeof event.amount === 'number' &&
      event.amount > 0
    ) {
      group = sharedSkillFxGroups.healing
      priority = 40
    } else if (
      event.event === 'damage_applied' &&
      /^status\.(burn|bleed|poison)$/.test(action) &&
      typeof event.amount === 'number' &&
      event.amount > 0
    ) {
      group = sharedSkillFxGroups.attrition
    }
    if (!group) continue
    selected.set(group, { assetId: `${group}-${(version % 3) + 1}`, priority })
  }
  return [...selected.values()].sort((a, b) => b.priority - a.priority).slice(0, 2)
}

/** Constant-space cursor: remount/history/replay/gaps never produce catch-up sound. */
export class BattleAudioCursor {
  constructor(private version: number) {}
  get currentVersion(): number {
    return this.version
  }
  advance(version: number, replayed = false): boolean {
    if (!Number.isSafeInteger(version) || version <= this.version) return false
    const adjacent = version === this.version + 1
    this.version = version
    return adjacent && !replayed
  }
}
