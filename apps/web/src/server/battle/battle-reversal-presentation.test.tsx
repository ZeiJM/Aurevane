import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import type { BattleSessionRepository } from '@aurevane/db/battle-session'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  PV1F_COMBAT_CONTENT,
  preparePv1fTurnEconomy,
  finishPv1fTurn,
  executePv1fAction,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { endCombatReversal } from '@aurevane/game-core/combat/combat-reversal'
import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { projectBattleSnapshot } from './battle-session-service'
import { abilityBehaviorInformation } from '@/components/character/ability-detail-presentation'
import { BattleCombatantEffects } from '@/components/battle/battle-combatant-effects'
import {
  projectBattleManualActionTargets,
  projectBattleStatusStateForViewer,
} from './battle-live-viewer-projection'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from './battle-viewer-entitlement'

vi.mock('server-only', () => ({}))

function fixture() {
  const captured = captureCombatAbilitySource({
    ...source({
      id: 'prepare',
      classification: 'utility',
      attackFamily: undefined,
      costs: [
        { resource: 'ap', amount: 35 },
        { resource: 'mp', amount: 5 },
        { resource: 'hp', amount: 3 },
      ],
      cooldown: { key: 'mirror', ownerTurns: 3 },
      targeting: {
        kind: 'self',
        teamPolicy: 'self',
        friendlyFire: 'allies-only',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 0,
        maximumSelections: 1,
        maximumElevationDifference: null,
        requiresLineOfSight: false,
      },
      effects: [
        {
          id: 'counter',
          timing: 'controlled',
          payload: {
            type: 'reversal',
            recipient: 'actor',
            version: 1,
            family: 'physical',
            reflectionBasisPoints: 12500,
            attackerMaxHpCapBasisPoints: 1800,
            defenderMaxHpCapBasisPoints: 2400,
          },
        },
      ],
    }),
    abilityId: 'vanguard.forceful-strike',
    contentVersion: 2,
  })
  const base = percentageDotEncounter()
  const initial = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(preparePv1fTurnEconomy(base), [captured]),
    base.statBridge,
  )
  const state = reattachStatDrivenCombatBridge(
    primeCombatControlledAbility({
      state: initial,
      actorId: 'actor',
      sourceInstanceId: captured.sourceInstanceId,
      behaviorId: 'prepare',
      content: PV1F_COMBAT_CONTENT,
    }).state,
    base.statBridge,
  )
  return { state, captured, initial }
}

