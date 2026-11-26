import { paintedPlayerAppearanceBlueprint } from './appearance-manifest'
import {
  paintedPlayerRecipe,
  wardrobeLook,
  type PaintedPlayerLook,
} from './appearance-painted-wardrobe'

export const daryaCourierLook = {
  ...wardrobeLook(),
  identity: 'ranger',
  faceId: 'f12',
  outerwear: 'compass',
  clothColor: 'natural',
  gear: 'mapcase',
  gearColor: 'natural',
  headwear: 'none',
  facewear: 'none',
  hairstyle: 'coils',
  backdrop: 'tealstudio',
} as const satisfies PaintedPlayerLook

export function daryaCourierBlueprint() {
  return paintedPlayerAppearanceBlueprint(daryaCourierLook)
}

const courierRecipe = paintedPlayerRecipe(daryaCourierLook).slice(0, -1).join('.')

export function paintedDaryaHairstyle(look: PaintedPlayerLook) {
  const style = look.hairstyle
  if (look.faceId !== daryaCourierLook.faceId || (style !== 'coils' && style !== 'lowpony'))
    return undefined
  // The background stays selectable. Other edits use the shared creator so a
  // saved dye, body build, scar or accessory always appears in the result.
  const recipe = paintedPlayerRecipe({ ...look, hairstyle: 'coils' })
    .slice(0, -1)
    .join('.')
  return recipe === courierRecipe ? style : undefined
}
