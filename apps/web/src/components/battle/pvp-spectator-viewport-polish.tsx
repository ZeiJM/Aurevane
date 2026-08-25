import boardLayoutStyles from './pvp-spectator-board-layout.module.css'
import styles from './pvp-spectator-viewport-polish.module.css'

export function PvpSpectatorViewportPolish() {
  return <span className={`${styles.hook} ${boardLayoutStyles.hook}`} aria-hidden="true" />
}
