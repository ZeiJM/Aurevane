'use client'

import { useState } from 'react'

import { resolvePublicCharacterImageUrl } from '@/media/public-character-portrait'
import type { ImageAssetId } from '@/media/registry'

import { AurevaneImage } from '@/components/media/aurevane-image'

interface CharacterPortraitImageProps {
  imageUrl?: string | null
  fallbackAssetId: ImageAssetId
  className?: string
  sizes?: string
  alt?: string
  priority?: boolean
  onRemoteError?: () => void
}

export function CharacterPortraitImage({
  imageUrl,
  fallbackAssetId,
  className,
  sizes,
  alt = '',
  onRemoteError,
  priority = false,
}: CharacterPortraitImageProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const source = resolvePublicCharacterImageUrl(imageUrl, null)
  const useRemoteImage = Boolean(source && failedImageUrl !== source)
  const portraitClassName = ['character-portrait-media', className].filter(Boolean).join(' ')

  if (source && useRemoteImage) {
    return (
      // Direct character image URLs intentionally support arbitrary http(s) hosts and animated GIFs.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source}
        alt={alt}
        className={portraitClassName}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        referrerPolicy="no-referrer"
        onError={() => {
          setFailedImageUrl(source)
          onRemoteError?.()
        }}
      />
    )
  }

  return <AurevaneImage assetId={fallbackAssetId} className={portraitClassName} sizes={sizes} />
}
