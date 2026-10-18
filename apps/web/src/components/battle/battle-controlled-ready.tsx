import styles from './battle-controlled-ready.module.css'

/** A static light inside existing artwork bounds; no new command or primed decoration. */
export function BattleControlledReady({ ready }: { ready: boolean }) {
  return ready ? (
    <span className={styles.light} data-battle-controlled-ready="true" aria-hidden="true" />
  ) : null
}
