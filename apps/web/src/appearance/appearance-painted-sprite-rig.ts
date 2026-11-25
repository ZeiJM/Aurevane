import type { AppearanceFacing, AppearancePose } from './appearance-manifest'
import { PAINTED_SPRITE_PARTS } from './appearance-painted-sprite-parts.generated'

type Outfit = Readonly<Record<'front' | 'back' | 'side' | 'sleeve', string>>
type Part = keyof typeof PAINTED_SPRITE_PARTS | `worn-outfit-${keyof Outfit}`
type Point = readonly [x: number, y: number]

export const PAINTED_SPRITE_COLLAR_Y = 17

export function paintedSpriteRigDefinitions(outfit?: Outfit) {
  const { hand, thigh, bootFront, bootBack, bootSide, cloak, satchel } = PAINTED_SPRITE_PARTS
  const parts = outfit
    ? {
        hand,
        thigh,
        bootFront,
        bootBack,
        bootSide,
        cloak,
        satchel,
        'worn-outfit-front': outfit.front,
        'worn-outfit-back': outfit.back,
        'worn-outfit-side': outfit.side,
        'worn-outfit-sleeve': outfit.sleeve,
      }
    : PAINTED_SPRITE_PARTS
  return Object.entries(parts)
    .map(
      ([name, href]) =>
        `<image id="rig-${name}" href="${href}" width="1" height="1" preserveAspectRatio="none"/>`,
    )
    .join('')
}

function placePart(part: Part, [x, y]: Point, [width, height]: Point, angle = 0, mirrored = false) {
  return `<use href="#rig-${part}" transform="translate(${x} ${y}) rotate(${angle}) translate(${-width / 2} 0) ${mirrored ? `translate(${width} 0) scale(-1 1)` : ''} scale(${width} ${height})"/>`
}

function belowJoint([x, y]: Point, length: number, angle: number): Point {
  const radians = (angle * Math.PI) / 180
  return [x - Math.sin(radians) * length, y + Math.cos(radians) * length]
}

