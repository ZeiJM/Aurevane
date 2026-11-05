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
