import { daryaCourierLook } from './appearance-darya-look'
import { PORTRAIT_FACES } from './appearance-face-catalog'
import { featuredVariantDyes } from './appearance-featured-variants'
import { appearanceEnsembles } from './appearance-look-ensembles'
import type { AppearanceBlueprint, PaintedPlayerAppearanceBlueprint } from './appearance-manifest'
import {
  appearanceGenderForIdentity,
  hairstyleAvailableForGender,
  type AppearanceGender,
} from './appearance-gender'
import { matchingPaintedStudy, PAINTED_STUDIES } from './appearance-painted-studies'
import {
  paintedPlayerRecipe,
  wardrobeLook,
  type PaintedPlayerLook,
} from './appearance-painted-wardrobe'

const featuredTitles = {
  asta: 'Pine Cape Trailblazer',
  cassian: 'High Collar Sentinel',
  yuna: 'Moonlit Ranger',
  ysara: 'Gilded Envoy',
  nalia: 'Frost Orchard Keeper',
  aren: 'Silverlake Wayfarer',
  kieran: 'Elder Sky Cartographer',
  alden: 'Quilted Route Finder',
} as const

export const FEATURED_PAINTED_LOOKS = [
  ...Object.values(PAINTED_STUDIES).map(({ key, look }) => ({
    key: key as string,
    label: featuredTitles[key],
    look: look as PaintedPlayerLook,
  })),
  { key: 'darya-coils', label: 'Compass Courier · Tight Coils', look: daryaCourierLook },
  {
    key: 'darya-lowpony',
    label: 'Compass Courier · Low Ponytail',
    look: { ...daryaCourierLook, hairstyle: 'lowpony' } as const,
  },
]

export type PaintedLookChoice = Readonly<{
  key: string
  label: string
  group: string
  variants: readonly [PaintedPlayerLook, PaintedPlayerLook, PaintedPlayerLook]
}>

const featuredGroup = 'Featured paintings'

function choicesForGender(gender: AppearanceGender): readonly PaintedLookChoice[] {
  const featured = FEATURED_PAINTED_LOOKS.filter(
    ({ look }) => appearanceGenderForIdentity(look.identity) === gender,
  )
  const applyPalette = (look: PaintedPlayerLook, dye: (typeof featuredVariantDyes)[number]) =>
    look.outerwear === 'none' ? { ...look, faceColor: dye } : { ...look, clothColor: dye }
  const choices: PaintedLookChoice[] = featured.map(({ key, label, look }) => ({
    key,
    label,
    group: featuredGroup,
    variants: [
      look,
      applyPalette(look, featuredVariantDyes[0]),
      applyPalette(look, featuredVariantDyes[1]),
    ],
  }))
  const faces = PORTRAIT_FACES.filter((face) => appearanceGenderForIdentity(face.rig) === gender)
  const featuredFaces = new Set(featured.map(({ look }) => look.faceId))
  const sequence = [...faces.filter(({ id }) => !featuredFaces.has(id)), ...faces]
  const labelCounts = new Map<string, number>()
  for (let index = 0; choices.length < 500; index++) {
    const face = sequence[index % sequence.length]!
    const ensemble =
      appearanceEnsembles[(index + Math.floor(index / faces.length)) % appearanceEnsembles.length]!
    const cuts = ensemble.hair.filter((cut) => hairstyleAvailableForGender(cut, gender))
    const hairstyle = cuts[Math.floor(index / appearanceEnsembles.length) % cuts.length]!
    const count = (labelCounts.get(ensemble.title) ?? 0) + 1
    labelCounts.set(ensemble.title, count)
    const base = {
      ...wardrobeLook(),
      identity: face.rig,
      faceId: face.id,
      outerwear: ensemble.coat,
      gear: ensemble.gear,
      headwear: ensemble.headwear ?? 'none',
      facewear: ensemble.facewear ?? 'none',
      bodyFrame:
        ensemble.build ?? (['natural', 'lean', 'natural', 'strong', 'slight'] as const)[index % 5]!,
      ...(face.rig === 'elder' || index % 19 === 0
        ? ({ apparentAge: index % 3 === 0 ? 'elder' : 'mature' } as const)
        : index % 11 === 0
          ? ({ apparentAge: 'youthful' } as const)
          : {}),
      ...(gender === 'masculine' && index % 5 === 0
        ? {
            facialHair: (['stubble', 'goatee', 'boxed', 'anchor', 'moustache'] as const)[
              Math.floor(index / 5) % 5
            ]!,
          }
        : {}),
      backdrop: ensemble.setting,
      hairstyle,
      hairDye: (['espresso', 'chestnut', 'onyx', 'auburn', 'charcoal'] as const)[index % 5]!,
      ...(ensemble.scar
        ? { scar: ensemble.scar }
        : index % 7 === 0
          ? {
              scar: (['cross', 'cheekpair', 'temple', 'brow', 'lip'] as const)[
                Math.floor(index / 7) % 5
              ]!,
            }
          : {}),
    } satisfies PaintedPlayerLook
    const [first, second, third] = ensemble.palettes.map(
      ([clothColor, gearColor, hairAccent, eyeColor, secondEye], variant) => ({
        ...base,
        clothColor,
        gearColor,
        eyeColor,
        ...(ensemble.headwear ? { headColor: gearColor } : {}),
        ...(ensemble.facewear ? { faceColor: gearColor } : {}),
        ...(index % 3 !== 0
          ? {
              hairAccent,
              hairPlacement: (['underlight', 'streak', 'ombre', 'tips'] as const)[
                Math.floor(index / 9) % 4
              ]!,
            }
          : {}),
        ...(index % 9 === 1 && variant === 2
          ? ({ hairHighlight: hairAccent === 'silver' ? 'copper' : 'silver' } as const)
          : {}),
        ...(secondEye
          ? { secondEye, irisPattern: (['paired', 'central', 'sectoral'] as const)[index % 3]! }
          : {}),
      }),
    )
    choices.push({
      key: `${face.id}-${index}`,
      label: `${ensemble.title} ${String(count).padStart(2, '0')}`,
      group: ensemble.group,
      variants: [first!, second!, third!],
    })
  }
  return choices
}

