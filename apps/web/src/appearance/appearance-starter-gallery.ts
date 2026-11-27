import {
  CREATION_CHARACTER_PORTRAITS,
  STARTER_CHARACTER_PORTRAITS,
} from '@aurevane/game-core/character/starter-options'
import { FEATURED_PAINTED_LOOKS } from './appearance-active-catalog'
import { appearanceGenderForIdentity } from './appearance-painted-looks'
import { portraitFace } from './appearance-face-catalog'
import { compileAppearanceManifest, paintedPlayerAppearanceBlueprint } from './appearance-manifest'
import { PAINTED_PORTRAIT_SETTINGS, type PaintedPlayerLook } from './appearance-painted-wardrobe'

const backdrops = Object.keys(PAINTED_PORTRAIT_SETTINGS) as PaintedPlayerLook['backdrop'][]

const creationGender = new Map(
  CREATION_CHARACTER_PORTRAITS.map(({ ref, presentationId }) => [ref, presentationId]),
)

export const ILLUSTRATED_STARTER_GALLERY = new Map<
  string,
  {
    name: string
    manifest: ReturnType<typeof compileAppearanceManifest>
  }
>(
  STARTER_CHARACTER_PORTRAITS.map(({ ref }, index) => {
    const gender = creationGender.get(ref) ?? (index % 2 ? 'masculine' : 'feminine')
    const pool = FEATURED_PAINTED_LOOKS.filter(
      ({ look }) => appearanceGenderForIdentity(look.identity) === gender,
    )
    const { look } = pool[index % pool.length]!
    const manifest = compileAppearanceManifest(
      paintedPlayerAppearanceBlueprint({ ...look, backdrop: backdrops[index]! }),
    )
    return [
      ref,
      {
        name:
          look.faceId === 'f12'
            ? look.hairstyle === 'coils'
              ? 'Darya · Tight coils'
              : 'Darya · Low ponytail'
            : portraitFace(look.faceId)!.name,
        manifest,
      },
    ] as const
  }),
)

export function illustratedStarterPortrait(ref: string | undefined) {
  return ref ? ILLUSTRATED_STARTER_GALLERY.get(ref) : undefined
}
