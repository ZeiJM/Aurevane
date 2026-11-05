import { expect, it, vi } from 'vitest'
import audit from '../../../../../docs/verification/2026-11-05-items-polish-successors.json'
import { parseRuntimeItemDefinition } from '@aurevane/game-core/content/items'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { captureEquipmentAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import { activateCombatAbilitySources } from '@aurevane/game-core/combat/combat-ability-command'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { fixture } from '../../../../../packages/game-core/src/combat/roster-outcome.test-utils'
import type { BattleEquipmentCapture } from '@aurevane/game-core/combat/combat-equipment'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { presentItem } from '@/lib/items/item-presentation'
import { itemSupportOptions } from '@/components/character/item-support-options'
import type { CharacterItemsView } from '@/server/character/character-items-service'
vi.mock('server-only', () => ({}))
import { projectBattleItems } from './battle-item-projection'
import { deriveParticipantBattleViewerEntitlement } from './battle-viewer-entitlement'

const weapons = [
  ['twinfang-blade', 'quickstep', 'Quickstep', 15],
  ['stormcaller-staff', 'storm-ward', 'Storm Ward', 25],
  ['emberbrand', 'kindle', 'Kindle', 20],
] as const

it.each(
  weapons.flatMap(([itemId, behaviorId, name, ap]) =>
    (['current', 'retained'] as const).map((bracerVersion) => ({
      itemId,
      behaviorId,
      name,
      ap,
      bracerVersion,
    })),
  ),
)(
  'offers $itemId Support with $bracerVersion armor and injects only its selected battle role',
  ({ itemId, behaviorId, name, ap, bracerVersion }) => {
    const definitions = starterItemDefinitions()
    const weapon = definitions.find((item) => item.id === itemId)!
    const bracer =
      bracerVersion === 'current'
        ? definitions.find((item) => item.id === 'wardstone-bracer')!
        : parseRuntimeItemDefinition(
            audit.candidates.find((item) => item.itemId === 'wardstone-bracer')!.beforeDefinition,
          )
    expect(bracer.contentVersion).toBe(bracerVersion === 'current' ? 6 : 1)
    const view = {
      equipment: { 'main-hand': 'private-weapon', 'off-hand': 'private-bracer' },
      stacks: [
        { id: 'private-weapon', item: presentItem(weapon) },
        { id: 'private-bracer', item: presentItem(bracer) },
      ],
    } as unknown as CharacterItemsView
    const choices = itemSupportOptions(view)
    expect(choices.map((choice) => choice.label)).toEqual([
      `${name} · Main Hand`,
      ...(bracerVersion === 'retained' ? ['Warding Prayer · Off Hand'] : []),
    ])
    expect(JSON.stringify(choices.map((choice) => choice.selection))).not.toContain('private-')
    const capture: BattleEquipmentCapture = {
      schemaVersion: 2,
      inventoryRevision: 1,
      selectedSupport: choices[0]!.selection,
      equipment: [
        { position: 'main-hand', ownedStackId: 'private-weapon', item: weapon },
        { position: 'off-hand', ownedStackId: 'private-bracer', item: bracer },
      ],
    }
    function project(selected: BattleEquipmentCapture) {
      const sources = selected.equipment.map((unit) =>
        captureEquipmentAbilitySource(selected, unit, 'actor')!,
      )
      const base = fixture([])
      const active = activateCombatAbilitySources(base, sources, PV1F_COMBAT_CONTENT, true).state
      const state = reattachStatDrivenCombatBridge(active, base.statBridge)
      return projectBattleItems(
        state,
        deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['actor']),
      )
    }
    const injected = project(capture)
    expect(injected.filter((option) => option.role === 'support')).toHaveLength(1)
    expect(injected.find((option) => option.role === 'support')).toMatchObject({
      actionId: `item.${itemId}.main-hand.support`,
      behaviorId,
      contentVersion: weapon.contentVersion,
      unavailableReason: null,
      behaviors: [{ costs: [{ resource: 'ap', amount: ap }] }],
    })
    expect(injected.some((option) => option.role === 'attack')).toBe(true)
    const competing = project({
      ...capture,
      selectedSupport: {
        kind: 'equipment',
        position: 'off-hand',
        itemId: 'wardstone-bracer',
        behaviorId: 'ward',
      },
    })
    expect(
      competing.filter((option) => option.role === 'support').map((option) => option.behaviorId),
    ).toEqual(bracerVersion === 'retained' ? ['ward'] : [])
    expect(competing.some((option) => option.role === 'attack')).toBe(true)
    expect(
      project({ ...capture, selectedSupport: { kind: 'basic', actionId: 'basic.recover' } }).some(
        (option) => option.role === 'support',
      ),
    ).toBe(false)
  },
)
