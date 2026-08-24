import mobileBoardStyles from './pvp-spectator-mobile-board-recovery.module.css'
import styles from './pvp-spectator-viewport-polish.module.css'

export function PvpSpectatorViewportPolish() {
  return <span className={`${styles.hook} ${mobileBoardStyles.hook}`} aria-hidden="true" />
}
