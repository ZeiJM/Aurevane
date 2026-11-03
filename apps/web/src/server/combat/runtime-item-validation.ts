import {
  parseRuntimeItemDefinition,
  type RuntimeItemDefinition,
} from '@aurevane/game-core/content/items'
import { imageAssetRegistry } from '@/media/registry'
import { validateCurrentCombatContent } from '../master/current-combat-content-authoring-validation'
/** Publication adds current authoring rules; pinned historical reads only use the strict retained grammar. */
export function assertRuntimeItemPublication(value: unknown): RuntimeItemDefinition {
  if (
    !value ||
    typeof value !== 'object' ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 2
  )
    throw new TypeError('Upgrade this retained draft to Item V2 before publication.')
  const definition = parseRuntimeItemDefinition(value)
  const result = validateCurrentCombatContent('item', definition, () => ({
    valid: true,
    issues: [],
    derivedTags: [],
  }))
  if (!result.valid) throw new TypeError(result.issues[0]!.message)
  if (!definition.media.artwork) {
    const artwork = imageAssetRegistry.get(definition.media.artworkId ?? '')
    if (!artwork?.src || artwork.status !== 'approved')
      throw new TypeError('Item artwork must be finalized or registered approved artwork.')
  }
  return definition
}
