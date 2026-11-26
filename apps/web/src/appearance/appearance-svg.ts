import {
  illustratedPortrait,
  illustratedSprite,
  illustratedSpriteHead,
  illustratedSpriteMaterials,
} from './appearance-illustrated'
import { facePainting, faceLayers, naturalFaceSkin, fieldFacePaint } from './appearance-face-paint'
import { FITTED_FACEWEAR, FITTED_HEADWEAR } from './appearance-fitted-accessories'
import {
  patternedBackdrop,
  studioColor,
  type StudioColor,
  type PatternedBackdrop,
} from './appearance-backdrop-catalog'
import {
  APPEARANCE_FACINGS,
  APPEARANCE_FRAME,
  APPEARANCE_MOTION_FRAME,
  APPEARANCE_POSES,
  APPEARANCE_PRESETS,
  appearanceFrameIndex,
  appearanceMotionFrameIndex,
  type AppearanceAsset,
  type AppearanceBlueprint,
  type AppearanceExpression,
  type AppearanceFacing,
  type AppearancePose,
  type AnyPaintedAppearanceBlueprint,
  type PaintedPlayerAppearanceBlueprint,
  type WardrobeAppearanceBlueprint,
} from './appearance-manifest'
import {
  PAINTED_ACTORS,
  PAINTED_ACTOR_PORTRAITS,
  PAINTED_OUTER_LAYERS,
  PAINTED_ACCESSORY_LAYERS,
} from './appearance-painted-catalog.generated'
import {
  paintedDyeFilter,
  paintedEquipmentDyes,
  paintedFieldEquipment,
  paintedPlayerPortraitEquipment,
  fittedPortraitHat,
  fieldFaceAnchor,
  paintedPortraitEquipment,
} from './appearance-painted-equipment'
import {
  paintedFeatureComposite,
  paintedFeatureDyes,
  paintedHairLayers,
} from './appearance-painted-features'
import {
  WARDROBE_EYE_COLORS,
  WARDROBE_FRAMES,
  WARDROBE_HAIRSTYLES,
  WARDROBE_SKIN_TONES,
  type PaintedWardrobeLook,
} from './appearance-painted-wardrobe'
import {
  WARDROBE_GEAR_LAYERS,
  WARDROBE_OUTER_LAYERS,
} from './appearance-painted-wardrobe.generated'
import {
  PAINTED_FIELD_SKIN_MASKS,
  PAINTED_PORTRAIT_SKIN_MASKS,
} from './appearance-painted-masks.generated'
import {
  PAINTED_PLAYER_FIELD_SKIN_MASKS,
  PAINTED_PLAYER_SPRITES,
} from './appearance-painted-player-art'
import {
  PAINTED_STUDIO_PAPER,
  PINE_SCOUT_CUTOUTS,
  PINE_SCOUT_PORTRAIT_SKIN,
} from './appearance-painted-player.generated'
import { FRONTAL_ACTORS } from './appearance-frontal.generated'
import { DEPTH_WALK_MAPS, DEPTH_WALK_SCALE } from './appearance-depth-walk.generated'
import { PAINTED_BACKDROPS } from './appearance-painted-backdrops.generated'
import { paintedPortraitWardrobe } from './appearance-painted-portrait-wardrobe'
import { renderLowerGarment } from './appearance-lower-art'
import { PAINTED_PRESET_PORTRAITS } from './appearance-painted-portraits.generated'
import { PAINTED_PRESET_SPRITES } from './appearance-painted-sprites.generated'
import { garmentFor, wardrobeArms, wardrobeBody, wardrobeLegs } from './appearance-wardrobe-art'

const palettes = {
  pine: ['#344e44', '#22332d', '#678777', '#d4a866'],
  garnet: ['#713f47', '#432b36', '#ad6672', '#e7b87b'],
  indigo: ['#455372', '#242d48', '#7a8eb1', '#dab879'],
  saffron: ['#86612d', '#4f381c', '#bd9654', '#e9cb90'],
  slate: ['#4e626b', '#303e48', '#849aa3', '#c2aa86'],
  ivory: ['#968874', '#564837', '#d2c4a6', '#f4d6a0'],
} as const
const skins = {
  light: ['#dbb598', '#a87564', '#f4d4b4'],
  tan: ['#b77f59', '#805039', '#daa37a'],
  brown: ['#935e48', '#5b392f', '#bd8262'],
  deep: ['#69453f', '#402c2b', '#976951'],
} as const
const hairs = {
  onyx: ['#29232a', '#55424b'],
  oak: ['#4c3028', '#87604b'],
  copper: ['#773e2f', '#b2704f'],
  silver: ['#858389', '#cbc5bd'],
} as const

const hairShapes = {
  crop: 'M39 47Q30 39 35 29Q38 14 54 14Q69 10 77 23Q84 34 75 49L72 31Q62 24 53 31L43 36Z',
  swept: 'M34 49Q20 33 35 20Q49 8 71 16Q86 18 84 35L76 51Q70 36 72 28Q55 45 37 38Z',
  braid: 'M34 55Q20 30 35 19Q45 12 55 14Q76 9 82 31L78 55L73 40L68 27Q57 38 39 40Z',
  curls:
    'M33 52Q24 51 29 42Q18 34 28 27Q24 16 37 16Q45 6 56 13Q68 6 76 16Q90 18 84 29Q93 35 84 45Q83 55 75 54L71 33Q64 39 58 29Q45 40 39 36Z',
} as const

const faceLines = {
  neutral: ['M42 46l10-1m13 0 10 1', 'M43 50q4 2 8 0m15 0q4 2 8 0', 'M52 64q6 2 12 0'],
  happy: [
    'M42 45q5-3 10-1m13 0q5-2 10 1',
    'M43 51q4-5 8 0m15 0q4-5 8 0',
    'M50 62q8 5 16 0-6 11-16 0Z',
  ],
  angry: ['M41 44l12 4m11 0 12-4', 'M43 51l8 1m15 0 8-1', 'M52 66q6-5 12 0'],
  sad: ['M42 47l11-4m11 0 11 4', 'M43 50q4 4 8 1m15 0q4 3 8-1', 'M52 66q6-5 12 0'],
  surprised: [
    'M42 41q5-4 10-1m13 0q5-3 10 1',
    'M43 50a4 4 0 1 0 8 0 4 4 0 1 0-8 0m23 0a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
    'M54 64a4 5 0 1 0 8 0 4 5 0 1 0-8 0',
  ],
} as const

