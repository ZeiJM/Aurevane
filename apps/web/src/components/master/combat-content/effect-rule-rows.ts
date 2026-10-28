import {
  AUTHORABLE_EFFECT_TAGS,
  createAuthorableEffectPayload,
} from '@aurevane/game-core/combat/combat-effect-authoring'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import { currentCombatEffectTimingTag } from '@aurevane/game-core/combat/combat-effect-timing'

const primary: Record<string, string> = {
  damage: 'damage',
  healing: 'hp-recovery',
  'mp-recovery': 'mp-recovery',
  'mp-drain': 'mp-drain',
  'barrier-change': 'barrier',
  'copy-statuses': 'copy-buffs',
  'remove-status': 'cleanse',
  sensory: 'reveal',
  'return-to-turn-start': 'rewind',
  'create-terrain': 'freeze-ground',
}

export const EFFECT_RULE_ROWS = [
  ...AUTHORABLE_EFFECT_TAGS.map((tag) => {
    const id = tag.id.replace(/^status:/u, '')
    const payload = createAuthorableEffectPayload(tag.id)
    const timingTag =
      tag.opcode === 'summon'
        ? 'summon'
        : id === 'revealed'
          ? 'sensory'
          : payload && !['move', 'damage-bonus', 'summon'].includes(payload.type)
            ? currentCombatEffectTimingTag(nativeCombatTagPayload(payload))
            : null
    const suffix = timingTag && (primary[timingTag] ?? timingTag) !== id ? `-${id}` : ''
    return {
      id,
      label: tag.label,
      timingTag,
      controlId: `timing-${timingTag ?? id}${suffix}`,
      editableTiming: timingTag !== null && id !== 'revealed',
    }
  }),
  {
    id: 'ground-area',
    label: 'Ground area',
    timingTag: 'ground-area',
    controlId: 'timing-ground-area',
    editableTiming: true,
  },
]
