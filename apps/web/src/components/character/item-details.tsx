import Image from 'next/image'
import type { ItemPresentation } from '@/lib/items/item-presentation'
import { AbilityParameters } from './ability-parameters'
import { AbilityEffectExplanations } from './ability-effect-explanations'
import styles from './item-details.module.css'
/** Shared public Item reader. No definition, inventory receipt or private source instance required. */
export function ItemDetails({
  item,
  showName = true,
}: {
  item: ItemPresentation
  showName?: boolean
}) {
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
              <dt>Quality Points</dt>
              <dd>{item.qualityPoints}</dd>
            </div>
            <div>
              <dt>Class</dt>
              <dd>{item.itemClass.replaceAll('-', ' ')}</dd>
            </div>
            <div>
              <dt>Equipment</dt>
              <dd>
                {item.equipment
                  ? item.itemClass === 'battle-item'
                    ? 'Consumable'
                    : item.equipment.slot === 'hand'
                      ? `hand · ${item.equipment.hands} ${item.equipment.hands === 1 ? 'hand' : 'hands'}`
                      : item.equipment.slot
                  : 'None'}
              </dd>
            </div>
            <div>
              <dt>Maximum stack</dt>
              <dd>{item.maximumStack}</dd>
            </div>
          </dl>
        </div>
      </div>
      {item.battleUses !== null ? (
        <p>
          {item.battleUses} uses per battle. Uses refill each battle; owned quantities are
          unchanged.
        </p>
      ) : null}
      {!item.enabled ? (
        <p>This Item is currently unavailable for new equipment or battles.</p>
      ) : null}
      <div className={styles.reports}>
        {item.reports.map((report) => (
          <section key={report.behaviorId}>
            <h4>{report.name}</h4>
            <AbilityParameters
              report={report}
              characteristicsClassName={styles.characteristics}
              showEffectExplanations={false}
            />
          </section>
        ))}
      </div>
      <AbilityEffectExplanations reports={item.reports} className={styles.explanations} />
    </article>
  )
}
