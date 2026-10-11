import styles from './battle-chronicle-heading.module.css'

export function BattleChronicleHeading({ round }: { round?: number | null }) {
  const recorded = typeof round === 'number' && Number.isSafeInteger(round) && round >= 0
  return (
    <header className={styles.heading} data-battle-chronicle-heading="true">
      <strong>Battle Chronicle</strong>
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-battle-round={recorded ? round : 'unavailable'}
        aria-label={recorded ? `Current battle round ${round}` : 'Current battle round unavailable'}
      >
        Round {recorded ? round : '—'}
      </span>
    </header>
  )
}
