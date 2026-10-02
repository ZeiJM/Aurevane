import type { SkillCharacteristic } from './basic-action-presentation'

/** Definition-list children shared by the fixed Nexus preview and battle reading panels. */
export function SkillCharacteristicRows({ rows }: { rows: readonly SkillCharacteristic[] }) {
  return rows.map(([label, value]) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd>{typeof value === 'string' ? value : value.join(', ') || 'N/A'}</dd>
    </div>
  ))
}
