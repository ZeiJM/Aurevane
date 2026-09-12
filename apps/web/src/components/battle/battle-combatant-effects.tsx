import type { CombatStatusInstance } from '@aurevane/game-core/combat/actions'
import { combatStatusDetails, PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'

import {
  aggregateBattleStatusStacks,
  statusLabel,
  summarizeBattleEffects,
} from './battle-effect-summary'
import styles from './battle-combatant-effects.module.css'

export function BattleCombatantEffects({
  name,
  statuses,
}: {
  name: string
  statuses: readonly CombatStatusInstance[]
}) {
  const effects = aggregateBattleStatusStacks(statuses)
  return (
    <section className={styles.effects} aria-label={`${name} active combat effects`}>
      <h3>Active effects</h3>
      {effects.length === 0 ? (
        <p>No active effects</p>
      ) : (
        <div className={styles.list}>
          {effects.map((effect) => {
            const details = combatStatusDetails(effect.statusId)
            const definition = PHASE4_STATUSES.find(
              (item) => item.id === effect.statusId && item.version === effect.statusVersion,
            )
            const label = statusLabel(effect.statusId)
            const tone =
              details.kind === 'Buff'
                ? 'positive'
                : details.kind === 'Debuff'
                  ? 'negative'
                  : 'mixed'
            const duration = `${effect.remainingOwnerTurnStarts} turn${effect.remainingOwnerTurnStarts === 1 ? '' : 's'} remaining`
            const legacy = summarizeBattleEffects([effect])
            return (
              <button
                type="button"
                key={`${effect.statusId}:${effect.statusVersion}`}
                data-tone={tone}
                title={`${details.description} ${duration}`}
                aria-label={`Explain ${label}, ${duration}`}
                data-battle-effect-trigger="true"
                data-battle-effect-name={label}
                data-battle-effect-kind={details.kind}
                data-battle-effect-duration={duration}
              >
                <span className={styles.identity}>
                  <i aria-hidden="true">
                    {tone === 'positive' ? '+' : tone === 'negative' ? '−' : '±'}
                  </i>
                  <strong>{label}</strong>
                  <small>
                    {effect.stacks > 1 ? `×${effect.stacks} · ` : ''}
                    {effect.remainingOwnerTurnStarts}t
                  </small>
                </span>
                {legacy.map((item) => (
                  <span
                    className={styles.modifier}
                    data-tone={item.tone === 'buff' ? 'positive' : 'negative'}
                    key={item.label}
                  >
                    Damage received <b>{item.value}</b>
                  </span>
                ))}
                {definition?.damageModifiers?.map((modifier, index) => {
                  const delta = (modifier.multiplierBasisPoints - 10000) / 100
                  const positive = modifier.direction === 'outgoing' ? delta > 0 : delta < 0
                  return (
                    <span
                      className={styles.modifier}
                      data-tone={positive ? 'positive' : 'negative'}
                      key={index}
                    >
                      {modifier.direction === 'outgoing' ? 'Damage dealt' : 'Damage received'}
                      {modifier.condition.kind !== 'always' ? ' · conditional' : ''}
                      <b>
                        {delta > 0 ? '+' : '−'}
                        {Math.abs(delta)}%
                      </b>
                    </span>
                  )
                })}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
