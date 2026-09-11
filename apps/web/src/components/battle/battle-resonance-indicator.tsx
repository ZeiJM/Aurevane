import Image from 'next/image'

import type { BattleResonancePresentation } from './battle-runtime'
import { battleResonanceArtwork } from './battle-skill-presentation'
import styles from './battle-resonance-indicator.module.css'

export function BattleResonanceIndicator({
  resonance,
}: {
  resonance: BattleResonancePresentation
}) {
  return (
    <aside className={styles.root} aria-label="Active Resonance" data-testid="battle-resonance">
      <Image
        width={64}
        height={64}
        unoptimized
        className={styles.artwork}
        src={battleResonanceArtwork(resonance.id)}
        alt=""
        aria-hidden="true"
      />
      <div className={styles.copy}>
        <span>Resonance</span>
        <strong>{resonance.name}</strong>
        <p>{resonance.description}</p>
      </div>
    </aside>
  )
}