function svg(width: number, height: number, drawing: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${drawing}</svg>`
}

function matchingPresetIndex(blueprint: AppearanceBlueprint) {
  return APPEARANCE_PRESETS.findIndex(({ blueprint: preset }) =>
    Object.keys(preset).every(
      (field) =>
        preset[field as keyof AppearanceBlueprint] ===
        blueprint[field as keyof AppearanceBlueprint],
    ),
  )
}

function paintedPortrait(index: number, expression: AppearanceExpression, icon: boolean) {
  const source = PAINTED_PRESET_PORTRAITS[index]?.[expression]
  if (!source) return null
  return icon
    ? svg(64, 64, `<image href="${source}" x="-10" y="-5" width="84" height="84"/>`)
    : svg(256, 256, `<image href="${source}" width="256" height="256"/>`)
}

const swing = [0, 0.707, 1, 0.707, 0, -0.707, -1, -0.707] as const
const rounded = (value: number) => Number(value.toFixed(4))
const passingStride = (frame: number) => swing[(frame + 2) % swing.length]!

function readyStance(facing: AppearanceFacing, frame: number) {
  const amount = (1 - passingStride(frame)) / 2
  const turn = facing === 'east' ? 1 : facing === 'west' ? -1 : 0
  const lean = amount * turn * 0.8 + swing[frame]! * 0.5

  // The feet anchor the stance while the upper body settles and breathes.
  return `rotate(${rounded(lean)} 24 57) translate(24 57) scale(${rounded(1 + amount * 0.014)} ${rounded(1 - amount * 0.025)}) translate(-24 -57)`
}

function downStance(facing: AppearanceFacing) {
  const direction = facing === 'west' ? -1 : 1
  // Rotate around the center of the standing cell so the head and feet fit the same frame.
  return `translate(24 46.5) rotate(${-90 * direction}) scale(.72) translate(-24 -32)`
}

function paintedSprite(
  facing: AppearanceFacing,
  pose: AppearancePose,
  frame: number,
  art = `<use href="#body-${facing}"/>`,
  motion = false,
) {
  const direction = facing === 'west' ? -1 : 1
  if (motion && pose === 'down') {
    return `<ellipse cx="24" cy="55" rx="17" ry="2.5" fill="#171d23" fill-opacity=".4"/><g transform="${downStance(facing)}">${art}</g>`
  }
  if (motion && pose === 'idle') {
    return `<ellipse cx="24" cy="58" rx="11" ry="2.5" fill="#171d23" fill-opacity=".4"/><g transform="${readyStance(facing, frame)}">${art}</g>`
  }
  const step = pose === 'walk' ? [0, 1.8, -1.8][frame]! : 0
  const rise = pose === 'walk' && frame !== 0 ? 1.5 : 0
  const angle =
    pose === 'attack'
      ? (motion ? [0, -4, 6.5] : [0, -9, 13])[frame]! * direction
      : pose === 'hit'
        ? (motion ? [0, -7, -3] : [0, -12, -5])[frame]! * direction
        : pose === 'down'
          ? -68 * direction
          : 0
  const lunge = pose === 'attack' ? (motion ? [0, -0.6, 1.3] : [0, -1, 4])[frame]! * direction : 0
  return `
    <ellipse cx="24" cy="58" rx="${pose === 'down' ? 16 : 11}" ry="2.5" fill="#171d23" fill-opacity=".4"/>
    <g transform="translate(${pose === 'down' ? 12 * direction : lunge} ${-rise}) rotate(${angle} 24 52)${pose === 'down' ? ' translate(24 52) scale(.72) translate(-24 -52)' : ''}">
      ${step ? `<g clip-path="url(#upper-body)">${art}</g><g clip-path="url(#lower-body)" transform="translate(${step} 0)">${art}</g>` : art}
    </g>
    ${pose === 'cast' && frame > 0 ? `<path d="M${24 + 12 * direction} 27l2.5 5-2.5 5-2.5-5Z" fill="#fff0b9" stroke="#deb96e" opacity=".88"/>` : ''}
    ${pose === 'attack' && frame === 2 ? `<path d="M${24 + 8 * direction} 25q${9 * direction} 1 ${13 * direction} 10" fill="none" stroke="#ecdaa8" stroke-width="1.7" stroke-linecap="round" opacity=".72"/>` : ''}
  `
}

function portrait(blueprint: AppearanceBlueprint, mood: AppearanceExpression, icon: boolean) {
  const [fabric, shade, light, trim] = palettes[blueprint.palette]
  const [skin, skinShade, skinLight] = skins[blueprint.complexion]
  const [hair, hairLight] = hairs[blueprint.hairColor]
  const [brows, eyes, mouth] = faceLines[mood]
  const shoulder = { slight: 20, average: 13, broad: 6 }[blueprint.body]
  const collar = {
    open: 'M37 79l12 38 10-27 11 27 12-38',
    standing: 'M36 77l15 30 8-16 8 16 16-30',
    fur: 'M35 78l4 9 5-4 5 11 5-5 5 10 6-10 5 5 5-11 5 4 4-9',
  }[blueprint.collar]
  const garment = garmentFor(blueprint.coat)
  const clothes = garment
    ? `<g transform="translate(-26.4 10) scale(3.6)">${wardrobeArms(garment, blueprint, palettes[blueprint.palette], skin, 0, 0, false)}${wardrobeBody(garment, blueprint, palettes[blueprint.palette], false, true)}</g>`
    : `
    <path fill="url(#coat)" stroke="#231e24" stroke-width="2" d="M${shoulder} 120L${shoulder + 5} 103Q${shoulder + 9} 85 41 78L76 78Q${113 - shoulder} 85 ${117 - shoulder} 103L${120 - shoulder} 120Z"/>
    <path fill="none" stroke="${trim}" stroke-width="1.7" d="${collar}"/>
    ${blueprint.coat === 'plate' ? `<path fill="${light}" stroke="${trim}" d="M13 112l6-17 17-5 7 14-8 14zm94 0-6-17-17-5-7 14 8 14z"/>` : ''}
    ${blueprint.coat === 'mantle' ? `<path fill="${shade}" stroke="${trim}" d="M17 102l17-19 16 19 9 6 10-6 16-19 18 19-3 13-41-5-40 5Z"/>` : ''}
    ${blueprint.accessory === 'scarf' ? `<path fill="${light}" stroke="${trim}" d="M41 77q18 11 36 0l-3 13q-16 11-32 0zm20 18 8-4 7 27-13-5Z"/>` : ''}
    ${blueprint.accessory === 'brooch' ? `<path fill="${trim}" stroke="${shade}" d="m77 97 5 5-5 5-5-5Z"/>` : ''}
    ${blueprint.accessory === 'satchel' ? `<path fill="none" stroke="${trim}" stroke-width="4" d="M81 85 38 120"/>` : ''}`
  const drawing = `
    <defs>
      <linearGradient id="coat" x2=".8" y2="1"><stop stop-color="${light}"/><stop offset=".65" stop-color="${fabric}"/><stop offset="1" stop-color="${shade}"/></linearGradient>
      <linearGradient id="skin" x1="0" x2="1" y1=".25" y2=".8"><stop stop-color="${skinLight}"/><stop offset=".58" stop-color="${skin}"/><stop offset="1" stop-color="${skinShade}"/></linearGradient>
      <radialGradient id="paper"><stop stop-color="#877a65"/><stop offset="1" stop-color="#282a32"/></radialGradient>
    </defs>
    <path fill="url(#paper)" d="M0 0h120v120H0z"/>
    <path fill="none" stroke="${trim}" stroke-opacity=".55" d="M8 8h104v104H8z M11 11h98v98H11z"/>
    <circle cx="60" cy="55" r="40" fill="none" stroke="${trim}" stroke-opacity=".35"/>
    ${blueprint.hair === 'braid' ? `<path fill="${hair}" stroke="${hairLight}" stroke-width="2" d="M75 36q20 14 8 30t2 31l-8 6q-9-15-4-31t2-36Z"/>` : ''}
    <path fill="${skinShade}" d="M47 63l-2 20 14 13 16-14-5-20z"/>
    ${clothes}
    <path fill="url(#skin)" stroke="${skinShade}" stroke-width="1.2" d="M39 41Q35 35 34 48q0 9 7 10l3 10q5 10 15 12 10-2 17-13l2-10q8-1 8-10-1-11-8-5L76 33Q61 18 41 32Z"/>
    <path fill="${hair}" stroke="${hairLight}" stroke-width="1.4" d="${hairShapes[blueprint.hair]}"/>
    <path fill="none" stroke="${hairLight}" stroke-opacity=".65" d="M39 27q13-13 25-8m-25 12q10-8 19-9m6-2 9 3"/>
    <path fill="none" stroke="${skinShade}" d="M57 51l-2 8 6 1m-12 9 8 4 9-3"/>
    <path fill="none" stroke="${hair}" stroke-width="1.6" stroke-linecap="round" d="${brows}"/>
    <path fill="none" stroke="#251e24" stroke-width="1.35" stroke-linecap="round" d="${eyes}"/>
    <path fill="${mood === 'happy' || mood === 'surprised' ? '#4b2d37' : 'none'}" stroke="#593643" stroke-width="1.5" stroke-linecap="round" d="${mouth}"/>
    <path fill="none" stroke="${skinLight}" stroke-opacity=".65" d="M43 55l5 1m20 0 6-2"/>
  `
  return icon
    ? svg(64, 64, `<g transform="scale(.64) translate(-10 -8)">${drawing}</g>`)
    : svg(120, 120, drawing)
}

function sprite(
  blueprint: Exclude<AppearanceBlueprint, AnyPaintedAppearanceBlueprint>,
  facing: AppearanceFacing,
  pose: AppearancePose | 'walk-base',
  frame: number,
  motion = false,
  frontal = false,
) {
  const [fabric, shade, light, trim] = palettes[blueprint.palette]
  const [skin, skinShade, skinLight] = skins[blueprint.complexion]
  const [hair, hairLight] = hairs[blueprint.hairColor]
  const back = facing === 'north'
  const profile = facing === 'east' || facing === 'west'
  const shoulder = { slight: 6, average: 8, broad: 10 }[blueprint.body]
  const legacyHems: Partial<Record<AppearanceBlueprint['coat'], number>> = {
    tunic: 39,
    longcoat: 48,
    mantle: 43,
    plate: 40,
  }
  const hemY = legacyHems[blueprint.coat] ?? 40
  const garment = garmentFor(blueprint.coat)
  const walk = pose === 'walk' ? (motion ? rounded(swing[frame]! * 3.2) : [0, 4, -4][frame]!) : 0
  const rise =
    pose === 'walk' ? (motion ? rounded(0.5 * (1 - swing[frame]! ** 2)) : Number(frame !== 0)) : 0
  const cuff = blueprint.sleeves === 'puffed' ? 4.4 : blueprint.sleeves === 'split' ? 3.2 : 2.6
  const reach =
    pose === 'attack' ? [0, 7, 12][frame]! : pose === 'cast' ? [1, 4, 6][frame]! : -walk / 2
  const arm =
    motion && (pose === 'attack' || pose === 'cast')
      ? Math.min(reach, 46 - (26 + shoulder + cuff + 0.5))
      : reach
  const tilt =
    pose === 'down'
      ? -78
      : pose === 'hit'
        ? [0, -12, -5][frame]!
        : motion && pose === 'walk'
          ? rounded(passingStride(frame) * 0.5)
          : 0
  const look = facing === 'west' ? -1 : 1
  const hem = {
    plain: `L${24 - shoulder} ${hemY}`,
    split: `L26 ${hemY}l-2-5-2 5H${24 - shoulder}`,
    pointed: `L24 ${hemY + 4} ${24 - shoulder} ${hemY}`,
  }[blueprint.hem]
  const transform =
    motion && pose === 'idle'
      ? readyStance(facing, frame)
      : motion && pose === 'down'
        ? downStance(facing)
        : `translate(${pose === 'down' ? 12 : 0} ${-rise}) rotate(${tilt} 24 53)`
  return `
    ${pose !== 'walk-base' ? `<ellipse cx="24" cy="${motion && pose === 'down' ? 55 : 58}" rx="${pose === 'down' ? 16 : 12}" ry="3" fill="#171d23" fill-opacity=".42"/>` : ''}
    <g transform="${transform}">
      <g transform="translate(24 0) scale(${look} 1) translate(-24 0)">
        ${
          blueprint.v !== 1 && blueprint.lower !== 'original'
            ? renderLowerGarment(
                blueprint.lower,
                palettes[blueprint.palette],
                skin,
                walk,
                (profile ? 0.88 : 1) * { slight: 0.94, average: 1, broad: 1.06 }[blueprint.body],
              )
            : garment
              ? wardrobeLegs(palettes[blueprint.palette], walk)
              : `<path fill="none" stroke="#28242a" stroke-width="7" stroke-linecap="round" d="M21 40l${-walk - 1} 15m7-15 ${walk + 1} 15"/>
        <path fill="none" stroke="${shade}" stroke-width="4" stroke-linecap="round" d="M21 40l${-walk - 1} 12m7-12 ${walk + 1} 12"/>
        <path fill="#392d31" stroke="#211f25" d="${pose === 'walk-base' || (frontal && facing === 'south') ? 'M18 53h5l-.2 5H16v-2Zm8 0h5l2 3v2h-7Z' : `M${18 - walk} 53h6v5h-8v-2Zm${13 + 2 * walk} 0h6l2 3v2h-8Z`}"/>`
        }
        ${
          garment
            ? `<g transform="translate(24 0) scale(${profile ? '.84' : '1'} 1) translate(-24 0)">${wardrobeArms(garment, blueprint, palettes[blueprint.palette], skin, walk, arm, profile)}${wardrobeBody(garment, blueprint, palettes[blueprint.palette], back)}</g>`
            : `${blueprint.coat === 'mantle' ? `<path fill="${shade}" stroke="${trim}" d="M${24 - shoulder} 24q-3 12-5 23l8-2 5 3 9-3-4-21Z"/>` : ''}
        <path fill="none" stroke="#25222a" stroke-width="${cuff * 2 + 1}" stroke-linecap="round" d="M${24 - shoulder} 26l${-2 + walk / 2} 9m${2 * shoulder + 2 - walk / 2}-9 ${2 + arm} ${9 - arm / 1.4}"/>
        <path fill="none" stroke="${fabric}" stroke-width="${cuff * 2}" stroke-linecap="round" d="M${24 - shoulder} 26l${-2 + walk / 2} 9m${2 * shoulder + 2 - walk / 2}-9 ${2 + arm} ${9 - arm / 1.4}"/>
        <circle cx="${22 - shoulder + walk / 2}" cy="37" r="2.2" fill="${skin}"/>
        <circle cx="${26 + shoulder + arm}" cy="${37 - arm / 1.4}" r="2.3" fill="${skin}"/>
        <path fill="${fabric}" stroke="#25222a" stroke-width="1.1" d="M${24 - shoulder} 24l4-4h${shoulder * 2 - 8}l4 4-1 9 1 ${hemY - 33}${hem}l1 ${33 - hemY}Z"/>
        <path fill="none" stroke="${light}" stroke-width="1" d="M${25 - shoulder} 27l2 7-2 ${hemY - 36}m${shoulder * 2 - 2} -${hemY - 27}l-2 7 2 ${hemY - 36}"/>
        <path fill="none" stroke="${trim}" stroke-width="1.2" d="M${25 - shoulder} 36h${2 * shoulder - 2}m0 ${hemY - 38}h-${2 * shoulder - 2}"/>
        ${blueprint.collar === 'fur' ? `<path fill="none" stroke="#d7c2a2" stroke-width="2.6" d="M${25 - shoulder} 23l3 2 2-2 3 4 3-4 2 2 3-2"/>` : `<path fill="none" stroke="${trim}" stroke-width="1.3" d="m${blueprint.collar === 'standing' ? 19 : 17} 22 5 7 5-7"/>`}
        ${blueprint.coat === 'plate' ? `<path fill="${light}" stroke="${trim}" d="M14 27l3-5 5 4-2 5h-5zm20 0-3-5-5 4 2 5h5Z"/>` : ''}
        ${!back && blueprint.closure === 'lacing' ? `<path fill="none" stroke="${trim}" stroke-width=".7" d="m22 28 4 4-4 3m4-7-4 4 4 3"/>` : ''}
        ${!back && blueprint.closure === 'clasps' ? `<path fill="none" stroke="${trim}" stroke-width="1" d="M21 29h6m-6 3h6"/>` : ''}
        ${!back && blueprint.closure === 'buttons' ? `<path stroke="${trim}" stroke-width="1.3" stroke-linecap="round" d="M24 28v.1m0 2v.1m0 2v.1"/>` : ''}
        ${blueprint.textile === 'brocade' ? `<path fill="none" stroke="${trim}" stroke-width=".6" d="m19 29 1 2-1 2-1-2Zm10 0 1 2-1 2-1-2Z"/>` : ''}
        ${blueprint.textile === 'quilt' ? `<path fill="none" stroke="${light}" stroke-width=".7" d="m17 28 5 5m1-5 5 5m1-5 4 4"/>` : ''}
        ${blueprint.accessory === 'satchel' ? `<path fill="none" stroke="${trim}" stroke-width="1.4" d="m30 23-12 13"/><path fill="#886445" stroke="#3a2930" d="M16 34h6v6h-6Z"/>` : ''}
        ${blueprint.accessory === 'scarf' ? `<path fill="none" stroke="${light}" stroke-width="2.4" d="M18 22q6 4 12 0l${3 + walk / 2} 11"/>` : ''}
        ${blueprint.accessory === 'brooch' ? `<path fill="${trim}" d="m28 24 2 2-2 2-2-2Z"/>` : ''}`
        }
        ${blueprint.hair === 'braid' ? `<path fill="none" stroke="${hair}" stroke-width="3.7" d="M19 14q-6 6-3 14t-2 8"/><path stroke="${trim}" d="m14 31 3 1"/>` : ''}
        <path fill="${skin}" stroke="${skinShade}" d="M18 12q7-5 12 0l${profile ? 2 : 0} 4-2 1-1 5q-5 4-10-1Z"/>
        <path fill="${hair}" stroke="${hairLight}" stroke-width=".8" d="${
          {
            crop: 'M17 17q-1-9 6-9 8-1 8 7l-4-2-6 2-2 3Z',
            swept: 'M17 17q-3-5 2-9 6-4 13 0l-2 8-3-4-8 5Z',
            braid: 'M17 19q-3-7 2-11 6-5 12 2l1 6-4-4-8 4-1 3Z',
            curls: 'M17 18q-3 0-2-4l1-3q-1-4 4-3 2-4 5-1 4-3 7 2l-1 7-3-3-7 1-1 4Z',
          }[blueprint.hair]
        }"/>
        ${back ? `<path fill="${hair}" stroke="${hairLight}" stroke-width=".55" d="M18 12q7-5 12 0l-1 8-5 2-5-2Z"/>` : `<path fill="none" stroke="${skinLight}" stroke-width=".75" d="M22 17l2 1m3-1 2 1"/><path stroke="#312329" d="M${profile ? 28 : frontal ? 20 : 22} 16h1${profile ? '' : frontal ? 'm6 0h1' : 'm3 0h1'}"/>`}
        ${pose === 'cast' && frame > 0 ? `<path fill="${trim}" fill-opacity=".75" d="m${26 + shoulder + arm} ${23 - arm / 1.4} 2 4-2 4-2-4Z"/>` : ''}${motion && pose === 'attack' && frame === 2 ? '<path d="M34 21q6 1 9 8" fill="none" stroke="#ecdaa8" stroke-width="1.4" stroke-linecap="round" opacity=".72"/>' : ''}
      </g>
    </g>`
}

const paintedFrameClips =
  '<clipPath id="upper-body"><path d="M0 0h48v46H0z"/></clipPath><clipPath id="lower-body"><path d="M0 45h48v19H0z"/></clipPath>'

const originalSkinMidtones = {
  pinescout: [191, 123, 78],
  scout: [180, 127, 95],
  ranger: [170, 122, 92],
  guard: [120, 84, 62],
  elder: [180, 132, 100],
} as const

// Replace just the south-facing cell. The existing side and rear sources retain their
// exact original pixels and registration in every skin and clothing layer.
function frontalSheet(source: string, front: string) {
  return `<g><svg x="128" y="0" width="384" height="176" viewBox="128 0 384 176" overflow="hidden"><image href="${source}" width="512" height="176"/></svg><image href="${front}" width="128" height="176"/></g>`
}

function wardrobeSkinDye(
  blueprint: WardrobeAppearanceBlueprint | PaintedPlayerAppearanceBlueprint,
  mask: string,
  width: number,
  height: number,
  frontalMask?: string,
) {
  const color =
    WARDROBE_SKIN_TONES[blueprint.skinTone].rgb ??
    (blueprint.v === 6 && width === 512 ? naturalFaceSkin(blueprint.faceId) : null)
  if (!color) return ''
  const midpoint = originalSkinMidtones[blueprint.identity]
  const matrix = color
    .map((channel, i) =>
      [...[0, 1, 2].map((n) => (n === i ? 0.9 : 0)), 0, (channel - midpoint[i]! * 0.9) / 255].join(
        ' ',
      ),
    )
    .join(' ')
  return `<mask id="wardrobe-skin" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">${frontalMask ? frontalSheet(mask, frontalMask) : `<image href="${mask}" width="${width}" height="${height}"/>`}</mask>
    <filter id="wardrobe-skin-dye" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${matrix} 0 0 0 1 0"/></filter>`
}

