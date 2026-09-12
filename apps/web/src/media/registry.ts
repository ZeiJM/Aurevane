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
    id: 'art.phase4.chronist.identity.v01',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-004',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/phase4/chronist-128-v01.webp',
    width: 128,
    height: 128,
  },
  {
    id: 'art.phase4.bastion.identity.v01',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-003',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/phase4/bastion-128-v01.webp',
    width: 128,
    height: 128,
  },
  {
    id: 'art.phase4.ravager.identity.v01',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-003',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/phase4/ravager-128-v01.webp',
    width: 128,
    height: 128,
  },
  {
    id: 'art.phase4.edgedancer.identity.v01',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-003',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/phase4/edgedancer-128-v01.webp',
    width: 128,
    height: 128,
  },
  {
    id: 'art.phase4.wildwarden.identity.v01',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-003',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/phase4/wildwarden-128-v01.webp',
    width: 128,
    height: 128,
  },
  {
    id: 'art.phase4.runeblade.identity.v01',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-003',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/phase4/runeblade-128-v01.webp',
    width: 128,
    height: 128,
  },
  {
    id: 'art.phase4.dawnshield.identity.v01',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-003',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/phase4/dawnshield-128-v01.webp',
    width: 128,
    height: 128,
  },
  {
    id: 'art.phase4.cinderweaver.identity.v01',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-003',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/phase4/cinderweaver-128-v01.webp',
    width: 128,
    height: 128,
  },
  {
    id: 'art.phase4.frostweaver.identity.v01',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-003',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/phase4/frostweaver-128-v01.webp',
    width: 128,
    height: 128,
  },
  {
    id: 'art.phase4.stormsinger.identity.v01',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-003',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/phase4/stormsinger-128-v01.webp',
    width: 128,
    height: 128,
  },
  {
    id: 'art.phase4.tidecaller.identity.v01',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-003',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/phase4/tidecaller-128-v01.webp',
    width: 128,
    height: 128,
  },

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
  {
    id: 'discipline.foundation.vanguard-sigil',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-001',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/disc_vanguard_icon_v01.svg',
    width: 512,
    height: 512,
  },
  {
    id: 'discipline.foundation.farstrider-sigil',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-001',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/disc_farstrider_icon_v01.svg',
    width: 512,
    height: 512,
  },
  {
    id: 'discipline.foundation.shadehand-sigil',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-001',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/disc_shadehand_icon_v01.svg',
    width: 512,
    height: 512,
  },
  {
    id: 'discipline.foundation.ironfist-sigil',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-002',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/phase4/ironfist-128-v01.webp',
    width: 128,
    height: 128,
  },
  {
    id: 'discipline.foundation.aetherist-sigil',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-001',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/disc_aetherist_icon_v01.svg',
    width: 512,
    height: 512,
  },
  {
    id: 'discipline.foundation.lifebinder-sigil',
    kind: 'icon',
    status: 'approved',
    requestId: 'ART-DISC-001',
    decorative: true,
    alt: '',
    src: '/media/art/disciplines/disc_lifebinder_icon_v01.svg',
    width: 512,
    height: 512,
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
