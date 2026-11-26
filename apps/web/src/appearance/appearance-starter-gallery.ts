import {
  CREATION_CHARACTER_PORTRAITS,
  STARTER_CHARACTER_PORTRAITS,
} from '@aurevane/game-core/character/starter-options'
import { activePaintedLooksForGender } from './appearance-active-catalog'
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
    const pool = activePaintedLooksForGender(gender)
    const { look, label } = pool[index % pool.length]!
    const manifest = compileAppearanceManifest(
      paintedPlayerAppearanceBlueprint({ ...look, backdrop: backdrops[index]! }),
    )
    return [ref, { name: label, manifest }] as const
  }),
)

export function illustratedStarterPortrait(ref: string | undefined) {
  return ref ? ILLUSTRATED_STARTER_GALLERY.get(ref) : undefined
}
