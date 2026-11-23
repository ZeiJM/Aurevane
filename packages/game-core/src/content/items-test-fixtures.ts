import type { RuntimeItemDefinition } from './items'
export function itemFixture(overrides: Partial<RuntimeItemDefinition> = {}): RuntimeItemDefinition {
  return {
    schemaVersion: 2,
    id: 'test.helm',
    contentVersion: 1,
    name: 'Iron Helm',
    description: 'A domain test fixture.',
    sortOrder: 0,
    enabled: true,
    media: { artworkId: 'test.helm.art' },
    inventoryCategory: 'gear',
    itemClass: 'armor',
    tier: 'D',
    qualityPoints: 10,
    equipment: { slot: 'head', hands: 1 },
    maximumStack: 1,
    requirements: null,
    ability: null,
    battleUses: null,
    consumeOnUse: false,
    tags: [],
    ...overrides,
  }
}
