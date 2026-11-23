'use client'

import { useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import {
  APPEARANCE_FRAME,
  appearanceFrameIndex,
  appearanceManifestFromImageUrl,
  type AppearanceFacing,
} from '@/appearance/appearance-manifest'
import {
  readClassicPortraitTokens,
  subscribeClassicPortraitTokens,
} from '@/appearance/appearance-preferences'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import type { ImageAssetId } from '@/media/registry'
import { BattleSummonPortrait } from './battle-summon-portrait'
import type { BattleAppearanceCue } from './battle-appearance-cues'
import styles from './battlefield-appearance-token.module.css'

export function BattlefieldAppearanceToken({
  imageUrl,
  portraitAssetId,
  facing,
  defeated,
  cue,
  name,
  className,
  fallbackClassName,
}: {
  imageUrl: string | null
  portraitAssetId: ImageAssetId | null
  facing: AppearanceFacing
  defeated: boolean
  cue?: BattleAppearanceCue
  name: string
  className?: string
  fallbackClassName: string
}) {
  const manifest = useMemo(() => appearanceManifestFromImageUrl(imageUrl), [imageUrl])
  const classic = useSyncExternalStore(
    subscribeClassicPortraitTokens,
    readClassicPortraitTokens,
    () => false,
  )
  const [loaded, setLoaded] = useState<string | null>(null)
  const embodied = !classic && manifest && loaded === manifest.atlas
  const pose = defeated ? 'down' : (cue?.pose ?? 'idle')
  const x = (frame: number) => {
    const { column } = appearanceFrameIndex(facing, pose, frame)
    return `${(100 * column) / (APPEARANCE_FRAME.columns - 1)}%`
  }
  const y = (row: number) => `${(100 * row) / (APPEARANCE_FRAME.rows - 1)}%`
  return (
    <>
      {!classic && manifest && !embodied ? (
        // Preload the complete atlas. Keep the portrait token until the file is ready.
        // eslint-disable-next-line @next/next/no-img-element
        <img hidden src={manifest.atlas} alt="" onLoad={() => setLoaded(manifest.atlas)} />
      ) : null}
      {embodied ? (
        <span
          key={cue?.key ?? pose}
          aria-hidden="true"
          className={styles.actor}
          data-battle-appearance-pose={pose}
          style={
            {
              '--atlas': `url("${manifest.atlas}")`,
              '--x0': x(0),
              '--x1': x(1),
              '--x2': x(2),
              '--y': y(appearanceFrameIndex(facing, pose, 0).row),
              '--idle-y': y(0),
              '--atlas-size': `${APPEARANCE_FRAME.columns * 100}% ${APPEARANCE_FRAME.rows * 100}%`,
            } as CSSProperties
          }
        />
      ) : portraitAssetId ? (
        <CharacterPortraitImage
          imageUrl={imageUrl}
          fallbackAssetId={portraitAssetId}
          className={className}
          sizes="96px"
          alt=""
        />
      ) : imageUrl ? (
        <BattleSummonPortrait
          src={imageUrl}
          name={name}
          fallbackClassName={fallbackClassName}
          className={className}
        />
      ) : (
        <span className={fallbackClassName} aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </>
  )
}
