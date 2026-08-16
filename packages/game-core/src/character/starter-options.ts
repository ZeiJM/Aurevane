import type { CharacterPortraitRef, StarterAppearanceRef } from './creation'

export const STARTER_CHARACTER_PORTRAITS: readonly {
  ref: CharacterPortraitRef
  label: string
}[] = [
  { ref: 'portrait.starter.wayfarer-01', label: 'Wayfarer I' },
  { ref: 'portrait.starter.wayfarer-02', label: 'Wayfarer II' },
  { ref: 'portrait.starter.wayfarer-03', label: 'Wayfarer III' },
  { ref: 'portrait.starter.wayfarer-04', label: 'Wayfarer IV' },
]

export const STARTER_CHARACTER_APPEARANCES: readonly {
  ref: StarterAppearanceRef
  label: string
}[] = [
  { ref: 'appearance.starter.roadworn', label: 'Roadworn layers' },
  { ref: 'appearance.starter.fieldcloak', label: 'Field cloak' },
  { ref: 'appearance.starter.lightstep', label: 'Lightstep travelwear' },
]

const portraitRefs = new Set<string>(STARTER_CHARACTER_PORTRAITS.map((option) => option.ref))
const appearanceRefs = new Set<string>(STARTER_CHARACTER_APPEARANCES.map((option) => option.ref))

export function isStarterCharacterPortraitRef(value: string): value is CharacterPortraitRef {
  return portraitRefs.has(value)
}

export function isStarterCharacterAppearanceRef(value: string): value is StarterAppearanceRef {
  return appearanceRefs.has(value)
}
