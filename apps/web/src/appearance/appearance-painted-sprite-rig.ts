import type { AppearanceFacing, AppearancePose } from './appearance-manifest'
import { PAINTED_SPRITE_PARTS } from './appearance-painted-sprite-parts.generated'

type Part = keyof typeof PAINTED_SPRITE_PARTS
type Point = readonly [x: number, y: number]

export function paintedSpriteRigDefinitions() {
  return Object.entries(PAINTED_SPRITE_PARTS)
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
  outfit,
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
  outfit?: string
  fabricDye?: string
  outfitDye?: string
  sleeve?: 'armFront' | 'armSide' | 'sleeveSeafarer' | 'sleeveWool'
  handDye?: string
  gear?: string
  gearDye?: string
}) {
  const profile = facing === 'east' || facing === 'west'
  const rear = facing === 'north'
  const phase = Math.sin((frame * 2 * Math.PI) / frames)
  const walking = pose === 'walk'
  const attacking = pose === 'attack' || pose === 'cast'
  const torsoY = 20 - (walking ? Math.abs(phase) * 0.9 : pose === 'idle' ? phase * 0.45 : 0)
  const torsoWidth = bodyBuild * (profile ? 11 : 18)
  const torsoBase = placePart(
    profile ? 'torsoSide' : rear ? 'torsoBack' : 'torsoFront',
    [24, torsoY],
    [torsoWidth, 22],
  )
  const dyePart = (art: string, filter = fabricDye) =>
    filter ? `<g filter="url(#${filter})">${art}</g>` : art
  const torso =
    !profile && !rear && outfit
      ? dyePart(
          `<use href="#${outfit}" transform="translate(${24 - torsoWidth * 0.63} ${torsoY - 1}) scale(${torsoWidth * 1.26} 24)"/>`,
          outfitDye ?? '',
        )
      : dyePart(torsoBase)
  const nearShoulder: Point = [24 + torsoWidth * (profile ? 0.13 : 0.42), torsoY + 3]
  const attackArm = -(pose === 'cast' ? 52 : 30) - Math.abs(phase) * 10
  const arm = (side: -1 | 1) => {
    const leading = side === 1
    const shoulder: Point = leading ? nearShoulder : [48 - nearShoulder[0], nearShoulder[1]]
    const angle = attacking
      ? leading
        ? attackArm
        : 16
      : walking && profile
        ? side * phase * 21
        : side * -7
    const width = profile ? 6.7 : 5.4
    const wrist = belowJoint(shoulder, 11, angle)
    return `<g data-rig-arm="${leading ? 'near' : 'far'}" data-limb="arm-${leading ? 'right' : 'left'}">
      ${dyePart(placePart('hand', wrist, [width * 0.69, 8], angle, !leading), handDye ?? '')}
      ${dyePart(placePart(sleeve, shoulder, [width, 13.1], angle, !leading))}
    </g>`
  }
  const leg = (side: -1 | 1) => {
    const hip: Point = [24 + side * (profile ? 2.7 : 3.7), torsoY + 17]
    const swing = walking ? side * phase : 0
    const thighAngle = profile ? swing * 23 : -side * (4 + swing * 5)
    const shinAngle = profile ? thighAngle + Math.max(0, swing) * 17 : -side * 3
    const knee = belowJoint(hip, 10.8, thighAngle)
    const boot = profile ? 'bootSide' : rear ? 'bootBack' : 'bootFront'
    return `<g data-rig-leg="${side === 1 ? 'near' : 'far'}">
      ${placePart('thigh', hip, [7, 13], thighAngle)}
      ${placePart(boot, knee, [profile ? 8 : 5.5, 10.7], shinAngle)}
    </g>`
  }

  const cloak = cape
    ? placePart('cloak', [24, torsoY + 1], [torsoWidth + 14, 35], walking ? phase * 4 : 0)
    : ''
  const shoulderPieces = mantle ? placePart('mantle', [24, torsoY + 1], [torsoWidth * 1.18, 6]) : ''
  const belt = gear
    ? `<use href="#${gear}" transform="translate(${24 - torsoWidth * 0.33} ${torsoY + (rear ? 12 : 7)}) scale(${torsoWidth * 0.76} 15)"${gearDye ? ` filter="url(#${gearDye})"` : ''}/>`
    : satchel
      ? placePart('satchel', [24, torsoY + 17], [torsoWidth, 8])
      : ''
  const shoulderCapY = torsoY + 2.1
  const shoulderCap = profile
    ? `<svg x="20" y="${shoulderCapY}" width="9" height="8" viewBox="20 ${shoulderCapY} 9 8" overflow="hidden">${dyePart(placePart(sleeve, [24.3, shoulderCapY], [8.1, 15]))}</svg>`
    : ''
  const figure = `${dyePart(cloak)}${leg(-1)}${leg(1)}${arm(-1)}${torso}${dyePart(shoulderPieces)}${belt}${shoulderCap}${arm(1)}
    <g transform="translate(0 ${torsoY - 20})">${head}</g>`
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
