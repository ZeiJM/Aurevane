import type { CombatStatusInstance } from '@aurevane/game-core/combat/actions'
import { combatStatusDetails, PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'

import {
  aggregateBattleStatusStacks,
  statusLabel,
  summarizeBattleEffects,
} from './battle-effect-summary'
import { BattleInfoPopover } from './battle-info-popover'
import styles from './battle-combatant-effects.module.css'

export function BattleCombatantEffects({
  name,
  statuses,
  compact = false,
}: {
  name: string
  statuses: readonly CombatStatusInstance[]
  compact?: boolean
}) {
  const effects = aggregateBattleStatusStacks(statuses)
  const limit = compact ? 1 : 2
  return (
    <section
      className={styles.effects}
      data-compact={compact || undefined}
      aria-label={`${name} active combat effects`}
    >
      <header>
        <h3>{compact ? 'Effects' : 'Active effects'}</h3>
        {effects.length > limit ? (
          <BattleInfoPopover
            label={`All ${name} effects`}
            title={`${name} · Active effects`}
            trigger={`All ${effects.length}`}
          >
            {effects.map((effect) => (
              <section key={`${effect.statusId}:${effect.statusVersion}`}>
                <strong>
                  {statusLabel(effect.statusId)} · {effect.remainingOwnerTurnStarts}t
                  {effect.stacks > 1 ? ` · ×${effect.stacks}` : ''}
                </strong>
                <p>{combatStatusDetails(effect.statusId).description}</p>
              </section>
            ))}
          </BattleInfoPopover>
        ) : null}
      </header>
      {effects.length === 0 ? (
        <p>No active effects</p>
      ) : (
        <div className={styles.list}>
          {effects.slice(0, limit).map((effect) => {
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
