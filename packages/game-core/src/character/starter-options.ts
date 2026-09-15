import type {
  CharacterPortraitRef,
  CharacterPresentationId,
  PronounPresetId,
  StarterAppearanceRef,
} from './creation'

export const STARTER_CHARACTER_PORTRAITS: readonly {
  ref: CharacterPortraitRef
  label: string
}[] = [
  { ref: 'portrait.starter.wayfarer-01', label: 'Wayfarer 01' },
  { ref: 'portrait.starter.wayfarer-02', label: 'Wayfarer 02' },
  { ref: 'portrait.starter.wayfarer-03', label: 'Wayfarer 03' },
  { ref: 'portrait.starter.wayfarer-04', label: 'Wayfarer 04' },
  { ref: 'portrait.starter.wayfarer-05', label: 'Wayfarer 05' },
  { ref: 'portrait.starter.wayfarer-06', label: 'Wayfarer 06' },
  { ref: 'portrait.starter.wayfarer-07', label: 'Wayfarer 07' },
  { ref: 'portrait.starter.wayfarer-08', label: 'Wayfarer 08' },
  { ref: 'portrait.starter.wayfarer-09', label: 'Wayfarer 09' },
  { ref: 'portrait.starter.wayfarer-10', label: 'Wayfarer 10' },
  { ref: 'portrait.starter.wayfarer-11', label: 'Wayfarer 11' },
  { ref: 'portrait.starter.wayfarer-12', label: 'Wayfarer 12' },
  { ref: 'portrait.starter.wayfarer-13', label: 'Wayfarer 13' },
  { ref: 'portrait.starter.wayfarer-14', label: 'Wayfarer 14' },
  { ref: 'portrait.starter.wayfarer-15', label: 'Wayfarer 15' },
  { ref: 'portrait.starter.wayfarer-16', label: 'Wayfarer 16' },
  { ref: 'portrait.starter.wayfarer-17', label: 'Wayfarer 17' },
  { ref: 'portrait.starter.wayfarer-18', label: 'Wayfarer 18' },
  { ref: 'portrait.starter.wayfarer-19', label: 'Wayfarer 19' },
  { ref: 'portrait.starter.wayfarer-20', label: 'Wayfarer 20' },
  { ref: 'portrait.starter.wayfarer-21', label: 'Wayfarer 21' },
  { ref: 'portrait.starter.wayfarer-22', label: 'Wayfarer 22' },
  { ref: 'portrait.starter.wayfarer-23', label: 'Wayfarer 23' },
  { ref: 'portrait.starter.wayfarer-24', label: 'Wayfarer 24' },
  { ref: 'portrait.starter.wayfarer-25', label: 'Wayfarer 25' },
  { ref: 'portrait.starter.wayfarer-26', label: 'Wayfarer 26' },
  { ref: 'portrait.starter.wayfarer-27', label: 'Wayfarer 27' },
  { ref: 'portrait.starter.wayfarer-28', label: 'Wayfarer 28' },
  { ref: 'portrait.starter.wayfarer-29', label: 'Wayfarer 29' },
  { ref: 'portrait.starter.wayfarer-30', label: 'Wayfarer 30' },
  { ref: 'portrait.starter.wayfarer-31', label: 'Wayfarer 31' },
  { ref: 'portrait.starter.wayfarer-32', label: 'Wayfarer 32' },
  { ref: 'portrait.starter.wayfarer-33', label: 'Wayfarer 33' },
  { ref: 'portrait.starter.wayfarer-34', label: 'Wayfarer 34' },
  { ref: 'portrait.starter.wayfarer-35', label: 'Wayfarer 35' },
  { ref: 'portrait.starter.wayfarer-36', label: 'Wayfarer 36' },
  { ref: 'portrait.starter.wayfarer-37', label: 'Wayfarer 37' },
  { ref: 'portrait.starter.wayfarer-38', label: 'Wayfarer 38' },
  { ref: 'portrait.starter.wayfarer-39', label: 'Wayfarer 39' },
  { ref: 'portrait.starter.wayfarer-40', label: 'Wayfarer 40' },
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

export function defaultPronounPresetForPresentation(
  presentationId: CharacterPresentationId,
): PronounPresetId {
  if (presentationId === 'masculine') return 'he_him'
  if (presentationId === 'feminine') return 'she_her'
  return 'they_them'
}

export function isStarterCharacterPortraitRef(value: string): value is CharacterPortraitRef {
  return portraitRefs.has(value)
}

export function isStarterCharacterAppearanceRef(value: string): value is StarterAppearanceRef {
  return appearanceRefs.has(value)
}
