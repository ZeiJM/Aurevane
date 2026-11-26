import {
  paintedPlayerRecipe,
  wardrobeLook,
  type PaintedPlayerLook,
} from './appearance-painted-wardrobe'

export const PAINTED_STUDIES = {
  f32: {
    key: 'asta',
    label: 'Try forest guide look',
    look: {
      ...wardrobeLook(),
      faceId: 'f32',
      identity: 'ranger',
      hairstyle: 'layers',
      outerwear: 'pine',
      backdrop: 'leavesfern',
    },
  },
  m02: {
    key: 'cassian',
    label: 'Try winter guide look',
    look: {
      ...wardrobeLook(),
      faceId: 'm02',
      identity: 'guard',
      hairstyle: 'curls',
      outerwear: 'shearling',
      facialHair: 'boxed',
      bodyFrame: 'broad',
      backdrop: 'northernpass',
    },
  },
} as const satisfies Record<string, { key: string; label: string; look: PaintedPlayerLook }>

export function paintedStudyForFace(faceId?: string) {
  return faceId && Object.hasOwn(PAINTED_STUDIES, faceId)
    ? PAINTED_STUDIES[faceId as keyof typeof PAINTED_STUDIES]
    : undefined
}

export function matchingPaintedStudy(look: PaintedPlayerLook) {
  const study = paintedStudyForFace(look.faceId)
  if (!study) return undefined
  // The background is a separate layer. Match every other field so a
  // custom selection never silently displays the authored default.
  const artRecipe = paintedPlayerRecipe(study.look).slice(0, -1).join('.')
  return paintedPlayerRecipe(look).slice(0, -1).join('.') === artRecipe ? study.key : undefined
}
