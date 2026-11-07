import type { AppearanceBlueprint } from './appearance-manifest'
import type { WardrobeCut } from './appearance-wardrobe-catalog'

// Original vector garment parts in the actor rig's 48 × 64 coordinates. The waist stays
// at y=34, the floor at y=58. Paths describe the shell, an overlapping fabric/armor layer,
// seams and a real attachment line for the three interchangeable hem shapes.
type Garment = {
  shell: string
  overlay: string
  seams: string
  hem: readonly [left: number, right: number, y: number]
  arms?: 'fitted' | 'wide' | 'bare' | 'armored'
  under?: string
  back?: string
  metal?: true
}

const garments: Record<WardrobeCut, Garment> = {
  bolero: {
    shell: 'M15 22l6-3h6l6 3 2 5-5 3v3H18v-3l-5-3Z',
    overlay: 'M16 23l4-2 4 5 4-5 4 2-3 8H19Z',
    seams: 'M17 24l4 5m10-5-4 5m-7 8h8',
    hem: [18, 30, 33],
    arms: 'bare',
    under: 'M18 29h12l2 11-8 2-8-2Z',
  },
  gown: {
    shell: 'M17 22l4-3h6l4 3-3 13 8 9 7 12H5l7-12 8-9Z',
    overlay: 'M20 34h8l8 17-12 4-12-4Z',
    seams: 'M20 37l-6 15m9-15-3 16m8-16 7 15M15 47l-4 6m22-6 5 6',
    hem: [6, 42, 55],
    arms: 'wide',
  },
  brigandine: {
    shell: 'M11 24l6-4h14l6 4-5 7-2 6 4 5H14l4-5-2-6Z',
    overlay: 'M14 25h20l-4 5H18Zm4 7h12l1 5H17Zm-2 7h16l2 3H14Z',
    seams: 'M18 27h1m4 0h2m4 0h1m-11 7h1m3 0h2m4 0h1m-10 6h8',
    hem: [14, 34, 42],
    arms: 'armored',
    metal: true,
  },
  poncho: {
    shell: 'M18 21l4-2h4l5 3 10 4 4 12-12 4-8-3-9 6L3 38l4-12Z',
    overlay: 'M5 34l12 3 7-5 9 3 10-3 2 6-12 4-8-3-9 6L3 38Z',
    seams: 'M9 28l10 4m20-4-10 3M7 39v2m5 0v3m22-3v3m6-5v3',
    hem: [16, 33, 41],
    arms: 'fitted',
  },
  frock: {
    shell: 'M14 23l6-4h8l6 4-2 10 3 11 2 9-9-3-4-10-4 10-9 3 2-9 3-11Z',
    overlay: 'M17 23l5-3 3 6 3-6 4 3-5 13h-6Zm-2 16 5-1-2 10-4 2Zm13-1 5 1 1 11-4-2Z',
    seams: 'M17 26l3 6m11-6-3 6M15 42l-2 7m20-7 2 7',
    hem: [12, 36, 49],
    back: 'M19 35h10l5 14-6-1-4-6-4 6-6 1Z',
  },
  overalls: {
    shell: 'M19 22h3l1 4h2l1-4h3l2 14 3 14-6 3-4-10-4 10-6-3 3-14Z',
    overlay: 'M19 25h10v11H19Zm0 13h10l2 8-6-3h-2l-6 3Z',
    seams: 'M20 24v5m8-5v5m-8 3h8m-6 5h4m-8 9-1 4m13-4 1 4',
    hem: [16, 32, 49],
    arms: 'bare',
    under: 'M15 23l5-3h8l5 3-2 14H17Z',
  },
  cuirass: {
    shell: 'M12 22l7-2h10l7 2-2 8-4 4v5l3 4H15l3-4v-5l-4-4Z',
    overlay: 'M14 24l6-3 4 2 4-2 6 3-5 8H19Zm4 11h12v4H18Z',
    seams: 'M16 25l8 5 8-5m-8 0v5m-5 7h10m-9 4h8',
    hem: [15, 33, 43],
    arms: 'armored',
    metal: true,
  },
  rainsmock: {
    shell: 'M16 23l4-4h8l4 4v9l4 5-1 10H13l-1-10 4-5Z',
    overlay: 'M16 24l5-4h6l5 4-3 4H19Zm1 12h14l2 8H15Z',
    seams: 'M18 38v5m12-5v5M17 34h14m-10 7h6',
    hem: [13, 35, 47],
    arms: 'wide',
  },
  capote: {
    shell: 'M11 23l9-4h8l5 3 7 11-4 9-6-4 3 13-12-7-11 2-2-13Z',
    overlay: 'M11 23l10-3 12 3 7 10-4 9-7-7-10-3-9 2Z',
    seams: 'M11 27l10 1 15 9M13 36l6-2m12 4 2 9',
    hem: [11, 32, 46],
    arms: 'bare',
    back: 'M19 22l13 2 8 14-4 9-12-11-10-1Z',
  },
  waistcoat: {
    shell: 'M17 22l4-3h6l4 3-1 8 4 8-6 5-4-5-4 5-6-5 4-8Z',
    overlay: 'M17 22l5-2 2 10 2-10 5 2-2 9 3 6-5 3-3-5-3 5-5-3 3-6Z',
    seams: 'M20 24l2 7m6-7-2 7M18 36l3-2m9 2-3-2',
    hem: [15, 33, 39],
    arms: 'wide',
    under: 'M13 24l8-4h6l8 4-3 16H16Z',
  },
  lamellar: {
    shell: 'M11 23l8-3h10l8 3-3 7-4 3 5 12-9 2-2-6-2 6-9-2 5-12-4-3Z',
    overlay: 'M13 24h22l-2 5H15Zm4 7h14v4H17Zm0 7h6l-2 7-6-1Zm8 0h6l2 6-6 1Z',
    seams: 'M17 25v3m5-3v3m4-3v3m5-3v3M20 31v4m4-4v4m4-4v4m-11 6h4m6 0h4',
    hem: [13, 35, 44],
    arms: 'armored',
    metal: true,
  },
  kaftan: {
    shell: 'M15 22l7-3h5l6 3-1 10 5 19-3 4H12l-1-4 5-19Z',
    overlay: 'M15 23l8-3 6 2-9 13-1 15-5 3 2-20Zm14 4 3 6 4 18-12 3 2-18Z',
    seams: 'M17 25l8-3M16 43l-2 9m15-12 3 12m-11-8 1 8',
    hem: [12, 36, 54],
    arms: 'wide',
  },
  doublet: {
    shell: 'M14 25l4-5h12l4 5-4 8 6 7-5 3-4-2-3 3-3-3-4 2-5-3 6-7Z',
    overlay: 'M16 25l5-4h6l5 4-4 8h-8Zm1 11h14l3 4-6 1-4-2-4 2-6-1Z',
    seams: 'M19 24l2 8m8-8-2 8m-9 6-2 3m14-3 2 3',
    hem: [13, 35, 42],
    arms: 'wide',
  },
  greatcloak: {
    shell: 'M18 20l6-3 6 3 8 5 3 16 4 14-7 2-10-2H20l-10 2-7-2 4-14 3-16Z',
    overlay: 'M17 23l6 2-5 9-4 18-8 3 5-27Zm14 0 6 5 5 27-8-3-4-18-5-9Z',
    seams: 'M14 27l-4 23m24-23 4 23M20 43l-3 10m11-10 3 10',
    hem: [4, 44, 55],
    back: 'M14 25l10-5 10 5 6 27-7 3-9-5-9 5-7-3Z',
  },
  hauberk: {
    shell: 'M14 24l5-4h10l5 4-2 10 3 13-8 2-3-5-3 5-8-2 3-13Z',
    overlay: 'M17 24h14l-2 10 4 10H15l4-10Z',
    seams: 'M17 28l3 2 4-2 4 2 3-2m-13 5 3 2 3-2 3 2 3-2m-13 6 4 2 3-2 3 2 4-2',
    hem: [14, 34, 47],
    metal: true,
  },
  splitrobe: {
    shell: 'M15 23l6-4h6l6 4-2 12 6 17-4 5-7-3-2-13-2 13-7 3-4-5 6-17Z',
    overlay: 'M17 23l5-2 2 4 2-4 5 2-4 14 7 16-6-2-4-14-4 14-6 2 7-16Z',
    seams: 'M17 25l4 8m10-8-4 8m-8 9-4 11m14-11 4 11',
    hem: [12, 36, 52],
    arms: 'wide',
  },
  jackcoat: {
    shell: 'M7 25l6-4 7 1 4-3 4 3 7-1 6 4-3 6-6-2-3 7 1 8H18l1-8-3-7-6 2Z',
    overlay: 'M8 26l5-4 6 2-3 6-5-1Zm32 0-5-4-6 2 3 6 5-1Zm-19 1h6l2 12H19Z',
    seams: 'M10 27l6-2m22 2-6-2m-12 12h8m-7 4h6',
    hem: [18, 30, 44],
    arms: 'armored',
  },
  mailskirt: {
    shell: 'M15 23l5-3h8l5 3-2 11 8 10-2 8-9-1-4-5-4 5-9 1-2-8 8-10Z',
    overlay: 'M18 34h12l8 11-2 5-8-2-4-5-4 5-8 2-2-5Z',
    seams: 'M14 43l4 3 3-3m6 0 3 3 4-3M18 37l6 3 6-3m-14 10 2 3m14-3-2 3',
    hem: [11, 37, 50],
    arms: 'bare',
    metal: true,
  },
  tabard: {
    shell: 'M13 22l7-3h8l7 3-4 7-2 7 3 20H16l3-20-2-7Z',
    overlay: 'M18 22l3-1 3 3 3-3 3 1-3 14 2 17H19l2-17Z',
    seams: 'M20 24l2 11m6-11-2 11m-3 6h2m-3 5h4m-4 4h4',
    hem: [17, 31, 55],
    under: 'M14 25l8-4h4l8 4-4 17H18Z',
  },
  surcoat: {
    shell: 'M13 23l7-4h8l7 4-4 9 2 10 5 7-10 6-5-7-12 4 4-13 2-7Z',
    overlay: 'M15 25l7-5h6l5 3-12 15-5 11-4 2 4-13Zm17 11 5 12-8 5-5-6Z',
    seams: 'M18 26l9-4m-8 18-4 8m13-7 5 7',
    hem: [13, 37, 50],
    arms: 'bare',
    back: 'M15 26l9 5 9-5-4 16-8 6-5-3Z',
  },
}

