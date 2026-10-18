import { expect, it, vi } from 'vitest'
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import {
  defaultBasicSkills,
  parseBasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { SUPPORT_ACTION_IDS } from '@aurevane/game-core/combat/support-actions'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  executePv1fAction,
  executePv1fMovement,
  preparePv1fTurnEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { createStatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'

function encounter() {
  const ids = [actorId, 'enemy']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'restored-basic-admission',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id,
        initiative: 40 - index * 10,
        baseMovementBudget: 4,
        hp: 600,
        maxHp: 1000,
        mp: 5,
        maxMp: 20,
      })),
    }),
  ).state
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 5,
        height: 3,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: Array.from({ length: 15 }, (_, i) => ({
          position: { x: i % 5, y: Math.floor(i / 5) },
          elevation: 0,
          terrainId: 'open',
        })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
        placements: ids.map((combatantId, index) => ({
          combatantId,
          position: { x: index + 1, y: 1 },
          facing: 'west',
          movementProfileId: 'ground',
        })),
      }),
    ),
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario', sourceId: 'scenario:restored-basics', sourceRulesVersion: 1 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      physicalPower: 20,
      mysticPower: 20,
      jump: 0,
    })),
  )
}
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createCombatContentAuthoringService } from '@/server/master/combat-content-authoring-service'
import {
  loadCharacterCommittedBuildSnapshot,
  saveCharacterDisciplineSkills,
  saveCharacterSupportAction,
} from '@/server/character/character-build-service'
import {
  captureBattleBuildAbilitySources,
  createResolvedBattleBuildAuthoritySnapshot,
} from './battle-build-authority'
import { projectBattleSnapshot } from './battle-session-service'
import { deriveParticipantBattleViewerEntitlement } from './battle-viewer-entitlement'
import { fixture, owner, characterId, skillRows } from './roster-legal-build.test-utils'

vi.mock('server-only', () => ({}))
const actorId = `character:${characterId}`

class Store extends InMemoryCombatContentRepository {
  async getOperatorRole(userId: string) {
    return userId === owner ? ('owner' as const) : null
  }
}

