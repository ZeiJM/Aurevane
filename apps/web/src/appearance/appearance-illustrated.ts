import { patternedBackdrop, studioColor } from './appearance-backdrop-catalog'
import {
  fittedCharacterPortrait,
  fittedCharacterSpriteHead,
  fittedSpriteGear,
  fittedSpriteOutfit,
  fittedSpriteSkinPigment,
} from './appearance-fitted-portrait'
import { LANDSCAPE_PAINTINGS } from './appearance-landscape-paintings.generated'
import type {
  AppearanceExpression,
  AppearanceFacing,
  AppearancePose,
  PaintedPlayerAppearanceBlueprint,
} from './appearance-manifest'
import { paintedDyeFilter, paintedPigmentFilter } from './appearance-painted-equipment'
import {
  paintedSpriteRigDefinitions,
  renderPaintedSpriteRig,
} from './appearance-painted-sprite-rig'
import { WARDROBE_FRAMES } from './appearance-painted-wardrobe'
import { PATTERN_PAINTINGS } from './appearance-pattern-paintings.generated'

type Look = PaintedPlayerAppearanceBlueprint

const naturalSpriteFabric = {
  none: [189, 175, 144],
  compass: [69, 98, 98],
  pine: [104, 105, 66],
  hawkmantle: [164, 119, 48],
  shearling: [113, 94, 72],
  scarf: [140, 77, 62],
  brigandine: [113, 108, 72],
  brocade: [104, 69, 84],
  hooded: [74, 82, 100],
  quilted: [154, 86, 56],
} as const satisfies Record<Look['outerwear'], readonly [number, number, number]>

const illustratedSleeves = {
  none: 'armSide',
  compass: 'armFront',
  pine: 'sleeveWool',
  hawkmantle: 'sleeveSeafarer',
  shearling: 'sleeveWool',
  scarf: 'armFront',
  brigandine: 'sleeveWool',
  brocade: 'sleeveWool',
  hooded: 'armFront',
  quilted: 'sleeveWool',
} as const satisfies Record<Look['outerwear'], string>

const key = (id: string) => {
  let value = 0
  for (const letter of id) value = (Math.imul(value, 31) + letter.charCodeAt(0)) >>> 0
  return value
}

const backdropMotifs = {
  waves:
    '<path d="M-16 15Q0-1 16 15T48 15T80 15M-16 24Q0 8 16 24T48 24T80 24M-16 34Q0 18 16 34T48 34T80 34"/>',
  lattice:
    '<path d="M0 24 24 0 48 24 24 48ZM12 24 24 12 36 24 24 36Z"/><circle cx="24" cy="24" r="2"/>',
  stars:
    '<path d="M12 4v16m-8-8h16m18 13v10m-5-5h10M12 12l26 18 12 12m-50-7 12-23"/><circle cx="26" cy="8" r="1"/><circle cx="8" cy="36" r="1"/>',
  leaves:
    '<path d="M24 1v47M24 24Q5 22 9 7 24 10 24 24ZM24 31Q43 27 40 15 24 17 24 31ZM24 43Q8 40 7 28 24 30 24 43Z"/>',
  tiles:
    '<path d="M24 0 48 24 24 48 0 24ZM24 6l6 12 12 6-12 6-6 12-6-12-12-6 12-6Z"/><circle cx="24" cy="24" r="5"/>',
} as const

const studioDecor: Record<
  NonNullable<ReturnType<typeof studioColor>>[0],
  keyof typeof backdropMotifs
> = {
  'Warm Parchment': 'lattice',
  'Midnight Blue': 'stars',
  'Forest Green': 'leaves',
  'Dusky Plum': 'lattice',
  Terracotta: 'tiles',
  'Pearl Grey': 'waves',
  Garnet: 'leaves',
  'Deep Teal': 'waves',
  'Old Gold': 'tiles',
  'Lavender Mist': 'stars',
}

function portraitBackground(id: Look['backdrop']) {
  const painting =
    LANDSCAPE_PAINTINGS[id as keyof typeof LANDSCAPE_PAINTINGS] ??
    PATTERN_PAINTINGS[id as keyof typeof PATTERN_PAINTINGS]
  const pattern = patternedBackdrop(id)
  const studio = studioColor(id === 'original' ? 'parchment' : id)
  const seed = key(id)
  const hues = [
    ['#303854', '#677690', '#b7c9cb'],
    ['#43344f', '#796581', '#d7bebd'],
    ['#28494b', '#637d69', '#d8c69d'],
    ['#583343', '#9b6c61', '#e3b98c'],
    ['#354259', '#697296', '#bdcadc'],
  ] as const
  const [outer, middle, pale] =
    pattern?.slice(1, 4) ?? (studio ? [studio[3], studio[2], studio[1]] : hues[seed % hues.length]!)
  const motif =
    pattern?.[4] ??
    (studio ? studioDecor[studio[0]] : undefined) ??
    (Object.keys(backdropMotifs) as (keyof typeof backdropMotifs)[])[seed % 5]!
  const landscape = !painting && !studio && !pattern && id !== 'original'
  return `<defs>
    <radialGradient id="paper-glow" cx=".48" cy=".42" r=".73"><stop stop-color="${pale}"/><stop offset=".56" stop-color="${middle}"/><stop offset="1" stop-color="${outer}"/></radialGradient>
    <radialGradient id="studio-ornament"><stop offset=".48" stop-color="black"/><stop offset=".69" stop-color="#686868"/><stop offset="1" stop-color="white"/></radialGradient>
    <mask id="studio-corners"><rect width="256" height="256" fill="url(#studio-ornament)"/></mask>
    <pattern id="painted-motif" width="48" height="48" patternUnits="userSpaceOnUse"><g fill="none" stroke="${pale}" stroke-width="1.15">${backdropMotifs[motif]}</g></pattern>
  </defs>
  <rect width="256" height="256" fill="url(#paper-glow)"/>
  ${painting ? `<image href="${painting}" width="256" height="256" opacity=".88"/>` : ''}
  ${landscape ? landscapeBrushwork(id, outer!, middle!, pale!) : ''}
  <rect width="256" height="256" fill="url(#painted-motif)" opacity="${painting ? '.07' : pattern ? '.34' : studio ? '.22' : '.12'}" ${studio ? 'mask="url(#studio-corners)"' : ''}/>
  ${studio ? '' : `<circle cx="128" cy="106" r="83" fill="none" stroke="${pale}" stroke-dasharray="1 5" opacity=".29"/>`}
  <path d="M13 49V15h38m154 0h38v34M13 207v34h38m154 0h38v-34" fill="none" stroke="${pale}" opacity="${studio ? '.34' : '.5'}"/>`
}