type Palette = readonly [fabric: string, shade: string, light: string, trim: string]
const outline = '#26222b'

export function garmentFor(coat: AppearanceBlueprint['coat']): Garment | undefined {
  return Object.hasOwn(garments, coat) ? garments[coat as WardrobeCut] : undefined
}

function line(d: string, stroke: string, width = 1) {
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
}

function part(d: string, fill: string, stroke = outline) {
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width=".9" stroke-linejoin="round"/>`
}

export function wardrobeLegs([, shade, light]: Palette, walk: number) {
  const left = 19 - walk
  const right = 29 + walk
  const legs = `M21 39l-1 9 ${left - 20} 6M27 39l1 9 ${right - 28} 6`
  return `
    ${line(legs, outline, 6)}
    ${line(legs, shade, 4.2)}
    ${part(`M${left - 2.1} 52h4.4l.6 4v2h-7v-2Zm${right - left - 2} 0h4.4l2.4 4v2h-7v-2Z`, '#3f3339')}
    ${line(`M${left - 1.7} 53h3.2M${right - 1.7} 53h3.2`, light, 0.7)}`
}

export function wardrobeArms(
  garment: Garment,
  blueprint: AppearanceBlueprint,
  [fabric, shade, light, trim]: Palette,
  skin: string,
  walk: number,
  arm: number,
  profile: boolean,
) {
  const shoulder = { slight: 7, average: 9, broad: 10 }[blueprint.body]
  const armStart = 24 + shoulder
  const armEnd = Math.min(44, armStart + 2 + arm * 0.82)
  const armY = 36 - arm * 0.56
  const left = 22 - shoulder + walk / 2
  const width =
    (garment.arms === 'wide' ? 1 : 0) + { close: 4, puffed: 7.5, split: 5.5 }[blueprint.sleeves]
  const armLines = `M${24 - shoulder} 26L${left} 36M${armStart} 26L${armEnd} ${armY}`
  const cuffs = `M${left - 1.5} 34l3 1M${armEnd - 1.5} ${armY - 1.4}l3 1`
  return `
    <g opacity="${profile ? '.92' : '1'}">
      ${line(armLines, outline, width + 1.5)}
      ${line(armLines, garment.arms === 'bare' ? skin : garment.arms === 'armored' ? shade : fabric, width)}
      ${line(cuffs, trim, 1.6)}
      ${blueprint.sleeves === 'split' ? line(`M${left - 2} 31l3 2M${armEnd - 2} ${armY - 4}l3 2`, light, 1.4) : ''}
      ${blueprint.sleeves === 'puffed' ? line(`M${25 - shoulder} 26l-2 4M${armStart - 1} 26l2 4`, light, 2.4) : ''}
      <circle cx="${left}" cy="37" r="1.65" fill="${skin}" stroke="${outline}" stroke-width=".6"/>
      <circle cx="${armEnd}" cy="${armY + 1}" r="1.65" fill="${skin}" stroke="${outline}" stroke-width=".6"/>
    </g>`
}

export function wardrobeBody(
  garment: Garment,
  blueprint: AppearanceBlueprint,
  [fabric, shade, light, trim]: Palette,
  back: boolean,
  portrait = false,
) {
  const [left, right, y] = garment.hem
  const span = right - left
  const middle = left + span / 2
  const hemline = {
    plain: `M${left} ${y - 2}H${right}l-1 2h-${span - 2}Z`,
    split: `M${left} ${y - 2}H${right}l-1 2-${span * 0.26} 2-${span * 0.24} -3-${span * 0.24} 3-${span * 0.26 - 2} -2Z`,
    pointed: `M${left} ${y - 2}H${right}L${middle} ${Math.min(58, y + 3)}Z`,
  }[blueprint.hem]
  const collar = {
    open: line('M18 21l6 6 6-6', trim, 1.35),
    standing: part('M17 21l2-3 5 3 5-3 2 3-4 4h-6Z', shade, trim),
    fur: part('M16 22l3-3 2 2 3-1 3 1 2-2 3 3-3 3-2-1-3 2-3-2-2 1Z', '#d3baa0', shade),
  }[blueprint.collar]
  const closure = {
    buttons: line('M24 27v.1m0 2.3v.1m0 2.3v.1', trim, 1.4),
    lacing: line('M22 27l4 2-4 2 4 2m0-6-4 2 4 2-4 2', trim, 0.85),
    clasps: line('M21 28h6m-6 3h6', trim, 1.25),
  }[blueprint.closure]
  const pattern = {
    linen: '',
    brocade: line('M20 28l1.5 2-1.5 2-1.5-2Zm8 0 1.5 2-1.5 2-1.5-2Z', light, 0.8),
    quilt: line('M17 27l4 5m-1-5 4 5m0-5 4 5m-1-5 4 5', light, 0.75),
  }[blueprint.textile]
  const accessory = {
    none: '',
    satchel:
      line(back ? 'M18 22l13 13' : 'M30 22 17 35', '#bd986f', 1.8) +
      part('M14 33h7l1 6h-9Z', '#8e6948') +
      line('M15 35h5', trim, 0.75),
    scarf: part('M16 22l7 2 8-2 1 3-3 2 4 7-4 1-3-8-8-1Z', light, shade),
    brooch: part('M29 24l2.4 2.4-2.4 2.4-2.4-2.4Z', trim),
  }[blueprint.accessory]
  const spread = portrait ? 1 : { slight: 0.94, average: 1, broad: 1.06 }[blueprint.body]
  return `<g transform="translate(24 0) scale(${spread} 1) translate(-24 0)">
    ${garment.under ? part(garment.under, shade) : ''}
    ${part(garment.shell, fabric)}
    ${part(back ? (garment.back ?? garment.overlay) : garment.overlay, garment.metal ? light : shade)}
    ${line(garment.seams, garment.metal ? shade : light, garment.metal ? 1 : 0.85)}
    ${part(hemline, light, shade)}
    ${collar}
    ${pattern}
    ${back ? '' : closure}
    ${accessory}
  </g>`
}
