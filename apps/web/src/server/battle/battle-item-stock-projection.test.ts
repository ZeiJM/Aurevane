import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { parseBattleEquipmentCapture } from '@aurevane/game-core/combat/combat-equipment'
import { captureEquipmentAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import { activateCombatAbilitySources } from '@aurevane/game-core/combat/combat-ability-command'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { fixture } from '../../../../../packages/game-core/src/combat/roster-outcome.test-utils'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { projectBattleItems } from './battle-item-projection'
import { projectBattleSnapshot } from './battle-session-service'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from './battle-viewer-entitlement'

it('projects current captured consumable stock only to its controlling owner and strips private settlement data for every viewer', () => {
  const item = starterItemDefinitions().find((row) => row.id === 'mender-salve')!
  const capture = parseBattleEquipmentCapture({
    schemaVersion: 2,
    consumptionPolicyVersion: 1,
    inventoryRevision: 1,
    selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
    equipment: [
      { position: 'consumable-1', ownedStackId: 'private-owned-stack', ownedQuantity: 7, item },
    ],
  })
  const source = captureEquipmentAbilitySource(capture, capture.equipment[0]!, 'actor')!
  const base = fixture([])
  const active = activateCombatAbilitySources(base, [source], PV1F_COMBAT_CONTENT, true).state
  const state = reattachStatDrivenCombatBridge(
    {
      ...active,
      itemConsumptionState: {
        version: 1,
        consumed: [{ sourceInstanceId: source.sourceInstanceId, count: 2 }],
      },
    },
    base.statBridge,
  )
  const owner = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
    'actor',
  ])
  expect(projectBattleItems(state, owner)[0]).toMatchObject({ stockQuantity: 5 })
  const viewers = [
    owner,
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['enemy']),
    createSpectatorBattleViewerEntitlement(),
  ]
  for (const viewer of viewers) {
    if (viewer !== owner) expect(projectBattleItems(state, viewer)).toEqual([])
    const safe = {
      ...projectBattleSnapshot(state, viewer),
      equipmentActions: projectBattleItems(state, viewer),
    }
    expect(safe).not.toHaveProperty('itemConsumptionState')
    expect(JSON.stringify(safe)).not.toMatch(
      /private-owned-stack|sourceInstanceId|ownedQuantity|itemConsumptionState/,
    )
  }
  const historicalSource = captureEquipmentAbilitySource(
    { ...capture, consumptionPolicyVersion: undefined },
    { position: 'consumable-1', ownedStackId: 'private-owned-stack', item },
    'actor',
  )!
  const historicalActive = activateCombatAbilitySources(
    base,
    [historicalSource],
    PV1F_COMBAT_CONTENT,
    true,
  ).state
  const historical = reattachStatDrivenCombatBridge(historicalActive, base.statBridge)
  expect(projectBattleItems(historical, owner)[0]).toMatchObject({ stockQuantity: null })
})

it.each([false, true])(
  'projects role-specific weapon names and artwork with historical absence=%s',
  (historical) => {
    const current = starterItemDefinitions().find((row) => row.id === 'tower-shield')!
    const item = historical
      ? {
          ...current,
          contentVersion: 6,
          actions: {
            ...current.actions,
            support: { behaviorId: current.actions!.support!.behaviorId, name: 'Tower Guard' },
          },
        }
      : current
    const capture = parseBattleEquipmentCapture({
      schemaVersion: 2,
      inventoryRevision: 1,
      selectedSupport: {
        kind: 'equipment',
        position: 'main-hand',
        itemId: item.id,
        behaviorId: item.actions!.support!.behaviorId,
      },
      equipment: [{ position: 'main-hand', ownedStackId: 'private-shield', item }],
    })
    const source = captureEquipmentAbilitySource(capture, capture.equipment[0]!, 'actor')!
    const base = fixture([])
    const active = activateCombatAbilitySources(base, [source], PV1F_COMBAT_CONTENT, true).state
    const state = reattachStatDrivenCombatBridge(active, base.statBridge)
    const owner = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
      'actor',
    ])
    const actions = projectBattleItems(state, owner)
    expect(actions.find((a) => a.role === 'attack')).toMatchObject({
      name: 'Tower Shield',
      artworkSrc: '/media/art/items/tower-shield-v01.webp',
      iconKey: 'item.tower-shield.art.v1',
    })
    expect(actions.find((a) => a.role === 'support')).toMatchObject({
      name: 'Tower Guard',
      artworkSrc: historical
        ? '/media/art/items/tower-shield-v01.webp'
        : '/media/art/items/techniques/tower-shield-technique-v01.webp',
      iconKey: historical ? 'item.tower-shield.art.v1' : 'item.tower-shield.technique.art.v1',
    })
  },
)
it('keeps weapon and technique names/art distinct in the actual guided Support loadout', async () => {
  const { createGuidedNativeFixture } =
    await import('../../../e2e/fixtures/guided-training-service')
  const { battle } = await (await createGuidedNativeFixture('equipment-support')).start()
  const actions = battle.snapshot.equipmentActions ?? []
  expect(actions.find((action) => action.role === 'attack')).toMatchObject({ name: 'Tower Shield' })
  expect(actions.find((action) => action.role === 'support')).toMatchObject({
    name: 'Tower Guard',
    artworkSrc: '/media/art/items/techniques/tower-shield-technique-v01.webp',
  })
})
