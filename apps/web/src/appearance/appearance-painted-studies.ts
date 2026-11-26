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
  f31keen: {
    key: 'yuna',
    label: 'Try observatory look',
    look: {
      ...wardrobeLook(),
      faceId: 'f31keen',
      identity: 'pinescout',
      hairstyle: 'silkwave',
      outerwear: 'brocade',
      bodyFrame: 'slight',
      backdrop: 'latticeplum',
    },
  },
  f05: {
    key: 'ysara',
    label: 'Try alpine guide look',
    look: {
      ...wardrobeLook(),
      faceId: 'f05',
      identity: 'pinescout',
      hairstyle: 'pixie',
      outerwear: 'none',
      facewear: 'scholarlenses',
      bodyFrame: 'slight',
      backdrop: 'frostvalley',
    },
  },
  f04: {
    key: 'nalia',
    label: 'Try gate watch look',
    look: {
      ...wardrobeLook(),
      faceId: 'f04',
      identity: 'ranger',
      hairstyle: 'longbraid',
      outerwear: 'brigandine',
      headwear: 'tidecirclet',
      bodyFrame: 'strong',
      backdrop: 'embervalley',
    },
  },
  m01: {
    key: 'aren',
    label: 'Try lighthouse keeper look',
    look: {
      ...wardrobeLook(),
      faceId: 'm01',
      identity: 'scout',
      hairstyle: 'shag',
      hairDye: 'silver',
      outerwear: 'scarf',
      bodyFrame: 'lean',
      scar: 'cross',
      backdrop: 'silverlake',
    },
  },
  m21keen: {
    key: 'kieran',
    label: 'Try sky cartographer look',
    look: {
      ...wardrobeLook(),
      faceId: 'm21keen',
      identity: 'elder',
      hairstyle: 'curtain',
      outerwear: 'hooded',
      headwear: 'wayfarercap',
      gear: 'mapcase',
      facialHair: 'goatee',
      apparentAge: 'elder',
      backdrop: 'starvault',
    },
  },
  m10: {
    key: 'alden',
    label: 'Try route finder look',
    look: {
      ...wardrobeLook(),
      faceId: 'm10',
      identity: 'scout',
      hairstyle: 'curls',
      outerwear: 'quilted',
      gear: 'utility',
      bodyFrame: 'strong',
      backdrop: 'crownroad',
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
  // Backgrounds and Asta’s registered cape dye have independent artwork.
  // Other edits need their own painting or the shared renderer.
  const artRecipe = paintedPlayerRecipe(study.look).slice(0, -1).join('.')
  const geometry = study.key === 'asta' ? { ...look, clothColor: study.look.clothColor } : look
  return paintedPlayerRecipe(geometry).slice(0, -1).join('.') === artRecipe ? study.key : undefined
}
