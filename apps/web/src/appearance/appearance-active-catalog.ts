import { daryaCourierLook, paintedDaryaHairstyle } from './appearance-darya-look'
import { portraitFace } from './appearance-face-catalog'
import type { AppearanceBlueprint, PaintedPlayerAppearanceBlueprint } from './appearance-manifest'
import { appearanceGenderForIdentity, type AppearanceGender } from './appearance-painted-looks'
import { matchingPaintedStudy, PAINTED_STUDIES } from './appearance-painted-studies'
import type { PaintedPlayerLook } from './appearance-painted-wardrobe'

export const ACTIVE_PAINTED_LOOKS = [
  ...Object.values(PAINTED_STUDIES).map(({ key, look }) => ({
    key: key as string,
    label: portraitFace(look.faceId)!.name,
    look: look as PaintedPlayerLook,
  })),
  { key: 'darya-coils', label: 'Darya · Tight coils', look: daryaCourierLook },
  {
    key: 'darya-lowpony',
    label: 'Darya · Low ponytail',
    look: { ...daryaCourierLook, hairstyle: 'lowpony' } as const,
  },
]

export function activePaintedLookKey(look: PaintedPlayerLook) {
  const darya = paintedDaryaHairstyle(look)
  return darya ? `darya-${darya}` : matchingPaintedStudy(look)
}

export function isActivePaintedAppearance(
  blueprint: AppearanceBlueprint | null | undefined,
): blueprint is PaintedPlayerAppearanceBlueprint {
  return blueprint?.v === 6 && activePaintedLookKey(blueprint) !== undefined
}

export function activePaintedLooksForGender(gender?: AppearanceGender) {
  return gender
    ? ACTIVE_PAINTED_LOOKS.filter(
        ({ look }) => appearanceGenderForIdentity(look.identity) === gender,
      )
    : ACTIVE_PAINTED_LOOKS
}

export function pickActivePaintedLook(
  gender?: AppearanceGender,
  random = Math.random,
  previous?: PaintedPlayerLook,
) {
  const previousKey = previous && activePaintedLookKey(previous)
  const pool = activePaintedLooksForGender(gender).filter(({ key }) => key !== previousKey)
  return pool[Math.floor(random() * pool.length)]!.look
}
