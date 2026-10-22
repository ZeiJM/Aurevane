import { expect, it, vi } from 'vitest'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { preparePv1fTurnEconomy } from '@aurevane/game-core/combat/pv1f-action-economy'
vi.mock('server-only', () => ({}))
import { projectBattleSnapshot } from './battle-session-service'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from './battle-viewer-entitlement'

function fixture(options: { pierce?: boolean; freeOffensiveMove?: boolean } = {}) {
  const definitions = defaultBasicSkills().map((basic) => ({
    ...basic,
    contentVersion: 2,
    name:
      basic.id === 'basic.recover'
        ? 'Second Wind'
        : basic.id === 'unarmed.basic'
          ? 'Open Palm'
          : basic.name,
    enabled: basic.id !== 'basic.recover',
    ...(basic.id === 'basic.move' && options.freeOffensiveMove
      ? { execution: { kind: 'basic-move' as const, costBasis: 'flat' as const } }
      : {}),
    ability: {
      ...basic.ability,
      behaviors: basic.ability.behaviors.map((behavior) => ({
        ...behavior,
        costs: [
          {
            resource: 'ap' as const,
            amount: basic.id === 'basic.move' ? (options.freeOffensiveMove ? 0 : 35) : 47,
          },
          ...(basic.id === 'basic.move'
            ? []
            : [
                { resource: 'mp' as const, amount: 3 },
                { resource: 'hp' as const, amount: 2 },
              ]),
        ],
        ...(basic.id === 'unarmed.basic'
          ? {
              accuracy: { kind: 'fixed' as const, chanceBasisPoints: 0 },
              cooldown: { key: 'open-palm', ownerTurns: 4 },
            }
          : {}),
        effects: [
          ...behavior.effects.map((effect) =>
            effect.payload.type === 'move'
              ? { ...effect, payload: { ...effect.payload, maximumTiles: 2 } }
              : effect.payload.type === 'percentage-recovery'
                ? {
                    ...effect,
                    payload: { ...effect.payload, percentageBasisPoints: 2200 },
                    requirements: {
                      kind: 'status-presence' as const,
                      subject: 'owner' as const,
                      statusId: 'guarded',
                      present: true,
                    },
                  }
                : effect.payload.type === 'damage' && options.pierce && basic.id === 'unarmed.basic'
                  ? {
                      ...effect,
                      payload: {
                        ...effect.payload,
                        type: 'pierce' as const,
                        armorIgnoredBasisPoints: 2500,
                      },
                    }
                  : effect,
          ),
          ...(basic.id === 'basic.move' && options.freeOffensiveMove
            ? [
                {
                  id: 'strike',
                  timing: 'instant' as const,
                  payload: { type: 'damage' as const, recipient: 'actor' as const, amount: 2 },
                },
              ]
            : []),
        ],
      })),
    },
  }))
  const captures = captureBasicSkillSources({
    ownerCombatantId: 'actor',
    supportActionId: 'basic.recover',
    definitions,
  })
  const state = reconcileCombatAbilitySources(
    preparePv1fTurnEconomy(percentageDotEncounter()),
    captures,
  ) as ReturnType<typeof percentageDotEncounter>
  return { state, definitions }
}