function paintedSkinComposite(id: string) {
  return `<use href="#${id}"/><g mask="url(#wardrobe-skin)"><use href="#${id}" filter="url(#wardrobe-skin-dye)"/></g>`
}

function paintedPlayerPortrait(
  blueprint: PaintedPlayerAppearanceBlueprint,
  expression: AppearanceExpression,
  icon: boolean,
) {
  const {
    identity,
    backdrop,
    skinTone,
    bodyFrame,
    hairstyle,
    hairDye,
    eyeColor,
    outerwear,
    gear,
    headwear,
    facewear,
  } = blueprint
  if (
    !blueprint.faceId &&
    identity === 'pinescout' &&
    backdrop === 'original' &&
    skinTone === 'natural' &&
    bodyFrame === 'natural' &&
    hairstyle === 'natural' &&
    hairDye === 'natural' &&
    eyeColor === 'natural' &&
    outerwear === 'none' &&
    gear === 'none' &&
    headwear === 'none' &&
    facewear === 'none'
  )
    return paintedPortrait(0, expression, icon)!

  const source =
    identity === 'pinescout'
      ? PINE_SCOUT_CUTOUTS[expression]
      : PAINTED_ACTOR_PORTRAITS[identity][expression]
  const skinMask =
    identity === 'pinescout'
      ? PINE_SCOUT_PORTRAIT_SKIN[expression]
      : PAINTED_PORTRAIT_SKIN_MASKS[identity][expression]
  const skin = wardrobeSkinDye(blueprint, skinMask, 256, 256)
  const featureDyes = paintedFeatureDyes(blueprint, expression)
  const photo =
    (skin ? paintedSkinComposite('wardrobe-portrait') : '<use href="#wardrobe-portrait"/>') +
    paintedFeatureComposite(blueprint, 'wardrobe-portrait')
  const painting = facePainting(blueprint.faceId)
  const painted = painting && faceLayers(blueprint, painting, expression)
  const fitted = Boolean(blueprint.faceId)
  const [backHair, frontHair] = paintedHairLayers(blueprint)
  const wardrobe = paintedPortraitWardrobe(blueprint, painted?.head ?? photo, Boolean(painted))
  const equipment = paintedPlayerPortraitEquipment(blueprint, expression, painted?.fit)
  const hat = fittedPortraitHat(blueprint, expression, painted?.fit)
  const subject = backHair + wardrobe.art + frontHair
  const art =
    (hat
      ? `<defs><clipPath id="under-brim"><path d="M0 ${hat.bottom - hat.h * 0.24} Q128 ${hat.bottom - hat.h * 0.27} 256 ${hat.bottom - hat.h * 0.3} V256H0Z"/></clipPath></defs><g clip-path="url(#under-brim)">${subject}</g>`
      : subject) + equipment
  const fittedScale = hat ? Math.min(1, 249 / (256 - hat.top)) : 1
  const framed = fitted
    ? `<g transform="translate(${128 * (1 - fittedScale)} ${256 * (1 - fittedScale)}) scale(${fittedScale})">${art}</g>`
    : headwear === 'arcanist'
      ? `<g transform="translate(26 61) scale(.79)">${art}</g>`
      : headwear === 'furcap'
        ? `<g transform="translate(15 49) scale(.85)">${art}</g>`
        : art
  const portrait = icon ? `<g transform="translate(-11 -4) scale(.34)">${framed}</g>` : framed
  const size = icon ? 64 : 256
  const studio = studioColor(backdrop)
  const scene =
    !studio &&
    (backdrop === 'original'
      ? PAINTED_STUDIO_PAPER
      : PAINTED_BACKDROPS[
          backdrop as Exclude<typeof backdrop, 'original' | StudioColor | PatternedBackdrop>
        ])
  const background = studio
    ? `<defs><radialGradient id="studio-light" cx=".40" cy=".32" r=".9"><stop stop-color="${studio[1]}"/><stop offset=".58" stop-color="${studio[2]}"/><stop offset="1" stop-color="${studio[3]}"/></radialGradient></defs><rect width="${size}" height="${size}" fill="url(#studio-light)"/>`
    : `<image href="${scene}" width="${size}" height="${size}"/>`
  const definitions = `<defs>${painted ? painted.defs : `<image id="wardrobe-portrait" href="${source}" width="256" height="256"/>${skin}${featureDyes}`}${wardrobe.definitions}${paintedEquipmentDyes(blueprint)}</defs>`
  return svg(size, size, definitions + background + portrait)
}

