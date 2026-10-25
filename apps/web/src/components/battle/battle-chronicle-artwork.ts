import type { ChronicleAction } from './battle-log-chronicle-model'
import {
  battleResonanceArtwork,
  battleSkillArtwork,
  BATTLE_COMMAND_ARTWORK,
  BATTLE_MISSING_ARTWORK,
} from './battle-skill-presentation'

/** Resolve the recorded identity; never label an unknown event with Inspect artwork. */
export function chronicleActionArtwork(action: ChronicleAction): string {
  const id = action.contentId ?? action.sourceActionId
  if (id === 'battle.lowered-guard.apply' || id === 'lowered-guard')
    return '/media/skills/defenseless-dark-fantasy-v1.webp'
  if (action.family === 'movement') return BATTLE_COMMAND_ARTWORK.move
  if (id) {
    const source =
      action.family === 'resonance' ? battleResonanceArtwork(id) : battleSkillArtwork(id)
    if (source !== BATTLE_MISSING_ARTWORK) return source
  }
  if (action.outcomes.some((outcome) => outcome.statusId === 'lowered-guard'))
    return '/media/skills/defenseless-dark-fantasy-v1.webp'
  return '/media/skills/chronicle-event-dark-fantasy-v1.webp'
}
