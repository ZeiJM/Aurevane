'use client'
import Image from 'next/image'
import type { BattleItemPresentation } from '@/lib/battle/battle-item-presentation'
import { BattleInfoPopover } from './battle-info-popover'
import { ItemDetails } from '../character/item-details'
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
            aria-label={`Use ${item.name}, ${item.position === 'main-hand' ? 'Main Hand' : 'Off Hand'}`}
            title={item.unavailableReason ?? undefined}
            data-item-action={item.actionId}
          >
            {item.artworkSrc ? (
              <Image
                src={item.artworkSrc.replace('/media/art/items/', '/media/art/items/thumbnails/')}
                alt=""
                width={28}
                height={28}
                unoptimized
              />
            ) : null}
            <span>
              <strong>{item.name}</strong>
              <small>
                {item.position === 'main-hand' ? 'Main Hand' : 'Off Hand'} ·{' '}
                {item.behaviors[0]?.costs
                  .filter((cost) => cost.resource === 'ap')
                  .reduce((sum, cost) => sum + cost.amount, 0) ?? 0}{' '}
                AP · {item.remainingUses} uses left
              </small>
            </span>
          </button>
          <BattleInfoPopover
            label={`Information about ${item.name}, ${item.position === 'main-hand' ? 'Main Hand' : 'Off Hand'}`}
            title={item.name}
            trigger="i"
            consumeOutsideClick
          >
            <>
              {item.unavailableReason ? <p>{item.unavailableReason}</p> : null}
              <ItemDetails item={item.item} />
            </>
          </BattleInfoPopover>
        </div>
      ))}
    </div>
  )
}
