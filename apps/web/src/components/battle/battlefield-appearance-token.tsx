'use client'

import { useCallback, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import {
  APPEARANCE_MOTION_FRAME,
  APPEARANCE_READY_CYCLE_MS,
  APPEARANCE_WALK_CYCLE_MS,
  appearanceManifestFromImageUrl,
  appearanceMotionFrameIndex,
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
  walking = false,
  cue,
  name,
  className,
  fallbackClassName,
}: {
  imageUrl: string | null
  portraitAssetId: ImageAssetId | null
  facing: AppearanceFacing
  defeated: boolean
  walking?: boolean
  cue?: BattleAppearanceCue
  name: string
  className?: string
  fallbackClassName: string
}) {
  const atlas = useMemo(() => appearanceManifestFromImageUrl(imageUrl)?.motionAtlas, [imageUrl])
  const classic = useSyncExternalStore(
    subscribeClassicPortraitTokens,
    readClassicPortraitTokens,
    () => false,
  )
  const [loaded, setLoaded] = useState<string | null>(null)
  const trackAtlas = useCallback(
    (image: HTMLImageElement | null) => {
      // A cached image can finish loading before React hydrates the preload element.
      if (atlas && image?.complete && image.naturalWidth > 0) setLoaded(atlas)
    },
    [atlas],
  )
  const embodied = !classic && atlas && loaded === atlas
  const pose = defeated ? 'down' : walking ? 'walk' : (cue?.pose ?? 'idle')
  const { columns, rows, frames } = APPEARANCE_MOTION_FRAME
  const x = (frame: number) => {
    const { column } = appearanceMotionFrameIndex(facing, pose, frame)
    return `${(100 * column) / (columns - 1)}%`
  }
  const y = (row: number) => `${(100 * row) / (rows - 1)}%`
  return (
    <>
      {!classic && atlas && !embodied ? (
        // Preload the complete atlas. Keep the portrait token until the file is ready.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={atlas}
          ref={trackAtlas}
          hidden
          src={atlas}
          alt=""
          onLoad={() => setLoaded(atlas)}
        />
      ) : null}
      {embodied ? (
        <span
          key={walking ? pose : (cue?.key ?? pose)}
          aria-hidden="true"
          className={styles.actor}
          data-battle-appearance-pose={pose}
          style={
            {
              '--atlas': `url("${atlas}")`,
              '--x0': x(0),
              '--x1': x(1),
              '--x2': x(2),
              '--x-last': x(frames - 1),
              '--y': y(appearanceMotionFrameIndex(facing, pose, 0).row),
              '--idle-y': y(0),
              '--atlas-size': `${columns * 100}% ${rows * 100}%`,
              '--motion-steps': frames,
              '--walk-duration': `${APPEARANCE_WALK_CYCLE_MS}ms`,
              '--ready-duration': `${APPEARANCE_READY_CYCLE_MS}ms`,
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
