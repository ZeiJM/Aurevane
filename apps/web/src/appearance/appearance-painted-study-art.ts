import { PAINTED_STUDY_CASSIAN_ACTIONS } from './appearance-painted-study-cassian-actions.generated'
import { PAINTED_STUDY_ASTA_ACTIONS } from './appearance-painted-study-asta-actions.generated'
import { PAINTED_STUDY_ASTA_PORTRAITS } from './appearance-painted-study-asta-portraits.generated'
import { PAINTED_STUDY_ASTA_SPRITES } from './appearance-painted-study-asta-sprites.generated'
import { PAINTED_STUDY_CASSIAN_PORTRAITS } from './appearance-painted-study-cassian-portraits.generated'
import { PAINTED_STUDY_CASSIAN_SPRITES } from './appearance-painted-study-cassian-sprites.generated'
import { matchingPaintedStudy } from './appearance-painted-studies'
import type {
  AppearanceExpression,
  AppearanceFacing,
  PaintedPlayerAppearanceBlueprint,
} from './appearance-manifest'

type Study = NonNullable<ReturnType<typeof matchingPaintedStudy>>
type WalkPose = 'idle' | 'left' | 'passing' | 'right'
type ActionPose = 'brace' | 'attack' | 'cast'
type Frame = Readonly<{ href: string; x: number; y: number; width: number; height: number }>
type Directions<Pose extends string> = Record<
  Exclude<AppearanceFacing, 'west'>,
  Record<Pose, Frame>
>

const artwork: Record<
  Study,
  {
    portraits: Record<AppearanceExpression, string>
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
} as const

export function studyPortrait(
  look: PaintedPlayerAppearanceBlueprint,
  mood: AppearanceExpression,
  backdrop: string,
  icon: boolean,
) {
  const study = matchingPaintedStudy(look)
  if (!study) return undefined
  const size = icon ? 64 : 256
  const viewBox = icon ? '56 28 144 144' : '0 0 256 256'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">
    ${backdrop}<image href="${artwork[study].portraits[mood]}" width="256" height="256"/>
  </svg>`
}

export function studySpriteMaterials(study: Study) {
  const { sprites, actions } = artwork[study]
  return `<defs>${[...Object.entries(sprites), ...Object.entries(actions)]
    .flatMap(([facing, poses]) =>
      Object.entries(poses).map(
        ([pose, { href, x, y, width, height }]) =>
          `<image id="study-${facing}-${pose}" href="${href}" x="${x}" y="${y}" width="${width}" height="${height}"/>`,
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
