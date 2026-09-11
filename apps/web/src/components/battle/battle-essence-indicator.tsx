import Image from 'next/image'

import type { BattleEssencePresentation } from './battle-runtime'
import { battleSkillArtwork } from './battle-skill-presentation'
import styles from './battle-essence-indicator.module.css'

export function BattleEssenceIndicator({ essence }: { essence: BattleEssencePresentation }) {
  return (
    <aside className={styles.root} aria-label="Active Essence" data-testid="battle-essence">
      <Image
        width={64}
        height={64}
        unoptimized
        className={styles.artwork}
        src={battleSkillArtwork(essence.id)}
        alt=""
        aria-hidden="true"
      />
      <div className={styles.copy}>
        <span>Pure Essence Skill</span>
        <strong>{essence.name}</strong>
        <p>{essence.description}</p>
        <small>
          {essence.apCost} AP · {essence.cooldownOwnerTurns} owner-turn cooldown
        </small>
      </div>
    </aside>
  )
}
