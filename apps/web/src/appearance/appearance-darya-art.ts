import { poseFeaturedPortrait, type PortraitStance } from './appearance-portrait-poses'
import { DARYA_COILS_PORTRAITS } from './appearance-darya-coils-portraits.generated'
import { DARYA_COILS_SPRITES } from './appearance-darya-coils-sprites.generated'
import { DARYA_LOW_PONY_PORTRAITS } from './appearance-darya-low-pony-portraits.generated'
import { DARYA_LOW_PONY_SPRITES } from './appearance-darya-low-pony-sprites.generated'
import {
  featuredDaryaHairstyle,
  featuredPaintFilter,
  featuredVariantDye,
} from './appearance-featured-variants'
import type {
  AppearanceExpression,
  AppearanceFacing,
  PaintedPlayerAppearanceBlueprint,
} from './appearance-manifest'

type DaryaHairstyle = NonNullable<ReturnType<typeof featuredDaryaHairstyle>>
type DaryaPose = 'idle' | 'left' | 'passing' | 'right' | 'cast'
type DaryaSprite = Readonly<{ href: string; x: number; y: number; width: number; height: number }>
type DaryaSpriteSheet = Record<
  Exclude<AppearanceFacing, 'west'>,
  Record<DaryaPose, DaryaSprite> & { cast: DaryaSprite & { focus: readonly [number, number] } }
>

const portraits: Record<DaryaHairstyle, Record<AppearanceExpression, string>> = {
  coils: DARYA_COILS_PORTRAITS,
  lowpony: DARYA_LOW_PONY_PORTRAITS,
}
const sprites: Record<DaryaHairstyle, DaryaSpriteSheet> = {
  coils: DARYA_COILS_SPRITES,
  lowpony: DARYA_LOW_PONY_SPRITES,
}

export function daryaPaintedPortrait(
  look: PaintedPlayerAppearanceBlueprint,
  mood: AppearanceExpression,
  background: string,
  icon: boolean,
  stance: PortraitStance = 0,
) {
  const hairstyle = featuredDaryaHairstyle(look)
  if (!hairstyle) return undefined
  const size = icon ? 64 : 256
  const viewBox = icon ? '56 28 144 144' : '0 0 256 256'
  const dye = featuredVariantDye(look)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">
    ${background}${dye ? featuredPaintFilter('featured-portrait', dye) : ''}
    ${poseFeaturedPortrait(`<image href="${portraits[hairstyle][mood]}" width="256" height="256"${dye ? ' filter="url(#featured-portrait)"' : ''}/>`, stance)}
  </svg>`
}

export function daryaSpriteMaterials(hairstyle: DaryaHairstyle) {
  return `<defs>${Object.entries(sprites[hairstyle])
    .flatMap(([facing, poses]) =>
      Object.entries(poses).map(
        ([pose, { href, x, y, width, height }]) =>
          `<image id="darya-${facing}-${pose}" href="${href}" x="${x}" y="${y}" width="${width}" height="${height}"/>`,
      ),
    )
    .join('')}</defs>`
}

export function daryaSpriteArt(facing: AppearanceFacing, pose: DaryaPose) {
  const frame = `<use href="#darya-${facing === 'west' ? 'east' : facing}-${pose}"/>`
  return facing === 'west' ? `<g transform="translate(48 0) scale(-1 1)">${frame}</g>` : frame
}

export function daryaCastLight(hairstyle: DaryaHairstyle, facing: AppearanceFacing, frame: number) {
  const [handX, handY] = sprites[hairstyle][facing === 'west' ? 'east' : facing].cast.focus
  const x = Math.max(4, Math.min(44, facing === 'west' ? 48 - handX : handX))
  const y = Math.max(5, handY - 5)
  const scale = frame === 1 ? 0.82 : 1
  return `<g transform="translate(${x} ${y}) scale(${scale})" class="darya-compass-light">
    <circle r="4" fill="#efb958" opacity=".22"/><circle r="2.7" fill="none" stroke="#efc273" stroke-width=".6"/>
    <path d="M0 -4L.78 -.75 3.5 0 .78 .75 0 4 -.78 .75 -3.5 0 -.78 -.75Z" fill="#fff1bd"/>
  </g>`
}