export function renderPaintedSpriteRig({
  facing,
  pose,
  frame,
  frames,
  head,
  bodyBuild,
  cape,
  mantle,
  satchel,
  fittedOutfit = false,
  fabricDye,
  outfitDye,
  sleeve = 'armFront',
  handDye,
  gear,
  gearDye,
}: {
  facing: AppearanceFacing
  pose: AppearancePose
  frame: number
  frames: number
  head: string
  bodyBuild: number
  cape: boolean
  mantle: boolean
  satchel: boolean
  fittedOutfit?: boolean
  fabricDye?: string
  outfitDye?: string
  sleeve?: 'armFront' | 'armSide' | 'sleeveSeafarer' | 'sleeveWool'
  handDye?: string
  gear?: Readonly<{
    id: string
    placement: 'sash' | 'shoulder' | 'waist' | 'behind'
    ratio: number
  }>
  gearDye?: string
}) {
  const profile = facing === 'east' || facing === 'west'
  const rear = facing === 'north'
  const phase = Math.sin((frame * 2 * Math.PI) / frames)
  const walking = pose === 'walk'
  const attacking = pose === 'attack' || pose === 'cast'
  const torsoY =
    PAINTED_SPRITE_COLLAR_Y - (walking ? Math.abs(phase) * 0.9 : pose === 'idle' ? phase * 0.45 : 0)
  const torsoWidth = bodyBuild * (profile ? 11 : 18)
  const torsoPart = fittedOutfit
    ? profile
      ? 'worn-outfit-side'
      : rear
        ? 'worn-outfit-back'
        : 'worn-outfit-front'
    : profile
      ? 'torsoSide'
      : rear
        ? 'torsoBack'
        : 'torsoFront'
  const dyePart = (art: string, filter = fabricDye) =>
    filter ? `<g filter="url(#${filter})">${art}</g>` : art
  const torso = dyePart(
    placePart(
      torsoPart,
      [24, torsoY - (fittedOutfit ? 1 : 0)],
      fittedOutfit ? [torsoWidth * 1.26, 24] : [torsoWidth, 23],
    ),
    fittedOutfit ? (outfitDye ?? '') : fabricDye,
  )
  const paintedSleeve = (shoulder: Point, size: Point, angle = 0, mirrored = false) =>
    dyePart(
      placePart(fittedOutfit ? 'worn-outfit-sleeve' : sleeve, shoulder, size, angle, mirrored),
      fittedOutfit ? (outfitDye ?? '') : fabricDye,
    )
  const nearShoulder: Point = [24 + torsoWidth * (profile ? 0.13 : 0.42), torsoY + 3]
  const attackArm = -(pose === 'cast' ? 52 : 30) - Math.abs(phase) * 10
  const arm = (side: -1 | 1) => {
    const leading = side === 1
    const shoulder: Point = leading ? nearShoulder : [48 - nearShoulder[0], nearShoulder[1]]
    const angle = attacking
      ? leading
        ? attackArm
        : 16
      : walking
        ? -side * phase * (profile ? 21 : 6) - (profile ? 0 : side * 7)
        : side * -7
    const width = profile ? 6.7 : 5.4
    const wrist = belowJoint(shoulder, 11, angle)
    return `<g data-rig-arm="${leading ? 'near' : 'far'}" data-limb="arm-${leading ? 'right' : 'left'}">
      ${dyePart(placePart('hand', wrist, [width * 0.69, 8], angle, !leading), handDye ?? '')}
      ${paintedSleeve(shoulder, [width, 13.1], angle, !leading)}
    </g>`
  }
  const leg = (side: -1 | 1) => {
    const hip: Point = [24 + side * (profile ? 2.7 : 3.7), torsoY + 19]
    const swing = walking ? side * phase : 0
    const thighAngle = profile ? swing * 23 : -side * (4 + swing * 5)
    const shinAngle = profile ? thighAngle + Math.max(0, swing) * 17 : -side * 3
    const knee = belowJoint(hip, 11.8, thighAngle)
    const boot = profile ? 'bootSide' : rear ? 'bootBack' : 'bootFront'
    return `<g data-rig-leg="${side === 1 ? 'near' : 'far'}">
      ${placePart('thigh', hip, [7, 14], thighAngle)}
      ${placePart(boot, knee, [profile ? 8 : 5.5, 10.7], shinAngle)}
    </g>`
  }

  const cloak = cape
    ? placePart('cloak', [24, torsoY + 1], [torsoWidth + 14, 35], walking ? phase * 4 : 0)
    : ''
  const shoulderPieces =
    mantle && !fittedOutfit ? placePart('mantle', [24, torsoY + 1], [torsoWidth * 1.18, 6]) : ''
  let wornGear = satchel && !gear ? placePart('satchel', [24, torsoY + 17], [torsoWidth, 8]) : ''
  let packedGear = ''
  if (gear && (!rear || gear.placement === 'behind' || gear.placement === 'waist')) {
    const placement = {
      sash: { center: 24, top: 6, width: torsoWidth * 0.84, height: 15 },
      shoulder: { center: 24 + torsoWidth * 0.26, top: 6, width: torsoWidth * 0.48, height: 10 },
      waist: { center: 24, top: 15, width: torsoWidth * 0.92, height: 10 },
      behind: {
        center: rear ? 24 : profile ? 20 : 24 + torsoWidth * 0.42,
        top: 6,
        width: torsoWidth * 0.8,
        height: 14,
      },
    }[gear.placement]
    const width = Math.min(placement.width, placement.height * gear.ratio)
    const height = width / gear.ratio
    const item = `<use href="#${gear.id}" transform="translate(${placement.center - width / 2} ${torsoY + placement.top}) scale(${width} ${height})"${gearDye ? ` filter="url(#${gearDye})"` : ''}/>`
    if (gear.placement === 'behind' && !rear) packedGear = item
    else wornGear = item
  }
  const shoulderCapY = torsoY + 2.1
  const shoulderCap = profile
    ? `<svg x="20" y="${shoulderCapY}" width="9" height="8" viewBox="20 ${shoulderCapY} 9 8" overflow="hidden">${paintedSleeve([24.3, shoulderCapY], [8.1, 15])}</svg>`
    : ''
  const figure = `${packedGear}${dyePart(cloak)}${leg(-1)}${leg(1)}${arm(-1)}${torso}${dyePart(shoulderPieces)}${wornGear}${shoulderCap}${arm(1)}
    <g transform="translate(0 ${torsoY - PAINTED_SPRITE_COLLAR_Y})">${head}</g>`
  const reaction = pose === 'hit' ? 'rotate(-9 24 58)' : ''
  const alignment = facing === 'west' ? 'translate(48 0) scale(-1 1)' : ''
  const down = pose === 'down' ? 'translate(24 53) rotate(-90) scale(.73) translate(-24 -30)' : ''
  const focus =
    pose === 'cast'
      ? '<path d="M43 23l1.6 3.7-1.6 3.4-1.5-3.4Z" fill="#f9e7ab" stroke="#bd874e" stroke-width=".65"/>'
      : ''
  const [gripX, gripY] = belowJoint(nearShoulder, 17.5, attackArm)
  const sword =
    pose === 'attack'
      ? `<g transform="translate(${gripX} ${gripY}) rotate(20)"><path d="M0 0V-11l1.4-3 1 3L1 0Z" fill="#e6deca" stroke="#574d56" stroke-width=".48"/><path d="M-1.5-1h4M.5 0v2" stroke="#b58a57" stroke-width="1.1"/></g>`
      : ''
  return `<ellipse cx="24" cy="59" rx="${pose === 'down' ? 20 : 12}" ry="2.6" fill="#25203c" opacity=".34"/>
    <g transform="${down} ${alignment} ${reaction}">${figure}${focus}${sword}</g>`
}
