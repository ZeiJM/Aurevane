import type { ReactNode } from 'react'
import type { SkillCharacteristic } from './basic-action-presentation'
import styles from './skill-characteristic-rows.module.css'
import { MechanicTextView } from './mechanic-text-view'
import type { MechanicTextPart } from './mechanic-text'

function parameterValue(label: string, value: string | readonly string[]) {
  if (label === 'Skill Type' && (value === 'Attack [Physical]' || value === 'Attack [Mystic]')) {
    const family = value === 'Attack [Physical]' ? 'physical' : 'mystic'
    return (
      <>
        Attack{' '}
        <span className={styles[family]} data-skill-attack-family={family}>
          [{family === 'physical' ? 'Physical' : 'Mystic'}]
        </span>
      </>
    )
  }
  return typeof value === 'string' ? value : value.join(', ') || 'N/A'
}

/** Definition-list children shared by the fixed Nexus preview and battle reading panels. */
export function SkillCharacteristicRows({
  rows,
  effectSummary,
  requirementParts,
  targetMethodExplanation,
  targetDetails,
}: {
  rows: readonly SkillCharacteristic[]
  effectSummary?: ReactNode
  requirementParts?: readonly MechanicTextPart[]
  targetMethodExplanation?: string
  targetDetails?: ReactNode
}) {
  return rows.map(([label, value]) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd title={label === 'Target Method' ? targetMethodExplanation : undefined}>
        {label === 'Effects' && effectSummary ? (
          effectSummary
        ) : label === 'Requirements' && requirementParts ? (
          <MechanicTextView
            text={typeof value === 'string' ? value : value.join(', ') || 'N/A'}
            parts={requirementParts}
            emphasizeTags
          />
        ) : (
          parameterValue(label, value)
        )}
        {label === 'Target Method' ? targetDetails : null}
      </dd>
    </div>
  ))
}
