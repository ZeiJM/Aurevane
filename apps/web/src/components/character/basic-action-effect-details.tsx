import {
  basicActionEffectExplanation,
  basicActionEffectSummaryParts,
  type BasicActionPresentationId,
} from './basic-action-presentation'
import { CompactEffectSummary } from './compact-skill-effect-summary'

export function BasicActionEffectSummary({ id }: { id: BasicActionPresentationId }) {
  return <CompactEffectSummary parts={basicActionEffectSummaryParts(id)} />
}

export function BasicActionEffectExplanations({
  id,
  className,
}: {
  id: BasicActionPresentationId
  className?: string
}) {
  return (
    <ul
      className={className}
      aria-label="Effect explanations"
      data-basic-action-effect-explanation="true"
    >
      <li>
        <strong>{basicActionEffectSummaryParts(id).label}</strong> —{' '}
        {basicActionEffectExplanation(id)}
      </li>
    </ul>
  )
}
