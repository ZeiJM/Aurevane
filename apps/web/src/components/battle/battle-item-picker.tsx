'use client'
import Image from 'next/image'
import type { BattleItemPresentation } from '@/lib/battle/battle-item-presentation'
import { BattleInfoPopover } from './battle-info-popover'
import { BattleItemReport } from './battle-item-report'
import commandStyles from './battle-skill-command.module.css'
import { itemThumbnail } from '../character/item-equipment-preview'
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
            aria-label={`Use ${item.name}`}
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
                {item.remainingUses ?? 'Unlimited'} / {item.maximumUsesPerBattle ?? 'Unlimited'}{' '}
                uses left this battle · Stock: {item.stockQuantity ?? 'N/A'}
              </small>
            </span>
          </button>
          <BattleInfoPopover
            label={`Information about ${item.name}`}
            className={commandStyles.infoTrigger}
            title={item.name}
            trigger="i"
            consumeOutsideClick
          >
            <BattleItemReport item={item} />
          </BattleInfoPopover>
        </div>
      ))}
    </div>
  )
}
