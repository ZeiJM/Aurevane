export type ImageAssetStatus = 'requested' | 'approved'
export type ImageAssetKind = 'environment' | 'character' | 'ui' | 'icon'

export interface ImageAssetDescriptor {
  id: string
  kind: ImageAssetKind
  status: ImageAssetStatus
  requestId: string
  decorative: boolean
  alt: string
  src?: string
  width?: number
  height?: number
}

const IMAGE_ASSETS = [
  {
    id: 'ui.foundation.vista',
    kind: 'environment',
    status: 'requested',
    requestId: 'ART-UI-001',
    decorative: true,
    alt: '',
  },
] as const satisfies readonly ImageAssetDescriptor[]

export type ImageAssetId = (typeof IMAGE_ASSETS)[number]['id']

export const imageAssetRegistry: ReadonlyMap<string, ImageAssetDescriptor> = new Map(
  IMAGE_ASSETS.map((asset) => [asset.id, asset]),
)

export function getImageAsset(id: ImageAssetId): ImageAssetDescriptor {
  const asset = imageAssetRegistry.get(id)
  if (!asset) {
    throw new Error(`Unknown AUREVANE image asset: ${id}`)
  }

  return asset
}

export function validateImageRegistry(entries: readonly ImageAssetDescriptor[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const asset of entries) {
    if (seen.has(asset.id)) {
      errors.push(`Duplicate image asset id: ${asset.id}`)
    }
    seen.add(asset.id)

    if (!asset.requestId.trim()) {
      errors.push(`Image asset ${asset.id} is missing a request id.`)
    }

    if (asset.status === 'requested' && (asset.src || asset.width || asset.height)) {
      errors.push(`Requested image asset ${asset.id} must not pretend to have runtime media.`)
    }

    if (asset.status === 'approved') {
      if (!asset.src?.trim() || !isPositiveInteger(asset.width) || !isPositiveInteger(asset.height)) {
        errors.push(`Approved image asset ${asset.id} requires source, width, and height.`)
      }

      if (!asset.decorative && !asset.alt.trim()) {
        errors.push(`Meaningful image asset ${asset.id} requires alt text.`)
      }
    }
  }

  return errors
}

export function validateRegisteredImageAssets(): string[] {
  return validateImageRegistry(IMAGE_ASSETS)
}

function isPositiveInteger(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}
