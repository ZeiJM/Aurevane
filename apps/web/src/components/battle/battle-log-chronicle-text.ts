import { renderBattleFlavorTemplate } from '@aurevane/game-core/combat/battle-narration'

import type { ChronicleAction } from './battle-log-chronicle-model'

/** The Chronicle reader and full-log export share the same player-facing words. */
export function chronicleActionTitle(action: ChronicleAction): string | null {
  if (!action.title) return null
  const prefix =
    action.family === 'skill' ||
    action.family === 'movement' ||
    action.title.toLowerCase() === action.family
      ? ''
      : `${action.family === 'resonance' ? 'Resonance' : action.family.toUpperCase()} · `
  return `${prefix}${action.title}`
}

export function chronicleActionNarration(action: ChronicleAction, actorName: string): string {
  return (
    renderBattleFlavorTemplate(action.flavorTemplate, {
      actor: { name: actorName, ...action.narrator?.actor },
      target: { name: action.targetName, ...action.narrator?.target },
      ability: action.title,
      values: action.configuredValues,
      triggeringActor: action.triggeringActorName
        ? { name: action.triggeringActorName }
        : undefined,
    }) ?? action.fallbackNarration
  )
}
