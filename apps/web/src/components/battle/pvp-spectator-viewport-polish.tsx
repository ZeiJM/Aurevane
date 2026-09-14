import mobileBoardStyles from './pvp-spectator-mobile-board-layout.module.css'
import mobileControlStyles from './pvp-spectator-mobile-control-balance.module.css'

export function PvpSpectatorViewportPolish() {
  return (
    <span className={`${mobileBoardStyles.hook} ${mobileControlStyles.hook}`} aria-hidden="true" />
  )
}
