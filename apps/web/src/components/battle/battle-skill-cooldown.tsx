import styles from './battle-skill-cooldown.module.css'

export function BattleSkillCooldown({ turns }: { turns: number }) {
  if (turns <= 0) return null
  return (
    <span className={styles.countdown} data-battle-cooldown-countdown="true" aria-hidden="true">
      {turns}
    </span>
  )
}
