import Image from 'next/image'
import { itemEquipRequirementSummaries } from '@aurevane/game-core/character/item-equip-requirements'
import type { ItemPresentation } from '@/lib/items/item-presentation'
import { itemClassLabel, itemCategoryLabel } from '@/lib/items/item-class-label'
import { ItemReportTabs } from './item-report-tabs'
import styles from './item-details.module.css'
import { itemPositions, positionNames } from './item-equipment-preview'
/** Shared public Item reader. No definition, inventory receipt or private source instance required. */
export function ItemDetails({
  item,
  showName = true,
}: {
  item: ItemPresentation
  showName?: boolean
}) {
  const battleUses =
    item.battleUses === null
      ? null
      : Math.min(
          item.battleUses,
          item.reports.find((report) => report.behaviorId === item.actions.use?.behaviorId)
            ?.maximumUsesPerBattle ?? item.battleUses,
        )
  return (
    <article className={styles.details} aria-label={`${item.name} details`}>
      <div className={styles.summary}>
        {item.artworkSrc ? (
          <Image
            className={styles.artwork}
            src={item.artworkSrc}
            width={160}
            height={160}
            alt={item.name}
          />
        ) : null}
        <div>
          {showName ? <h3>{item.name}</h3> : null}
          <p>{item.description}</p>
          <dl className={styles.facts}>
            <div>
              <dt>Tier</dt>
              <dd>{item.tier}</dd>
            </div>
            <div>
              <dt>Maximum stack</dt>
              <dd>{item.maximumStack}</dd>
            </div>
            <div>
              <dt>Class</dt>
              <dd>{itemCategoryLabel(item.inventoryCategory)}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>
                {item.itemClass === 'battle-item'
                  ? 'Consumable Slot'
                  : itemPositions(item)
                      .map((position) => positionNames[position])
                      .join(' / ') || 'N/A'}
              </dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>
                {['armor', 'hand-armor', 'weapon', 'battle-item'].includes(item.itemClass)
                  ? itemClassLabel(item.itemClass)
                  : 'N/A'}
              </dd>
            </div>
            {battleUses !== null ? (
              <div>
                <dt>Uses per battle</dt>
                <dd>{battleUses}</dd>
              </div>
            ) : null}
            {item.equipment && item.equipRequirements ? (
              <div className={styles.requirements}>
                <dt>Equip requirements</dt>
                <dd>
                  {(
                    item.equipRequirementSummaries ??
                    itemEquipRequirementSummaries(item.equipRequirements)
                  ).join(' · ') || 'None'}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
      {!item.enabled ? (
        <p>This Item is currently unavailable for new equipment or battles.</p>
      ) : null}
      <ItemReportTabs
        itemId={item.id}
        itemCharacteristics={item}
        supportBehaviorId={
          item.itemClass === 'weapon' ? item.actions.support?.behaviorId : undefined
        }
        reports={item.reports.map((report) =>
          battleUses === null
            ? report
            : {
                ...report,
                limits: report.limits.filter(
                  (limit) =>
                    limit !== `${report.maximumUsesPerBattle ?? battleUses} uses per battle`,
                ),
              },
        )}
      />
    </article>
  )
}
