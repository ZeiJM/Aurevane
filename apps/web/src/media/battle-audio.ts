import { PHASE4_AUDIO_DISCIPLINES } from '@aurevane/audio'
import type { BattleEventRecord } from '@aurevane/db/battle-session'

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
    const action = typeof event.actionId === 'string' ? event.actionId : ''
    let family = ''
    let role = 'action'
    let priority = 20
    if (event.event === 'combat_action_used') {
      const essence = action.startsWith('essence.')
      const discipline = action.split('.')[essence ? 1 : 0]
      if (PHASE4_AUDIO_DISCIPLINES.some((id) => id === discipline)) {
        family = discipline!
        role = essence ? 'essence' : 'action'
        priority = essence ? 90 : 70
      }
    } else if (event.event === 'resonance_activated') {
      family = 'resonance'
      priority = 80
    } else if (event.event === 'status_removed') {
      family = 'cleanse'
      priority = 50
    } else if (
      event.event === 'healing_applied' &&
      typeof event.amount === 'number' &&
      event.amount > 0
    ) {
      family = 'healing'
      priority = 40
    } else if (
      event.event === 'damage_applied' &&
      /^status\.(burn|bleed|poison)$/.test(action) &&
      typeof event.amount === 'number' &&
      event.amount > 0
    ) {
      family = 'attrition'
    }
    if (!family) continue
    const key = `${family}-${role}`
    selected.set(key, {
      assetId: `audio.phase4.${key}-v01-${(version % 3) + 1}`,
      priority,
    })
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
