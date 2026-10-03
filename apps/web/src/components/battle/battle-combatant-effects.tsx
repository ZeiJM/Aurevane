import type { CombatStatusInstance } from '@aurevane/game-core/combat/actions'
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'

import { aggregateBattleStatusStacks, summarizeBattleEffects } from './battle-effect-summary'
import { BattleInfoPopover } from './battle-info-popover'
import { describeBattleEffect } from './battle-effect-identity'
import { statusDamageMultiplierBasisPoints } from '../../lib/status-potency-presentation'
import styles from './battle-combatant-effects.module.css'

function effectDefinition(effect: CombatStatusInstance) {
  return PHASE4_STATUSES.find(
    (item) => item.id === effect.statusId && item.version === effect.statusVersion,
  )
}

function EffectModifiers({ effect }: { effect: CombatStatusInstance }) {
  const definition = effectDefinition(effect)
  if (effect.timingState === 'pending') return null
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
        const delta =
          (statusDamageMultiplierBasisPoints(
            modifier.multiplierBasisPoints,
            effect.potencyBasisPoints,
          ) -
            10000) /
          100
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
      <section className={styles.icons} aria-label={`${name} combat effects`}>
        <header>
          <h3>Effects</h3>
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
            <span className={styles.noEffects}>No combat effects</span>
          ) : (
            effects.map((effect, index) => {
              const details = describeBattleEffect(effect)
              const tone =
                details.kind === 'Buff'
                  ? 'positive'
                  : details.kind === 'Debuff'
                    ? 'negative'
                    : 'mixed'
              return (
                <span
                  key={`${effect.statusId}:${effect.statusVersion}:${index}`}
                  data-tone={tone}
                  data-effect-timing={details.timingState}
                >
                  <BattleInfoPopover
                    label={`Explain ${details.label}, ${details.timing} · ${details.duration}`}
                    description={details.explanation}
                    title={details.label}
                    className={styles.icon}
                    hover
                    consumeOutsideClick
                    trigger={
                      <>
                        <i aria-hidden="true">{details.identifier}</i>
                        {details.count !== null ? (
                          <small data-effect-duration="true">{details.count}</small>
                        ) : null}
                      </>
                    }
                  >
                    <p>
                      <strong>{details.kind}</strong> · {details.description}
                    </p>
                    <p>
                      {details.timing} · {details.duration}
                    </p>
                    <p>
                      {effect.stacks} stack{effect.stacks === 1 ? '' : 's'}
                    </p>
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
      aria-label={`${name} combat effects`}
    >
      <header>
        <h3>Effects</h3>
        {effects.length > limit ? (
          <BattleInfoPopover
            label={`All ${name} effects`}
            title={`${name} · Effects`}
            trigger={`All ${effects.length}`}
          >
            {effects.map((effect, index) => {
              const details = describeBattleEffect(effect)
              return (
                <section key={`${effect.statusId}:${effect.statusVersion}:${index}`}>
                  <strong>
                    {details.label} · {details.counterLabel}
                    {effect.stacks > 1 ? ` · ×${effect.stacks}` : ''}
                  </strong>
                  <p>{details.explanation}</p>
                </section>
              )
            })}
          </BattleInfoPopover>
        ) : null}
      </header>
      {effects.length === 0 ? (
        <p>No combat effects</p>
      ) : (
        <div className={styles.list}>
          {effects.slice(0, limit).map((effect, index) => {
            const details = describeBattleEffect(effect)
            const tone =
              details.kind === 'Buff'
                ? 'positive'
                : details.kind === 'Debuff'
                  ? 'negative'
                  : 'mixed'
            return (
              <div
                key={`${effect.statusId}:${effect.statusVersion}:${index}`}
                data-tone={tone}
                data-effect-timing={details.timingState}
                data-battle-effect-kind={details.kind}
              >
                <BattleInfoPopover
                  label={`Explain ${details.label}, ${details.timing} · ${details.duration}`}
                  description={details.explanation}
                  title={details.label}
                  className={styles.effectButton}
                  hover
                  consumeOutsideClick
                  trigger={
                    <>
                      <span className={styles.identity}>
                        <i aria-hidden="true">{details.identifier}</i>
                        <strong>{details.label}</strong>
                        <small>
                          {effect.stacks > 1 ? `×${effect.stacks} · ` : ''}
                          {details.counterLabel}
                        </small>
                      </span>
                      <EffectModifiers effect={effect} />
                    </>
                  }
                >
                  <p>
                    <strong>{details.kind}</strong> · {details.description}
                  </p>
                  <p>
                    {details.timing} · {details.duration}
                  </p>
                  <p>
                    {effect.stacks} stack{effect.stacks === 1 ? '' : 's'}
                  </p>
                </BattleInfoPopover>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
