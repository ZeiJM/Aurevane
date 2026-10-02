import type { ReactNode } from 'react'
import type { SkillCharacteristic } from './basic-action-presentation'

/** Definition-list children shared by the fixed Nexus preview and battle reading panels. */
export function SkillCharacteristicRows({
  rows,
  effectSummary,
}: {
  rows: readonly SkillCharacteristic[]
  effectSummary?: ReactNode
}) {
  return rows.map(([label, value]) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd>
        {label === 'Effects' && effectSummary
          ? effectSummary
          : typeof value === 'string'
            ? value
            : value.join(', ') || 'N/A'}
      </dd>
    </div>
  ))
}