describe('Reversal captured readers and viewer profiles', () => {
  it('uses the canonical Skill cost/cooldown and authored counter values in the shared report', () => {
    const { captured } = fixture()
    const report = abilityBehaviorInformation(captured.definition.behaviors[0]!)
    expect(Object.fromEntries(report.rows)).toMatchObject({
      Cost: '35 AP / 5 MP / 3 HP',
      Cooldown: '3 turns',
    })
    expect(report.effectDescriptions[0]).toContain('18%')
    expect(report.effectDescriptions[0]).toContain('24%')
    expect(report.effects[0]?.parts.timing).toBe('Controlled')
  })
  it('shows armed state to owner, ordinary opponent and spectator without leaking the ledger', () => {
    const { state } = fixture()
    for (const viewer of [
      deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['actor']),
      deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['enemy']),
      createSpectatorBattleViewerEntitlement(),
    ]) {
      const publicSnapshot = projectBattleSnapshot(state, viewer)
      expect(JSON.stringify(publicSnapshot)).not.toMatch(
        /reversalState|preparedTurnNumber|offensiveTurns|reversalPreparation/,
      )
      const statuses = publicSnapshot.statusState.find(
        (row) => row.combatantId === 'actor',
      )!.statuses
      expect(statuses).toContainEqual(
        expect.objectContaining({
          statusId: 'reversal',
          presentationDuration: 'until-reversal-ends',
          reversal: {
            family: 'physical',
            reflectionBasisPoints: 12500,
            attackerMaxHpCapBasisPoints: 1800,
            defenderMaxHpCapBasisPoints: 2400,
          },
        }),
      )
      expect(JSON.stringify(statuses)).not.toMatch(
        /sourceInstanceId|preparedTurnNumber|offensiveTurns/,
      )
      expect(statuses.some((row) => row.statusId === 'primed')).toBe(false)
      for (const compact of [true, false]) {
        const html = renderToStaticMarkup(
          createElement(BattleCombatantEffects, { name: 'A', statuses, compact }),
        )
        expect(html).toContain('Reversal')
        expect(html).not.toContain('Captured effect rules unavailable')
      }
    }
  })
  it('conceals armed benefits under Covert but keeps the protected Strain visible', () => {
    const { state } = fixture()
    const covert = {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                ...row.statuses,
                {
                  statusId: 'covert',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'actor',
                },
              ],
            }
          : row,
      ),
    }
    const enemy = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
      'enemy',
    ])
    expect(
      projectBattleStatusStateForViewer(covert, enemy)
        .find((row) => row.combatantId === 'actor')!
        .statuses.some((row) => row.statusId === 'reversal'),
    ).toBe(false)
    const ended = endCombatReversal(covert, 'actor', 'revealed').state
    expect(
      projectBattleStatusStateForViewer(ended, enemy).find((row) => row.combatantId === 'actor')!
        .statuses,
    ).toContainEqual(
      expect.objectContaining({
        statusId: 'reversal-strain',
        presentationDuration: 'next-complete-owner-turn',
      }),
    )
  })
  it('marks only Reversal Controlled references as paid automatic preparation', () => {
    const { state } = fixture()
    const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
      'actor',
    ])
    expect(projectBattleManualActionTargets(state, viewer)[0]?.controlled).toMatchObject({
      kind: 'reversal',
      phase: 'primed',
    })
  })
})

it('previews paid preparation without changing resources, cooldowns, armed authority or RNG', async () => {
  const { previewCombatContentDefinition } = await import('@/server/master/combat-content-preview')
  const { resolveMatureSkillVersion } = await import('@aurevane/game-core/combat/mature-skills')
  const { captured } = fixture()
  const definition = {
    ...resolveMatureSkillVersion('vanguard.forceful-strike', 2)!,
    ability: captured.definition,
  }
  const before = JSON.stringify(definition)
  const preview = previewCombatContentDefinition(definition, { behaviorId: 'prepare' })
  expect(preview).toMatchObject({
    legal: true,
    costs: { actionEconomy: 35, mp: 5, hp: 3 },
    simulation: { preparation: 'paid-controlled-prime', rngConsumed: false },
  })
  expect(JSON.stringify(definition)).toBe(before)
})