function paintedCharacterPortrait(
  blueprint: AnyPaintedAppearanceBlueprint,
  expression: AppearanceExpression,
  icon: boolean,
) {
  if (blueprint.v === 6) return paintedPlayerPortrait(blueprint, expression, icon)
  const source = PAINTED_ACTOR_PORTRAITS[blueprint.identity][expression]
  const size = icon ? 64 : 256
  const skin =
    blueprint.v === 5
      ? wardrobeSkinDye(
          blueprint,
          PAINTED_PORTRAIT_SKIN_MASKS[blueprint.identity][expression],
          256,
          256,
        )
      : ''
  const featureDyes = blueprint.v === 5 ? paintedFeatureDyes(blueprint, expression) : ''
  const featureComposite =
    blueprint.v === 5 ? paintedFeatureComposite(blueprint, 'wardrobe-portrait') : ''
  const [backHair, frontHair] = blueprint.v === 5 ? paintedHairLayers(blueprint) : ['', '']
  const body = skin
    ? paintedSkinComposite('wardrobe-portrait')
    : featureDyes
      ? '<use href="#wardrobe-portrait"/>'
      : `<image href="${source}" width="256" height="256"/>`
  const art = backHair + body + featureComposite + frontHair + paintedPortraitEquipment(blueprint)
  const framed =
    blueprint.headwear === 'arcanist'
      ? `<g transform="translate(31 76) scale(.76)">${art}</g>`
      : blueprint.headwear === 'furcap'
        ? `<g transform="translate(18 44) scale(.86)">${art}</g>`
        : art
  const portrait = icon ? `<g transform="translate(-14 0) scale(.359375)">${framed}</g>` : framed
  return svg(
    size,
    size,
    `
    <defs><radialGradient id="paper"><stop stop-color="#8d8069"/><stop offset="1" stop-color="#29282d"/></radialGradient>
    ${paintedEquipmentDyes(blueprint)}${skin || featureDyes ? `<image id="wardrobe-portrait" href="${source}" width="256" height="256"/>${skin}${featureDyes}` : ''}</defs>
    <rect width="${size}" height="${size}" fill="url(#paper)"/>${portrait}`,
  )
}

