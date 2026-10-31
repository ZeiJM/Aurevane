import { effectTagDescription } from '@/lib/combat-effect-descriptions'
import { AUTHORABLE_EFFECT_TAGS } from '@aurevane/game-core/combat/combat-effect-authoring'
import { REGISTERED_EFFECT_TAGS } from '@aurevane/game-core/combat/combat-effect-identities'
import { createAuthorableEffectPayload } from '@aurevane/game-core/combat/combat-effect-authoring'
import {
  combatTagDefinition,
  nativeCombatTagPayload,
} from '@aurevane/game-core/combat/combat-tag-registry'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import { skillEffectDescription } from '@/components/character/skill-detail-presentation'

/** Generic current help, with retained examples for historical tags; opening never saves it. */
export function tagWordingDefaults(tagId: string): { full: string; short: string } {
  const tag = REGISTERED_EFFECT_TAGS.find((entry) => entry.id.replace(/^status:/u, '') === tagId)
  if (!tag) return { full: '', short: '' }
  const generic = AUTHORABLE_EFFECT_TAGS.some((current) => current.id === tag.id)
    ? effectTagDescription(tag.id)
    : undefined
  if (generic) return { full: generic, short: generic }
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
