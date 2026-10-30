import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import { previewEffectWithTag } from '../../character/skill-effect-preview'
import { MasterHelp } from '../master-help'
import styles from './combat-content-editor.module.css'

/** Reuse the game's effect wording for quick reference while authoring. */
export function EffectTagHelp({ effect }: { effect: MatureSkillEffectDefinition }) {
  const preview = previewEffectWithTag(effect)
  const piercing =
    effect.type === 'damage' && (effect.piercing === true || effect.shattersBarrier === true)
  const label = piercing
    ? 'Pierce'
    : preview.label === 'Cleanse Chilled'
      ? 'Conditional Cleanse'
      : preview.label
  const explanation = piercing
    ? effect.piercing === true
      ? 'Deals piercing damage that bypasses Armor and Guard.'
      : 'Deals piercing damage, breaks Barriers and ignores the configured share of equipment Armor. Physical and Mystic Defense still apply.'
    : preview.explanation
  return (
    <div className={styles.effectReference}>
      <strong>{label}</strong>
      <MasterHelp label={label}>
        <p>{explanation}</p>
      </MasterHelp>
    </div>
  )
}
