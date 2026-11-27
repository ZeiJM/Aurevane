import { poseFeaturedPortrait, type PortraitStance } from './appearance-portrait-poses'
import { PAINTED_STUDY_YUNA_ACTIONS } from './appearance-painted-study-yuna-actions.generated'
import { PAINTED_STUDY_YUNA_PORTRAITS } from './appearance-painted-study-yuna-portraits.generated'
import { PAINTED_STUDY_YUNA_SPRITES } from './appearance-painted-study-yuna-sprites.generated'
import { PAINTED_STUDY_YSARA_ACTIONS } from './appearance-painted-study-ysara-actions.generated'
import { PAINTED_STUDY_YSARA_PORTRAITS } from './appearance-painted-study-ysara-portraits.generated'
import { PAINTED_STUDY_YSARA_SPRITES } from './appearance-painted-study-ysara-sprites.generated'
import { PAINTED_STUDY_NALIA_ACTIONS } from './appearance-painted-study-nalia-actions.generated'
import { PAINTED_STUDY_NALIA_PORTRAITS } from './appearance-painted-study-nalia-portraits.generated'
import { PAINTED_STUDY_NALIA_SPRITES } from './appearance-painted-study-nalia-sprites.generated'
import { PAINTED_STUDY_AREN_ACTIONS } from './appearance-painted-study-aren-actions.generated'
import { PAINTED_STUDY_AREN_PORTRAITS } from './appearance-painted-study-aren-portraits.generated'
import { PAINTED_STUDY_AREN_SPRITES } from './appearance-painted-study-aren-sprites.generated'
import { PAINTED_STUDY_KIERAN_ACTIONS } from './appearance-painted-study-kieran-actions.generated'
import { PAINTED_STUDY_KIERAN_PORTRAITS } from './appearance-painted-study-kieran-portraits.generated'
import { PAINTED_STUDY_KIERAN_SPRITES } from './appearance-painted-study-kieran-sprites.generated'
import { PAINTED_STUDY_ALDEN_ACTIONS } from './appearance-painted-study-alden-actions.generated'
import { PAINTED_STUDY_ALDEN_PORTRAITS } from './appearance-painted-study-alden-portraits.generated'
import { PAINTED_STUDY_ALDEN_SPRITES } from './appearance-painted-study-alden-sprites.generated'
import { PAINTED_STUDY_CASSIAN_ACTIONS } from './appearance-painted-study-cassian-actions.generated'
import { PAINTED_STUDY_ASTA_ACTIONS } from './appearance-painted-study-asta-actions.generated'
import { PAINTED_STUDY_ASTA_PORTRAITS } from './appearance-painted-study-asta-portraits.generated'
import { PAINTED_STUDY_ASTA_SPRITES } from './appearance-painted-study-asta-sprites.generated'
import { PAINTED_STUDY_CASSIAN_PORTRAITS } from './appearance-painted-study-cassian-portraits.generated'
import { PAINTED_STUDY_CASSIAN_SPRITES } from './appearance-painted-study-cassian-sprites.generated'
import { paintedDyeFilter } from './appearance-painted-equipment'
import {
  featuredPaintFilter,
  featuredStudy,
  featuredVariantDye,
} from './appearance-featured-variants'
import type {
  AppearanceExpression,
  AppearanceFacing,
  PaintedPlayerAppearanceBlueprint,
} from './appearance-manifest'

type Study = NonNullable<ReturnType<typeof featuredStudy>>
type WalkPose = 'idle' | 'left' | 'passing' | 'right'
type ActionPose = 'brace' | 'attack' | 'cast'
type Painting = Readonly<{ href: string; fabric?: string }>
type Frame = Painting & Readonly<{ x: number; y: number; width: number; height: number }>
type Cloth = PaintedPlayerAppearanceBlueprint['clothColor']
type Directions<Pose extends string> = Record<
  Exclude<AppearanceFacing, 'west'>,
  Record<Pose, Frame>
>

const artwork: Record<
  Study,
  {
    portraits: Record<AppearanceExpression, string | Painting>
    sprites: Directions<WalkPose>
    actions: Directions<ActionPose> &
      Record<'south' | 'east' | 'north', { cast: Frame & { focus: readonly [number, number] } }>
  }
