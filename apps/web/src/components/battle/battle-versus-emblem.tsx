import type { CSSProperties } from 'react'
import { BATTLE_VERSUS_ART } from '@/media/battle-art'
import styles from './battle-versus-emblem.module.css'

/** Decoration only: never takes space from the cards or intercepts battle input. */
export function BattleVersusEmblem({ placement = 'battle' }: { placement?: 'battle' | 'lobby' }) {
  return (
    <span
      className={styles.emblem}
      data-battle-versus="true"
      data-placement={placement}
      aria-hidden="true"
      style={{ '--battle-versus-art': `url('${BATTLE_VERSUS_ART.src}')` } as CSSProperties}
    >
      <span className={styles.flames} data-battle-versus-flames="true" />
    </span>
  )
}
