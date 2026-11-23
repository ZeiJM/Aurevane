import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'

import styles from './arena-npc-card.module.css'

export function ArenaNpcCard({
  name,
  lore,
  portraitRef,
  imageUrl,
}: {
  name: string
  lore: string
  portraitRef: string | null
  imageUrl?: string | null
}) {
  const portrait =
    portraitRef && isStarterCharacterPortraitRef(portraitRef)
      ? portraitRef
      : 'portrait.starter.wayfarer-01'
  return (
    <article className={styles.card}>
      <CharacterPortraitImage
        imageUrl={imageUrl}
        fallbackAssetId={getStarterPortraitImageAssetId(portrait)}
        className={styles.portrait}
        sizes="64px"
      />
      <div className={styles.identity}>
        <strong>{name}</strong>
        <span>Arena fighter</span>
        {lore.length > 230 ? (
          <details>
            <summary>Read arena lore</summary>
            <p>{lore}</p>
          </details>
        ) : lore ? (
          <p>{lore}</p>
        ) : null}
      </div>
    </article>
  )
}
