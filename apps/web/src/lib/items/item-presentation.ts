import type { RuntimeItemDefinition } from '@aurevane/game-core/content/items'
import { contentMediaSource } from '@aurevane/game-core/combat/content-media'
import { abilityBehaviorInformation } from '@/components/character/ability-detail-presentation'
import { imageAssetRegistry } from '@/media/registry'

/** Safe shared reader for inventory, Master previews and captured Item information. */
export function presentItem(definition: RuntimeItemDefinition) {
  const image = definition.media.artwork
    ? contentMediaSource(definition.media.artwork)
    : (imageAssetRegistry.get(definition.media.artworkId ?? '')?.src ?? null)
  return {
    id: definition.id,
    contentVersion: definition.contentVersion,
    name: definition.name,
    description: definition.description,
    enabled: definition.enabled,
    inventoryCategory: definition.inventoryCategory,
    itemClass: definition.itemClass,
    tier: definition.tier,
    qualityPoints: definition.qualityPoints,
    equipment: definition.equipment ? { ...definition.equipment } : null,
    maximumStack: definition.maximumStack,
    battleUses: definition.battleUses,
    consumeOnUse: false as const,
    artworkSrc: image,
    tags: [...definition.tags],
    actions: definition.actions ? structuredClone(definition.actions) : {},
    reports: (definition.ability?.behaviors ?? []).map((behavior) => ({
      behaviorId: behavior.id,
      name:
        Object.values(definition.actions ?? {}).find(
          (binding) => binding.behaviorId === behavior.id,
        )?.name ?? 'Passive',
      ...abilityBehaviorInformation(
        definition.actions?.use?.behaviorId === behavior.id && definition.battleUses !== null
          ? {
              ...behavior,
              maximumUsesPerBattle: Math.min(
                behavior.maximumUsesPerBattle ?? 99,
                definition.battleUses,
              ),
            }
          : behavior,
        { tagPresentation: definition.ability?.tagPresentation },
      ),
    })),
  }
}
export type ItemPresentation = ReturnType<typeof presentItem>
