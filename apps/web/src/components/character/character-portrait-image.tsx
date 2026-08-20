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
  onRemoteError?: () => void
}

export function CharacterPortraitImage({
  imageUrl,
  fallbackAssetId,
  className,
  sizes,
  alt = '',
  onRemoteError,
}: CharacterPortraitImageProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const useRemoteImage = Boolean(imageUrl && failedImageUrl !== imageUrl)

  if (imageUrl && useRemoteImage) {
    return (
      // Direct character image URLs intentionally support arbitrary http(s) hosts and animated GIFs.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={alt}
        className={className}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setFailedImageUrl(imageUrl)
          onRemoteError?.()
        }}
      />
    )
  }

  return <AurevaneImage assetId={fallbackAssetId} className={className} sizes={sizes} />
}
