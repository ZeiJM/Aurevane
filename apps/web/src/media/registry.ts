import { disciplineSigilArtwork } from './discipline-sigil-art'
import { GENERATED_STARTER_PORTRAITS_1 } from './generated-starter-portraits-1'
import { GENERATED_STARTER_PORTRAITS_2 } from './generated-starter-portraits-2'
import { GENERATED_STARTER_PORTRAITS_3 } from './generated-starter-portraits-3'
import { GENERATED_STARTER_PORTRAITS_4 } from './generated-starter-portraits-4'
import { GENERATED_STARTER_PORTRAITS_5 } from './generated-starter-portraits-5'
import { GENERATED_STARTER_PORTRAITS_6 } from './generated-starter-portraits-6'
import { GENERATED_STARTER_PORTRAITS_7 } from './generated-starter-portraits-7'
import { RESTORED_STARTER_PORTRAIT_07 } from './restored-starter-portrait-07'

export type ImageAssetStatus = 'requested' | 'approved'
export type ImageAssetKind = 'environment' | 'character' | 'ui' | 'icon'

export interface ImageAssetDescriptor {
  id: string
  kind: ImageAssetKind
  status: ImageAssetStatus
  requestId: string
  generationRequestId?: string
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

// Links generated runtime derivatives to the committed concept-ui provenance record.
const conceptUiGenerationRequestId = 'ART-UI-029'

const generatedStarterPortraits = [
  ...GENERATED_STARTER_PORTRAITS_1,
  ...GENERATED_STARTER_PORTRAITS_2,
  ...GENERATED_STARTER_PORTRAITS_3,
  ...GENERATED_STARTER_PORTRAITS_4,
  ...GENERATED_STARTER_PORTRAITS_5,
  ...GENERATED_STARTER_PORTRAITS_6,
  ...GENERATED_STARTER_PORTRAITS_7,
] as const

const legacySquareStarterPortraitAssetIds = [
  'character.creation.square-portrait-01',
  'character.creation.square-portrait-02',
  'character.creation.square-portrait-03',
  'character.creation.square-portrait-04',
] as const

const IMAGE_ASSETS = [
  ...phase4Sigils.map(([discipline, requestId]) => ({
    id: `art.phase4.${discipline}.identity.v01`,
    kind: 'icon' as const,
    status: 'approved' as const,
    requestId,
    decorative: true,
    alt: '',
    src: disciplineSigilArtwork(discipline)!,
    width: 1024,
    height: 1024,
  })),
  {
    id: 'ui.foundation.vista',
    kind: 'environment',
    status: 'approved',
    requestId: 'ART-UI-001',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: true,
    alt: '',
    src: '/media/art/concept-ui/world-v01.webp',
    width: 1536,
    height: 1024,
  },
  {
    id: 'environment.character-creation.threshold',
    kind: 'environment',
    status: 'approved',
    requestId: 'ART-ENV-001',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: true,
    alt: '',
    src: '/media/art/concept-ui/world-v01.webp',
    width: 1536,
    height: 1024,
  },
  {
    id: 'character.creation.portrait-01',
    kind: 'character',
    status: 'approved',
    requestId: 'ART-CHR-001',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: false,
    alt: 'Adventurer with tousled blond hair, silver armor and a dark green cloak, holding a sword',
    src: '/media/art/concept-ui/portrait-01-v01.webp',
    width: 768,
    height: 1152,
  },
  {
    id: 'character.creation.portrait-02',
    kind: 'character',
    status: 'approved',
    requestId: 'ART-CHR-001',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: false,
    alt: 'Adventurer with long silver hair, a violet cloak and black armor, holding a purple crystal',
    src: '/media/art/concept-ui/portrait-02-v01.webp',
    width: 768,
    height: 1152,
  },
  {
    id: 'character.creation.portrait-03',
    kind: 'character',
    status: 'approved',
    requestId: 'ART-CHR-001',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: false,
    alt: 'Adventurer with short dark curls, a green cloak and leather armor, carrying a bow and quiver',
    src: '/media/art/concept-ui/portrait-03-v01.webp',
    width: 768,
    height: 1152,
  },
  {
    id: 'character.creation.portrait-04',
    kind: 'character',
    status: 'approved',
    requestId: 'ART-CHR-001',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: false,
    alt: 'Adventurer with short black hair, a teal cloak and bronze bracers over wrapped forearms',
    src: '/media/art/concept-ui/portrait-04-v01.webp',
    width: 768,
    height: 1152,
  },
  ...generatedStarterPortraits.slice(0, 4).map((portrait, index) => ({
    id: legacySquareStarterPortraitAssetIds[index]!,
    kind: 'character' as const,
    status: 'approved' as const,
    requestId: 'ART-CHR-001',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: false,
    alt: portrait.alt,
    src: portrait.src,
    // The matching large HQ preview is available for the first identity.
    width: index === 0 ? 400 : 96,
    height: index === 0 ? 400 : 96,
  })),
  ...generatedStarterPortraits.slice(4).map((portrait) => ({
    id: portrait.id,
    kind: 'character' as const,
    status: 'approved' as const,
    requestId: 'ART-CHR-001',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: false,
    alt: portrait.alt,
    src:
      portrait.id === RESTORED_STARTER_PORTRAIT_07.id
        ? RESTORED_STARTER_PORTRAIT_07.src
        : portrait.src,
    width: 96,
    height: 96,
  })),
  {
    id: 'character.creation.appearance-reference',
    kind: 'character',
    status: 'approved',
    requestId: 'ART-CHR-002',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: true,
    alt: '',
    src: '/media/art/concept-ui/portrait-01-v01.webp',
    width: 768,
    height: 1152,
  },
  {
    id: 'ui.foundation.vista-mobile',
    kind: 'environment',
    status: 'approved',
    requestId: 'ART-UI-001',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: true,
    alt: '',
    src: '/media/art/concept-ui/world-mobile-v01.webp',
    width: 768,
    height: 1024,
  },
  {
    id: 'environment.passive-training.cloister',
    kind: 'environment',
    status: 'approved',
    requestId: 'ART-ENV-002',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: true,
    alt: '',
    src: '/media/art/concept-ui/training-v01.webp',
    width: 1536,
    height: 1024,
  },
  {
    id: 'environment.battle-hall.courtyard',
    kind: 'environment',
    status: 'approved',
    requestId: 'ART-ENV-003',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: true,
    alt: '',
    src: '/media/art/concept-ui/battle-hall-v01.webp',
    width: 1536,
    height: 1024,
  },
  {
    id: 'environment.archive.interior',
    kind: 'environment',
    status: 'approved',
    requestId: 'ART-ENV-004',
    generationRequestId: conceptUiGenerationRequestId,
    decorative: true,
    alt: '',
    src: '/media/art/concept-ui/archive-v01.webp',
    width: 1536,
    height: 1024,
  },
  ...foundationSigils.map(([discipline, requestId]) => ({
    id: `discipline.foundation.${discipline}-sigil`,
    kind: 'icon' as const,
    status: 'approved' as const,
    requestId,
    decorative: true,
    alt: '',
    src: disciplineSigilArtwork(discipline)!,
    width: 1024,
    height: 1024,
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
