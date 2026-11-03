import type { AbilityBehavior, AbilityEffect, AbilityTargeting } from '../combat/combat-definition'
import type { CombatTagPayload } from '../combat/combat-tag-registry'
import type { CombatBonusStat } from '../combat/combat-stat-bonus-definition'
import type { RuntimeItemDefinition, ItemTier, ItemClass } from './items'

const self: AbilityTargeting = {
  geometryVersion: 3,
  kind: 'self',
  teamPolicy: 'self',
  friendlyFire: 'allies-only',
  shape: { kind: 'single' },
  categories: ['self'],
  minimumRange: 0,
  maximumRange: 0,
  requiresLineOfSight: false,
  maximumElevationDifference: null,
  maximumSelections: 1,
}
const enemy = (range = 1): AbilityTargeting => ({
  ...self,
  kind: 'unit',
  teamPolicy: 'enemy',
  friendlyFire: 'enemies-only',
  categories: ['enemy'],
  minimumRange: 1,
  maximumRange: range,
  requiresLineOfSight: true,
  maximumElevationDifference: 1,
})
const effects = (...payloads: CombatTagPayload[]): AbilityEffect[] =>
  payloads.map((payload, index) => ({ id: `effect-${index + 1}`, timing: 'instant', payload }))
const passive = (...payloads: CombatTagPayload[]): AbilityBehavior => ({
  id: 'passive',
  activation: 'ongoing',
  mode: 'modifier',
  classification: 'utility',
  targeting: null,
  costs: [],
  cooldown: null,
  requirements: null,
  effects: payloads.map((payload, index) => ({ id: `passive-${index + 1}`, payload })),
})
const stat = (stat: CombatBonusStat, amount: number): CombatTagPayload => ({
  type: 'stat-bonus',
  recipient: 'actor',
  stat,
  amount,
})
const status = (
  statusId: string,
  potencyBasisPoints?: number,
  recipient: 'actor' | 'primary-unit' = 'actor',
  durationTurns = 2,
): CombatTagPayload => ({
  type: 'apply-status',
  recipient,
  statusId,
  stacks: 1,
  durationTurns,
  ...(potencyBasisPoints === undefined ? {} : { potencyBasisPoints }),
})
const action = (
  id: string,
  ap: number,
  payloads: CombatTagPayload[],
  options: Partial<AbilityBehavior> = {},
): AbilityBehavior => ({
  id,
  activation: 'manual',
  mode: 'action',
  classification: 'utility',
  targeting: self,
  costs: [{ resource: 'ap', amount: ap }],
  cooldown: null,
  requirements: null,
  effects: effects(...payloads),
  ...options,
})
const damage = (
  amount: number,
  coefficientBasisPoints: number,
  family: 'physical' | 'mystic' = 'physical',
  element?: 'fire' | 'storm',
): CombatTagPayload => ({
  type: 'damage',
  recipient: 'primary-unit',
  amount,
  scaling: {
    source: family === 'physical' ? 'physical-power' : 'mystic-power',
    coefficientBasisPoints,
  },
  defenseKind: family === 'physical' ? 'armor' : 'ward',
  ...(element ? { element } : {}),
})
const fireCleanse: CombatTagPayload = {
  type: 'remove-status',
  recipient: 'actor',
  statusIds: ['frozen'],
}
function item(
  key: string,
  name: string,
  description: string,
  tier: ItemTier,
  qualityPoints: number,
  itemClass: ItemClass,
  equipment: RuntimeItemDefinition['equipment'],
  behaviors: AbilityBehavior[] = [],
  actions?: RuntimeItemDefinition['actions'],
  battleUses: number | null = null,
): RuntimeItemDefinition {
  return {
    schemaVersion: 2,
    id: key,
    contentVersion: 1,
    name,
    description,
    sortOrder: 0,
    enabled: true,
    media: { artworkId: `item.${key}.art.v1` },
    inventoryCategory:
      itemClass === 'armor' || itemClass === 'hand-armor' || itemClass === 'weapon'
        ? 'gear'
        : itemClass === 'battle-item'
          ? 'battle-items'
          : itemClass === 'material'
            ? 'materials'
            : itemClass,
    itemClass,
    tier,
    qualityPoints,
    equipment,
    maximumStack: ['armor', 'hand-armor', 'weapon'].includes(itemClass) ? 1 : 99,
    requirements: null,
    ability: behaviors.length ? { schemaVersion: 1, behaviors } : null,
    ...(actions ? { actions } : {}),
    battleUses,
    consumeOnUse: false,
    tags: ['starter'],
  }
}
function armor(
  key: string,
  name: string,
  description: string,
  tier: ItemTier,
  qp: number,
  slot: 'head' | 'body' | 'pants' | 'boots',
  bonuses: CombatTagPayload[],
) {
  return item(key, name, description, tier, qp, 'armor', { slot, hands: 1 }, [passive(...bonuses)])
}
function weapon(
  key: string,
  name: string,
  description: string,
  tier: ItemTier,
  qp: number,
  ap: number,
  packets: CombatTagPayload[],
  options: {
    hands?: 1 | 2
    family?: 'physical' | 'mystic'
    range?: number
    passives?: CombatTagPayload[]
    support?: AbilityBehavior
  } = {},
) {
  return item(
    key,
    name,
    description,
    tier,
    qp,
    'weapon',
    { slot: 'hand', hands: options.hands ?? 1 },
    [
      action('attack', ap, packets, {
        classification: 'attack',
        attackFamily: options.family ?? 'physical',
        targeting: enemy(options.range),
      }),
      ...(options.passives ? [passive(...options.passives)] : []),
      ...(options.support ? [options.support] : []),
    ],
    {
      attack: { behaviorId: 'attack', name },
      ...(options.support
        ? { support: { behaviorId: options.support.id, name: 'Tower Guard' } }
        : {}),
    },
  )
}
function supply(
  key: string,
  name: string,
  description: string,
  tier: ItemTier,
  qp: number,
  ap: number,
  uses: number,
  packets: CombatTagPayload[],
  options: Partial<AbilityBehavior> = {},
) {
  return item(
    key,
    name,
    description,
    tier,
    qp,
    'battle-item',
    { slot: 'hand', hands: 1 },
    [action('use', ap, packets, options)],
    { use: { behaviorId: 'use', name } },
    uses,
  )
}

