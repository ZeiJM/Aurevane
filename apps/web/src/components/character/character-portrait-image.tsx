import type { ImageAssetId } from '@/media/registry'

import { AurevaneImage } from '@/components/media/aurevane-image'

interface CharacterPortraitImageProps {
  imageUrl?: string | null
  fallbackAssetId: ImageAssetId
  className?: string
  sizes?: string
  alt?: string
}

export function CharacterPortraitImage({
  imageUrl,
  fallbackAssetId,
  className,
  sizes,
  alt = '',
}: CharacterPortraitImageProps) {
  if (imageUrl) {
    return (
      // Direct character image URLs intentionally support arbitrary http(s) hosts and animated GIFs.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt={alt} className={className} loading="lazy" referrerPolicy="no-referrer" />
    )
  }

  return <AurevaneImage assetId={fallbackAssetId} className={className} sizes={sizes} />
}
