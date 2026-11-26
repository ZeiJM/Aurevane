import type { AppearanceFacing, AppearancePose } from './appearance-manifest'
import { CATALOG_SPRITE_BODY, CATALOG_SPRITE_HANDS } from './appearance-catalog-art'
import { PAINTED_SPRITE_PARTS } from './appearance-painted-sprite-parts.generated'

type Outfit = Readonly<Record<'front' | 'back' | 'side' | 'sleeve', string>>
type Part =
  | keyof typeof PAINTED_SPRITE_PARTS
  | `worn-outfit-${keyof Outfit}`
  | 'visible-hand'
  | 'grip-hand'
  | 'casting-hand'
  | 'upper-sleeve'
  | 'lower-sleeve'
type Point = readonly [x: number, y: number]

export const PAINTED_SPRITE_COLLAR_Y = 17

export function fittedSpriteTorsoWidth(
  facing: AppearanceFacing,
  bodyBuild: number,
  feminine = false,
) {
  const profile = facing === 'east' || facing === 'west'
  // Preserve body-build variation while leaving room for the head and arms.
  return (
    (profile ? (feminine ? 11.6 : 12.2) : feminine ? 16.6 : 17.8) * (1 + (bodyBuild - 1) * 0.67)
  )
}

export function paintedSpriteRigDefinitions(outfit?: Outfit) {
  const { thigh, bootFront, bootBack, bootSide } = CATALOG_SPRITE_BODY
  const { cloak, satchel } = PAINTED_SPRITE_PARTS
  const parts = outfit
    ? {
        'visible-hand': CATALOG_SPRITE_HANDS.relaxed,
        'grip-hand': CATALOG_SPRITE_HANDS.grip,
        'casting-hand': CATALOG_SPRITE_HANDS.cast,
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
  const images = Object.entries(parts)
    .map(
      ([name, href]) =>
        `<image id="rig-${name}" href="${href}" width="1" height="1" preserveAspectRatio="none"/>`,
    )
    .join('')
  // Paint the hand independently at the wrist so each pose has a clear silhouette.
  if (!outfit) return images
  const crop = (id: Part, source: Part, viewBox: string) =>
    `<svg id="rig-${id}" width="1" height="1" viewBox="${viewBox}" preserveAspectRatio="none" overflow="hidden"><use href="#rig-${source}"/></svg>`
  return (
    images +
    crop('upper-sleeve', 'worn-outfit-sleeve', '0 0 1 .62') +
    crop('lower-sleeve', 'worn-outfit-sleeve', '0 .48 1 .52')
  )
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
  face,
  head,
  bodyBuild,
  cape,
  mantle,
  satchel,
  fittedOutfit = false,
  feminine = false,
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
  face?: string
  head: string
  bodyBuild: number
  cape: boolean
  mantle: boolean
  satchel: boolean
  fittedOutfit?: boolean
  feminine?: boolean
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
  // Battle and creator callers share the first three action frames.
  const actionFrame = Math.min(frame, 2)
  const strike = fittedOutfit && pose === 'attack' ? [0, 1, 0.34][actionFrame]! : 0
  const charge = fittedOutfit && pose === 'cast' ? [0.1, 1, 0.43][actionFrame]! : 0
  const recoil = fittedOutfit && pose === 'hit' ? [1, 0.48, 0.14][actionFrame]! : 0
  const settling = fittedOutfit && pose === 'down' ? [0, 0.7, 1][actionFrame]! : 0
  const torsoY =
    PAINTED_SPRITE_COLLAR_Y -
    (walking ? Math.abs(phase) * 0.9 : pose === 'idle' ? phase * 0.45 : 0) +
    strike * 0.7 +
    recoil * 0.8 -
    charge * 0.55
  const torsoWidth = fittedOutfit
    ? fittedSpriteTorsoWidth(facing, bodyBuild, feminine)
    : bodyBuild * (profile ? 11 : 18)
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
  const torsoArt = placePart(
    torsoPart,
    [24, torsoY - (fittedOutfit ? 1 : 0)],
    fittedOutfit ? [torsoWidth * 1.26, 22.5] : [torsoWidth, 23],
  )
  const torso = dyePart(torsoArt, fittedOutfit ? (outfitDye ?? '') : fabricDye)
  const waist = torsoWidth * (profile ? 0.49 : feminine ? 0.42 : 0.45)
  const shoulders = torsoWidth * 0.61
  const contour = `M${24 - shoulders} ${torsoY - 3}H${24 + shoulders}V${torsoY + 7}Q${24 + shoulders} ${torsoY + 13} ${24 + waist} ${torsoY + 18}L${24 + waist} ${torsoY + 23}H${24 - waist}L${24 - waist} ${torsoY + 18}Q${24 - shoulders} ${torsoY + 13} ${24 - shoulders} ${torsoY + 7}Z`
  const torsoClip = `rig-waist-${facing}-${pose}-${frame}`
  const body = fittedOutfit
    ? `<clipPath id="${torsoClip}"><path d="${contour}"/></clipPath><g clip-path="url(#${torsoClip})">${torso}</g>`
    : torso
  const paintedSleeve = (shoulder: Point, size: Point, angle = 0, mirrored = false) =>
    dyePart(
      placePart(fittedOutfit ? 'worn-outfit-sleeve' : sleeve, shoulder, size, angle, mirrored),
      fittedOutfit ? (outfitDye ?? '') : fabricDye,
    )
  const nearShoulder: Point = [
    24 +
      torsoWidth * (profile ? 0.11 : 0.42) -
      (fittedOutfit && attacking && !profile ? 2.5 + strike * 1.75 : 0),
    torsoY + 3,
  ]
  const attackArm = fittedOutfit
    ? pose === 'cast'
      ? -23 - charge * (profile ? 33 : 25)
      : 9 - strike * (profile ? 64 : 50)
    : -(pose === 'cast' ? 52 : 30) - Math.abs(phase) * 10
  const armPose = (side: -1 | 1) => {
    const leading = side === 1
    const shoulder: Point = leading ? nearShoulder : [48 - nearShoulder[0], nearShoulder[1]]
    const angle = attacking
      ? leading
        ? attackArm
        : fittedOutfit && pose === 'cast'
          ? (profile ? -1 : 1) * (12 + charge * 27)
          : 16
      : walking
        ? -side * phase * (profile ? 21 : 6) - (profile ? 0 : side * 7)
        : side * -7 +
          (fittedOutfit && pose === 'idle' ? phase * 2.2 : 0) +
          side * (settling * 4 - recoil * 12)
    const elbow = belowJoint(shoulder, 7.55, angle)
    const bend = attacking
      ? pose === 'cast'
        ? 20 + (1 - charge) * 12
        : 10 + (1 - strike) * 24
      : walking
        ? 7 + Math.max(0, side * phase) * 9
        : 7 + recoil * 11
    const forearmAngle = angle + (profile ? -bend : side * bend * (pose === 'cast' ? 0.56 : -0.56))
    const wrist = fittedOutfit
      ? belowJoint(elbow, 5.8, forearmAngle)
      : belowJoint(shoulder, 11, angle)
    return { shoulder, elbow, wrist, angle, forearmAngle }
  }
  const nearPose = armPose(1)
  const arm = (side: -1 | 1) => {
    const leading = side === 1
    const { shoulder, elbow, wrist, angle, forearmAngle } = leading ? nearPose : armPose(side)
    const width = fittedOutfit ? (feminine ? 4.55 : 5) : profile ? 6.7 : 5.4
    const handPart = !fittedOutfit
      ? 'hand'
      : pose === 'attack' && leading
        ? 'grip-hand'
        : pose === 'cast'
          ? 'casting-hand'
          : 'visible-hand'
    const hand = dyePart(
      placePart(
        handPart,
        wrist,
        fittedOutfit ? [width * 0.66, handPart === 'grip-hand' ? 3.4 : 4.25] : [width * 0.69, 8],
        fittedOutfit ? forearmAngle : angle,
        !leading,
      ),
      handDye ?? '',
    )
    // Let the painted elbow overlap the top of the forearm so the two
    // segments bend without exposing a hard gap across the sleeve.
    const sleeve = fittedOutfit
      ? dyePart(
          placePart('lower-sleeve', elbow, [width * 0.89, 7], forearmAngle, !leading) +
            placePart('upper-sleeve', shoulder, [width, 8.85], angle, !leading),
          outfitDye ?? '',
        )
      : paintedSleeve(shoulder, [width, 13.1], angle, !leading)
    return `<g data-rig-arm="${leading ? 'near' : 'far'}" data-limb="arm-${leading ? 'right' : 'left'}">
      ${fittedOutfit ? sleeve + hand : hand + sleeve}
    </g>`
  }
  const leg = (side: -1 | 1) => {
    const hip: Point = [
      24 + side * (profile ? (fittedOutfit ? 2.45 : 2.7) : 3.7),
      torsoY + (fittedOutfit ? 18.4 : 19),
    ]
    const swing = walking ? side * phase : 0
    const thighAngle =
      (profile ? swing * 23 : -side * (4 + swing * 5)) -
      side * (strike * 8 + recoil * 6 + settling * 3)
    const shinAngle = profile ? thighAngle + Math.max(0, swing) * 17 : -side * (3 + strike * 2)
    const knee = belowJoint(hip, 11.8, thighAngle)
    const boot = profile ? 'bootSide' : rear ? 'bootBack' : 'bootFront'
    return `<g data-rig-leg="${side === 1 ? 'near' : 'far'}">
      ${placePart('thigh', hip, [fittedOutfit ? 6.3 : 7, 14], thighAngle)}
      ${placePart(boot, knee, [profile ? (fittedOutfit ? 7.2 : 8) : 5.5, fittedOutfit ? 11.3 : 10.7], shinAngle)}
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
  const shoulderCap =
    profile && !fittedOutfit
      ? `<svg x="20" y="${shoulderCapY}" width="9" height="8" viewBox="20 ${shoulderCapY} 9 8" overflow="hidden">${paintedSleeve([24.3, shoulderCapY], [8.1, 15])}</svg>`
      : ''
  const placeHead = `translate(0 ${torsoY - PAINTED_SPRITE_COLLAR_Y})`
  // Tuck the painted neck under the outfit, with long hair and accessories
  // still able to overlap the shoulder from the front.
  const lowerHead = face ? `<g transform="${placeHead}">${face}</g>` : ''
  // The fitted profile painting already has a shoulder. Its own top edge
  // forms the collar, with the moving forearm painted below.
  const insetSleeve = profile && fittedOutfit
  const nearArm = arm(1)
  // The cast and attack forearm still needs to cross the torso. Reveal
  // everything below the shoulder after the front of the outfit is drawn.
  const visibleArm = insetSleeve
    ? `<svg x="0" y="${torsoY + 7}" width="48" height="22" viewBox="0 ${torsoY + 7} 48 22" overflow="hidden">${nearArm}</svg>`
    : nearArm
  const figure = `${packedGear}${dyePart(cloak)}${leg(-1)}${leg(1)}${arm(-1)}${lowerHead}${body}${dyePart(shoulderPieces)}${wornGear}${shoulderCap}${visibleArm}
    <g transform="${placeHead}">${head}</g>`
  const lean =
    (fittedOutfit && profile && walking ? 3 : 0) +
    strike * (profile ? 4 : 2.5) -
    recoil * 10 +
    charge * 2
  const reaction = fittedOutfit
    ? lean
      ? `rotate(${lean} 24 57)`
      : ''
    : pose === 'hit'
      ? 'rotate(-9 24 58)'
      : ''
  const alignment = facing === 'west' ? 'translate(48 0) scale(-1 1)' : ''
  const down =
    pose === 'down'
      ? `translate(24 ${53 + settling}) rotate(${-90 + settling * 2}) scale(.73) translate(-24 -30)`
      : ''
  const [gripX, gripY] = fittedOutfit
    ? belowJoint(nearPose.wrist, 2.5, nearPose.forearmAngle)
    : belowJoint(nearShoulder, 17.5, attackArm)
  const focusX = Math.min(38, gripX + 5)
  const focusY = Math.max(12, gripY - 6)
  const focus =
    pose === 'cast'
      ? fittedOutfit
        ? `<g transform="translate(${focusX} ${focusY}) scale(${0.65 + charge * 0.42})"><circle cy="3.2" r="${2.8 + charge * 2}" fill="#f3ca62" opacity="${0.13 + charge * 0.18}"/><path d="M0 0l1.6 3.7-1.6 3.4-1.5-3.4Z" fill="#f9e7ab" stroke="#bd874e" stroke-width=".65"/></g>`
        : '<path d="M43 23l1.6 3.7-1.6 3.4-1.5-3.4Z" fill="#f9e7ab" stroke="#bd874e" stroke-width=".65"/>'
      : ''
  const swordAngle = fittedOutfit ? -27 + strike * (profile ? 36 : 33) : 20
  const sword =
    pose === 'attack'
      ? `<g transform="translate(${gripX} ${gripY}) rotate(${swordAngle})"><path d="M0 0V-11l1.4-3 1 3L1 0Z" fill="#e6deca" stroke="#574d56" stroke-width=".48"/><path d="M-1.5-1h4M.5 0v2" stroke="#b58a57" stroke-width="1.1"/></g>`
      : ''
  return `<ellipse cx="24" cy="59" rx="${pose === 'down' ? 20 : 12}" ry="2.6" fill="#25203c" opacity=".34"/>
    <g transform="${down} ${alignment} ${reaction}">${figure}${focus}${sword}</g>`
}
