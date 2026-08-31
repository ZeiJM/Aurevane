import type { BattleFacing } from './battle-geometry'
import styles from './battle-facing-indicator.module.css'

export function BattleFacingIndicator({ facing }: { facing: BattleFacing }) {
  return (
    <div
      className={styles.indicator}
      data-battle-facing-indicator="true"
      data-facing={facing}
      aria-hidden="true"
    >
      <svg viewBox="0 0 12 12" focusable="false" aria-hidden="true">
        <path d="M6 0.8 10.4 5.2H7.4V11.2H4.6V5.2H1.6L6 0.8Z" />
      </svg>
    </div>
  )
}