const catalogue = {
  feminine: choicesForGender('feminine'),
  masculine: choicesForGender('masculine'),
}
const allChoices = [...catalogue.feminine, ...catalogue.masculine]
const recipeWithoutBackdrop = (look: PaintedPlayerLook) =>
  paintedPlayerRecipe(look).slice(0, -1).join('.')
const byRecipe = new Map(
  allChoices.flatMap((choice) =>
    choice.variants.map(
      (look, variant) => [recipeWithoutBackdrop(look), { choice, variant }] as const,
    ),
  ),
)
const asta = allChoices.find(({ key }) => key === 'asta')!

export function findActivePaintedLook(look: PaintedPlayerLook) {
  return (
    byRecipe.get(recipeWithoutBackdrop(look)) ??
    (matchingPaintedStudy(look) === 'asta' ? { choice: asta, variant: 0 } : undefined)
  )
}

export function paintedLookStance(look: PaintedPlayerLook) {
  const variant = findActivePaintedLook(look)?.variant
  return variant === 1 || variant === 2 ? variant : 0
}

export function activePaintedLookKey(look: PaintedPlayerLook) {
  return findActivePaintedLook(look)?.choice.key
}

export function isActivePaintedAppearance(
  blueprint: AppearanceBlueprint | null | undefined,
): blueprint is PaintedPlayerAppearanceBlueprint {
  return blueprint?.v === 6 && activePaintedLookKey(blueprint) !== undefined
}

export function activePaintedLooksForGender(gender?: AppearanceGender) {
  return gender ? catalogue[gender] : allChoices
}

export function defaultActivePaintedLook(gender: AppearanceGender = 'feminine') {
  return catalogue[gender][0]!.variants[0]
}

export function pickActivePaintedLook(
  gender?: AppearanceGender,
  random = Math.random,
  previous?: PaintedPlayerLook,
) {
  const previousKey = previous && activePaintedLookKey(previous)
  const pool = activePaintedLooksForGender(gender).filter(({ key }) => key !== previousKey)
  const choice = pool[Math.floor(random() * pool.length)]!
  return choice.variants[Math.floor(random() * choice.variants.length)]!
}
