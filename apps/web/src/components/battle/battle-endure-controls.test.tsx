import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { executeCombatAction } from '@aurevane/game-core/combat/actions'
import {
  PV1F_COMBAT_CONTENT,
  PV1F_GUARD_ACTION,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { capturedBasicBattle } from './battle-basic-actions.test-utils'
import { BattleExperience } from './battle-experience'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import { endCombatReversal } from '@aurevane/game-core/combat/combat-reversal'
import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'
import type { BattleRuntime } from './battle-runtime'

import { projectBattleSnapshot } from '@/server/battle/battle-session-service'
import { deriveParticipantBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

it.each([false, true])(
  'projects Endure blocking only while active (pending=%s), and disables Basic Attack without disabling support',
  (pending) => {
    const { state: base, view } = capturedBasicBattle()
    const applied = executeCombatAction(
      base,
      {
        ...PV1F_GUARD_ACTION,
        effects: [
          {
            type: 'endure',
            recipient: 'actor',
            durationTurns: 2,
            releaseBasisPoints: 80000,
            radiusTiles: 1,
            targetTeams: 'enemies',
          },
        ],
      },
      { kind: 'self' },
      PV1F_COMBAT_CONTENT,
    ).state
    const state = pending
      ? {
          ...applied,
          statusState: applied.statusState.map((row) => ({
            ...row,
            statuses: row.statuses.map((status) => ({
              ...status,
              timingState: 'pending' as const,
            })),
          })),
        }
      : applied
    const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
      'actor',
    ])
    const snapshot = projectBattleSnapshot(state as typeof base, viewer)
    const attack = snapshot.manualActionTargets!.find(
      (row) => row.actionId === 'basic.attack.unarmed.basic',
    )!
    expect(attack).toBeTruthy()
    expect(attack.endureBlocked === true).toBe(!pending)
    expect(
      snapshot.manualActionTargets!.find((row) => row.actionId === 'basic.recover')?.endureBlocked,
    ).toBeUndefined()
    expect(JSON.stringify(snapshot)).not.toContain('receivedDamage')
    const html = renderToStaticMarkup(
      <BattleExperience
        initialBattle={{ ...view, snapshot }}
        runtime={{
          kind: 'pve',
          supportActionId: 'basic.recover',
          playerName: 'Wayfarer',
          playerLevel: 1,
          playerPortraitAssetId: 'character.creation.square-portrait-01',
          playerProfileImageUrl: null,
        }}
      />,
    )
    const button = (slot: string) =>
      html.match(new RegExp(`<button[^>]*data-battle-command="${slot}"[^>]*>`))![0]
    expect(button('attack').includes('disabled=""')).toBe(!pending)
    expect(button('guard')).not.toContain('disabled=""')
    expect(button('finish')).not.toContain('disabled=""')
  },
)

