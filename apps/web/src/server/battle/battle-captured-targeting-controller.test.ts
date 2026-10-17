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
  selectInitialBattleSkillPreviewIntent,
  selectDirectionalBattleSkillPreviewIntent,
  selectBattleSkillPreviewIntent,
} from '@/components/battle/battle-preview-selection'
import { battleRangePreviewIntents } from '@/components/battle/battle-range-previews'
vi.mock('server-only', () => ({}))
import { projectBattleManualActionTargets } from './battle-live-viewer-projection'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from './battle-viewer-entitlement'

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
