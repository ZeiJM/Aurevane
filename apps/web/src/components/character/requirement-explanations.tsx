import { isMechanicTag, plainMechanicText, type MechanicTextPart } from './mechanic-text'
import styles from './compact-skill-effect-summary.module.css'

/** Reuse the exact policy-aware tag help already captured with the requirement. */
export function RequirementExplanations({
  text,
  parts,
  className,
}: {
  text: string
  parts?: readonly MechanicTextPart[]
  className?: string
}) {
  if (!parts || plainMechanicText(parts) !== text) return null
  const tags = new Map<string, Exclude<MechanicTextPart, string>>()
  for (const part of parts) {
    if (typeof part !== 'string' && isMechanicTag(part.tag) && part.explanation) {
      tags.set(`${part.tag}\0${part.label}\0${part.explanation}`, part)
    }
  }
  return tags.size ? (
    <ul className={className} aria-label="Requirement explanations">
      {[...tags].map(([key, part]) => (
        <li key={key}>
          <strong className={styles.label}>{part.label}</strong> — {part.explanation}
        </li>
      ))}
    </ul>
  ) : null
}