for (const mode of ['pve', 'pvp'] as const) {
  it.each(['armed', 'strain'] as const)(
    `${mode} disables Basic Attack, Discipline and Essence during Reversal %s while leaving support available`,
    (phase) => {
      const { state: base, view } = capturedBasicBattle()
      const strike = captureCombatAbilitySource({
        ...source({}, 'restriction.strike'),
        abilityId: 'restriction.strike',
      })
      const essence = captureCombatAbilitySource({
        ...source({}, 'restriction.essence'),
        abilityId: 'restriction.essence',
        sourceKind: 'essence',
      })
      const reversal = captureCombatAbilitySource({
        ...source(
          {
            id: 'prepare',
            classification: 'utility',
            attackFamily: undefined,
            costs: [],
            targeting: {
              kind: 'self',
              teamPolicy: 'self',
              friendlyFire: 'allies-only',
              shape: { kind: 'single' },
              minimumRange: 0,
              maximumRange: 0,
              requiresLineOfSight: false,
              maximumElevationDifference: null,
              maximumSelections: 1,
            },
            effects: [
              {
                id: 'reversal',
                timing: 'controlled',
                payload: {
                  type: 'reversal',
                  recipient: 'actor',
                  version: 1,
                  family: 'physical',
                  reflectionBasisPoints: 10000,
                  attackerMaxHpCapBasisPoints: 2000,
                  defenderMaxHpCapBasisPoints: 2500,
                },
              },
            ],
          },
          'restriction.reversal',
        ),
        abilityId: 'restriction.reversal',
        tags: [],
      })
      const reconciled = reconcileCombatAbilitySources({ ...base, reversalPolicyVersion: 1 }, [
        ...base.capturedAbilitySources!,
        strike,
        essence,
        reversal,
      ])
      const prepared = primeCombatControlledAbility({
        state: reconciled,
        actorId: 'actor',
        sourceInstanceId: reversal.sourceInstanceId,
        behaviorId: 'prepare',
        content: PV1F_COMBAT_CONTENT,
      })
      expect(prepared.events.some((event) => event.event === 'reversal_prepared')).toBe(true)
      const state = {
        ...(phase === 'strain'
          ? endCombatReversal(prepared.state, 'actor', 'cancelled').state
          : prepared.state),
        statBridge: base.statBridge,
      }
      const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
        'actor',
      ])
      const snapshot = projectBattleSnapshot(state, viewer)
      const basic = snapshot.manualActionTargets!.find(
        (row) => row.actionId === 'basic.attack.unarmed.basic',
      )!
      expect(basic.reversalBlocked).toBe(true)
      const skill = {
        id: strike.abilityId,
        name: 'Restriction Strike',
        contentVersion: 1,
        sourceDisciplineId: 'vanguard',
        apCost: 11,
        mpCost: 2,
        hpCost: 1,
        cooldownOwnerTurns: 0,
        category: 'attack' as const,
        targetKind: 'unit' as const,
        targetTeamPolicy: 'enemy' as const,
        minimumRange: 1,
        maximumRange: 4,
        tags: [],
        effectDescriptions: [],
        requirementDescriptions: [],
      }
      const shared = {
        playerName: 'Wayfarer',
        supportActionId: 'basic.recover' as const,
        techniques: [skill],
        essence: { ...skill, id: essence.abilityId, name: 'Restriction Essence', description: '' },
      }
      const runtime: BattleRuntime =
        mode === 'pve'
          ? {
              ...shared,
              kind: 'pve',
              playerLevel: 1,
              playerPortraitAssetId: 'character.creation.square-portrait-01',
              playerProfileImageUrl: null,
            }
          : {
              ...shared,
              kind: 'pvp',
              metadata: {
                lobbyId: 'lobby',
                battleKey: 'key',
                mode: '1v1',
                localCharacterId: 'owner',
                participants: state.tactical.battle.combatants.map((unit, index) => ({
                  combatantId: unit.id,
                  characterId: index === 0 ? 'owner' : unit.id,
                  characterName: unit.id,
                  teamIndex: unit.teamId === 'players' ? 0 : 1,
                  seatIndex: index,
                  characterLevel: 1,
                  portraitRef: STARTER_CHARACTER_PORTRAITS[0]!.ref,
                  profileImageUrl: null,
                })),
              },
            }
      const before = JSON.stringify(state)
      const html = renderToStaticMarkup(
        <BattleExperience initialBattle={{ ...view, snapshot }} runtime={runtime} />,
      )
      const command = (slot: string) =>
        html.match(new RegExp(`<button[^>]*data-battle-command="${slot}"[^>]*>`))![0]
      expect(command('attack')).toContain('disabled=""')
      expect(html.match(/<button[^>]*aria-label="Selected Restriction Strike[^>]*>/)![0]).toContain(
        'disabled=""',
      )
      expect(html.match(/<button[^>]*aria-label="Restriction Essence[^>]*>/)![0]).toContain(
        'disabled=""',
      )
      expect(command('guard')).not.toContain('disabled=""')
      expect(command('move')).not.toContain('disabled=""')
      expect(command('finish')).not.toContain('disabled=""')
      expect(JSON.stringify(state)).toBe(before)
      expect(JSON.stringify(snapshot)).not.toContain('reversalState')
    },
  )
}
