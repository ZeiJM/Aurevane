'use client'

import { useState } from 'react'

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
  const useRemoteImage = Boolean(imageUrl && failedImageUrl !== imageUrl)
  const portraitClassName = ['character-portrait-media', className].filter(Boolean).join(' ')

  if (imageUrl && useRemoteImage) {
    return (
      // Direct character image URLs intentionally support arbitrary http(s) hosts and animated GIFs.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={alt}
        className={portraitClassName}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        referrerPolicy="no-referrer"
        onError={() => {
          setFailedImageUrl(imageUrl)
          onRemoteError?.()
        }}
      />
    )
  }

  return <AurevaneImage assetId={fallbackAssetId} className={portraitClassName} sizes={sizes} />
}