type PaintedDye = PaintedWardrobeLook['clothColor']

function paintedLayer(facing: AppearanceFacing, layer: string, color?: PaintedDye) {
  const column = APPEARANCE_FACINGS.indexOf(facing)
  const art = `<use href="#painted-${layer}"/>`
  const filtered = color && color !== 'natural' ? `<g filter="url(#dye-${layer})">${art}</g>` : art
  return `<svg x="3.52" y="7.44" width="40.96" height="56.32" viewBox="${column * 128} 0 128 176" overflow="hidden">${filtered}</svg>`
}

function paintedLayerDefinition(layer: string, source: string, color?: PaintedDye) {
  return `<image id="painted-${layer}" href="${source}" width="512" height="176"/>${paintedDyeFilter(`dye-${layer}`, color)}`
}

function renderSpriteAtlas(
  definitions: string,
  draw: (facing: AppearanceFacing, pose: AppearancePose, frame: number) => string,
  motion = false,
) {
  const { width, height, frames, columns, rows } = motion
    ? APPEARANCE_MOTION_FRAME
    : APPEARANCE_FRAME
  const frameIndex = motion ? appearanceMotionFrameIndex : appearanceFrameIndex
  const drawings = APPEARANCE_POSES.flatMap((pose) =>
    APPEARANCE_FACINGS.flatMap((facing) =>
      Array.from(
        { length: pose === 'idle' || pose === 'walk' ? frames : APPEARANCE_FRAME.frames },
        (_, frame) => {
          const { column, row } = frameIndex(facing, pose, frame)
          return `<svg x="${column * width}" y="${row * height}" width="${width}" height="${height}" overflow="hidden">${draw(facing, pose, frame)}</svg>`
        },
      ),
    ),
  )
  return svg(columns * width, rows * height, definitions + drawings.join(''))
}

