import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { applyAbilityTimingDefaults } from '@aurevane/game-core/combat/combat-definition'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  prepareCombatAbilityCommand,
  commitCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import {
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  validateCombatEncounterState,
  type CombatEncounterState,
} from '@aurevane/game-core/combat/actions'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { BattleGroundAreaLayer } from '@/components/battle/battle-ground-area-layer'
import { projectBattleSnapshot } from './battle-session-service'
import {
  createSpectatorBattleViewerEntitlement,
  deriveParticipantBattleViewerEntitlement,
} from './battle-viewer-entitlement'

vi.mock('server-only', () => ({}))

it.each(['participant', 'spectator'] as const)(
  'the first authoritative Instant Ground commit projects an active field to %s and survives reload',
  (viewerKind) => {
    const base = preparePv1fTurnEconomy(percentageDotEncounter())
    const template = source()
    const behavior = template.definition.behaviors[0]!
    const captured = captureCombatAbilitySource(
      source({
        targeting: {
          ...behavior.targeting!,
          kind: 'ground-tile',
          geometryVersion: 3,
          categories: ['ground'],
          minimumRange: 0,
        },
        effects: [
          {
            id: 'hit',
            timing: 'instant',
            payload: { type: 'damage', recipient: 'affected-units', target: 'ground', amount: 10 },
          },
        ],
        groundArea: {
          durationRounds: 3,
          visualPresetId: 'arcane-pulse',
          contactPolicyVersion: 1,
          placementTimingVersion: 1,
          targetTeams: 'enemies',
          entryEffectIds: ['hit'],
        },
      }),
    )
    const defaulted = captureCombatAbilitySource({
      ...captured,
      definition: {
        ...captured.definition,
        behaviors: captured.definition.behaviors.map((row) =>
          applyAbilityTimingDefaults(row, {
            version: 1,
            tagAuthority: 'global',
            modes: { 'ground-area': 'next-round' },
          }),
        ),
      },
    })
    expect(defaulted.definition.behaviors[0]?.groundArea?.timing).toBeUndefined()
    const state = reconcileCombatAbilitySources(
      {
        ...base,
        groundEffectPolicyVersion: 1,
        groundContactPolicyVersion: 1,
        effectTimingPolicy: { version: 1, modes: { 'ground-area': 'next-round' } },
      },
      [defaulted],
    )
    const command = {
      state,
      actorId: 'actor',
      root: { kind: 'canonical' as const, source: defaulted, behaviorId: 'strike' },
      selection: { kind: 'tile' as const, position: { x: 2, y: 1 } },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, defaulted),
    }
    const before = JSON.stringify(state)
    const prepared = prepareCombatAbilityCommand(command)
    expect(prepared.evaluation.legal).toBe(true)
    expect(prepared.evaluation.projectedGroundAreas?.[0]?.activationRound).toBe(1)
    expect(JSON.stringify(state)).toBe(before)
    const committed = commitCombatAbilityCommand(command)
    expect(committed.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')?.hp).toBe(
      990,
    )
    expect(committed.state.pendingEffects ?? []).toEqual([])
    expect(committed.state.groundAreas?.[0]).toMatchObject({
      activationRound: 1,
      expiresAtRound: 4,
      targetTeams: 'enemies',
      placementTimingVersion: 1,
    })
    const restored = reattachStatDrivenCombatBridge(
      JSON.parse(JSON.stringify(committed.state)) as CombatEncounterState,
      base.statBridge,
    )
    expect(validateCombatEncounterState(restored)).toEqual([])
    const viewer =
      viewerKind === 'participant'
        ? deriveParticipantBattleViewerEntitlement(restored.tactical.battle.combatants, ['actor'])
        : createSpectatorBattleViewerEntitlement()
    const snapshot = projectBattleSnapshot(restored, viewer)
    expect(snapshot.groundAreas).toEqual([
      {
        id: 'ground.area.1',
        effectVisualIds: ['damage'],
        targetTeams: 'enemies',
        tiles: [{ x: 2, y: 1 }],
        activationRound: 1,
        expiresAtRound: 4,
        visualPresetId: 'arcane-pulse',
      },
    ])
    for (const key of [
      'caster',
      'content',
      'entryEffects',
      'sourceActionId',
      'abilityCommandFacts',
      'placementTimingVersion',
    ])
      expect(snapshot.groundAreas?.[0]).not.toHaveProperty(key)
    const html = renderToStaticMarkup(
      createElement(BattleGroundAreaLayer, {
        areas: snapshot.groundAreas,
        round: snapshot.tactical.battle.round,
        position: { x: 2, y: 1 },
      }),
    )
    expect(html).toContain('data-ground-area-phase="active"')
    expect(html).not.toContain('data-ground-area-phase="pending"')
    expect(html).not.toContain('data-ground-area-clock')
  },
)