> = {
  asta: {
    portraits: PAINTED_STUDY_ASTA_PORTRAITS,
    sprites: PAINTED_STUDY_ASTA_SPRITES,
    actions: PAINTED_STUDY_ASTA_ACTIONS,
  },
  cassian: {
    portraits: PAINTED_STUDY_CASSIAN_PORTRAITS,
    sprites: PAINTED_STUDY_CASSIAN_SPRITES,
    actions: PAINTED_STUDY_CASSIAN_ACTIONS,
  },
  yuna: {
    portraits: PAINTED_STUDY_YUNA_PORTRAITS,
    sprites: PAINTED_STUDY_YUNA_SPRITES,
    actions: PAINTED_STUDY_YUNA_ACTIONS,
  },
  ysara: {
    portraits: PAINTED_STUDY_YSARA_PORTRAITS,
    sprites: PAINTED_STUDY_YSARA_SPRITES,
    actions: PAINTED_STUDY_YSARA_ACTIONS,
  },
  nalia: {
    portraits: PAINTED_STUDY_NALIA_PORTRAITS,
    sprites: PAINTED_STUDY_NALIA_SPRITES,
    actions: PAINTED_STUDY_NALIA_ACTIONS,
  },
  aren: {
    portraits: PAINTED_STUDY_AREN_PORTRAITS,
    sprites: PAINTED_STUDY_AREN_SPRITES,
    actions: PAINTED_STUDY_AREN_ACTIONS,
  },
  kieran: {
    portraits: PAINTED_STUDY_KIERAN_PORTRAITS,
    sprites: PAINTED_STUDY_KIERAN_SPRITES,
    actions: PAINTED_STUDY_KIERAN_ACTIONS,
  },
  alden: {
    portraits: PAINTED_STUDY_ALDEN_PORTRAITS,
    sprites: PAINTED_STUDY_ALDEN_SPRITES,
    actions: PAINTED_STUDY_ALDEN_ACTIONS,
  },
} as const

function studyPainting(id: string, frame: Frame, fabricDye: boolean) {
  const { href, fabric, x, y, width, height } = frame
  const box = `x="${x}" y="${y}" width="${width}" height="${height}"`
  if (!fabricDye || !fabric) return `<image id="${id}" href="${href}" ${box}/>`
  return `<defs>
    <image id="${id}-source" href="${href}" ${box}/>
    <mask id="${id}-fabric" mask-type="alpha" maskUnits="userSpaceOnUse" ${box}>
      <image href="${fabric}" ${box}/>
    </mask>
  </defs><g id="${id}">
    <use href="#${id}-source"/>
    <g mask="url(#${id}-fabric)"><use href="#${id}-source" filter="url(#study-fabric-dye)"/></g>
  </g>`
}

export function studyPortrait(
  look: PaintedPlayerAppearanceBlueprint,
  mood: AppearanceExpression,
  backdrop: string,
  icon: boolean,
  stance: PortraitStance = 0,
) {
  const study = featuredStudy(look)
  if (!study) return undefined
  const size = icon ? 64 : 256
  const viewBox = icon ? '56 28 144 144' : '0 0 256 256'
  const portrait = artwork[study].portraits[mood]
  const painting = typeof portrait === 'string' ? { href: portrait } : portrait
  const frame = { ...painting, x: 0, y: 0, width: 256, height: 256 }
  const tinted = look.clothColor !== 'natural' && Boolean(painting.fabric)
  const dye = tinted ? undefined : featuredVariantDye(look)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">
    ${backdrop}
    <defs>${tinted ? paintedDyeFilter('study-fabric-dye', look.clothColor) : ''}${studyPainting('study-portrait', frame, tinted)}</defs>
    ${dye ? featuredPaintFilter('featured-portrait', dye) : ''}
    ${poseFeaturedPortrait(`<use href="#study-portrait"${dye ? ' filter="url(#featured-portrait)"' : ''}/>`, stance)}
  </svg>`
}

export function studySpriteMaterials(study: Study, cloth: Cloth) {
  const { sprites, actions } = artwork[study]
  const tinted = cloth !== 'natural'
  return `<defs>${tinted ? paintedDyeFilter('study-fabric-dye', cloth) : ''}${[
    ...Object.entries(sprites),
    ...Object.entries(actions),
  ]
    .flatMap(([facing, poses]) =>
      Object.entries(poses).map(([pose, frame]) =>
        studyPainting(`study-${facing}-${pose}`, frame, tinted),
      ),
    )
    .join('')}</defs>`
}

export function studySpriteArt(facing: AppearanceFacing, pose: WalkPose | ActionPose) {
  const frame = `<use href="#study-${facing === 'west' ? 'east' : facing}-${pose}"/>`
  return facing === 'west' ? `<g transform="translate(48 0) scale(-1 1)">${frame}</g>` : frame
}

export function studyCastGlow(study: Study, facing: AppearanceFacing, frame: number) {
  const profile = facing === 'west' ? 'east' : facing
  const [x, y] = artwork[study].actions[profile].cast.focus
  const glowX = Math.min(44, Math.max(4, facing === 'west' ? 48 - x : x))
  const glowY = Math.min(53, Math.max(5, y - 3))
  const scale = frame === 1 ? 0.76 : 1
  return `<g transform="translate(${glowX} ${glowY}) scale(${scale})">
    <circle r="4" fill="#efb958" opacity=".24"/>
    <path d="M0 -3.4 .82 -.83 3.4 0 .82 .83 0 3.4 -.82 .83 -3.4 0 -.82 -.83Z" fill="#fff1bd"/>
  </g>`
}
