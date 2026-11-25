import {
  CREATION_CHARACTER_PORTRAITS,
  STARTER_CHARACTER_PORTRAITS,
} from '@aurevane/game-core/character/starter-options'
import { PORTRAIT_FACES } from './appearance-face-catalog'
import { compileAppearanceManifest, paintedPlayerAppearanceBlueprint } from './appearance-manifest'
import { appearanceGenderForIdentity, CURATED_PAINTED_LOOKS } from './appearance-painted-looks'

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
    const faces = PORTRAIT_FACES.filter(
      (face) => face.painted && appearanceGenderForIdentity(face.rig) === gender,
    )
    const face = faces[(index * 11 + 5) % faces.length]!
    const outfits = CURATED_PAINTED_LOOKS.filter(({ look }) => look.identity === face.rig)
    const outfit = outfits[(index * 7 + 2) % outfits.length]!
    const manifest = compileAppearanceManifest(
      paintedPlayerAppearanceBlueprint({
        ...outfit.look,
        faceId: face.id,
        ...(index % 8 === 0 ? { apparentAge: 'mature' } : {}),
      }),
    )
    return [ref, { name: face.name, manifest }] as const
  }),
)

export function illustratedStarterPortrait(ref: string | undefined) {
  return ref ? ILLUSTRATED_STARTER_GALLERY.get(ref) : undefined
}
