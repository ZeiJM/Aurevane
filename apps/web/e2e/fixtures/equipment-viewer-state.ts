import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { itemFixture } from '../../../../packages/game-core/src/content/items-test-fixtures'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { captureEquipmentAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  equipmentBehaviorActionId,
  parseBattleEquipmentCapture,
  type BattleEquipmentCapture,
} from '@aurevane/game-core/combat/combat-equipment'
import { source } from '../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { projectBattleItems } from '@/server/battle/battle-item-projection'
import {
  projectBattleBasicActions,
  projectBattleManualActionTargets,
  omitPendingBattlePayloads,
} from '@/server/battle/battle-live-viewer-projection'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from '@/server/battle/battle-viewer-entitlement'
import { PV1F_BASIC_ATTACK_ID } from '@aurevane/game-core/combat/pv1f-skills'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'

export function equipmentFixtureSources(
  weapon = false,
  controlled = false,
  genuine = false,
  twoHanded = false,
  barrier = false,
  different = false,
  ownedQuantity = 7,
) {
  const ability = structuredClone(
    defaultBasicSkills().find((x) => x.id === 'basic.recover')!.ability,
  )
  Object.assign(ability.behaviors[0]!, {
    costs: [{ resource: 'ap', amount: 10 }],
    cooldown: null,
    requirements: null,
    // Two equal packets preserve total recovery while witnessing grouped Tag explanations.
    effects: ['heal-first', 'heal-second'].map((id) => ({
      id,
      ...(controlled ? { timing: 'controlled' } : {}),
      payload: { type: 'healing', recipient: 'actor', amount: 10 },
    })),
  })
  const tonic = genuine
    ? starterItemDefinitions().find(
        (item) => item.id === (barrier ? 'ward-sigil-scroll' : 'mender-salve'),
      )!
    : itemFixture({
        id: 'fixture.salve',
        name: 'Mender Salve',
        itemClass: 'battle-item',
        inventoryCategory: 'battle-items',
        equipment: { slot: 'hand', hands: 1 },
        maximumStack: 99,
        battleUses: 2,
        ability,
        actions: { use: { behaviorId: ability.behaviors[0]!.id, name: 'Apply' } },
        media: { artworkId: 'item.mender-salve.art.v1' },
      })
  const strike = source({
    costs: [{ resource: 'ap', amount: 15 }],
    effects: [
      {
        id: 'hit',
        payload: {
          type: 'damage',
          recipient: 'primary-unit',
          amount: 10,
          scaling: { source: 'physical-power', coefficientBasisPoints: 4000 },
        },
      },
    ],
  }).definition.behaviors[0]!
  const sword = genuine
    ? starterItemDefinitions().find(
        (item) => item.id === (twoHanded ? 'sunsplitter' : 'iron-shortsword'),
      )!
    : itemFixture({
        id: 'fixture.sword',
        name: 'Iron Shortsword',
        itemClass: 'weapon',
        equipment: { slot: 'hand', hands: 1 },
        ability: {
          schemaVersion: 1,
          behaviors: [strike, { ...ability.behaviors[0]!, id: 'support' }],
        },
        actions: {
          attack: { behaviorId: strike.id, name: 'Cut' },
          support: { behaviorId: 'support', name: 'Mend' },
        },
        media: { artworkId: 'item.iron-shortsword.art.v1' },
      })
  const capture: BattleEquipmentCapture = parseBattleEquipmentCapture({
    schemaVersion: 2,
    inventoryRevision: 1,
    ...(different ? { consumptionPolicyVersion: 1 } : {}),
    selectedSupport:
      weapon && !genuine
        ? { kind: 'equipment', position: 'main-hand', itemId: sword.id, behaviorId: 'support' }
        : { kind: 'basic', actionId: 'basic.recover' },
    equipment: [
      ...(weapon ? [{ position: 'main-hand', ownedStackId: 'private-sword', item: sword }] : []),
      {
        position: 'consumable-1',
        ownedStackId: 'private-salve-stack',
        item: tonic,
        ...(different ? { ownedQuantity } : {}),
      },
      ...(!weapon
        ? [
            {
              position: 'consumable-2',
              ownedStackId: different ? 'private-second-stack' : 'private-salve-stack',
              ...(different ? { ownedQuantity: 5 } : {}),
              item: different
                ? starterItemDefinitions().find((item) => item.id === 'ward-sigil-scroll')!
                : tonic,
            },
          ]
        : []),
    ],
  })
  return [
    ...captureBasicSkillSources({
      ownerCombatantId: 'character:player',
      supportActionId: 'basic.recover',
      definitions: defaultBasicSkills(),
    }).filter(
      (x) =>
        !weapon || x.abilityId === 'basic.move' || (genuine && x.abilityId === 'basic.recover'),
    ),
    ...capture.equipment.map((unit) =>
      captureEquipmentAbilitySource(capture, unit, 'character:player')!,
    ),
  ]
}
export function equipmentFixtureAction(state: StatDrivenCombatEncounterState, actionId: string) {
  return state.capturedAbilitySources?.find(
    (source) =>
      source.equipment &&
      Object.values(source.equipment.roles).some(
        (id) =>
          equipmentBehaviorActionId(source.equipment!, id!) === actionId ||
          (actionId === PV1F_BASIC_ATTACK_ID && source.equipment!.roles.attack === id),
      ),
  )
}
export function projectEquipmentFixture(state: StatDrivenCombatEncounterState, spectator: boolean) {
  const viewer = spectator
    ? createSpectatorBattleViewerEntitlement()
    : deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
        'character:player',
      ])
  const equipmentActions = projectBattleItems(state, viewer)
  const safe = omitPendingBattlePayloads(state)
  const { rng: _rng, ...battle } = safe.tactical.battle
  void _rng
  return {
    ...safe,
    tactical: { ...safe.tactical, battle },
    manualActionTargets: projectBattleManualActionTargets(state, viewer),
    ...(spectator
      ? {}
      : {
          equipmentActions,
          basicActions: [
            ...(projectBattleBasicActions(state, viewer) ?? []),
            ...equipmentActions
              .filter((x) => x.role !== 'use')
              .map((x) => ({
                ...x,
                actionId: x.role === 'attack' ? PV1F_BASIC_ATTACK_ID : x.actionId,
              })),
          ],
        }),
  }
}
