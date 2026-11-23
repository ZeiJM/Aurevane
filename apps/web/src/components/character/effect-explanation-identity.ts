import { combatEffectPresentationId } from '@aurevane/game-core/combat/combat-effect-identities'

/** Ground fields teach a different delivery rule from the matching unit status. */
export function effectExplanationIdentity(
  effect: Parameters<typeof combatEffectPresentationId>[0],
): string {
  return `${combatEffectPresentationId(effect)}${'target' in effect && effect.target === 'ground' ? ':ground' : ''}`
}