/** Source version 1 is immutable once distributed. Master publishes later versions normally. */
export function starterItemDefinitions(): readonly RuntimeItemDefinition[] {
  return [
    armor(
      'wayfarer-hood',
      'Wayfarer Hood',
      'A weathered hood that keeps the road in view.',
      'D',
      5,
      'head',
      [stat('evasion', 100)],
    ),
    armor(
      'ember-stitched-cowl',
      'Ember-Stitched Cowl',
      'Warm thread steadies a wandering spellcaster.',
      'C',
      14,
      'head',
      [stat('mystic-power', 12)],
    ),
    armor(
      'warden-helm',
      'Warden Helm',
      'Layered steel for the one who holds the doorway.',
      'A',
      26,
      'head',
      [stat('physical-defense', 18), stat('mystic-defense', 10)],
    ),
    armor(
      'traveler-jerkin',
      'Traveler Jerkin',
      'Supple leather carries the marks of long journeys.',
      'D',
      6,
      'body',
      [stat('physical-defense', 6)],
    ),
    armor(
      'stormweave-robe',
      'Stormweave Robe',
      'Silver threads hum softly in unsettled air.',
      'B',
      20,
      'body',
      [stat('mystic-defense', 16), stat('mystic-power', 8)],
    ),
    armor(
      'duskplate-cuirass',
      'Duskplate Cuirass',
      'Heavy dusk-dark plates shelter the wearer from steel and sorcery.',
      'S',
      38,
      'body',
      [stat('physical-defense', 32), stat('mystic-defense', 20)],
    ),
    armor(
      'roadworn-trousers',
      'Roadworn Trousers',
      'Practical seams leave nothing to snag on the trail.',
      'D',
      4,
      'pants',
      [stat('initiative', 3)],
    ),
    armor(
      'reinforced-greaves',
      'Reinforced Greaves',
      'Braced knees protect a sure-footed climb.',
      'C',
      14,
      'pants',
      [stat('physical-defense', 10), stat('jump', 1)],
    ),
    armor(
      'shadowstep-leggings',
      'Shadowstep Leggings',
      'Quiet layers favor the first step out of danger.',
      'A',
      24,
      'pants',
      [stat('evasion', 400), stat('initiative', 6)],
    ),
    armor(
      'trailbound-boots',
      'Trailbound Boots',
      'Reliable soles for one more stretch of road.',
      'C',
      12,
      'boots',
      [stat('movement', 1)],
    ),
    armor(
      'galewalker-boots',
      'Galewalker Boots',
      'Wind-worn silver clasps carry the stride farther.',
      'A',
      28,
      'boots',
      [stat('movement', 2)],
    ),
    item(
      'quickdraw-glove',
      'Quickdraw Glove',
      'A close-fitting glove for a quick, decisive hand.',
      'C',
      8,
      'hand-armor',
      { slot: 'hand', hands: 1 },
      [passive(stat('initiative', 6), stat('physical-power', 4))],
    ),
    item(
      'wardstone-bracer',
      'Wardstone Bracer',
      'A cool wardstone holds a small reserve of protection.',
      'B',
      16,
      'hand-armor',
      { slot: 'hand', hands: 1 },
      [
        passive(stat('mystic-defense', 12)),
        action(
          'ward',
          30,
          [
            {
              type: 'barrier-change',
              recipient: 'actor',
              amount: 8,
              basis: 'maximum-hp-percent',
              durationTurns: 2,
            },
          ],
          { cooldown: { key: 'ward', ownerTurns: 2 } },
        ),
      ],
      { support: { behaviorId: 'ward', name: 'Warding Prayer' } },
    ),
    weapon(
      'iron-shortsword',
      'Iron Shortsword',
      'A dependable blade that can strike an opening one tile beyond unarmed reach.',
      'C',
      9,
      30,
      [damage(5, 1250)],
      { range: 2 },
    ),
    weapon(
      'hollow-dagger',
      'Hollow Dagger',
      'A light blade that leaves time to move after a quick thrust.',
      'D',
      6,
      20,
      [damage(3, 850)],
    ),
    weapon(
      'buckler-patience',
      'Buckler of Patience',
      'A restrained bash followed by a brief guarded stance.',
      'C',
      12,
      30,
      [damage(4, 1000), status('guarded', 1000, 'actor', 1)],
    ),
    weapon(
      'twinfang-blade',
      'Twinfang Blade',
      'Two light cuts trade individual force for a second impact.',
      'B',
      20,
      40,
      [damage(3, 850), damage(3, 850)],
    ),
    weapon(
      'tower-shield',
      'Tower Shield',
      'A heavy shield trades striking power for durable protection and a chosen Guard action.',
      'A',
      30,
      30,
      [damage(3, 850)],
      {
        passives: [stat('physical-defense', 18), stat('mystic-defense', 10)],
        support: action('guard', 30, [status('guarded', 3000)], {
          cooldown: { key: 'guard', ownerTurns: 2 },
        }),
      },
    ),
    weapon(
      'stormcaller-staff',
      'Stormcaller Staff',
      'A short arc of lightning leaves its target Conductive.',
      'B',
      22,
      35,
      [damage(5, 1500, 'mystic', 'storm'), status('conductive', 1000, 'primary-unit', 1)],
      { family: 'mystic', range: 3 },
    ),
    weapon(
      'emberbrand',
      'Emberbrand',
      'A banked ember strengthens direct Fire damage while this blade is held.',
      'A',
      28,
      35,
      [damage(6, 1300, 'physical', 'fire'), fireCleanse],
      {
        passives: [
          {
            type: 'damage-bonus',
            recipient: 'actor',
            elementFilter: 'fire',
            multiplierBasisPoints: 11000,
          },
        ],
      },
    ),
    weapon(
      'sunsplitter',
      'Sunsplitter',
      'A two-handed blade that demands half the equipment budget and both hands.',
      'S',
      50,
      50,
      [damage(8, 2100)],
      { hands: 2 },
    ),
    supply(
      'mender-salve',
      'Mender Salve',
      'A small jar of restorative herbal salve.',
      'C',
      8,
      35,
      3,
      [
        {
          type: 'percentage-recovery',
          recipient: 'actor',
          resource: 'hp',
          percentageBasisPoints: 1200,
        },
      ],
      { classification: 'recovery' },
    ),
    supply(
      'clarity-draught',
      'Clarity Draught',
      'A clear draught that steadies a depleted spirit.',
      'C',
      8,
      35,
      3,
      [
        {
          type: 'percentage-recovery',
          recipient: 'actor',
          resource: 'mp',
          percentageBasisPoints: 1200,
        },
      ],
      { classification: 'recovery' },
    ),
    supply(
      'purifying-incense',
      'Purifying Incense',
      'A fragrant curl of smoke clears harmful applications.',
      'B',
      14,
      30,
      2,
      [
        {
          type: 'remove-status',
          recipient: 'actor',
          removalMode: 'all-debuffs',
          statusIds: ['burn'],
        },
      ],
    ),
    supply(
      'whetstone-charm',
      'Whetstone Charm',
      'An etched stone lends a brief edge to outgoing damage.',
      'C',
      12,
      25,
      2,
      [status('inspired', 1500)],
    ),
    supply(
      'ironbark-tonic',
      'Ironbark Tonic',
      'Bitter bark favors defense at the cost of outgoing force.',
      'C',
      12,
      25,
      2,
      [{ ...status('fortified', 1500), defenseIncreaseBasisPoints: 1500 } as CombatTagPayload],
    ),
    supply(
      'swiftleaf-tea',
      'Swiftleaf Tea',
      'A sharp green brew makes each ordinary step less costly.',
      'B',
      14,
      20,
      2,
      [
        {
          type: 'apply-status',
          recipient: 'actor',
          statusId: 'haste',
          stacks: 1,
          durationTurns: 2,
          movementApAdjustment: 10,
        },
      ],
    ),
    supply(
      'emberflask',
      'Emberflask',
      'A modest thrown flame, useful beyond a blade’s reach.',
      'C',
      10,
      30,
      3,
      [damage(8, 800, 'mystic', 'fire'), fireCleanse],
      { classification: 'attack', attackFamily: 'mystic', targeting: enemy(3) },
    ),
    supply(
      'vulnerability-oil',
      'Vulnerability Oil',
      'A thrown coating exposes the next opening.',
      'B',
      16,
      25,
      2,
      [status('exposed', 1500, 'primary-unit')],
      { targeting: enemy(3) },
    ),
    supply(
      'frostbind-powder',
      'Frostbind Powder',
      'A pinch of icy powder leaves an enemy Chilled.',
      'B',
      16,
      25,
      2,
      [status('frozen', undefined, 'primary-unit')],
      { targeting: enemy(3) },
    ),
    supply(
      'smoke-veil',
      'Smoke Veil',
      'A sheltering veil softens incoming blows for a short time.',
      'B',
      18,
      25,
      2,
      [status('guarded', 2000)],
    ),
    supply(
      'ward-sigil-scroll',
      'Ward Sigil Scroll',
      'A single-use battle ward unfolds from an old sigil.',
      'A',
      22,
      35,
      1,
      [
        {
          type: 'barrier-change',
          recipient: 'actor',
          amount: 20,
          basis: 'maximum-hp-percent',
          durationTurns: 2,
        },
      ],
    ),
    ...(
      [
        [
          'ashwood-plank',
          'Ashwood Plank',
          'material',
          'A smooth ashwood plank. A material sample; crafting is not available.',
        ],
        [
          'ironvein-ore',
          'Ironvein Ore',
          'material',
          'Dense iron-bearing stone. A material sample; crafting is not available.',
        ],
        [
          'dusk-petal',
          'Dusk Petal',
          'material',
          'A dried violet petal. A material sample; crafting is not available.',
        ],
        [
          'wyrm-scale-shard',
          'Wyrm Scale Shard',
          'material',
          'A weathered scale fragment. A material sample; crafting is not available.',
        ],
        [
          'glimmer-dust',
          'Glimmer Dust',
          'material',
          'Fine sparkling dust. A material sample; crafting is not available.',
        ],
        [
          'lantern-oil',
          'Lantern Oil',
          'general',
          'A sealed bottle of lamp oil. An inventory sample with no usable action.',
        ],
        [
          'rope-coil',
          'Rope Coil',
          'general',
          'A neatly bound length of rope. An inventory sample with no traversal action.',
        ],
        [
          'worn-map-fragment',
          'Worn Map Fragment',
          'general',
          'An incomplete old map. A keepsake sample; it reveals no locations.',
        ],
        [
          'travel-rations',
          'Travel Rations',
          'general',
          'A simple bundle of provisions. An inventory sample with no recovery action.',
        ],
        [
          'letter-introduction',
          'Letter of Introduction',
          'event',
          'A sealed introduction. A protected story sample with no active quest.',
        ],
        [
          'cracked-aurevane-sigil',
          'Cracked Aurevane Sigil',
          'event',
          'An old cracked medallion. A protected story sample with no event action.',
        ],
        [
          'gatewarden-token',
          'Gatewarden Token',
          'event',
          'A token bearing a closed gate. A protected story sample; it unlocks no route.',
        ],
        [
          'hearthbite-treat',
          'Hearthbite Treat',
          'companion',
          'A pouch of baked treats. A companion sample; companion gameplay is not available.',
        ],
        [
          'bond-ribbon',
          'Bond Ribbon',
          'companion',
          'A ribbon tied around a small clasp. A companion keepsake with no gameplay action.',
        ],
        [
          'travel-collar',
          'Travel Collar',
          'companion',
          'A small leather collar. A companion sample with no equip or summon action.',
        ],
      ] as const
    ).map(([key, name, itemClass, description]) =>
      item(key, name, description, 'D', 0, itemClass, null),
    ),
  ].map((definition, sortOrder) => ({ ...definition, sortOrder }))
}

export const starterItemGrant = {
  key: 'starter-items.2026-11-03.v1',
  items: starterItemDefinitions().map((item) => ({
    itemId: item.id,
    quantity:
      item.id === 'ashwood-plank'
        ? 12
        : item.id === 'ironvein-ore'
          ? 40
          : item.id === 'glimmer-dust'
            ? 99
            : item.itemClass === 'battle-item'
              ? 12
              : 1,
  })),
} as const
