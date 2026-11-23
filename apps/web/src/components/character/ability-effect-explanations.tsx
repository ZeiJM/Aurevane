import type { BattleAbilityBehaviorReport } from '@/lib/battle/battle-basic-actions'
import type { AbilityEffectPresentation } from './ability-detail-presentation'
import { EffectTagLabel, EffectExplanationNotes } from './compact-skill-effect-summary'
import { MechanicTextView } from './mechanic-text-view'
import type { MechanicTextPart } from './mechanic-text'

/** Group Tag teaching copy only; ordered Effects rows and immutable mechanics stay untouched. */
export function AbilityEffectExplanations({
  reports,
  className,
}: {
  reports: readonly BattleAbilityBehaviorReport[]
  className?: string
}) {
  const groups = new Map<
    string,
    {
      effect?: AbilityEffectPresentation
      entries: Map<string, { text: string; parts?: readonly MechanicTextPart[] }>
      notes: Map<string, AbilityEffectPresentation>
    }
  >()
  let ordinal = 0
  for (const report of reports)
    for (const [index, description] of report.effectDescriptions.entries()) {
      const effect = report.effects[index]
      const identity =
        effect?.explanationTagId ?? effect?.tagPresentation?.tagId ?? `unknown-${ordinal}`
      ordinal += 1
      const group = groups.get(identity) ?? { effect, entries: new Map(), notes: new Map() }
      const baseMatches =
        effect?.explanationBaseDescription !== undefined &&
        description ===
          `${effect.explanationBaseDescription}${effect.condition ? ` Applies only when ${effect.condition}.` : ''}`
      const text = baseMatches ? effect.explanationBaseDescription! : description
      if (!group.entries.has(text))
        group.entries.set(text, {
          text,
          parts: baseMatches ? effect?.explanationBaseParts : effect?.explanationParts,
        })
      for (const note of effect?.explanationAdditionalNotes ?? [])
        if (!group.entries.has(note)) group.entries.set(note, { text: note })
      if (baseMatches && effect?.condition) {
        const condition = `Effect ${ordinal}: Applies only when ${effect.condition}.`
        group.entries.set(condition, {
          text: condition,
          parts: [
            `Effect ${ordinal}: Applies only when `,
            ...(effect.conditionParts ?? [effect.condition]),
            '.',
          ],
        })
      }
      if (effect)
        group.notes.set(JSON.stringify([effect.parts.details, effect.repeatsOnEntry]), effect)
      groups.set(identity, group)
    }
  if (!groups.size) return null
  return (
    <ul className={className} aria-label="Effect explanations">
      {[...groups.entries()].map(([identity, { effect, entries, notes }]) => (
        <li key={identity}>
          {effect ? (
            <>
              <strong>
                <EffectTagLabel
                  label={effect.parts.label}
                  tagPresentation={effect.tagPresentation}
                />
              </strong>{' '}
              —{' '}
            </>
          ) : null}
          {[...entries.entries()].map(([key, entry], index) => (
            <span key={key}>
              {index ? ' ' : null}
              <MechanicTextView text={entry.text} parts={entry.parts} />
            </span>
          ))}
          {[...notes.entries()].map(([key, note]) => (
            <EffectExplanationNotes
              key={key}
              parts={note.parts}
              repeatsOnEntry={note.repeatsOnEntry}
            />
          ))}
        </li>
      ))}
    </ul>
  )
}
