import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { capturedBasicBattle } from './battle-basic-actions.test-utils'
import { executeCombatAction } from '@aurevane/game-core/combat/actions'
import {
  PV1F_GUARD_ACTION,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { BattleExperience } from './battle-experience'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { projectBattleSnapshot } from '@/server/battle/battle-session-service'
import { deriveParticipantBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const skill = {
  id: 'seal.strike',
  contentVersion: 1,
  sourceDisciplineId: 'vanguard',
  name: 'Seal Strike',
  apCost: 11,
  mpCost: 2,
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
for (const mode of ['pve', 'pvp'] as const)
  it.each([false, true])(
    `${mode} keeps sealed skills visible with a reason, and exempts Essence/Support/Basic Attack (pending=%s)`,
    (pending) => {
      const { state: base, view } = capturedBasicBattle()
      const discipline = captureCombatAbilitySource({
        ...source({}, 'seal.strike.source'),
        abilityId: skill.id,
      })
      const essence = captureCombatAbilitySource({
        ...source({}, 'seal.essence.source'),
        abilityId: 'seal.essence',
        sourceKind: 'essence',
      })
      const reconciled = reconcileCombatAbilitySources(base, [
        ...(base.capturedAbilitySources ?? []),
        discipline,
        essence,
      ])
      const applied = executeCombatAction(
        { ...reconciled, effectTimingPolicy: { version: 1, modes: { seal: 'instant' } } },
        {
          ...PV1F_GUARD_ACTION,
          effects: [
            {
              type: 'apply-status',
              recipient: 'actor',
              statusId: 'seal',
              stacks: 1,
              durationTurns: 2,
              sealedCategories: ['attack'],
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
      expect(snapshot.manualActionTargets!.find((row) => row.actionId === skill.id)).toMatchObject(
        pending ? {} : { sealBlocked: true },
      )
      for (const actionId of ['seal.essence', 'basic.recover', 'basic.attack.unarmed.basic'])
        expect(
          snapshot.manualActionTargets!.find((row) => row.actionId === actionId)?.sealBlocked,
        ).toBeUndefined()
      const html = renderToStaticMarkup(
        <BattleExperience
          initialBattle={{ ...view, snapshot }}
          runtime={{
            ...(mode === 'pve'
              ? {
                  kind: 'pve' as const,
                  playerLevel: 1,
                  playerPortraitAssetId: 'character.creation.square-portrait-01',
                  playerProfileImageUrl: null,
                }
              : {
                  kind: 'pvp' as const,
                  metadata: {
                    lobbyId: 'lobby',
                    battleKey: 'key',
                    mode: '1v1' as const,
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
                }),
            techniques: [skill],
            essence: { ...skill, id: 'seal.essence', name: 'Free Essence', description: '' },
            playerName: 'Wayfarer',
          }}
        />,
      )
      const button = html.match(/<button[^>]*aria-label="Selected Seal Strike[^>]*>/)![0]
      expect(button.includes('disabled=""')).toBe(!pending)
      if (!pending) expect(button).toContain('Sealed')
      expect(html).toContain('Free Essence')
      expect(html.match(/<button[^>]*data-battle-command="attack"[^>]*>/)![0]).not.toContain(
        'disabled=""',
      )
    },
  )