it('projects saved Basic costs, enabled state and complete reports for the controlled owner', () => {
  const { state, definitions } = fixture()
  const before = JSON.stringify(state)
  definitions[3]!.name = 'Changed current name'
  const view = projectBattleSnapshot(
    state,
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['actor']),
  )
  expect(view.basicActions).toHaveLength(3)
  const recovery = view.basicActions!.find((action) => action.actionId === 'basic.recover')!
  expect(recovery.name).toBe('Second Wind')
  expect(recovery.enabled).toBe(false)
  expect(recovery.contentVersion).toBe(2)
  expect(Object.fromEntries(recovery.behaviors[0]!.rows)).toMatchObject({
    Cost: '47 AP / 3 MP / 2 HP',
    Effects: expect.stringContaining('22%'),
  })
  expect(recovery.behaviors[0]!.effects[0]!.condition).toBe('Guard [Self]')
  expect(Object.fromEntries(recovery.behaviors[0]!.rows).Requirements).toContain(
    'HP Recovery: Guard [Self]',
  )
  expect(Object.fromEntries(recovery.behaviors[0]!.rows).Effects).not.toContain('If ')
  expect(recovery.behaviors[0]!.effectDescriptions.join(' ')).not.toContain('If Guard [Self]:')
  const attack = view.basicActions!.find(
    (action) => action.actionId === 'basic.attack.unarmed.basic',
  )!
  expect(attack.name).toBe('Open Palm')
  expect(attack.behaviors[0]!.cooldown).toEqual({ key: 'open-palm', ownerTurns: 4 })
  expect(attack.behaviors[0]!.rows.map((row) => row[0])).toEqual([
    'Skill Type',
    'Cost',
    'Cooldown',
    'Requirements',
    'Effects',
    'Range',
    'Target',
    'Target Method',
    'Target Elevation',
    'Line of Sight',
  ])
  const move = view.basicActions!.find((action) => action.actionId === 'basic.move')!
  expect(move.movement).toEqual({
    costBasis: 'per-terrain-point',
    apPerTraversalPoint: 35,
    maximumTiles: 2,
  })
  expect(Object.fromEntries(move.behaviors[0]!.rows).Range).toBe('2')
  expect(
    view.basicActions!.some(
      (action) => action.actionId === 'basic.guard' || action.actionId === 'basic.recover.mp',
    ),
  ).toBe(false)
  expect(JSON.stringify(view.basicActions)).not.toMatch(
    /accuracy|chanceBasisPoints|sourceInstanceId|abilityRuntime|scalingBasisPoints|effectOrigin/,
  )
  expect(JSON.stringify(state)).toBe(before)
})

it('reports native Basic Pierce stronger-Power scaling as well as Armor bypass', () => {
  const { state } = fixture({ pierce: true })
  const view = projectBattleSnapshot(
    state,
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['actor']),
  )
  const attack = view.basicActions!.find((row) => row.actionId === 'basic.attack.unarmed.basic')!
  expect(Object.fromEntries(attack.behaviors[0]!.rows).Effects).toContain(
    'floor(15% Physical Power)',
  )
  expect(Object.fromEntries(attack.behaviors[0]!.rows).Effects).not.toContain('Armor ignored')
  expect(attack.behaviors[0]!.effects[0]!.parts.details).toContainEqual(
    expect.objectContaining({ label: 'Armor ignored', value: '25%' }),
  )
  expect(attack.behaviors[0]!.effectDescriptions.join(' ')).toContain(
    'stronger Physical or Mystic Power',
  )
  expect(attack.behaviors[0]!.effectDescriptions.join(' ')).toContain(
    'The displayed bypass applies only to equipment Armor.',
  )
  expect(attack.behaviors[0]!.effectDescriptions.join(' ')).not.toContain('25%')
})

it('reports the mandatory free offensive Move limit without changing the saved definition', () => {
  const { state } = fixture({ freeOffensiveMove: true })
  const view = projectBattleSnapshot(
    state,
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['actor']),
  )
  const move = view.basicActions!.find((row) => row.actionId === 'basic.move')!
  expect(move.behaviors[0]!.limits).toContain('Once per owner turn')
  expect(view.manualActionTargets?.find((row) => row.actionId === 'basic.move')).toMatchObject({
    move: { maximumTiles: 2, conditional: false },
    costs: [{ resource: 'ap', amount: 0 }],
  })
  expect(
    state.capturedAbilitySources!.find((row) => row.abilityId === 'basic.move')!.definition
      .behaviors[0]!.activationLimits ?? [],
  ).not.toContain('once-per-owner-turn')
})

it('does not publish another owner’s Basic records or invent captured records for historical battles', () => {
  const { state } = fixture()
  for (const viewer of [
    createSpectatorBattleViewerEntitlement(),
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['enemy']),
  ]) {
    expect(projectBattleSnapshot(state, viewer).basicActions).toBeUndefined()
  }
  const historical = percentageDotEncounter()
  expect(
    projectBattleSnapshot(
      historical,
      deriveParticipantBattleViewerEntitlement(historical.tactical.battle.combatants, ['actor']),
    ).basicActions,
  ).toBeUndefined()
})
