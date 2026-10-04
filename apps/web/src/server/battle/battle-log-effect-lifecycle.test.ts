import { describe, expect, it, vi } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import {
  createTacticalBattleState,
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  selectCurrentFinalFacing,
} from '@aurevane/game-core/combat/board'
import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
  type CombatActionDefinition,
} from '@aurevane/game-core/combat/actions'

vi.mock('server-only', () => ({}))

import { buildBattleLogView, createViewerSafeBattleLogService } from './battle-log-service'
import type { BattleHistoryPrivacyAuthority } from './battle-history-privacy-authority'
import { createSpectatorBattleViewerEntitlement } from './battle-viewer-entitlement'
import { buildBattleChronicle } from '../../components/battle/battle-log-chronicle-model'

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'chronicle.effects',
      rulesVersion: 3,
      contentVersion: 2,
      rngSeed: 123,
      combatants: ['character:zei', 'recruit:weon'].map((id, index) => ({
        id,
        teamId: index === 0 ? 'a' : 'b',
        initiative: 2 - index,
        baseMovementBudget: 2,
        hp: 100,
        maxHp: 100,
        mp: 20,
        maxMp: 30,
      })),
    }),
  ).state
  return {
    ...createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 2,
        height: 1,
        terrains: P2_2_VERTICAL_SLICE_TERRAINS,
        movementProfiles: [P2_2_ORDINARY_GROUND_PROFILE],
        tiles: [0, 1].map((x) => ({
          position: { x, y: 0 },
          elevation: 0,
          terrainId: 'open-ground',
        })),
        placements: battle.combatants.map((combatant, x) => ({
          combatantId: combatant.id,
          position: { x, y: 0 },
          facing: 'east' as const,
          movementProfileId: 'ordinary-ground',
        })),
      }),
    ),
    effectTimingPolicy: { version: 1, modes: {} },
  }
}

const baseAction: CombatActionDefinition = {
  id: 'test.severing-cut',
  version: 1,
  sourceType: 'test',
  tags: [],
  requirements: [],
  cost: { spendsAction: false, mp: 0 },
  target: {
    kind: 'unit',
    teamPolicy: 'enemy',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 6,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    friendlyFire: 'enemies-only',
  },
  effects: [],
}