function landscapeBrushwork(id: string, dark: string, mid: string, light: string) {
  const seed = key(id)
  const skyline = Array.from({ length: 13 }, (_, i) => {
    const y = 120 + ((seed >>> (i * 2)) % 61) - (i % 3 === 0 ? 42 : 0)
    return `${i * 22 - 4} ${y}`
  }).join(' L')
  const celestial = /astral|nebula|star|lunar|violet|cinder|hourless|moon|shatter/.test(id)
  const civic = /hall|archive|crown|citadel|harbor|arena|gate|cloister|steps|haven/.test(id)
  const landmarks = civic
    ? `<path d="M0 180v-34h16v-16h13v16h11v34h16v-46l13-22 13 22v46h94v-32l12-18 12 18v32h18v-60h20v16h18v44Z" fill="${dark}" opacity=".55"/>`
    : `<path d="M-10 177Q30 142 72 162T157 165T267 146v110H-10Z" fill="${mid}" opacity=".85"/>`
  return `<circle cx="${32 + (seed % 155)}" cy="${26 + (seed % 36)}" r="${celestial ? 24 : 14}" fill="${light}" opacity=".75"/>
  <path d="M${skyline}V256H-4Z" fill="${mid}" opacity=".59"/>${landmarks}
  <path d="M-4 219Q38 196 74 214T155 212T264 181V256H-4Z" fill="${dark}" opacity=".8"/>
  <path d="M6 194Q36 192 65 201m116 1 64-9M12 229l45 1m117 1 71-13" fill="none" stroke="${light}" stroke-width="2" opacity=".28"/>`
}

export function illustratedPortrait(look: Look, expression: AppearanceExpression, icon: boolean) {
  return fittedCharacterPortrait(look, expression, portraitBackground(look.backdrop), icon)
}

export function illustratedSpriteMaterials(look: Look) {
  const gear = fittedSpriteGear(look)
  const fabric =
    look.clothColor === 'natural'
      ? paintedPigmentFilter('rig-fabric', naturalSpriteFabric[look.outerwear])
      : paintedDyeFilter('rig-fabric', look.clothColor)
  return `${paintedSpriteRigDefinitions()}${fabric}${paintedDyeFilter('rig-gear', look.gearColor)}
  ${paintedPigmentFilter('rig-skin', fittedSpriteSkinPigment(look))}
  <image id="rig-worn-outfit" href="${fittedSpriteOutfit(look)}" width="1" height="1" preserveAspectRatio="none"/>
  ${gear ? `<image id="rig-worn-gear" href="${gear.art.href}" width="1" height="1" preserveAspectRatio="none"/>` : ''}`
}

export function illustratedSprite(
  look: Look,
  facing: AppearanceFacing,
  pose: AppearancePose,
  frame: number,
  frames: number,
  headId: string,
) {
  const gear = fittedSpriteGear(look)
  return renderPaintedSpriteRig({
    facing,
    pose,
    frame,
    frames,
    head: `<use href="#${headId}"/>`,
    bodyBuild: WARDROBE_FRAMES[look.bodyFrame].torsoScale,
    cape: look.outerwear === 'pine' || look.outerwear === 'compass' || look.outerwear === 'hooded',
    mantle:
      look.outerwear === 'hawkmantle' ||
      look.outerwear === 'shearling' ||
      look.outerwear === 'scarf',
    satchel: look.gear !== 'none',
    outfit: 'rig-worn-outfit',
    fabricDye: 'rig-fabric',
    outfitDye: look.clothColor === 'natural' ? undefined : 'rig-fabric',
    sleeve: illustratedSleeves[look.outerwear],
    handDye: 'rig-skin',
    gear: gear && {
      id: 'rig-worn-gear',
      placement: gear.placement,
      ratio: gear.art.width / gear.art.height,
    },
    gearDye: look.gearColor === 'natural' ? undefined : 'rig-gear',
  })
}

export function illustratedSpriteHead(look: Look, facing: AppearanceFacing, id: string) {
  return fittedCharacterSpriteHead(look, facing, id)
}
