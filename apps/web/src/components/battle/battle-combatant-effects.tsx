import type { CombatStatusInstance } from '@aurevane/game-core/combat/actions'
import {
  combatStatusDetails,
  combatStatusDuration,
  PHASE4_STATUSES,
} from '@aurevane/game-core/combat/status-content'

import {
  aggregateBattleStatusStacks,
  statusLabel,
  summarizeBattleEffects,
} from './battle-effect-summary'
import { BattleInfoPopover } from './battle-info-popover'
import styles from './battle-combatant-effects.module.css'

function effectDefinition(effect: CombatStatusInstance) {
  return PHASE4_STATUSES.find(
    (item) => item.id === effect.statusId && item.version === effect.statusVersion,
  )
}

function remainingDuration(effect: CombatStatusInstance) {
  const definition = effectDefinition(effect)
  const count = effect.remainingOwnerTurnStarts
  if (definition?.nextRoundInitiative !== undefined) return 'Until the next round starts'
  if (definition?.endOfTurn)
    return `${count} affected-turn-end tick${count === 1 ? '' : 's'} remaining`
  return `${count} affected-unit turn start${count === 1 ? '' : 's'} remaining`
}

function effectGlyph(statusId: string) {
  // Short labels identify each existing effect without implying a new gameplay rule or asset.
  const distinct = { haste: 'HST', hastened: 'HSN', mark: 'MRK', marked: 'MK1' }
  return (
    distinct[statusId as keyof typeof distinct] ??
    statusLabel(statusId)
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 3)
      .toUpperCase()
  )
}

function EffectModifiers({ effect }: { effect: CombatStatusInstance }) {
  const definition = effectDefinition(effect)
  return (
    <>
      {summarizeBattleEffects([effect]).map((item) => (
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
    </>
  )
}

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
  if (compact)
    return (
      <section className={styles.icons} aria-label={`${name} active combat effects`}>
        <header>
          <h3>Active effects</h3>
          {effects.length > 20 ? (
            <small title={`Scroll for all ${effects.length} effects`}>↕ {effects.length}</small>
          ) : null}
        </header>
        <div
          className={styles.iconGrid}
          role={effects.length > 20 ? 'region' : undefined}
          tabIndex={effects.length > 20 ? 0 : undefined}
          aria-label={effects.length > 20 ? `Scroll for all ${effects.length} effects` : undefined}
        >
          {effects.length === 0 ? (
            <span className={styles.noEffects}>No active effects</span>
          ) : (
            effects.map((effect) => {
              const details = combatStatusDetails(effect.statusId)
              const label = statusLabel(effect.statusId)
              const tone =
                details.kind === 'Buff'
                  ? 'positive'
                  : details.kind === 'Debuff'
                    ? 'negative'
                    : 'mixed'
              const duration = remainingDuration(effect)
              return (
                <span
                  key={`${effect.statusId}:${effect.statusVersion}`}
                  data-tone={tone}
                  title={`${label}: ${details.description} ${duration}`}
                >
                  <BattleInfoPopover
                    label={`Explain ${label}, ${duration}`}
                    title={label}
                    className={styles.icon}
                    hover
                    trigger={
                      <>
                        <i aria-hidden="true">{effectGlyph(effect.statusId)}</i>
                        <small data-effect-duration="true">{effect.remainingOwnerTurnStarts}</small>
                      </>
                    }
                  >
                    <p>
                      <strong>{details.kind}</strong> · {details.description}
                    </p>
                    <p>
                      {duration} · {effect.stacks} stack{effect.stacks === 1 ? '' : 's'}
                    </p>
                    <p>
                      {effectDefinition(effect)
                        ? combatStatusDuration(effect.statusId)
                        : 'The counter advances at the affected unit’s turn start, rather than at every combatant’s turn or every round.'}
                    </p>
                    <div className={styles.popupModifiers}>
                      <EffectModifiers effect={effect} />
                    </div>
                  </BattleInfoPopover>
                </span>
              )
            })
          )}
        </div>
      </section>
    )
  const limit = 2
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
            const label = statusLabel(effect.statusId)
            const tone =
              details.kind === 'Buff'
                ? 'positive'
                : details.kind === 'Debuff'
                  ? 'negative'
                  : 'mixed'
            const duration = remainingDuration(effect)
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
                <EffectModifiers effect={effect} />
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