const paintedWalkClips = `
  <clipPath id="painted-torso"><rect width="48" height="46"/></clipPath>
  <clipPath id="painted-left-leg"><path d="M0 45h24v19H0z"/></clipPath>
  <clipPath id="painted-right-leg"><path d="M24 45h24v19H24z"/></clipPath>`

const motionWalkClips = `
  <clipPath id="motion-upper"><rect width="48" height="44"/></clipPath>
  <clipPath id="motion-left"><path d="M0 43h24v21H0z"/></clipPath>
  <clipPath id="motion-right"><path d="M24 43h24v21H24z"/></clipPath>`

// Depth motion deforms the complete dressed actor with a single continuous field.
// The front and rear cycles each have a planted boot, a passing knee and a reciprocal arm.
const depthWalkFilters = Object.entries(DEPTH_WALK_MAPS)
  .flatMap(([facing, maps]) =>
    maps.map(
      (map, frame) =>
        `<filter id="depth-${facing}-${frame}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="0" y="0" width="48" height="64" color-interpolation-filters="sRGB"><feImage href="${map}" x="0" y="0" width="48" height="64" result="stride"/><feDisplacementMap in="SourceGraphic" in2="stride" scale="${DEPTH_WALK_SCALE}" xChannelSelector="R" yChannelSelector="G"/></filter>`,
    ),
  )
  .join('')

function depthWalkFrame(facing: 'north' | 'south', frame: number, actor: string, equipment = '') {
  // Long weapons and rigid packs follow their torso attachment without bending at the knees.
  const anchored = equipment
    ? `<g transform="translate(0 ${rounded(0.2 - 0.55 * swing[frame]! ** 2)})">${equipment}</g>`
    : ''
  return `<ellipse cx="24" cy="58" rx="11" ry="2.5" fill="#171d23" fill-opacity=".4"/><g filter="url(#depth-${facing}-${frame})">${actor}</g>${anchored}`
}

