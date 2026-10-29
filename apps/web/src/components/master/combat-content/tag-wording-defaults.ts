import { REGISTERED_EFFECT_TAGS } from '@aurevane/game-core/combat/combat-effect-identities'
import { createAuthorableEffectPayload } from '@aurevane/game-core/combat/combat-effect-authoring'
import {
  combatTagDefinition,
  nativeCombatTagPayload,
} from '@aurevane/game-core/combat/combat-tag-registry'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import { skillEffectDescription } from '@/components/character/skill-detail-presentation'

/** A readable example, never written back merely by opening the editor. */
export function tagWordingDefaults(tagId: string): { full: string; short: string } {
  const tag = REGISTERED_EFFECT_TAGS.find((entry) => entry.id.replace(/^status:/u, '') === tagId)
  if (!tag) return { full: '', short: '' }
  const payload = createAuthorableEffectPayload(tag.id)
  const operation = combatTagDefinition(tag.opcode)
  const short = tag.statusId
    ? combatStatusDetails(tag.statusId).description
    : (operation?.conciseExplanation ?? tag.label)
  const full =
    payload && !['move', 'damage-bonus', 'summon'].includes(payload.type)
      ? payload.type === 'pierce'
        ? operation!.fullExplanation
        : skillEffectDescription(nativeCombatTagPayload(payload))
      : (operation?.fullExplanation ?? short)
  return { full, short: payload ? full : short }
}
