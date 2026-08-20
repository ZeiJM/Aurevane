'use client'

import { useEffect, useState } from 'react'

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
  const [remoteFailed, setRemoteFailed] = useState(false)

  useEffect(() => {
    setRemoteFailed(false)
  }, [imageUrl])

  if (imageUrl && !remoteFailed) {
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
          setRemoteFailed(true)
          onRemoteError?.()
        }}
      />
    )
  }

  return <AurevaneImage assetId={fallbackAssetId} className={className} sizes={sizes} />
}
