'use client'

import { BattleInfoPopover } from './battle-info-popover'
import styles from './battle-map-key.module.css'

export function BattleMapKey({ variant = 'popover' }: { variant?: 'inline' | 'popover' } = {}) {
  const content = (
    <dl className={styles.key}>
      <div>
        <dt>
          <i data-key="rough" aria-hidden="true" />
          Difficult Terrain
        </dt>
        <dd>Costs more AP and Movement to cross. Check the path preview before moving.</dd>
      </div>
      <div>
        <dt>
          <i data-key="elevated" aria-hidden="true">
            ▲
          </i>
          Elevated Ground
        </dt>
        <dd>The raised rim marks elevation. Access depends on your character’s Jump.</dd>
      </div>
      <div>
        <dt>
          <i data-key="frozen" aria-hidden="true">
            ❄
          </i>
          Frozen
        </dt>
        <dd>Temporary ice adds 10 AP per tile entered. Airborne ignores this extra cost.</dd>
      </div>
      <div>
        <dt>
          <i data-key="steam" aria-hidden="true">
            ≋
          </i>
          Steam
        </dt>
        <dd>Temporary steam blocks line of sight through intervening tiles.</dd>
      </div>
      <div>
        <dt>
          <i data-key="path" aria-hidden="true">
            1
          </i>
          Movement path
        </dt>
        <dd>Numbered tiles show the planned route. The AP bar previews its total cost.</dd>
      </div>
      <div>
        <dt>
          <i data-key="facing" aria-hidden="true">
            ↑
          </i>
          Facing
        </dt>
        <dd>
          The arrow above a portrait shows its facing. Choose a map arrow to finish your turn.
        </dd>
      </div>
    </dl>
  )
  if (variant === 'inline')
    return (
      <section className={styles.inline} aria-label="Terrain Key" data-battle-terrain-key="true">
        <header>
          <strong>Terrain Key</strong>
          <BattleInfoPopover label="Full terrain key" trigger="i">
            {content}
          </BattleInfoPopover>
        </header>
        <div className={styles.samples}>
          <span>
            <i data-key="open" aria-hidden="true" />
            Open ground
          </span>
          <span>
            <i data-key="rough" aria-hidden="true" />
            Difficult terrain
          </span>
          <span>
            <i data-key="elevated" aria-hidden="true" />
            Elevated ground
          </span>
          <span>
            <i data-key="frozen" aria-hidden="true">
              ❄
            </i>
            Temporary ice
          </span>
        </div>
      </section>
    )
  return (
    <BattleInfoPopover
      label="Map Key"
      trigger={
        <>
          <span aria-hidden="true">▦</span> Map Key
        </>
      }
    >
      {content}
    </BattleInfoPopover>
  )
}
