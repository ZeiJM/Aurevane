import type { BattleEssencePresentation } from './battle-runtime'
import styles from './battle-essence-indicator.module.css'

export function BattleEssenceIndicator({ essence }: { essence: BattleEssencePresentation }) {
  return (
    <aside className={styles.root} aria-label="Active Essence" data-testid="battle-essence">
      <span>Pure Essence Skill</span>
      <strong>{essence.name}</strong>
      <p>{essence.description}</p>
      <small>
        {essence.apCost} AP · {essence.cooldownOwnerTurns} owner-turn cooldown
      </small>
    </aside>
  )
}