it('returns the paid Reversal prime quote from a live forecast without paying or arming it', async () => {
  const { createBattlePreviewService } = await import('./battle-preview-service')
  const { initial: encounter, captured } = fixture()
  const { createBattleBuildAuthoritySnapshot } = await import('./battle-build-authority')
  const { essenceSnapshotReference, resolveEssenceForBuild } =
    await import('@aurevane/game-core/combat/essence')
  const authority = createBattleBuildAuthoritySnapshot('pve', [
    {
      combatantId: 'character:owner',
      characterId: 'owner',
      snapshot: {
        schemaVersion: 4,
        buildVersion: 1,
        primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
        secondary: null,
        disciplineSkills: [
          {
            slotIndex: 1,
            skillId: captured.abilityId,
            contentVersion: captured.contentVersion,
            sourceDisciplineId: 'vanguard',
          },
        ],
        extensions: {
          resonance: null,
          essence: essenceSnapshotReference(resolveEssenceForBuild('vanguard', null)!),
          equipmentSkills: [],
          supernatural: null,
          prestige: null,
        },
      },
    },
  ])
  const initial = {
    ...encounter,
    buildAuthority: {
      ...authority,
      combatants: authority.combatants.map((row) => ({ ...row, combatantId: 'actor' })),
    },
  }
  const before = JSON.stringify(initial)
  const fail = async () => {
    throw new Error('Read-only preview must not commit.')
  }
  const repository: BattleSessionRepository = {
    createBattleSession: fail,
    findBattleIntentReplay: fail,
    commitBattleIntent: fail,
    findBattleSession: async () => ({
      battleSessionId: 'session',
      battleId: initial.tactical.battle.battleId,
      battleVersion: 1,
      rulesVersion: initial.tactical.battle.rulesVersion,
      contentVersion: initial.tactical.battle.contentVersion,
      lifecycle: initial.tactical.battle.lifecycle,
      snapshot: initial,
      controlledCombatantIds: ['actor'],
      updatedAt: '2026-10-31T00:00:00Z',
    }),
  }
  const result = await createBattlePreviewService(repository).previewIntent({
    userId: 'owner',
    battleSessionId: 'session',
    expectedBattleVersion: 1,
    intent: { kind: 'ability-prime', actionId: captured.abilityId, behaviorId: 'prepare' },
  })
  expect(result.preview).toMatchObject({
    kind: 'action',
    legal: true,
    preparation: 'paid-controlled-prime',
    commandCosts: [
      { resource: 'ap', amount: 35 },
      { resource: 'mp', amount: 5 },
      { resource: 'hp', amount: 3 },
    ],
  })
  expect(result.preview).not.toMatchObject({ controlledReady: true })
  expect(JSON.stringify(initial)).toBe(before)
})

it('does not expose a Covert-protected counter through public targeting forecasts', async () => {
  const { createBattlePreviewService } = await import('./battle-preview-service')
  const { initial, captured } = fixture()
  const covert = {
    ...initial,
    statusState: initial.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'covert',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 3,
                sourceCombatantId: 'actor',
              },
            ],
          }
        : row,
    ),
  }
  const prepared = primeCombatControlledAbility({
    state: covert,
    actorId: 'actor',
    sourceInstanceId: captured.sourceInstanceId,
    behaviorId: 'prepare',
    content: PV1F_COMBAT_CONTENT,
  })
  const armed = finishPv1fTurn(
    reattachStatDrivenCombatBridge(prepared.state, initial.statBridge),
    'east',
  ).state
  const before = JSON.stringify(armed)
  const fail = async () => {
    throw new Error('A targeting preview cannot write.')
  }
  const repository: BattleSessionRepository = {
    createBattleSession: fail,
    findBattleIntentReplay: fail,
    commitBattleIntent: fail,
    findBattleSession: async () => ({
      battleSessionId: 'session',
      battleId: armed.tactical.battle.battleId,
      battleVersion: 1,
      rulesVersion: armed.tactical.battle.rulesVersion,
      contentVersion: armed.tactical.battle.contentVersion,
      lifecycle: armed.tactical.battle.lifecycle,
      snapshot: armed,
      controlledCombatantIds: ['enemy'],
      updatedAt: '2026-10-31T00:00:00Z',
    }),
  }
  const result = await createBattlePreviewService(repository).previewIntent({
    userId: 'owner',
    battleSessionId: 'session',
    expectedBattleVersion: 1,
    intent: {
      kind: 'action',
      actionId: 'basic.attack.unarmed.basic',
      target: { kind: 'unit', combatantId: 'actor' },
    },
  })
  expect(JSON.stringify(result.preview)).not.toContain('reversal_triggered')
  expect(JSON.stringify(result.preview)).not.toContain(captured.abilityId)
  expect(JSON.stringify(armed)).toBe(before)
  const actual = executePv1fAction(armed, 'basic.attack.unarmed.basic', {
    kind: 'unit',
    combatantId: 'actor',
  })
  expect(
    actual.events.some(
      (event) =>
        event &&
        typeof event === 'object' &&
        'event' in event &&
        event.event === 'reversal_triggered',
    ),
  ).toBe(true)
})
