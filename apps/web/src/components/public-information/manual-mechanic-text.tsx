import { Fragment } from 'react'
import { CompactEffectSummary } from '@/components/character/compact-skill-effect-summary'
import { MechanicTextView } from '@/components/character/mechanic-text-view'
import { plainMechanicText } from '@/components/character/mechanic-text'
import { plainManualInlineParts, type ManualInlinePart } from '@/content/manual-mechanic-text'

/** Optional annotation must reproduce the exact escaped article text, or remains plain. */
export function ManualMechanicText({
  text,
  parts,
}: {
  text: string
  parts?: readonly ManualInlinePart[] | null
}) {
  if (!parts || plainManualInlineParts(parts) !== text) return text
  return parts.map((part, index) => (
    <Fragment key={index}>
      {typeof part === 'string' ? (
        part
      ) : part.kind === 'effect' ? (
        <CompactEffectSummary parts={part.parts} />
      ) : (
        <MechanicTextView text={plainMechanicText(part.parts)} parts={part.parts} />
      )}
    </Fragment>
  ))
}
