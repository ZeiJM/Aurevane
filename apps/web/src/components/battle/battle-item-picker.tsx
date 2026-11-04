'use client'
import Image from 'next/image'
import type { BattleItemPresentation } from '@/lib/battle/battle-item-presentation'
import { BattleInfoPopover } from './battle-info-popover'
import { AbilityParameters } from '../character/ability-parameters'
import { AbilityEffectExplanations } from '../character/ability-effect-explanations'
import { positionNames, itemThumbnail } from '../character/item-equipment-preview'
import styles from './battle-item-picker.module.css'

export function BattleItemPicker({
  items,
  disabled,
  onSelect,
}: {
  items: readonly BattleItemPresentation[]
  disabled: boolean
  onSelect: (item: BattleItemPresentation) => void
}) {
  return (
    <div
      className={styles.choices}
      aria-label="Equipped Item choices"
      data-battle-item-choices="true"
    >
      {items.map((item) => (
        <div className={styles.choice} key={item.actionId}>
          <button
            type="button"
            disabled={disabled || item.unavailableReason !== null}
            onClick={() => onSelect(item)}
            aria-label={`Use ${item.name}, ${positionNames[item.position]}`}
            title={item.unavailableReason ?? undefined}
            data-item-action={item.actionId}
          >
            {item.artworkSrc ? (
              <Image
                src={itemThumbnail(item.artworkSrc)}
                alt=""
                width={28}
                height={28}
                unoptimized
              />
            ) : null}
            <span>
              <strong>{item.name}</strong>
              <small>
                {positionNames[item.position]} ·{' '}
                {item.behaviors[0]?.costs
                  .filter((cost) => cost.resource === 'ap')
                  .reduce((sum, cost) => sum + cost.amount, 0) ?? 0}{' '}
                AP · {item.remainingUses} uses left
              </small>
            </span>
          </button>
          <BattleInfoPopover
            label={`Information about ${item.name}, ${positionNames[item.position]}`}
            title={item.name}
            trigger="i"
            consumeOutsideClick
          >
            <article data-battle-item-report="true">
              <div className={styles.reportSummary}>
                {item.artworkSrc ? (
                  <Image
                    src={itemThumbnail(item.artworkSrc)}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                  />
                ) : null}
                <p>
                  {positionNames[item.position]} · {item.remainingUses ?? 'Unlimited'} uses left
                  {item.maximumUsesPerBattle !== null
                    ? ` of ${item.maximumUsesPerBattle} per battle`
                    : ''}
                  . Uses refill each battle.
                </p>
              </div>
              {item.unavailableReason ? <p>{item.unavailableReason}</p> : null}
              <strong>Parameters</strong>
              {item.behaviors.map((report) => (
                <section key={report.behaviorId}>
                  {item.behaviors.length > 1 ? <strong>{report.behaviorId}</strong> : null}
                  <AbilityParameters report={report} showEffectExplanations={false} />
                </section>
              ))}
              <AbilityEffectExplanations reports={item.behaviors} />
            </article>
          </BattleInfoPopover>
        </div>
      ))}
    </div>
  )
}