describe('canonical delayed effects through the shared Chronicle projection', () => {
  it.each([
    { statusId: 'poison' as const, copied: false },
    { statusId: 'burn' as const, copied: false },
    { statusId: 'poison' as const, copied: true },
    { statusId: 'burn' as const, copied: true },
  ])(
    'renders the pinned title from actual $statusId ticks (copied=$copied)',
    async ({ statusId, copied }) => {
      const skillId = 'vanguard.forceful-strike'
      const contentVersion = copied ? 7 : 12
      const actionId = copied ? `temporary.copy.${skillId}.v${contentVersion}` : skillId
      const pinned = {
        ...resolveMatureSkillVersion(skillId, 2)!,
        contentVersion,
      }
      let transition = executeCombatAction(
        encounter(),
        {
          ...baseAction,
          id: actionId,
          effects: [{ type: statusId, recipient: 'primary-unit', power: 4, durationTurns: 2 }],
        },
        { kind: 'unit', combatantId: 'recruit:weon' },
        { statuses: [] },
      )
      let state = transition.state
      const records = transition.events.map((event, eventIndex) => ({
        battleVersion: 1,
        eventIndex,
        createdAt: '2026-10-04T00:00:00Z',
        event,
      }))
      for (let battleVersion = 2; battleVersion <= 5; battleVersion += 1) {
        transition = endCombatTurn(
          { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
          { statuses: [] },
        )
        state = transition.state
        records.push(
          ...transition.events.map((event, eventIndex) => ({
            battleVersion,
            eventIndex,
            createdAt: '2026-10-04T00:00:00Z',
            event,
          })),
        )
      }
      const history = copied
        ? [
            {
              battleVersion: 0,
              eventIndex: 0,
              createdAt: '2026-10-04T00:00:00Z',
              event: {
                event: 'temporary_skill_copied',
                combatantId: 'character:zei',
                sourceCombatantId: 'recruit:weon',
                skillId,
                contentVersion,
              },
            },
            ...records,
          ]
        : records
      const authority: BattleHistoryPrivacyAuthority = {
        viewer: createSpectatorBattleViewerEntitlement(),
        journals: [...new Set(history.map((record) => record.battleVersion))].map(
          (battleVersion) => ({
            schemaVersion: 1,
            battleVersion,
            actorCombatantId: 'character:zei',
            actorTeamId: 'a',
            eventCount: history.filter((record) => record.battleVersion === battleVersion).length,
            commandVisibility: { kind: 'public' },
            eventVisibilityOverrides: [],
          }),
        ),
        buildAuthority: {
          schemaVersion: 1,
          catalogVersion: 3,
          combatContext: 'pve',
          combatants: [
            {
              combatantId: 'character:zei',
              characterId: 'zei',
              snapshotSchemaVersion: 1,
              buildSchemaVersion: 1,
              buildVersion: 1,
              fingerprint: 'private',
              primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
              secondary: null,
              disciplineSkills: copied
                ? []
                : [{ slotIndex: 1, skillId, contentVersion, sourceDisciplineId: 'vanguard' }],
              extensions: { essence: null, resonance: null },
            },
          ],
        },
      }
      const view = await createViewerSafeBattleLogService(
        { findBattleEvents: async () => history },
        { findBattleHistoryPrivacy: async () => authority },
        {
          resolvePinnedSkillDefinition: async (id, version) =>
            id === skillId && version === contentVersion ? pinned : null,
        },
      ).getLog('viewer', 'chronicle.effects')
      const tick = view.entries.find((entry) => entry.periodicStatusId === statusId)!
      expect(tick.actionContext).toMatchObject({ name: 'Forceful Strike', skillId, contentVersion })
      const chronicle = buildBattleChronicle(view.entries, {
        combatantNames: { 'character:zei': 'Zei', 'recruit:weon': 'Weon' },
      })
      const tickAction = chronicle
        .flatMap((round) => round.actors.flatMap((actor) => actor.actions))
        .find((action) =>
          action.outcomes.some((outcome) => outcome.text.includes('deals 4 damage')),
        )!
      expect(tickAction.title).toBe('Forceful Strike')
      expect(tickAction.flavorTemplate).toBeNull()
    },
  )
  it.each(['bleed', 'poison', 'burn'] as const)(
    'keeps %s activation separate from recorded periodic damage',
    (statusId) => {
      const effect =
        statusId === 'bleed'
          ? {
              type: 'bleed' as const,
              recipient: 'primary-unit' as const,
              damagePerTick: 4,
              ticks: 2,
            }
          : { type: statusId, recipient: 'primary-unit' as const, power: 4, durationTurns: 2 }
      let transition = executeCombatAction(
        encounter(),
        { ...baseAction, effects: [effect] },
        { kind: 'unit', combatantId: 'recruit:weon' },
        { statuses: [] },
      )
      let state = transition.state
      const records = transition.events.map((event, eventIndex) => ({
        battleVersion: 1,
        eventIndex,
        createdAt: '2026-10-04T00:00:00Z',
        event,
      }))
      let version = 1
      const end = () => {
        transition = endCombatTurn(
          { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
          { statuses: [] },
        )
        state = transition.state
        version += 1
        records.push(
          ...transition.events.map((event, eventIndex) => ({
            battleVersion: version,
            eventIndex,
            createdAt: '2026-10-04T00:00:00Z',
            event,
          })),
        )
      }
      end()
      end()
      const activationView = buildBattleLogView('chronicle.effects', records)
      const pending = activationView.entries.find((entry) => entry.eventType === 'effect_pending')!
      expect(pending.effectTiming).toEqual({ remainingOwnerTurnEnds: 2 })
      expect(
        activationView.entries.filter((entry) => entry.eventType === 'damage_applied'),
      ).toHaveLength(0)
      end()
      end()
      const tickView = buildBattleLogView('chronicle.effects', records)
      const tick = tickView.entries.find((entry) => entry.periodicStatusId === statusId)!
      expect(tick).toMatchObject({
        actionId: baseAction.id,
        actorCombatantId: 'character:zei',
        targetCombatantId: 'recruit:weon',
        templateValues: { amount: '4' },
      })
      const chronicle = buildBattleChronicle(tickView.entries, {
        combatantNames: { 'character:zei': 'Zei', 'recruit:weon': 'Weon' },
      })
      const texts = chronicle.flatMap((round) =>
        round.actors.flatMap((actor) =>
          actor.actions.flatMap((action) => action.outcomes.map((outcome) => outcome.text)),
        ),
      )
      expect(texts).toContain(
        `${statusId[0].toUpperCase() + statusId.slice(1)} will affect Weon during rounds 2–3!`,
      )
      expect(
        texts.some((text) =>
          text.includes(`${statusId[0].toUpperCase() + statusId.slice(1)} deals 4 damage`),
        ),
      ).toBe(true)
    },
  )
})
