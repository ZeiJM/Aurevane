import { expect, it, vi } from 'vitest'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import { prepareCombatAbilityCommand } from '@aurevane/game-core/combat/combat-ability-command'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import {
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  resolveBattleCapturedSkill,
  battleActionDescriptorWithElevation,
  battleSkillTargetSpec,
  selectInitialBattleSkillPreviewIntent,
  selectDirectionalBattleSkillPreviewIntent,
  selectBattleSkillPreviewIntent,
} from '@/components/battle/battle-preview-selection'
import { capturedBasicBattle } from '@/components/battle/battle-basic-actions.test-utils'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { battleRangePreviewIntents } from '@/components/battle/battle-range-previews'
vi.mock('server-only', () => ({}))
import { projectBattleManualActionTargets } from './battle-live-viewer-projection'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from './battle-viewer-entitlement'

it('preserves actual captured Basic elevation through the controller descriptor constructor while elevating only Attack Skills', () => {
  const { view } = capturedBasicBattle()
  const choice = view.snapshot.manualActionTargets!.find(
    (row) => row.actionId === 'basic.attack.unarmed.basic',
  )!
  expect(choice).toBeDefined()
  const captured = resolveBattleCapturedSkill(
    {
      id: choice.actionId,
      targetKind: choice.target.kind,
      targetTeamPolicy: choice.target.teamPolicy,
      minimumRange: choice.target.minimumRange,
      maximumRange: choice.target.maximumRange,
    },
    [choice],
  )!
  expect(captured.classification).toBe('attack')
  const before = JSON.stringify(captured)
  const basic = battleActionDescriptorWithElevation(captured, captured.target, true)
  expect(basic.target!.maximumElevationDifference).toBe(choice.target.maximumElevationDifference)
  expect(battleSkillTargetSpec(basic, true)!.maximumElevationDifference).toBe(
    choice.target.maximumElevationDifference,
  )
  for (const classification of ['attack', 'recovery', 'utility'] as const) {
    const definition = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!
    const skill = {
      ...captured,
      id: `skill.${classification}`,
      classification,
      target: definition.ability.behaviors[0]!.targeting!,
    }
    const described = battleActionDescriptorWithElevation(skill, skill.target, true)
    expect(described.target!.maximumElevationDifference).toBe(
      classification === 'attack' ? 3 : skill.target.maximumElevationDifference,
    )
    expect(battleActionDescriptorWithElevation(skill, skill.target, false)).toBe(skill)
  }
  expect(JSON.stringify(captured)).toBe(before)
})

it.each(['damage', 'pierce', 'utility'] as const)(
  'projects selected %s group damage semantics through the actual owner capture adapter',
  (kind) => {
    const captured = captureCombatAbilitySource(
      source({
        effects: [
          {
            id: 'effect',
            payload:
              kind === 'utility'
                ? {
                    type: 'apply-status',
                    recipient: 'actor',
                    statusId: 'guarded',
                    stacks: 1,
                    durationTurns: 2,
                    potencyBasisPoints: 1200,
                  }
                : kind === 'pierce'
                  ? {
                      type: 'pierce',
                      recipient: 'primary-unit',
                      amount: 10,
                      armorIgnoredBasisPoints: 5000,
                    }
                  : { type: 'damage', recipient: 'primary-unit', amount: 10 },
          },
        ],
      }),
    )
    const base = preparePv1fTurnEconomy(percentageDotEncounter())
    const state = reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(base, [captured]),
      base.statBridge,
    )
    const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
      'actor',
    ])
    const choices = projectBattleManualActionTargets(state, viewer)
    expect(choices).toHaveLength(1)
    expect(choices[0]!.dealsDamage).toBe(kind !== 'utility')
    const descriptor = resolveBattleCapturedSkill(
      {
        id: captured.abilityId,
        targetKind: 'self',
        targetTeamPolicy: 'self',
        minimumRange: 0,
        maximumRange: 0,
      },
      choices,
    )!
    expect(descriptor.dealsDamage).toBe(kind !== 'utility')
    expect(
      projectBattleManualActionTargets(state, createSpectatorBattleViewerEntitlement()),
    ).toEqual([])
    expect(JSON.stringify(choices)).not.toMatch(
      /armorIgnoredBasisPoints|sourceInstanceId|definition/,
    )
  },
)

it.each([{ kind: 'line', length: 3 }, { kind: 'circle', radius: 2 }, { kind: 'all' }] as const)(
  'uses the actual canonical default for omitted-marker %j from capture through authoritative quote',
  (shape) => {
    const captured = captureCombatAbilitySource(
      source({
        targeting: {
          ...source().definition.behaviors[0]!.targeting!,
          shape,
          maximumSelections: 1,
          minimumRange: 0,
          maximumRange: shape.kind === 'line' ? 3 : shape.kind === 'circle' ? 2 : 0,
        },
        accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
        effects: [
          { id: 'hit', payload: { type: 'damage', recipient: 'affected-units', amount: 10 } },
        ],
      }),
    )
    const base = preparePv1fTurnEconomy(percentageDotEncounter())
    const state = reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(base, [captured]),
      base.statBridge,
    )
    const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
      'actor',
    ])
    const choices = projectBattleManualActionTargets(state, viewer)
    expect(choices[0]!.classification).toBe('attack')
    expect(choices[0]!.target.geometryVersion).toBe(2)
    expect(captured.definition.behaviors[0]!.targeting!.geometryVersion).toBeUndefined()
    expect(JSON.stringify(choices)).not.toContain('chanceBasisPoints')
    expect(
      projectBattleManualActionTargets(state, createSpectatorBattleViewerEntitlement()),
    ).toEqual([])
    const skill = resolveBattleCapturedSkill(
      {
        id: captured.abilityId,
        targetKind: 'self',
        targetTeamPolicy: 'self',
        minimumRange: 0,
        maximumRange: 0,
      },
      choices,
    )!
    const combatants = state.tactical.placements.map((p) => {
      const unit = state.tactical.battle.combatants.find((u) => u.id === p.combatantId)!
      return {
        combatantId: unit.id,
        teamIndex: unit.teamId === 'players' ? 0 : 1,
        hp: unit.hp,
        position: p.position,
      }
    })
    const selection = {
      actorId: 'actor',
      selectedCombatantId: 'enemy',
      selectedTile: { x: 2, y: 1 },
      combatants,
    }
    const intents = [
      selectInitialBattleSkillPreviewIntent(skill, selection),
      selectDirectionalBattleSkillPreviewIntent(skill, selection, { x: 1, y: 0 }),
      selectBattleSkillPreviewIntent(skill, selection),
      ...battleRangePreviewIntents(skill, 'actor', combatants),
    ]
    expect(
      intents.every(
        (intent) => intent?.target.kind === (shape.kind === 'line' ? 'direction' : 'activate'),
      ),
    ).toBe(true)
    expect(intents.length).toBeGreaterThan(3)
    for (const [index, intent] of intents.entries()) {
      expect(intent?.behaviorId).toBe('strike')
      const quote = prepareCombatAbilityCommand({
        state,
        actorId: 'actor',
        root: { kind: 'canonical', source: captured, behaviorId: intent!.behaviorId },
        selection: intent!.target,
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(state, captured),
      })
      if (index < 3) expect(quote.evaluation.legal).toBe(true)
      else
        expect(quote.evaluation.issues.some((issue) => issue.code === 'invalid-target-kind')).toBe(
          false,
        )
    }
  },
)