function paintedWalkMotion(facing: AppearanceFacing, frame: number, body: string, wardrobe = '') {
  const step = swing[frame]!
  const passing = passingStride(frame)
  const profile = facing === 'east' || facing === 'west'
  const direction = facing === 'west' ? -1 : 1
  const stride = step * (profile ? 9.5 * direction : 1.6)
  const torsoShift = step * (profile ? 0.55 * direction : 0.22)
  const torsoRise = 0.55 * (1 - step ** 2)

  const leg = (side: 'left' | 'right', sign: number) => {
    const swingLift = Math.max(0, passing * sign) * (profile ? 0.135 : 0.12)
    const skew = stride * sign
    return `<g transform="translate(24 43) skewX(${rounded(skew)}) scale(1 ${rounded(1 - swingLift)}) translate(-24 -43)"><g clip-path="url(#motion-${side})">${body}</g></g>`
  }

  return `<ellipse cx="24" cy="58" rx="11" ry="2.5" fill="#171d23" fill-opacity=".4"/>
    ${leg('left', 1)}${leg('right', -1)}
    <g transform="translate(${rounded(torsoShift)} ${rounded(-torsoRise)}) rotate(${rounded(step * direction * 0.85)} 24 43)">
      <g clip-path="url(#motion-upper)">${body}</g>${wardrobe}
    </g>`
}

function paintedCharacterWalk(facing: AppearanceFacing, frame: number) {
  const body = `<use href="#painted-body-${facing}"/>`
  const gear = `<use href="#painted-gear-${facing}"/>`
  const head = `<use href="#painted-equipment-${facing}"/>`
  const clothing = `<use href="#painted-clothing-${facing}"/>`
  if (!frame)
    return paintedSprite(facing, 'walk', frame, `<use href="#painted-character-${facing}"/>`)
  const step = frame === 1 ? 1 : -1
  const profile = facing === 'east' || facing === 'west'
  const direction = facing === 'west' ? -1 : 1
  const x = step * (profile ? 1.9 * direction : 0.65)
  const y = step * (profile ? 0.65 : 1.15)
  return `
    <ellipse cx="24" cy="58" rx="11" ry="2.5" fill="#171d23" fill-opacity=".4"/>
    <g clip-path="url(#painted-torso)" transform="translate(0 -.6)">${body}</g>
    <g transform="translate(${x} ${y})"><g clip-path="url(#painted-left-leg)">${body}</g></g>
    <g transform="translate(${-x} ${-y})"><g clip-path="url(#painted-right-leg)">${body}</g></g>
    <g transform="rotate(${step * 1.4} 24 25) translate(0 -.6)">${clothing}</g>
    <g transform="translate(0 -.6)">${gear}${head}</g>`
}

const wardrobeOuterLayers = { ...PAINTED_OUTER_LAYERS, ...WARDROBE_OUTER_LAYERS }
const wardrobeGearLayers = { ...PAINTED_ACCESSORY_LAYERS, ...WARDROBE_GEAR_LAYERS }
const wardrobeBodyClips =
  '<clipPath id="wardrobe-head"><rect width="48" height="26"/></clipPath><clipPath id="wardrobe-torso"><path d="M0 26h48v38H0z"/></clipPath>'

function renderPaintedCharacterAtlas(
  blueprint: AnyPaintedAppearanceBlueprint,
  motion: boolean,
  depthWalk: boolean,
) {
  const { outerwear, clothColor, gear, gearColor } = blueprint
  const source =
    blueprint.v === 6
      ? PAINTED_PLAYER_SPRITES[blueprint.identity]
      : PAINTED_ACTORS[blueprint.identity]
  const front = depthWalk ? FRONTAL_ACTORS[blueprint.identity] : undefined
  const skin =
    blueprint.v !== 4
      ? wardrobeSkinDye(
          blueprint,
          blueprint.v === 6
            ? PAINTED_PLAYER_FIELD_SKIN_MASKS[blueprint.identity]
            : PAINTED_FIELD_SKIN_MASKS[blueprint.identity],
          512,
          176,
          front?.skin,
        )
      : ''
  const featureDyes = blueprint.v !== 4 ? paintedFeatureDyes(blueprint, undefined, depthWalk) : ''
  const featureComposite =
    blueprint.v !== 4 ? paintedFeatureComposite(blueprint, 'wardrobe-body') : ''
  const scaling = blueprint.v !== 4 ? WARDROBE_FRAMES[blueprint.bodyFrame].torsoScale : 1
  const hood = outerwear === 'hooded'
  const actorImage = (id: string) =>
    front
      ? `<g id="${id}">${frontalSheet(source, front.body)}</g>`
      : `<image id="${id}" href="${source}" width="512" height="176"/>`
  const layers = [
    skin || featureDyes
      ? `${actorImage('wardrobe-body')}${skin}${featureDyes}<g id="painted-body">${skin ? paintedSkinComposite('wardrobe-body') : '<use href="#wardrobe-body"/>'}${featureComposite}</g>`
      : actorImage('painted-body'),
  ]
  if (outerwear !== 'none')
    layers.push(paintedLayerDefinition('clothing', wardrobeOuterLayers[outerwear], clothColor))
  if (gear !== 'none')
    layers.push(paintedLayerDefinition('gear', wardrobeGearLayers[gear], gearColor))
  const fit = (art: string) =>
    scaling === 1 || !art
      ? art
      : `<g transform="translate(24) scale(${scaling} 1) translate(-24)">${art}</g>`
  const face = blueprint.v === 6 ? facePainting(blueprint.faceId) : null
  if (face) {
    layers.push(
      `<image id="field-face-front" href="${face.front}" width="40" height="46"/><image id="field-face-side" href="${face.field}" width="38" height="46"/>`,
    )
  }
  const parts = APPEARANCE_FACINGS.map((facing) => {
    const [backHair, frontHair] =
      blueprint.v !== 4 ? paintedHairLayers(blueprint, facing) : ['', '']
    let faceLayer = ''
    if (face && blueprint.v === 6 && facing !== 'north') {
      const { x, y, w } = fieldFaceAnchor(blueprint.identity, facing)
      const h = w * 1.24
      const view = facing === 'south' ? 'front' : 'side'
      const mirror = facing === 'west' ? `translate(${2 * x} 0) scale(-1 1)` : ''
      const faceArt = fieldFacePaint(blueprint, facing)
      faceLayer = `<g transform="translate(3.52 7.44) scale(.32) ${mirror}"><svg x="${x - w * 0.5}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${view === 'front' ? 40 : 38} 46" overflow="hidden">${faceArt}</svg></g>`
    }
    const naturalBody =
      backHair +
      paintedLayer(facing, 'body') +
      (faceLayer ? `<use href="#painted-face-${facing}"/>` : '') +
      frontHair
    const head = `<g clip-path="url(#wardrobe-head)">${naturalBody}</g>`
    const body =
      scaling === 1
        ? naturalBody
        : `${head}<g clip-path="url(#wardrobe-torso)">${fit(naturalBody)}</g>`
    const clothing = outerwear === 'none' ? '' : fit(paintedLayer(facing, 'clothing', clothColor))
    const accessory = gear === 'none' ? '' : fit(paintedLayer(facing, 'gear', gearColor))
    return `${faceLayer ? `<g id="painted-face-${facing}">${faceLayer}</g>` : ''}<g id="painted-body-${facing}">${body}</g>
      <g id="painted-clothing-${facing}">${clothing}</g><g id="painted-gear-${facing}">${accessory}</g>
      <g id="painted-equipment-${facing}">${hood ? head : ''}${paintedFieldEquipment(blueprint, facing, depthWalk)}</g>
      <g id="painted-character-${facing}"><use href="#painted-body-${facing}"/>
        <use href="#painted-clothing-${facing}"/><use href="#painted-gear-${facing}"/>
        <use href="#painted-equipment-${facing}"/></g>`
  }).join('')
  const definitions = `<defs>${motion ? motionWalkClips : paintedWalkClips}${depthWalk ? depthWalkFilters : ''}${scaling !== 1 || hood ? wardrobeBodyClips : ''}${paintedEquipmentDyes(blueprint)}${layers.join('')}${parts}</defs>`
  return renderSpriteAtlas(
    definitions,
    (facing, pose, frame) => {
      const complete = `<use href="#painted-character-${facing}"/>`
      if (pose !== 'walk') return paintedSprite(facing, pose, frame, complete, motion)
      if (!motion) return paintedCharacterWalk(facing, frame)
      if (depthWalk && (facing === 'north' || facing === 'south'))
        return depthWalkFrame(
          facing,
          frame,
          `<use href="#painted-body-${facing}"/><use href="#painted-clothing-${facing}"/>`,
          `<use href="#painted-gear-${facing}"/><use href="#painted-equipment-${facing}"/>`,
        )
      return paintedWalkMotion(
        facing,
        frame,
        `<use href="#painted-body-${facing}"/>`,
        `<use href="#painted-clothing-${facing}"/><use href="#painted-gear-${facing}"/><use href="#painted-equipment-${facing}"/>`,
      )
    },
    motion,
  )
}

