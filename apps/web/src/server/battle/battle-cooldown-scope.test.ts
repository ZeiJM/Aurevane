import { expect, it, vi } from 'vitest'
import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  commitCombatAbilityCommand,
  prepareCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import {
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { battleActionCooldownTurns } from '@/components/battle/battle-action-cooldown'
import type { BattleSessionView } from './battle-session-service'
import type { BattleRuntime } from '@/components/battle/battle-runtime'
import { SKILL_COOLDOWN_RESOURCE_PREFIX } from '@aurevane/game-core/combat/skill-cooldowns'
vi.mock('server-only', () => ({}))
import { projectBattleSnapshot } from './battle-session-service'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from './battle-viewer-entitlement'
import { projectBattleHistoryForViewer } from './battle-history-privacy'

it('projects genuine independent Skill and Essence clocks through reload to cockpit counters without exposing private keys', () => {
  const captures = ['first', 'second', 'essence'].map((id) =>
    captureCombatAbilitySource({
      ...source(
        {
          id: 'main',
          costs: [{ resource: 'ap', amount: 1 }],
          cooldown: { key: 'main', ownerTurns: 2 },
        },
        id,
      ),
      abilityId: `private.${id}`,
      sourceKind: id === 'essence' ? ('essence' as const) : ('discipline-skill' as const),
    }),
  )
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  const state = reconcileCombatAbilitySources({ ...base, abilityCooldownScopeVersion: 1 }, captures)
  const command = (next: typeof state, root: (typeof captures)[number]) => ({
    state: next,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: root },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(next, root),
  })
  const used = commitCombatAbilityCommand(command(state, captures[0]!))
  const restored = reattachStatDrivenCombatBridge(
    JSON.parse(JSON.stringify(used.state)),
    base.statBridge,
  )
  const owner = deriveParticipantBattleViewerEntitlement(restored.tactical.battle.combatants, [
    'actor',
  ])
  const owned = projectBattleSnapshot(restored, owner)
  const view = { snapshot: owned } as BattleSessionView
  const runtime = {
    kind: 'pve',
    playerName: 'Player',
    playerLevel: 1,
    playerPortraitAssetId: 'character.adventure.male-01',
    playerProfileImageUrl: null,
  } as BattleRuntime
  expect(
    captures.map((capture) => battleActionCooldownTurns(view, runtime, 'actor', capture.abilityId)),
  ).toEqual([2, 0, 0])
  expect(prepareCombatAbilityCommand(command(restored, captures[1]!)).evaluation.legal).toBe(true)
  const privateResource = owned.tactical.battle.combatants
    .find((unit) => unit.id === 'actor')!
    .temporaryResources.find((row) => row.key.startsWith(SKILL_COOLDOWN_RESOURCE_PREFIX))!
  expect(privateResource).toBeDefined()
  const publicResources = restored.tactical.battle.combatants
    .find((unit) => unit.id === 'actor')!
    .temporaryResources.filter((row) => !row.key.startsWith(SKILL_COOLDOWN_RESOURCE_PREFIX))
  for (const viewer of [
    deriveParticipantBattleViewerEntitlement(restored.tactical.battle.combatants, ['enemy']),
    deriveParticipantBattleViewerEntitlement(restored.tactical.battle.combatants, ['ally']),
    createSpectatorBattleViewerEntitlement(),
  ]) {
    const projected = projectBattleSnapshot(restored, viewer)
    expect(
      projected.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.temporaryResources,
    ).toEqual(publicResources)
    expect(JSON.stringify(projected)).not.toContain(privateResource.key)
  }
})

it('keeps owner history clock keys but makes foreign cooldown receipts opaque', () => {
  const combatants = percentageDotEncounter().tactical.battle.combatants
  const records = ['skill_cooldown_advanced', 'skill_cooldown_ready'].map((event, eventIndex) => ({
    battleVersion: 2,
    eventIndex,
    createdAt: '2026-11-02T00:00:00Z',
    event: {
      event,
      combatantId: 'actor',
      cooldownKey: 'ability.discipline-skill.0070007200690076006100740065.main',
      ...(eventIndex === 0 ? { ticksRemaining: 1 } : {}),
    },
  }))
  const owner = deriveParticipantBattleViewerEntitlement(combatants, ['actor'])
  expect(projectBattleHistoryForViewer(records, [], owner)[0]!.event).toHaveProperty(
    'cooldownKey',
    records[0]!.event.cooldownKey,
  )
  for (const viewer of [
    deriveParticipantBattleViewerEntitlement(combatants, ['enemy']),
    createSpectatorBattleViewerEntitlement(),
  ]) {
    expect(projectBattleHistoryForViewer(records, [], viewer).map((row) => row.event)).toEqual(
      records.map((row) => ({ ...row.event, cooldownKey: 'private' })),
    )
  }
})
