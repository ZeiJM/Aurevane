import { daryaCourierLook } from './appearance-darya-recipe'
import { paintedPlayerAppearanceBlueprint } from './appearance-manifest'

export { daryaCourierLook, paintedDaryaHairstyle } from './appearance-darya-recipe'

export function daryaCourierBlueprint() {
  return paintedPlayerAppearanceBlueprint(daryaCourierLook)
}
