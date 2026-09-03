import type { BattleResonancePresentation } from './battle-runtime'
import styles from './battle-resonance-indicator.module.css'

export function BattleResonanceIndicator({
  resonance,
}: {
  resonance: BattleResonancePresentation
}) {
  return (
    <aside className={styles.root} aria-label="Active Resonance" data-testid="battle-resonance">
      <span>Resonance</span>
      <strong>{resonance.name}</strong>
      <p>{resonance.description}</p>
    </aside>
  )
}
