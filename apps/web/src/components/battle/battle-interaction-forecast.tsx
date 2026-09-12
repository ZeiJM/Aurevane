import type { CombatResolutionEvent } from '@aurevane/game-core/combat/actions'
import { combatInteractionDescription } from '../../lib/battle/combat-interaction-presentation'
import styles from './battle-interaction-forecast.module.css'

/** Available on every playable mode; the compact cockpit cannot contain full tile effects. */
export function BattleInteractionForecast({
  events,
}: {
  events: readonly CombatResolutionEvent[]
}) {
  const descriptions = events
    .map(combatInteractionDescription)
    .filter((text): text is string => text !== null)
  if (descriptions.length === 0) return null
  return (
    <details className={styles.forecast}>
      <summary>Terrain &amp; effect details</summary>
      <section aria-label="Terrain and effect forecast">
        <strong>On confirmation</strong>
        <ul>
          {descriptions.map((description, index) => (
            <li key={index}>{description}</li>
          ))}
        </ul>
      </section>
    </details>
  )
}
