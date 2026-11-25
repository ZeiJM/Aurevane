import { CHARACTER_PAINT } from './appearance-character-materials.generated'
import { patternedBackdrop, studioColor } from './appearance-backdrop-catalog'
import { LANDSCAPE_PAINTINGS } from './appearance-landscape-paintings.generated'
import { GARMENT_PAINTINGS } from './appearance-garment-paintings.generated'
import { PATTERN_PAINTINGS } from './appearance-pattern-paintings.generated'
import { portraitFace } from './appearance-face-catalog'
import type {
  AppearanceExpression,
  AppearanceFacing,
  AppearancePose,
  PaintedPlayerAppearanceBlueprint,
} from './appearance-manifest'
import {
  PLAYER_HAIRSTYLES,
  WARDROBE_DYES,
  WARDROBE_EYE_COLORS,
  WARDROBE_FRAMES,
  WARDROBE_HAIR_COLORS,
  WARDROBE_SKIN_TONES,
} from './appearance-painted-wardrobe'
import facePalettes from './appearance-face-palette.json'

type Look = PaintedPlayerAppearanceBlueprint
type RGB = readonly [number, number, number]
const ink = '#292338'
const metal = '#eac78a'
const hairFamilies = [
  'natural',
  'feather',
  'quiff',
  'curls',
  'crown',
  'layers',
  'bun',
  'topknot',
  'pony',
  'braid',
  'twins',
  'waves',
] as const
const hairStyles = Object.keys(PLAYER_HAIRSTYLES)
const inkStroke = `stroke="${ink}" stroke-linejoin="round" stroke-linecap="round"`
const channel = (value: number) => Math.round(Math.max(0, Math.min(255, value)))
const shade = (color: RGB, strength = 1, lift = 0) =>
  `rgb(${color.map((value, index) => channel(value * strength + lift + (index === 2 && strength < 1 ? 9 : 0))).join(',')})`
const key = (id: string) => {
  let value = 0
  for (const letter of id) value = (Math.imul(value, 31) + letter.charCodeAt(0)) >>> 0
  return value
}

function colorOptions(look: Look) {
  const original = look.faceId?.replace(/(?:soft|keen)$/, '')
  const face = original ? facePalettes[original as keyof typeof facePalettes] : undefined
  const complexion =
    WARDROBE_SKIN_TONES[look.skinTone].rgb ??
    face?.skin ??
    WARDROBE_SKIN_TONES[
      look.identity === 'guard' ? 'copper' : look.identity === 'ranger' ? 'bronze' : 'peach'
    ].rgb
  const hair =
    WARDROBE_HAIR_COLORS[look.hairDye].rgb ??
    face?.hair ??
    WARDROBE_HAIR_COLORS[
      look.identity === 'elder' ? 'silver' : look.identity === 'pinescout' ? 'copper' : 'espresso'
    ].rgb
  const eyes =
    WARDROBE_EYE_COLORS[look.eyeColor].rgb ??
    WARDROBE_EYE_COLORS[look.identity === 'scout' ? 'gray' : 'hazel'].rgb
  const cloth =
    WARDROBE_DYES[look.clothColor].rgb ??
    WARDROBE_DYES[
      look.identity === 'pinescout' ? 'cedar' : look.identity === 'guard' ? 'midnight' : 'oxblood'
    ].rgb
  return {
    complexion: complexion as RGB,
    hair: hair as RGB,
    eyes,
    cloth,
    gear: WARDROBE_DYES[look.gearColor].rgb ?? WARDROBE_DYES.leather.rgb,
    head: WARDROBE_DYES[look.headColor].rgb ?? WARDROBE_DYES.midnight.rgb,
    face: WARDROBE_DYES[look.faceColor].rgb ?? WARDROBE_DYES.walnut.rgb,
  }
}

