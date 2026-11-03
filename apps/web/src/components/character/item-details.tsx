import Image from 'next/image'
import type { ItemPresentation } from '@/lib/items/item-presentation'
import { AbilityParameters } from './ability-parameters'
import { AbilityEffectExplanations } from './ability-effect-explanations'
import styles from './item-details.module.css'
/** Shared public Item reader. No definition, inventory receipt or private source instance required. */
export function ItemDetails({ item }: { item: ItemPresentation }) {
  return (
    <article className={styles.details} aria-label={`${item.name} details`}>
      {item.artworkSrc ? (
        <Image
          className={styles.artwork}
          src={item.artworkSrc}
          width={400}
          height={400}
          alt={item.name}
        />
      ) : null}
      <h3>{item.name}</h3>
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
              ? `${item.equipment.slot} · ${item.equipment.hands} ${item.equipment.hands === 1 ? 'hand' : 'hands'}`
              : 'None'}
          </dd>
        </div>
        <div>
          <dt>Maximum stack</dt>
          <dd>{item.maximumStack}</dd>
        </div>
      </dl>
      {item.battleUses !== null ? (
        <p>
          {item.battleUses} uses per battle. Uses refill each battle; owned quantities are
          unchanged.
        </p>
      ) : null}
      {!item.enabled ? (
        <p>This Item is currently unavailable for new equipment or battles.</p>
      ) : null}
      {item.reports.map((report) => (
        <section key={report.behaviorId}>
          <h4>{report.name}</h4>
          <AbilityParameters report={report} showEffectExplanations={false} />
        </section>
      ))}
      <AbilityEffectExplanations reports={item.reports} />
    </article>
  )
}
