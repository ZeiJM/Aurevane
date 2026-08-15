import Image from 'next/image'

import { getImageAsset, type ImageAssetId } from '@/media/registry'

interface AurevaneImageProps {
  assetId: ImageAssetId
  className?: string
  sizes?: string
}

export function AurevaneImage({ assetId, className, sizes = '100vw' }: AurevaneImageProps) {
  const asset = getImageAsset(assetId)

  if (asset.status !== 'approved' || !asset.src || !asset.width || !asset.height) {
    return (
      <div
        className={['media-fallback', className].filter(Boolean).join(' ')}
        data-media-status="requested"
        data-media-request={asset.requestId}
        aria-hidden={asset.decorative || undefined}
        role={asset.decorative ? undefined : 'img'}
        aria-label={
          asset.decorative ? undefined : asset.alt || 'Artwork awaiting production review'
        }
      >
        <span className="media-fallback__sky" aria-hidden="true" />
        <span className="media-fallback__ridge media-fallback__ridge--far" aria-hidden="true" />
        <span className="media-fallback__ridge media-fallback__ridge--near" aria-hidden="true" />
        <span className="media-fallback__road" aria-hidden="true" />
      </div>
    )
  }

  return (
    <Image
      src={asset.src}
      alt={asset.decorative ? '' : asset.alt}
      width={asset.width}
      height={asset.height}
      sizes={sizes}
      className={className}
    />
  )
}
