import facePalettes from './appearance-face-palette.json'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppearanceExpression } from './appearance-manifest'
import { portraitFace } from './appearance-face-catalog'
import {
  WARDROBE_EYE_COLORS,
  WARDROBE_HAIR_COLORS,
  WARDROBE_SKIN_TONES,
  type PaintedPlayerLook,
} from './appearance-painted-wardrobe'

type Point = readonly [number, number]
export interface FaceFit {
  eyes: readonly [Point, Point]
  temples: readonly [Point, Point]
  nose: Point
  chin: Point
  top: number
  width: number
  hair: string
  irises: readonly string[]
}
interface Painting {
  poses: Record<AppearanceExpression, string>
  fit: Record<AppearanceExpression, FaceFit>
  field: string
  front: string
}
const paintings = new Map<string, Painting>()
export function facePainting(id?: string) {
  if (!id || !portraitFace(id)?.painted) return null
  let result = paintings.get(id)
  if (!result) {
    const app = existsSync(join(process.cwd(), 'src/appearance/faces'))
      ? process.cwd()
      : join(process.cwd(), 'apps/web')
    result = JSON.parse(
      readFileSync(join(app, 'src/appearance/faces', id + '.json'), 'utf8'),
    ) as Painting
    if (paintings.size >= 24) paintings.delete(paintings.keys().next().value!)
    paintings.set(id, result)
  }
  return result
}

function pigment(name: string, color: readonly number[], denominator: number) {
  const rows = color.map((c) =>
    [(0.24 * c) / denominator, (0.65 * c) / denominator, (0.11 * c) / denominator, 0, 0.012].join(
      ' ',
    ),
  )
  return `<filter id="${name}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${rows.join(' ')} 0 0 0 1 0"/></filter>`
}

export function faceLayers(
  look: PaintedPlayerLook,
  painting: Painting,
  mood: AppearanceExpression,
) {
  const fit = painting.fit[mood]
  const skin = WARDROBE_SKIN_TONES[look.skinTone].rgb
  const hair = WARDROBE_HAIR_COLORS[look.hairDye].rgb
  const eyes = WARDROBE_EYE_COLORS[look.eyeColor].rgb
  const head = '<use href="#registered-head"/>'
  const defs = `<image id="registered-head" href="${painting.poses[mood]}" width="256" height="256"/>
    <clipPath id="face-hair"><polygon points="${fit.hair}"/></clipPath><clipPath id="face-eyes">${fit.irises.map((points) => `<polygon points="${points}"/>`).join('')}</clipPath>
    ${skin ? pigment('face-skin', skin, 145) : ''}${hair ? pigment('face-hair-dye', hair, 72) : ''}${eyes ? pigment('face-eye-dye', eyes, 105) : ''}`
  const colored = skin ? `<g filter="url(#face-skin)">${head}</g>` : head
  const hairLayer =
    skin || hair
      ? `<g clip-path="url(#face-hair)"${hair ? ' filter="url(#face-hair-dye)"' : ''}>${head}</g>`
      : ''
  const eyeLayer =
    skin || eyes
      ? `<g clip-path="url(#face-eyes)"${eyes ? ' filter="url(#face-eye-dye)"' : ''}>${head}</g>`
      : ''
  return { defs, head: colored + hairLayer + eyeLayer, fit }
}

export function naturalFaceSkin(id?: string) {
  return id && Object.hasOwn(facePalettes, id)
    ? facePalettes[id as keyof typeof facePalettes].skin
    : null
}

// Apply the miniature head's material layers in its own registered coordinates.
export function fieldFacePaint(look: PaintedPlayerLook, facing: 'east' | 'south' | 'west') {
  const front = facing === 'south'
  const view = front ? 'front' : 'side'
  const width = front ? 40 : 38
  const head = `<use href="#field-face-${view}"/>`
  const hair = WARDROBE_HAIR_COLORS[look.hairDye].rgb
  const eyes = WARDROBE_EYE_COLORS[look.eyeColor].rgb
  const skin = WARDROBE_SKIN_TONES[look.skinTone].rgb
  if (!hair && !eyes && !skin) return head
  const id = `field-face-paint-${facing}`
  const iris = front ? [12, 28] : [23, 34]
  return `<g><defs><clipPath id="${id}-hair"><path d="M0 0H${width}V16Q${width - 7} 6 15 9Q6 11 0 22Z"/></clipPath>
    <clipPath id="${id}-eyes">${iris.map((x) => `<ellipse cx="${x}" cy="22" rx="1.25" ry="1.05"/>`).join('')}</clipPath>
    ${skin ? pigment(id + '-skin', skin, 145) : ''}${hair ? pigment(id + '-dye', hair, 72) : ''}${eyes ? pigment(id + '-iris', eyes, 105) : ''}</defs>
    ${skin ? `<g filter="url(#${id}-skin)">${head}</g>` : head}
    <g clip-path="url(#${id}-hair)"${hair ? ` filter="url(#${id}-dye)"` : ''}>${head}</g>
    <g clip-path="url(#${id}-eyes)"${eyes ? ` filter="url(#${id}-iris)"` : ''}>${head}</g></g>`
}