export function renderAppearanceAsset(
  blueprint: AppearanceBlueprint,
  asset: AppearanceAsset,
  illustrated = false,
): string {
  const depthWalk = asset === 'motion-v2'
  const motion = asset === 'motion' || depthWalk
  if (
    blueprint.v === 6 &&
    (illustrated ||
      Object.hasOwn(FITTED_HEADWEAR, blueprint.headwear) ||
      Object.hasOwn(FITTED_FACEWEAR, blueprint.facewear) ||
      blueprint.apparentAge ||
      blueprint.facialHair ||
      blueprint.hairAccent ||
      blueprint.secondEye ||
      blueprint.scar ||
      !Object.hasOwn(WARDROBE_EYE_COLORS, blueprint.eyeColor) ||
      blueprint.faceId?.endsWith('soft') ||
      blueprint.faceId?.endsWith('keen') ||
      !Object.hasOwn(WARDROBE_HAIRSTYLES, blueprint.hairstyle) ||
      patternedBackdrop(blueprint.backdrop))
  ) {
    if (asset !== 'atlas' && asset !== 'motion' && asset !== 'motion-v2')
      return illustratedPortrait(blueprint, asset === 'icon' ? 'neutral' : asset, asset === 'icon')
    const heads = APPEARANCE_FACINGS.map((facing) =>
      illustratedSpriteHead(blueprint, facing, 'painted-' + facing),
    )
    const frames = motion ? APPEARANCE_MOTION_FRAME.frames : APPEARANCE_FRAME.frames
    return renderSpriteAtlas(
      `<defs>${illustratedSpriteMaterials(blueprint)}${heads.join('')}</defs>`,
      (facing, pose, frame) =>
        illustratedSprite(blueprint, facing, pose, frame, frames, 'painted-' + facing),
      motion,
    )
  }
  if (blueprint.v === 4 || blueprint.v === 5 || blueprint.v === 6)
    return asset === 'atlas' || motion
      ? renderPaintedCharacterAtlas(blueprint, motion, depthWalk)
      : paintedCharacterPortrait(blueprint, asset === 'icon' ? 'neutral' : asset, asset === 'icon')
  const preset = matchingPresetIndex(blueprint)
  if (asset !== 'atlas' && !motion) {
    const expression = asset === 'icon' ? 'neutral' : asset
    return (
      paintedPortrait(preset, expression, asset === 'icon') ??
      portrait(blueprint, expression, asset === 'icon')
    )
  }
  const { width } = APPEARANCE_FRAME
  const painted = PAINTED_PRESET_SPRITES[preset]
  const presetFront = depthWalk
    ? [FRONTAL_ACTORS.pinescout, FRONTAL_ACTORS.winterguard, FRONTAL_ACTORS.emberenvoy][preset]
    : undefined
  const actorDefinitions = painted
    ? `${motion ? motionWalkClips : paintedFrameClips}${painted
        .map((part, index) => {
          if (presetFront && index === 0) {
            const scale = 52 / presetFront.height
            return `<image id="body-south" href="${presetFront.body}" x="${24 - 64 * scale}" y="${6 - presetFront.top * scale}" width="${128 * scale}" height="${176 * scale}"/>`
          }
          return `<image id="body-${APPEARANCE_FACINGS[index]}" href="${part.uri}" x="${(width - part.width) / 2}" y="6" width="${part.width}" height="52"/>`
        })
        .join('')}`
    : ''
  const vectorWalkBases =
    !painted && depthWalk
      ? (['south', 'north'] as const)
          .map(
            (facing) =>
              `<g id="body-${facing}">${sprite(blueprint, facing, 'walk-base', 0, false, facing === 'south')}</g>`,
          )
          .join('')
      : ''
  const definitions =
    painted || depthWalk
      ? `<defs>${actorDefinitions}${vectorWalkBases}${depthWalk ? depthWalkFilters : ''}</defs>`
      : ''
  return renderSpriteAtlas(
    definitions,
    (facing, pose, frame) => {
      if (depthWalk && pose === 'walk' && (facing === 'north' || facing === 'south')) {
        return depthWalkFrame(facing, frame, `<use href="#body-${facing}"/>`)
      }
      if (!painted)
        return sprite(blueprint, facing, pose, frame, motion, depthWalk && facing === 'south')
      const body = `<use href="#body-${facing}"/>`
      return motion && pose === 'walk'
        ? paintedWalkMotion(facing, frame, body)
        : paintedSprite(facing, pose, frame, body, motion)
    },
    motion,
  )
}