it.each(
  defaultBasicSkills().flatMap((row) =>
    ['pve', 'pvp'].map((context) => ({ id: row.id, context: context as 'pve' | 'pvp' })),
  ),
)(
  '$id restored publication reaches actual $context admission, native outcome and pinned reader without changing the saved four-Skill build',
  async ({ id, context }) => {
    const kit = {
      name: 'earned-vanguard',
      primary: 'vanguard',
      secondary: null,
      ids: skillRows
        .filter((row) => row.after.sourceDisciplineId === 'vanguard')
        .slice(0, 4)
        .map((row) => row.id),
    }
    const f = fixture(kit, 100)
    await saveCharacterDisciplineSkills(
      owner,
      f.character,
      {
        expectedBuildVersion: 1,
        skillIds: kit.ids,
        idempotencyKey: '33333333-3333-4333-8333-333333333333',
      },
      f.repository,
    )
    let saved = await loadCharacterCommittedBuildSnapshot(owner, characterId, f.repository)
    const active = await f.repository.findActiveBuild(owner, characterId)
    f.repository.loadCommittedBuildSnapshot = vi.fn(async () => structuredClone(saved))
    f.repository.findActiveBuild = vi.fn(async () => ({
      ...active!,
      buildVersion: saved.buildVersion,
      supportActionId: saved.supportActionId,
    }))
    f.repository.saveSupportAction = vi.fn(async (input) => {
      expect(input.expectedBuildVersion).toBe(saved.buildVersion)
      saved = {
        ...saved,
        buildVersion: saved.buildVersion + 1,
        supportActionId: input.supportActionId,
      }
      return { buildVersion: saved.buildVersion, replayed: false }
    })
    const support = SUPPORT_ACTION_IDS.find((key) => key === id) ?? 'basic.guard'
    await saveCharacterSupportAction(
      owner,
      f.character,
      {
        expectedBuildVersion: 2,
        supportActionId: support,
        idempotencyKey: '44444444-4444-4444-8444-444444444444',
      },
      f.repository,
    )
    const committed = await loadCharacterCommittedBuildSnapshot(owner, characterId, f.repository)
    const unchangedBuild = JSON.stringify(committed)
    const unchangedEarned = JSON.stringify(f.learned)
    const store = new Store()
    const resolver = createCombatContentResolver({
      findCurrentSkill: (key) => store.findPublished(key, 'skill'),
      findSkillVersion: async (key, version) =>
        (await store.listPublishedVersions(key)).find((row) => row.contentVersion === version) ??
        null,
    })
    const service = createCombatContentAuthoringService({ store, resolver })
    const builtin = defaultBasicSkills().find((row) => row.id === id)!
    const edited = (ap: number) => {
      const next = structuredClone(builtin)
      Object.assign(next, { name: `Authored ${id} ${ap}` })
      Object.assign(next.ability.behaviors[0]!, {
        costs: [
          { resource: 'ap', amount: ap },
          ...(id === 'basic.recover' ? [{ resource: 'hp', amount: 2 }] : []),
          ...(id === 'basic.recover.mp' ? [{ resource: 'mp', amount: 1 }] : []),
        ],
      })
      return parseBasicSkillDefinition(next)
    }
    await service.publishSkill({
      actorUserId: owner,
      definition: edited(17),
      expectedBaseVersion: 1,
    })
    await service.publishSkill({
      actorUserId: owner,
      definition: edited(29),
      expectedBaseVersion: 2,
    })
    const admit = async () => {
      const authority = await createResolvedBattleBuildAuthoritySnapshot(
        context,
        [{ combatantId: actorId, characterId, snapshot: committed }],
        resolver,
      )
      const base = preparePv1fTurnEconomy(encounter())
      const sources = await captureBattleBuildAbilitySources(base, authority, resolver)
      return {
        authority,
        state: reattachStatDrivenCombatBridge(
          reconcileCombatAbilitySources(base, sources),
          base.statBridge,
        ),
      }
    }
    const old = await admit()
    const oldBytes = JSON.stringify(old)
    const draft = await service.restoreBasicSkillDraft({
      actorUserId: owner,
      skillId: id,
      targetVersion: 2,
      expectedBaseVersion: 3,
      expectedDraftVersion: null,
    })
    expect(service.validateSkillDefinition(draft.definition).valid).toBe(true)
    expect(
      (await service.previewSkillDefinition({ actorUserId: owner, definition: draft.definition }))
        .legal,
    ).toBe(true)
    await service.publishSkill({
      actorUserId: owner,
      definition: draft.definition,
      expectedBaseVersion: 3,
    })
    const fresh = await admit()
    const restored = JSON.parse(JSON.stringify(fresh.state)) as typeof fresh.state
    const execute = (state: typeof restored) =>
      id === 'basic.move'
        ? executePv1fMovement(state, [
            { x: 1, y: 1 },
            { x: 1, y: 0 },
          ])
        : executePv1fAction(
            state,
            id === 'unarmed.basic' ? 'basic.attack.unarmed.basic' : id,
            id === 'unarmed.basic' ? { kind: 'unit', combatantId: 'enemy' } : { kind: 'self' },
          )
    const ap = (state: typeof restored) =>
      state.tactical.battle.combatants
        .find((row) => row.id === actorId)!
        .temporaryResources!.find((row) => row.key === 'pv1f.action-economy')!.current
    const oldResult = execute(old.state)
    const result = execute(restored)
    expect(ap(oldResult.state)).toBe(71)
    expect(ap(result.state)).toBe(83)
    const actor = result.state.tactical.battle.combatants.find((row) => row.id === actorId)!
    if (id === 'basic.move')
      expect(
        result.state.tactical.placements.find((row) => row.combatantId === actorId)!.position,
      ).toEqual({ x: 1, y: 0 })
    if (id === 'unarmed.basic')
      expect(
        result.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp,
      ).toBeLessThan(600)
    if (id === 'basic.guard')
      expect(
        result.state.statusState
          .find((row) => row.combatantId === actorId)!
          .statuses.some((row) => row.statusId === 'guarded'),
      ).toBe(true)
    if (id === 'basic.recover') expect(actor.hp).toBeGreaterThan(598)
    if (id === 'basic.recover.mp') expect(actor.mp).toBeGreaterThan(4)
    const view = projectBattleSnapshot(
      result.state,
      deriveParticipantBattleViewerEntitlement(result.state.tactical.battle.combatants, [actorId]),
    )
    const selected = view.basicActions!.find(
      (row) => row.actionId === (id === 'unarmed.basic' ? 'basic.attack.unarmed.basic' : id),
    )!
    expect(selected).toMatchObject({ contentVersion: 4, name: `Authored ${id} 17` })
    expect(Object.fromEntries(selected.behaviors[0]!.rows).Cost).toContain('17 AP')
    expect(view.basicActions).toHaveLength(3)
    expect(JSON.stringify(view.basicActions)).not.toMatch(
      /chanceBasisPoints|sourceInstanceId|accuracyMode/,
    )
    expect(fresh.authority.combatants[0]!.disciplineSkills).toHaveLength(4)
    expect(fresh.authority.combatants[0]!.supportActionId).toBe(support)
    expect(JSON.stringify(old)).toBe(oldBytes)
    expect(
      JSON.stringify(await loadCharacterCommittedBuildSnapshot(owner, characterId, f.repository)),
    ).toBe(unchangedBuild)
    expect(JSON.stringify(f.learned)).toBe(unchangedEarned)
    expect(f.repository.saveSupportAction).toHaveBeenCalledTimes(1)
  },
)