function faceGeometry(look: Look) {
  const face = portraitFace(look.faceId)
  const feminine = look.identity === 'pinescout' || look.identity === 'ranger'
  const seed = key(look.faceId?.replace(/(?:soft|keen)$/, '') ?? look.identity)
  const soft = face?.shape === 1
  const keen = face?.shape === 2
  const youth = look.apparentAge === 'youthful'
  const elder = look.apparentAge === 'elder'
  const older = elder || look.apparentAge === 'mature'
  return {
    cheeks:
      (feminine ? 44 : 48) +
      (seed % 10) +
      (soft ? 4 : keen ? -4 : 0) +
      (youth ? 2 : elder ? -3 : 0),
    jaw:
      (feminine ? 19 : 27) +
      ((seed >>> 5) % 8) +
      (soft ? 5 : keen ? -6 : 0) +
      (youth ? -3 : older ? 2 : 0),
    chin: 159 + ((seed >>> 9) % 6) + (soft ? -3 : keen ? 5 : 0) + (youth ? -7 : elder ? 3 : 0),
    eyeGap: 21 + ((seed >>> 12) % 7) + (soft ? 2 : 0),
    eyeWidth: 14 + ((seed >>> 15) % 5),
    arch:
      (feminine ? 8 : 6) +
      ((seed >>> 19) % 4) +
      (soft ? 3 : keen ? -2 : 0) +
      (youth ? 2 : older ? -1 : 0),
    mouth: 13 + ((seed >>> 2) % 7),
    nose: 5 + ((seed >>> 4) % 4),
    seed,
    feminine,
  }
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
    PATTERN_PAINTINGS[id as keyof typeof PATTERN_PAINTINGS] ??
    LANDSCAPE_PAINTINGS[id as keyof typeof LANDSCAPE_PAINTINGS]
  const pattern = patternedBackdrop(id)
  const studio = studioColor(id)
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
  <rect width="256" height="256" fill="url(#painted-motif)" opacity="${pattern ? (painting ? '.07' : '.34') : studio ? '.34' : '.12'}" ${studio ? 'mask="url(#studio-corners)"' : ''}/>
  <circle cx="128" cy="106" r="77" fill="none" stroke="${pale}" opacity=".37"/>
  <circle cx="128" cy="106" r="83" fill="none" stroke="${pale}" stroke-dasharray="1 5" opacity=".39"/>
  <path d="M13 49V15h38m154 0h38v34M13 207v34h38m154 0h38v-34" fill="none" stroke="${pale}" opacity=".57"/>`
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

function hairArt(look: Look, color: RGB, cheeks: number, facing: AppearanceFacing) {
  const styleIndex = hairStyles.indexOf(look.hairstyle)
  const familyIndex = styleIndex < 12 ? styleIndex : Math.floor((styleIndex - 12) / 3)
  const variation = styleIndex < 12 ? 0 : ((styleIndex - 12) % 3) + 1
  const family = hairFamilies[familyIndex]!
  const left = 128 - cheeks - 6
  const right = 128 + cheeks + 6
  const crown = 44 - variation * (family === 'quiff' || family === 'topknot' ? 7 : 2)
  const accent = look.hairAccent && WARDROBE_HAIR_COLORS[look.hairAccent].rgb
  const dual = accent && look.hairAccent !== look.hairDye
  const id = 'hair-pigment-' + facing
  const placement = look.hairPlacement ?? 'streak'
  const paint = dual && placement !== 'underlight' ? `url(#${id})` : shade(color)
  const lightPaint =
    dual && placement !== 'underlight' ? `url(#${id}-light)` : shade(color, 0.75, 47)
  const backPaint = dual ? `url(#${id})` : shade(color, 0.63)
  const stops =
    placement === 'tips'
      ? [0, 0.68, 0.96]
      : placement === 'underlight'
        ? [0, 0.47, 0.83]
        : placement === 'split'
          ? [0.48, 0.51, 0.53]
          : [0.56, 0.63, 0.72]
  const orientation =
    placement === 'tips' || placement === 'underlight' ? 'x2="0%" y2="100%"' : 'x2="100%" y2="0%"'
  const gradient = (suffix: string, base: string, second: string) =>
    `<linearGradient id="${id}${suffix}" ${orientation}><stop offset="${stops[0]}" stop-color="${base}"/><stop offset="${stops[1]}" stop-color="${base}"/><stop offset="${stops[2]}" stop-color="${second}"/><stop offset="1" stop-color="${placement === 'streak' ? base : second}"/></linearGradient>`
  const defs = dual
    ? `<defs>${gradient('', shade(color), shade(accent))}${gradient('-light', shade(color, 0.75, 47), shade(accent, 0.88, 40))}</defs>`
    : ''
  const shadow = shade(color, 0.63)
  const base = paint
  const gleam = lightPaint
  const curls = family === 'curls'
  const braided = family === 'braid' || family === 'twins' || family === 'crown'
  const long = family === 'waves' || family === 'layers' || (family === 'curls' && variation === 2)
  const tied = family === 'pony' || family === 'bun' || family === 'topknot'
  const tip = 147 + variation * 13 + (family === 'waves' ? 28 : 0)
  const side = variation === 3 ? -1 : 1
  const tailX = 128 + side * (cheeks - (family === 'topknot' ? 44 : 10))
  const tailY =
    family === 'topknot' ? crown - 3 : family === 'bun' ? 110 : 77 + (variation === 2 ? 34 : 0)
  const longBack = long
    ? `<path d="M${left + 13} 72Q${left - 18} 100 ${left - 8} 139T${left - 18} ${tip}Q${left + 15} ${tip - 5} 112 151h34q23 34 60 ${tip - 151}Q${right + 4} 164 ${right + 10} 140T${right - 8} 72Z" fill="${backPaint}" ${inkStroke} stroke-width="2.5"/>`
    : ''
  const backTail = tied
    ? `<path d="M${tailX - 9} ${tailY + 13}c-15-3-16-23-2-28 13-7 22 2 23 15q${side * 24} 21 ${side * (family === 'pony' ? 20 : 7)} ${family === 'pony' ? 50 + variation * 6 : 14}q${-side * 17}-3 ${-side * 21}-23Z" fill="${backPaint}" ${inkStroke} stroke-width="2.5"/>`
    : ''
  const braids = braided
    ? (family === 'twins' ? [-1, 1] : [side])
        .map((x) =>
          Array.from({ length: family === 'crown' ? 6 : 5 + variation }, (_, i) => {
            const bx = family === 'crown' ? 92 + i * 14 : 128 + x * (cheeks - 2 + i * 0.58)
            const by = family === 'crown' ? 48 + Math.abs(i - 3) * 2.7 : 119 + i * 12
            return `<ellipse cx="${bx}" cy="${by}" rx="${13 - i * 0.75}" ry="8.4" transform="rotate(${i % 2 ? 22 : -22} ${bx} ${by})" fill="${i % 2 ? base : gleam}" ${inkStroke} stroke-width="1.7"/>`
          }).join(''),
        )
        .join('')
    : ''
  const volume =
    family === 'natural' ? 3 + variation * 3 : family === 'quiff' ? 20 + variation * 5 : 11
  const fringe =
    family === 'quiff' || family === 'crown' || tied
      ? `Q${right - 20} 76 161 73Q118 ${57 + variation * 3} ${left + 8} 102`
      : styleIndex === 17
        ? `Q${right - 10} 84 167 78l-10 15-14-10-14 9-9-12-18 19-12-13-10 15`
        : family === 'feather' || family === 'layers'
          ? `Q${right - 9} 84 154 ${73 + variation * 4}l8 12q-24-1-48-20-6 16-35 34`
          : `Q${right - 9} 87 158 77q-23 ${variation % 2 ? 12 : -8} -40 -3Q96 98 ${left + 8} 102`
  const lift = family === 'feather' && variation === 3 ? -8 : 0
  const headShade = `<path d="M${left + 1} 89Q96 ${crown - volume + 20} 120 ${crown - volume + 10}q-6 22-19 34t-23 29Z" fill="${shadow}" opacity=".62"/>`
  const hairShape = `M${left} 109Q${left - 9} ${crown + 9} 98 ${crown - volume + lift}Q128 ${crown - volume - 13 + lift} 156 ${crown - volume + 2}Q${right + 14} ${crown + 10} ${right} 114l-10-20 ${fringe}l-4 17Z`
  const front = `<path d="${hairShape}" fill="${base}" ${inkStroke} stroke-width="3"/>
    ${
      facing === 'south'
        ? `<defs><clipPath id="hair-material"><path d="${hairShape}"/></clipPath></defs>
    <image href="${CHARACTER_PAINT.hair}" x="${left - 3}" y="${Math.max(0, crown - volume - 6)}" width="${right - left + 6}" height="112" preserveAspectRatio="none" clip-path="url(#hair-material)" opacity=".35" style="mix-blend-mode: soft-light"/>`
        : ''
    }
    ${headShade}
    ${dual && placement === 'underlight' ? `<path d="M${left + 7} 88q4 15 2 24l11-11 2-15Zm${right - left - 18} 7 5 14 7-2-4-15Z" fill="${shade(accent, 0.78, 28)}"/>` : ''}
    <path d="M${left + 8} 80Q91 ${crown - volume + 14} 132 ${crown - volume + 3}q26 1 44 18-24-9-52-4t-48 23Z" fill="${gleam}" opacity=".84"/>
    <path d="M${left + 16} 68Q100 ${crown - volume + 7} 125 ${crown - volume + 6}m15 0q21 1 35 12" fill="none" stroke="${shade(color, 0.87, 68)}" stroke-width="2" opacity=".75"/>
    ${
      curls
        ? Array.from({ length: 8 + variation }, (_, i) => {
            const x = left + 9 + (i % 7) * ((cheeks * 1.75) / 6)
            const y = 54 + Math.abs((i % 7) - 3) * 5 + (i > 6 ? 16 : 0)
            return `<path d="M${x - 7} ${y + 9}q-8-12 4-17 15-5 17 5 1 9-11 10 7-6 2-9-6-3-10 4Z" fill="${gleam}" stroke="${shadow}" stroke-width="1.4"/>`
          }).join('')
        : ''
    }
    ${family === 'crown' ? braids : ''}
    ${family === 'braid' ? braids : ''}`
  return { defs, back: defs + longBack + backTail + (family === 'twins' ? braids : ''), front }
}

function beardArt(style: Look['facialHair'], color: RGB, chin: number) {
  const dark = shade(color, 0.78)
  const light = shade(color, 0.8, 26)
  const mustache = `<path d="M109 139q11-10 19-4 8-6 19 4-11 5-19-1-8 6-19 1Z" fill="${dark}"/>`
  switch (style) {
    case 'stubble':
      return `<path d="M98 132q10 17 30 19 20-2 30-19-4 22-30 27-26-5-30-27Z" fill="${dark}" opacity=".44"/>`
    case 'moustache':
      return mustache
    case 'goatee':
      return `<path d="M116 151q12 5 24 0l-5 10-7 7-8-7Z" fill="${dark}"/>`
    case 'anchor':
      return (
        mustache +
        `<path d="M102 147q15 8 23 7l3-8 3 8q9 1 23-7-8 17-26 19-18-2-26-19Z" fill="${dark}"/>`
      )
    case 'boxed':
    case 'full':
    case 'braided': {
      const bottom = chin + (style === 'boxed' ? 4 : 17)
      return `<path d="M96 127q8 16 18 18 14-5 28 0 10-2 18-18 0 26-18 ${bottom - 146}l-14 6-14-6q-18-12-18-39Z" fill="${dark}" stroke="${ink}" stroke-width="1.8"/>${mustache}
        <path d="M104 145q8 12 21 13m27-13q-8 12-21 13" stroke="${light}" fill="none" stroke-width="2.5"/>
        ${style === 'braided' ? `<path d="M123 ${bottom}q-6 14 5 22 11-8 5-22Z" fill="${dark}" stroke="${metal}" stroke-width="2"/>` : ''}`
    }
    default:
      return ''
  }
}

function headwearArt(
  style: Look['headwear'],
  color: RGB,
  cheeks: number,
  facing: AppearanceFacing,
) {
  const base = shade(color)
  const dark = shade(color, 0.57)
  const light = shade(color, 0.83, 50)
  const width = cheeks + (facing === 'east' || facing === 'west' ? 4 : 10)
  const band = `M${128 - width} 64Q128 40 ${128 + width} 64l-4 13Q128 54 ${132 - width} 77Z`
  switch (style) {
    case 'none':
      return ''
    case 'arcanist':
      return `<path d="M88 64 107 23Q125 2 164 17l-18 16 18 29Z" fill="${base}" ${inkStroke} stroke-width="3"/>
      <path d="M98 58q9-39 55-41-24 7-38 43Z" fill="${light}"/>
      <path d="M91 61q38 5 71-9l6 9q-45 15-82 12Z" fill="${dark}" stroke="${metal}" stroke-width="2"/>
      <path d="M61 72q24-13 63-11 41-11 73-1-14 19-66 24-48 4-70-12Z" fill="${base}" ${inkStroke} stroke-width="3"/>
      <path d="M72 73q54 8 109-12" stroke="${light}" stroke-width="2.4" fill="none"/>`
    case 'furcap':
      return `<path d="M${128 - width} 71Q${132 - width} 14 125 24q44-14 ${3 + width} 45Z" fill="${base}" ${inkStroke} stroke-width="3"/>
      <path d="${band}" fill="${light}" ${inkStroke} stroke-width="2.8"/>
      <path d="M96 52q16-25 43-21m-29 36 9-4m11 2 8-3m10 4 9-2" fill="none" stroke="${light}" stroke-width="2"/>`
    case 'bandana':
      return `<path d="${band}" fill="${base}" ${inkStroke} stroke-width="2.4"/><path d="M92 65q36-12 71 0" stroke="${light}" fill="none" stroke-width="2"/>`
    case 'circlet':
      return `<path d="M${135 - width} 75Q112 69 128 84Q142 69 ${121 + width} 72" fill="none" stroke="${dark}" stroke-width="6"/>
      <path d="M${135 - width} 74Q111 69 128 83Q142 69 ${121 + width} 72m-52 2q9-10 18 0m19 0q10-10 18-2" fill="none" stroke="${light}" stroke-width="3"/>
      <path d="m128 76 6 7-6 8-6-8Z" fill="${metal}" stroke="${dark}" stroke-width="1.5"/>`
  }
}

function facewearArt(
  style: Look['facewear'],
  color: RGB,
  eyes: number,
  width: number,
  cheeks: number,
  facing: AppearanceFacing,
) {
  const base = shade(color)
  const dark = shade(color, 0.61)
  const light = shade(color, 0.8, 55)
  if (facing === 'east' || facing === 'west') {
    const strap = `<path d="M99 103q17-4 37 1" fill="none" stroke="${dark}" stroke-width="4"/>`
    if (style === 'eyepatch' && facing === 'east') return strap
    if (style === 'eyepatch')
      return `${strap}<path d="M135 99q17-8 32 0l-4 14q-15 8-25-1Z" fill="${base}" ${inkStroke} stroke-width="2"/>`
    if (style === 'goggles')
      return `${strap}<ellipse cx="151" cy="103" rx="${width + 1}" ry="12" fill="#a3d6d0" fill-opacity=".32" stroke="${dark}" stroke-width="4"/><path d="m144 107 9-9" stroke="${light}" stroke-width="2"/>`
    if (style === 'mask')
      return `<path d="M104 112q28 2 51-6l18 12-14 17-20-5-24-8Z" fill="${base}" ${inkStroke} stroke-width="2.5"/><path d="m121 117 31 1" stroke="${light}" stroke-width="2"/>`
    if (style === 'veil')
      return `<path d="M104 108q29 14 67 10l2 18-15 22q-27-6-44-24Z" fill="${base}" ${inkStroke} stroke-width="2.5"/><path d="M118 122q22 18 47 11m-32 4 16 8" stroke="${light}" stroke-width="2" fill="none"/>`
  }
  switch (style) {
    case 'none':
      return ''
    case 'eyepatch': {
      const x = 128 - eyes
      return `<path d="M${130 - cheeks} 91Q128 100 ${126 + cheeks} 110" fill="none" stroke="${dark}" stroke-width="3"/>
      <path d="M${x - 18} 99q18-9 37 0l-7 19q-10 10-21 1Z" fill="${base}" ${inkStroke} stroke-width="2"/>
      <path d="M${x - 13} 101q12-5 24-2" fill="none" stroke="${light}" stroke-width="1.7"/>`
    }
    case 'goggles':
      return `<path d="M${130 - cheeks} 102q${cheeks} 12 ${2 * cheeks - 4} 0" fill="none" stroke="${dark}" stroke-width="6"/>
      ${[-1, 1]
        .map((side) => {
          const x = 128 + side * eyes
          return `<ellipse cx="${x}" cy="105" rx="${width + 3}" ry="14" fill="#a3d6d0" fill-opacity=".32" stroke="${dark}" stroke-width="4"/>
          <path d="m${x - 8} 109 11-11m-3 12 9-9" stroke="${light}" stroke-width="1.8" opacity=".66"/>`
        })
        .join('')}`
    case 'mask':
      return `<path d="M${131 - cheeks} 111q20 4 25-8l${2 * cheeks - 56} 0q9 12 25 8l-12 18q-15 4-29-6-14 10-29 6Z" fill="${base}" ${inkStroke} stroke-width="2.5"/>
      <path d="M100 119q12 1 20-4m16 0q9 5 21 4" stroke="${light}" stroke-width="2" fill="none"/>`
    case 'veil':
      return `<path d="M${131 - cheeks} 113Q105 125 128 116Q151 125 ${125 + cheeks} 113l-12 42q-32 22-64 0Z" fill="${base}" ${inkStroke} stroke-width="2.5"/>
      <path d="M${134 - cheeks} 120Q107 131 128 123Q150 133 ${122 + cheeks} 120M96 147q32 14 64-1" stroke="${light}" stroke-width="2" fill="none"/>
      <path d="m128 135 6 6-6 6-6-6Z" fill="${metal}"/>`
  }
}

const scarStrokes: NonNullable<Partial<Record<NonNullable<Look['scar']>, string>>> = {
  cross: 'M151 116l13 15m-1-16-13 17',
  cheek: 'M151 114q2 9 14 17',
  brow: 'M92 81l14 18',
  bridge: 'M116 114q12 3 25-4',
  jaw: 'M87 133q9 3 16 13',
}

function faceScar(scar: Look['scar'], skin: RGB, facing: AppearanceFacing) {
  const line = scar && scarStrokes[scar]
  if (!line || facing === 'north' || (scar === 'cross' && facing === 'west')) return ''
  const profile = facing === 'east' || facing === 'west'
  return `<g ${profile ? 'transform="translate(-4 0)"' : ''} fill="none" stroke-linecap="round"><path d="${line}" stroke="${shade(skin, 0.69)}" stroke-width="3.1"/><path d="${line}" transform="translate(.6 .9)" stroke="${shade(skin, 0.91, 47)}" stroke-width="1.2"/></g>`
}

function ageMarks(age: Look['apparentAge'], pigment: RGB, facing: AppearanceFacing) {
  if (age !== 'mature' && age !== 'elder') return ''
  const elder = age === 'elder'
  const profile = facing === 'east' || facing === 'west'
  const ageLines = profile
    ? 'M145 115q7 3 14-1m-8 14q-5 5-6 11'
    : 'M89 112q10 5 20 3m38 0q10 2 20-3M111 125q-6 7-6 13m46-13q6 7 6 13'
  const deepLines = profile
    ? 'M140 89q10-4 20-1m-18 29q8 4 13 2m-36 4 7 6'
    : 'M104 80q24-6 48 0m-39 6q15-3 30 0m-55 29q9 6 15 5m48 0q6 0 15-5m-55 28q16 7 33 0'
  return `<g data-age-lines="${age}" fill="none" stroke-linecap="round">
    <path d="${ageLines}" stroke="${shade(pigment, 0.67)}" opacity=".59" stroke-width="${elder ? 2.3 : 1.5}"/>
    ${
      elder
        ? `<path d="${deepLines}" stroke="${shade(pigment, 0.63)}" stroke-width="1.6" opacity=".64"/>
      <path d="${ageLines}" transform="translate(0 .8)" stroke="${shade(pigment, 0.86, 46)}" stroke-width=".8" opacity=".62"/>`
        : ''
    }
  </g>`
}

function portraitHead(look: Look, mood: AppearanceExpression, facing: AppearanceFacing = 'south') {
  const { complexion, hair, head, face, eyes } = colorOptions(look)
  const { cheeks, jaw, chin, eyeGap, eyeWidth, arch, mouth, nose, seed, feminine } =
    faceGeometry(look)
  const skin = shade(complexion)
  const skinLight = shade(complexion, 0.9, 31)
  const skinShadow = shade(complexion, 0.76)
  const blush = shade(complexion, 0.81, 15)
  const hairParts = hairArt(look, hair, cheeks, facing)
  const profile = facing === 'east' || facing === 'west'
  const back = facing === 'north'
  const left = 128 - cheeks
  const right = 128 + cheeks
  const headShape = `M${left} 85Q${left + 3} 53 128 52Q${right - 3} 55 ${right} 85L${right - 3} 118Q${right - 9} 141 ${128 + jaw} 147Q146 ${chin - 2} 128 ${chin}Q110 ${chin - 2} ${128 - jaw} 147Q${left + 8} 141 ${left + 3} 118Z`
  const faceProfile = `M${left + 8} 74Q115 45 150 59q17 10 19 45l12 12-12 8 1 11q-5 20-24 23-11 3-32-10-28-17-28-42Z`
  const path = profile ? faceProfile : headShape
  const neutralMouth = `M${128 - mouth} 138q${mouth} 3 ${mouth * 2} 0`
  const mouthForms = {
    neutral: neutralMouth,
    happy: `M${128 - mouth} 136q${mouth} 8 ${mouth * 2} 0q-3 12 ${-mouth} 12t${-mouth}-12Z`,
    angry: `M${128 - mouth} 142q${mouth} -6 ${mouth * 2} -3`,
    sad: `M${128 - mouth} 141q${mouth} -9 ${mouth * 2} -1`,
    surprised: 'M119 139q9-9 18 0l-3 10q-7 5-13-1Z',
  }
  const showEyes = profile ? [facing === 'west' ? -1 : 1] : [-1, 1]
  const expression = mood === 'angry' ? 4 : mood === 'sad' ? -4 : mood === 'surprised' ? -3 : 0
  const features = showEyes
    .map((side) => {
      const x = profile ? 151 : 128 + side * eyeGap
      const focus = mood === 'surprised' ? 2.8 : mood === 'happy' ? -2 : 0
      const aperture = Math.max(4, arch + focus)
      const pivot = (seed % 3) - 1
      const iris = side === -1 && look.secondEye ? WARDROBE_EYE_COLORS[look.secondEye].rgb : null
      const irisColor = shade(iris ?? eyes, 0.92, 16)
      const eye = `M${x - eyeWidth} 105q${eyeWidth} ${-aperture * 2} ${2 * eyeWidth} -1q${-eyeWidth} ${aperture * 1.28} ${-2 * eyeWidth} 1Z`
      const pupilX = x + pivot
      const outline = `eye-${facing}-${side < 0 ? 'right' : 'left'}`
      const irisWidth = Math.min(8.5, aperture + 1.5)
      return `<path d="M${x - eyeWidth} ${91 - expression * side}q${eyeWidth} ${-7 + expression * side} ${2 * eyeWidth} ${expression * side * 2}" fill="none" stroke="${shade(hair, 0.62)}" stroke-width="${feminine ? 2.9 : 4}" stroke-linecap="round"/>
      <path d="${eye}" fill="#fff0db" stroke="${ink}" stroke-width="1.5"/>
      <defs><clipPath id="${outline}"><path d="${eye}"/></clipPath></defs>
      <g clip-path="url(#${outline})">
        <ellipse cx="${pupilX}" cy="103" rx="${irisWidth}" ry="${aperture * 0.88}" fill="${irisColor}" stroke="${shade(iris ?? eyes, 0.58)}" stroke-width="1"/>
        <ellipse cx="${pupilX}" cy="102" rx="2.5" ry="${Math.min(4.8, aperture - 0.4)}" fill="${ink}"/>
        <circle cx="${pupilX - 2.8}" cy="${102 - aperture * 0.37}" r="1.75" fill="#fff4db"/><circle cx="${pupilX + 2.5}" cy="105" r=".7" fill="#fff4db"/>
      </g>
      <path d="M${x - eyeWidth} 105q${eyeWidth} ${-aperture * 2} ${2 * eyeWidth} -1" fill="none" stroke="${ink}" stroke-width="${feminine ? 2.55 : 1.95}" stroke-linecap="round"/>`
    })
    .join('')
  const neck = `<path d="M105 141h46q-6 21 3 38l15 11-41 26-40-26 13-12q7-19 4-37Z" fill="${skin}" ${inkStroke} stroke-width="3"/>
    <path d="M105 146h45q-3 12-8 19l-35 9Z" fill="${skinShadow}"/>`
  const hatCover = look.headwear === 'furcap' || look.headwear === 'arcanist'
  const shortHair = [
    'natural',
    'crop',
    'sidepart',
    'pixie',
    'feather',
    'shag',
    'sidefringe',
    'spiked',
    'quiff',
    'frosted',
    'brushed',
    'loosequiff',
    'curls',
    'coils',
    'curlsweep',
    'crown',
    'coronet',
    'halo',
    'ropebraid',
    'topknot',
    'warrior',
    'doublenot',
    'hightwist',
  ].includes(look.hairstyle)
  const fittedHair = hatCover
    ? `<defs><clipPath id="hat-fit-${facing}"><path d="M0 77q128 12 256-10v189H0Z"/></clipPath></defs><g clip-path="url(#hat-fit-${facing})">${hairParts.front}</g>`
    : hairParts.front
  const frontHair = profile
    ? `<g transform="translate(8 -1) scale(.94 1)">${fittedHair}</g>`
    : fittedHair
  const headArt = back
    ? `<path d="${headShape}" fill="${shade(hair, 0.74)}" ${inkStroke} stroke-width="3"/>${frontHair}`
    : `<path d="M${left + 6} 102q-14-9-11 8 1 12 14 12m${2 * cheeks - 14}-20q14-9 11 8-1 12-14 12" fill="${skinShadow}" ${inkStroke} stroke-width="2.2"/>
      <defs><linearGradient id="face-light-${facing}" x1="0" y1=".15" x2="1" y2=".85"><stop stop-color="${shade(complexion, 0.94, 19)}"/><stop offset=".67" stop-color="${skin}"/><stop offset="1" stop-color="${skinShadow}"/></linearGradient></defs>
      <path d="${path}" fill="url(#face-light-${facing})" ${inkStroke} stroke-width="2.45"/>
      ${
        !profile
          ? `<defs><clipPath id="skin-fit"><path d="${path}"/></clipPath></defs>
      <image href="${CHARACTER_PAINT.skin}" x="70" y="45" width="116" height="125" preserveAspectRatio="none" clip-path="url(#skin-fit)" opacity=".22" style="mix-blend-mode: soft-light"/>`
          : ''
      }
      <path d="M${left + 8} 89q20-30 49-25t${cheeks - 12} 25q-21-11-34 2-27-13-61-2Z" fill="${skinShadow}" opacity=".63"/>
      <path d="M${profile ? 114 : 108} 117q9-13 16-11l7 21-16 2Z" fill="${skinLight}" opacity=".84"/>
      <path d="M${left + 13} 122q12 2 21 7m${cheeks - 17} 0q10-7 21-7" fill="none" stroke="${blush}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M${left + 11} 118q18 10 28 5-8 13-23 11Zm${2 * cheeks - 28} 3q-18 8-25 1 4 15 19 12Z" fill="${shade(complexion, 0.87, 22)}" opacity=".47"/>
      ${features}
      <path d="${profile ? 'M152 120q7 3 14 1' : `M128 111l-${nose} 14q${nose} 4 ${nose + 5} 0`}" fill="none" stroke="${skinShadow}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="${mouthForms[mood]}" ${profile ? 'transform="translate(31 0) scale(.87 1)"' : ''} fill="${mood === 'happy' || mood === 'surprised' ? '#754753' : 'none'}" stroke="#774f51" stroke-width="2.4" stroke-linecap="round"/>
      ${mood === 'happy' ? '<path d="M120 140q8 4 16 0" stroke="#fff0db" stroke-width="2" fill="none"/>' : ''}
      ${ageMarks(look.apparentAge, complexion, facing)}
      ${faceScar(look.scar, complexion, facing)}${beardArt(look.facialHair, hair, chin)}${frontHair}${facewearArt(look.facewear, face, eyeGap, eyeWidth, cheeks, facing)}`
  return {
    neck,
    hairBack: hatCover && shortHair ? hairParts.defs : hairParts.back,
    head: `${headArt}${headwearArt(look.headwear, head, cheeks, facing)}`,
    shade: skinShadow,
  }
}

const clothingDetail: Record<Look['outerwear'], string> = {
  none: '<path d="M102 179l26 30 26-30" fill="none" stroke="#edd4ae" stroke-width="3"/>',
  compass:
    '<path d="M85 177q11 24 43 31l43-31M62 221q30-14 43-17m46 0q19 5 44 19" fill="none" stroke="#dbb382" stroke-width="3"/><circle cx="137" cy="209" r="7" fill="#eac78a"/><path d="m137 204 3 5-3 5-3-5Z" fill="#694452"/>',
  pine: '<path d="M89 176q1 37 39 36 25-9 39-36M77 192q-3 29-29 47m132-47q3 29 30 47" fill="none" stroke="#bdc794" stroke-width="3"/>',
  hawkmantle:
    '<path d="M74 184q-13 20-39 40 24-6 45-21-3 11-14 24 32-15 42-39m74-4q13 20 39 40-24-6-45-21 3 11 14 24-32-15-42-39" fill="#e9bc8e" opacity=".76"/>',
  shearling:
    '<path d="M103 176q-20-5-32 7-9-1-14 10-10 1-16 15 1 7 5 7 0 10 9 11 0 7 9 4 8 5 15-4 7 3 14-5 7 2 16-7l19-12 18 12q9 10 16 7 7 8 14 5 7 9 15 4 9 3 9-4 9-1 9-11 4 0 5-7-6-14-16-15-5-11-14-10-12-12-32-7-8 29-25 35-19-7-25-35Z" fill="#e3c9b1" fill-rule="evenodd" stroke="#af9296" stroke-width="2"/>',
  scarf:
    '<path d="M104 176q23 15 49 0l6 11q-30 22-62 3Z" fill="#e7af78" stroke="#8a563e" stroke-width="2"/><path d="M141 194q3 22 23 53l13-7-19-50" fill="#ca895b" stroke="#8a563e" stroke-width="2"/>',
  brigandine:
    '<path d="M97 187q31 26 62 0l9 69H88Z" fill="#4b4256" stroke="#d2aa7e" stroke-width="3"/><path d="M102 216h52m-54 13h56m-58 13h60" stroke="#e0ba7d" stroke-width="2"/>',
  brocade:
    '<path d="M91 179l35 32v45m39-77l-35 32v45" fill="none" stroke="#eac78a" stroke-width="4"/><path d="m111 220 5 5-5 6-5-6Zm35 0 5 5-5 6-5-6Z" fill="#f2cc87"/>',
  hooded:
    '<path d="M94 172q8 33 34 36 26-3 34-36l9 9q-2 32-43 42-41-10-43-42Z" fill="#514b68" stroke="#aaa1bb" stroke-width="2"/>',
  quilted:
    '<path d="m64 197 36 59m-22-69 42 69m72-59-36 59m22-69-42 69M105 185l23 27 23-27" stroke="#dfb48e" stroke-opacity=".65" stroke-width="2" fill="none"/>',
}

function gearArt(gear: Look['gear'], pigment: RGB) {
  const base = shade(pigment)
  const rim = shade(pigment, 0.76, 63)
  const edge = `stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"`
  switch (gear) {
    case 'none':
      return ''
    case 'mapcase':
      return `<path d="M4 7q13-8 26 0v17H4Z" fill="${base}" ${edge}/><path d="M4 8q13-5 26 0v7q-13 5-26 0Z" fill="${rim}" ${edge}/><rect x="14" y="12" width="6" height="5" rx="1" fill="${metal}"/>`
    case 'potions':
      return `<path d="M3 3h27v5H3Z" fill="${base}" ${edge}/>${[9, 17, 25]
        .map(
          (x, i) =>
            `<path d="M${x - 2} 6h4v5l2 4v7h-8v-7l2-4Z" fill="${['#89c6bf', '#cf92a2', '#e0b46e'][i]}" ${edge}/><path d="M${x - 2} 6h4" stroke="${rim}" stroke-width="2"/>`,
        )
        .join('')}`
    case 'bedroll':
      return `<path d="M4 6h23q6 6 0 16H4q-6-7 0-16Z" fill="${base}" ${edge}/><path d="M10 6v16m10-16v16" stroke="${rim}" stroke-width="3"/><ellipse cx="28" cy="14" rx="4" ry="8" fill="${rim}" ${edge}/><path d="M28 11q5 5-1 6" stroke="${base}" stroke-width="1.4" fill="none"/>`
    case 'journal':
      return `<path d="M3 5h15v18H3Z" fill="${base}" ${edge}/><path d="M6 7v13m2-13h7" stroke="${rim}" stroke-width="1.7"/><path d="M23 12q-2-6 3-6t3 6m-7 0h8l2 10H20Z" fill="${rim}" ${edge}/><path d="M24 15h4v5h-4Z" fill="${metal}"/>`
    case 'rope':
      return `<path d="M10 3q15-1 15 11T16 25 7 14 16 8 22 15 15 21 10 12 17 10m2 12 8 3" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/><ellipse cx="16" cy="14" rx="8.5" ry="10" fill="none" stroke="${rim}" stroke-width="2.6"/><ellipse cx="16" cy="14" rx="4.7" ry="6" fill="none" stroke="${base}" stroke-width="2.4"/>`
    case 'sword':
      return `<path d="m4 22 18-15 4 4-18 15Z" fill="${base}" ${edge}/><path d="m20 7 7 6m-4-4 7-6" stroke="${rim}" stroke-width="3" stroke-linecap="round"/><circle cx="30" cy="3" r="2" fill="${metal}"/>`
    case 'girdle':
      return `<path d="M2 9q15 2 30-1v12q-15 4-30 0Z" fill="${base}" ${edge}/><path d="m8 15 6 5 6-5-6-5Zm13 0 4 4 4-4-4-4Z" fill="${rim}" stroke="${metal}" stroke-width="1.5"/>`
    case 'utility':
      return `<path d="M3 7h28v7H3ZM6 14h7v10H6Zm14 0h9l-1 10h-7Z" fill="${base}" ${edge}/><path d="M7 17h5m10 0h6" stroke="${rim}" stroke-width="2"/><rect x="13" y="7" width="8" height="7" rx="1" fill="${metal}" ${edge}/>`
  }
}
function portraitClothing(look: Look) {
  const { cloth, gear } = colorOptions(look)
  const build = WARDROBE_FRAMES[look.bodyFrame].torsoScale
  const shoulder = 83 * build
  const fill = shade(cloth)
  const shadeColor = shade(cloth, 0.57)
  const light = shade(cloth, 0.83, 53)
  const strap =
    look.gear === 'none'
      ? ''
      : `<path d="M${128 - shoulder * 0.63} 190q28 8 70 66h16q-34-50-72-69Z" fill="${shade(gear)}" stroke="${ink}" stroke-width="2"/><path d="m115 217 12-6 9 10-12 7Z" fill="${metal}" stroke="${ink}" stroke-width="2"/>`
  const shape = `M100 176Q${128 - shoulder} 180 ${Math.max(1, 128 - shoulder - 23)} 256H${Math.min(255, 128 + shoulder + 23)}Q${128 + shoulder} 180 156 176Q146 194 128 204Q110 194 100 176Z`
  const texture =
    GARMENT_PAINTINGS[look.outerwear as keyof typeof GARMENT_PAINTINGS] ?? GARMENT_PAINTINGS.cloth
  const dyed = look.clothColor !== 'natural'
  return `<g>
    <defs><clipPath id="garment-fit"><path d="${shape}"/></clipPath>
    <filter id="fabric-pigment" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/></filter></defs>
    <path d="${shape}" fill="${fill}" ${inkStroke} stroke-width="3"/>
    <image href="${texture}" x="14" y="170" width="228" height="108" preserveAspectRatio="xMidYMid slice" clip-path="url(#garment-fit)" opacity="${dyed ? '.28' : '.48'}" ${dyed ? 'filter="url(#fabric-pigment)"' : ''}/>
    <path d="M58 201q25-13 41-15l29 28 27-28q21 1 47 18l-24 52H68Z" fill="${shadeColor}" opacity=".56"/>
    <path d="M42 229q9-18 36-29m138 32q-12-21-39-32M96 196q0 18 10 29m52-30q0 18-8 32" fill="none" stroke="${light}" opacity=".83" stroke-width="4"/>
    <path d="M101 177q13 24 27 27 15-3 28-27l8 4q-13 25-36 37-22-10-35-37Z" fill="${light}" opacity=".74" stroke="${shadeColor}" stroke-width="1.4"/>
    <path d="M52 248q20-20 39-25m103 0q16 7 25 25" stroke="${light}" stroke-width="1.5" stroke-dasharray="2 3" fill="none" opacity=".73"/>
    ${clothingDetail[look.outerwear]}${strap}<g transform="translate(157 206) scale(1.65)">${gearArt(look.gear, gear)}</g>
  </g>`
}

export function illustratedPortrait(look: Look, expression: AppearanceExpression, icon: boolean) {
  const character = portraitHead(look, expression)
  const crop = icon ? '43 32 170 170' : '0 0 256 256'
  const size = icon ? 64 : 256
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${crop}">${portraitBackground(look.backdrop)}
    <defs><filter id="paper-fiber" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence numOctaves="3" baseFrequency=".62" seed="29" type="fractalNoise"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter></defs>
    ${character.hairBack}${character.neck}${portraitClothing(look)}${character.head}
    <rect width="256" height="256" fill="#b6aeac" filter="url(#paper-fiber)" opacity=".12" style="mix-blend-mode: multiply"/>
  </svg>`
}

export function illustratedSpriteMaterials() {
  return `<image id="field-thread" href="${CHARACTER_PAINT.thread}" width="26" height="21" preserveAspectRatio="none"/>
    <image id="field-leather" href="${CHARACTER_PAINT.leather}" width="26" height="21" preserveAspectRatio="none"/>`
}

export function illustratedSprite(
  look: Look,
  facing: AppearanceFacing,
  pose: AppearancePose,
  frame: number,
  frames: number,
  headId: string,
) {
  const { cloth, gear, complexion } = colorOptions(look)
  const build = WARDROBE_FRAMES[look.bodyFrame].torsoScale
  const profile = facing === 'east' || facing === 'west'
  const rear = facing === 'north'
  const direction = facing === 'west' ? -1 : 1
  const motion = Math.sin((frame * 2 * Math.PI) / frames)
  const stride = pose === 'walk' ? motion * (profile ? 4.3 : 2.1) : 0
  const lift = pose === 'walk' ? Math.abs(motion) * 0.65 : pose === 'idle' ? motion * 0.36 : 0
  const torso = shade(cloth)
  const depth = shade(cloth, 0.59)
  const thread = shade(cloth, 0.85, 59)
  const hand = shade(complexion)
  const boots = '#614c50'
  const sleeve = look.outerwear === 'shearling' ? '#ddc2af' : thread
  const clothOfPose = pose === 'hit' ? shade(cloth, 0.72, 28) : torso
  const bodyWidth = (profile ? 8 : 10) * build
  const nearSide = facing === 'west' || rear ? -1 : 1
  const farSide = nearSide === 1 ? -1 : 1
  const arm = (side: -1 | 1) => {
    const near = side === nearSide || !profile
    const shoulder = 24 + side * bodyWidth * (profile ? 0.7 : 0.91)
    const elbow = shoulder + (profile ? direction : side * 2) + side * stride * 0.58
    const wrist =
      elbow +
      (pose === 'cast' || pose === 'attack' ? (near ? direction * 5 : -direction * 2) : side * 0.5)
    const wristY =
      pose === 'cast' || pose === 'attack'
        ? near
          ? 28 - frame
          : 39
        : 41 - Math.max(0, side * stride)
    return `<g data-limb="arm-${side === -1 ? 'left' : 'right'}">
      <path d="M${shoulder} 28Q${elbow} 34 ${wrist} ${wristY}" fill="none" stroke="${ink}" stroke-width="5.6" stroke-linecap="round"/>
      <path d="M${shoulder} 28Q${elbow} 34 ${wrist} ${wristY}" fill="none" stroke="${near ? clothOfPose : depth}" stroke-width="4" stroke-linecap="round"/>
      <path d="M${wrist - 0.9} ${wristY - 1.2}l1 .5" stroke="${sleeve}" stroke-width="2.2"/>
      <circle cx="${wrist}" cy="${wristY + 0.75}" r="1.4" fill="${hand}" stroke="${ink}" stroke-width=".6"/>
    </g>`
  }
  const leg = (side: -1 | 1) => {
    const base = 24 + side * (profile ? 2.4 : 4.4) * build
    const toe = base + side * stride * (profile ? direction : 0.47)
    const ground = 57 - Math.max(0, side * stride * (profile ? 0.38 : 0.86))
    return `<g data-limb="leg-${side === -1 ? 'left' : 'right'}"><path d="M${base} 42q${side * stride * 0.7} 5 ${toe - base} ${ground - 42}" stroke="${ink}" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M${base} 42q${side * stride * 0.7} 5 ${toe - base} ${ground - 42}" stroke="${side === 1 ? '#5b5167' : '#454054'}" stroke-width="4.1" stroke-linecap="round" fill="none"/>
    <path d="M${toe} ${ground - 4}v3l${profile ? direction * 2.4 : side * 0.8} 1" stroke="${boots}" stroke-width="4.4" stroke-linecap="round" fill="none"/></g>`
  }
  const longCoat = ['compass', 'pine', 'hawkmantle', 'hooded', 'shearling'].includes(look.outerwear)
  const profileNudge = profile ? direction * 2 : 0
  const headTransform = `translate(${8 + profileNudge} 3) scale(.125)${facing === 'west' ? ' translate(256 0) scale(-1 1)' : ''}`
  const fx =
    pose === 'cast'
      ? `<path d="m${profile ? (direction > 0 ? 41 : 7) : 36} 20 2.4 4.5-2.4 4.5-2.4-4.5Z" fill="#f9df8f" stroke="#d29053" stroke-width=".7"/>`
      : ''
  const weapon =
    pose === 'attack'
      ? `<path d="M${24 + direction * 7} 35l${direction * (4 + frame)} -16 1 1-3 17Z" fill="#d5e4e9" stroke="#65596b" stroke-width=".7"/>`
      : ''
  const detail =
    look.outerwear === 'scarf'
      ? `<path d="M${24 - bodyWidth * 0.65} 26q7 5 ${bodyWidth * 1.3} 0l-1 4q-7 4 ${-bodyWidth * 1.15} 1Z" fill="${thread}" stroke="${ink}" stroke-width=".7"/>`
      : look.outerwear === 'shearling'
        ? `<path d="M${24 - bodyWidth} 31q1-6 6-6 2 6 4 6 2 0 4-6 5 0 7 6-3 2-7 1-4 6-8 0-3 1-6-1Z" fill="#ddc2af" stroke="#887384" stroke-width=".75"/>`
        : `<path d="M${24 - bodyWidth * 0.6} 26l${bodyWidth * 0.56} 7 ${bodyWidth * 0.63}-7" fill="none" stroke="${thread}" stroke-width="1.4"/><circle cx="24" cy="34" r="1" fill="${metal}"/>`
  const jacket = `M${24 - bodyWidth} 29q${bodyWidth} -8 ${bodyWidth * 2} 0l-3 14q${-bodyWidth + 3} 5 ${-bodyWidth * 2 + 6} 0Z`
  const texture =
    look.outerwear === 'brigandine' || look.outerwear === 'brocade' ? 'thread' : 'leather'
  const garmentFit = `field-jacket-${facing}-${pose}-${frame}`
  const body = `${leg(-1)}${leg(1)}<g transform="translate(0 ${-lift})">
    ${longCoat ? `<path d="M${24 - bodyWidth * 0.79} 28q-2 11 -4 18 5 1 12-3l7 4q1-10-3-19Z" fill="${depth}" stroke="${ink}" stroke-width="1.1"/>` : ''}
    ${profile ? arm(farSide) : ''}
    <path d="${jacket}" fill="${clothOfPose}" ${inkStroke} stroke-width="1.25"/>
    <defs><clipPath id="${garmentFit}"><path d="${jacket}"/></clipPath></defs>
    <use href="#field-${texture}" x="11" y="25" opacity=".26" clip-path="url(#${garmentFit})" style="mix-blend-mode: soft-light"/>
    <path d="M${24 - bodyWidth * 0.62} 39q${bodyWidth * 0.66} 4 ${bodyWidth * 1.24} 0" stroke="${depth}" stroke-width="2" fill="none"/>
    ${detail}
    ${
      look.gear !== 'none'
        ? `<path d="M${24 - bodyWidth * 0.75} 29l${bodyWidth * 1.28} 12" stroke="${shade(gear)}" stroke-width="1.4"/><g transform="translate(${23 + bodyWidth * 0.21} 36) scale(.26)">${gearArt(look.gear, gear)}</g>`
        : ''
    }
    ${profile ? arm(nearSide) : arm(-1) + arm(1)}
    <use href="#${headId}" transform="${headTransform}"/>
  </g>`
  const poseTransform =
    pose === 'down'
      ? 'translate(24 53) rotate(-90) scale(.73) translate(-24 -30)'
      : pose === 'hit'
        ? `rotate(${-direction * (4 + frame)} 24 58)`
        : pose === 'attack'
          ? `rotate(${direction * (5 + frame)} 24 58)`
          : ''
  return `<ellipse cx="24" cy="59" rx="${pose === 'down' ? 20 : 12}" ry="2.65" fill="#25203c" fill-opacity=".34"/>
    <g transform="${poseTransform}">${body}</g>${fx}${weapon}`
}

export function illustratedSpriteHead(look: Look, facing: AppearanceFacing, id: string) {
  const { head, hairBack, shade: skin } = portraitHead(look, 'neutral', facing)
  return `<g id="${id}">${hairBack}<path d="M108 139h40l-2 49h-36Z" fill="${skin}" stroke="${ink}" stroke-width="2.8"/>${head}</g>`
}
