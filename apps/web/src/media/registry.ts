import { disciplineSigilDataUrl } from './generated-dark-fantasy-art'

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

const phase4Sigils = [
  ['chronist', 'ART-DISC-004'],
  ['bastion', 'ART-DISC-003'],
  ['ravager', 'ART-DISC-003'],
  ['edgedancer', 'ART-DISC-003'],
  ['wildwarden', 'ART-DISC-003'],
  ['runeblade', 'ART-DISC-003'],
  ['dawnshield', 'ART-DISC-003'],
  ['cinderweaver', 'ART-DISC-003'],
  ['frostweaver', 'ART-DISC-003'],
  ['stormsinger', 'ART-DISC-003'],
  ['tidecaller', 'ART-DISC-003'],
] as const

const foundationSigils = [
  ['vanguard', 'ART-DISC-001'],
  ['farstrider', 'ART-DISC-001'],
  ['shadehand', 'ART-DISC-001'],
  ['ironfist', 'ART-DISC-002'],
  ['aetherist', 'ART-DISC-001'],
  ['lifebinder', 'ART-DISC-001'],
] as const

const IMAGE_ASSETS = [
  ...phase4Sigils.map(([discipline, requestId]) => ({
    id: `art.phase4.${discipline}.identity.v01`,
    kind: 'icon' as const,
    status: 'approved' as const,
    requestId,
    decorative: true,
    alt: '',
    src: disciplineSigilDataUrl(discipline)!,
    width: 128,
    height: 128,
  })),
  {
    id: 'ui.foundation.vista',
    kind: 'environment',
    status: 'requested',
    requestId: 'ART-UI-001',
    decorative: true,
    alt: '',
  },
  {
    id: 'environment.character-creation.threshold',
    kind: 'environment',
    status: 'requested',
    requestId: 'ART-ENV-001',
    decorative: true,
    alt: '',
  },
  {
    id: 'character.creation.portrait-01',
    kind: 'character',
    status: 'requested',
    requestId: 'ART-CHR-001',
    decorative: false,
    alt: 'Starter portrait option one',
  },
  {
    id: 'character.creation.portrait-02',
    kind: 'character',
    status: 'requested',
    requestId: 'ART-CHR-001',
    decorative: false,
    alt: 'Starter portrait option two',
  },
  {
    id: 'character.creation.portrait-03',
    kind: 'character',
    status: 'requested',
    requestId: 'ART-CHR-001',
    decorative: false,
    alt: 'Starter portrait option three',
  },
  {
    id: 'character.creation.portrait-04',
    kind: 'character',
    status: 'requested',
    requestId: 'ART-CHR-001',
    decorative: false,
    alt: 'Starter portrait option four',
  },
  {
    id: 'character.creation.appearance-reference',
    kind: 'character',
    status: 'requested',
    requestId: 'ART-CHR-002',
    decorative: true,
    alt: '',
  },
  ...foundationSigils.map(([discipline, requestId]) => ({
    id: `discipline.foundation.${discipline}-sigil`,
    kind: 'icon' as const,
    status: 'approved' as const,
    requestId,
    decorative: true,
    alt: '',
    src: disciplineSigilDataUrl(discipline)!,
    width: 128,
    height: 128,
  })),
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
      if (
        !asset.src?.trim() ||
        !isPositiveInteger(asset.width) ||
        !isPositiveInteger(asset.height)
      ) {
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
