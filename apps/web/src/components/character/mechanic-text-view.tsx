'use client'

import { BattleInfoPopover } from '../battle/battle-info-popover'
import { isMechanicTag, plainMechanicText, type MechanicTextPart } from './mechanic-text'
import styles from './compact-skill-effect-summary.module.css'

/** Missing or stale optional metadata falls back to the exact escaped captured text. */
export function MechanicTextView({
  text,
  parts,
}: {
  text: string
  parts?: readonly MechanicTextPart[]
}) {
  if (!parts || plainMechanicText(parts) !== text) return text
  return parts.map((part, index) =>
    typeof part === 'string' ? (
      part
    ) : isMechanicTag(part.tag) && part.explanation ? (
      <BattleInfoPopover
        key={index}
        nested
        referenceTrigger
        hover
        consumeOutsideClick
        panelWidth={300}
        label={`Explain ${part.label}`}
        title={part.label}
        className={styles.reference}
        trigger={<span data-combat-tag-reference={part.tag}>{part.label}</span>}
      >
        <p>{part.explanation}</p>
      </BattleInfoPopover>
    ) : (
      part.label
    ),
  )
}
