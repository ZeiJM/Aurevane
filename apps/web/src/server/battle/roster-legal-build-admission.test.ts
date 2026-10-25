import { attachCombatBuildBridge } from '@aurevane/game-core/combat/build-snapshot'
import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  createCharacterDerivedCombatProfile,
  createDuelBalancedCombatEncounterState,
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import {
  chooseBuildAwareRecruitAiDecision,
  executeBuildAwareRecruitAiAction,
} from '@aurevane/game-core/combat/recruit-ai-build'
import {
  createPv1fTemporaryResources,
  calculatePv1fBasicAttackDamage,
  preparePv1fTurnEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { calculateDerivedStats } from '@aurevane/game-core/character/derived-stats'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import {
  loadCharacterCommittedBuildSnapshot,
  saveCharacterDisciplineSkills,
} from '@/server/character/character-build-service'
import { toCombatBuildSnapshot } from '@/server/character/character-combat-build-snapshot'
import {
  captureBattleBuildAbilitySources,
  createResolvedBattleBuildAuthoritySnapshot,
  parseBattleBuildAuthoritySnapshot,
  resolveBattleDisciplineSkillDefinitions,
  resolvePinnedBattleEssenceDefinition,
  resolvePinnedBattleResonanceDefinition,
} from './battle-build-authority'
import {
  actorId,
  characterId,
  disciplines,
  fixture,
  owner,
  publishProposedRoster,
  resolver,
  rows,
  skillRows,
  timestamp,
  type Kit,
} from './roster-legal-build.test-utils'

vi.mock('server-only', () => ({}))
beforeAll(publishProposedRoster, 30_000)

const kits: Kit[] = [
  // Complementary coverage loadouts, not newly authored class strategies.
  ...disciplines.flatMap((discipline) =>
    [0, 4].map((start) => ({
      name: `${discipline.id}:pure:${start / 4 + 1}`,
      primary: discipline.id,
      secondary: null,
      ids: skillRows
        .filter((row) => row.after.sourceDisciplineId === discipline.id)
        .slice(start, start + 4)
        .map((row) => row.id),
    })),
  ),
  ...rows
    .filter((row) => row.kind === 'resonance')
    .flatMap((row) =>
      row.after.disciplinePair.map((primary, index) => ({
        name: `${row.id}:primary:${primary}`,
        primary,
        secondary: row.after.disciplinePair[1 - index]!,
        ids: row.playIdentity!.earnedFourSkillKit.map((skill) => skill.id),
      })),
    ),
]
function encounter(character: PersistedCharacter) {
  const stats = calculateDerivedStats({
    attributes: character.attributes,
    level: character.level,
  }).stats
  const battle = startBattle(
    createPendingBattle({
      battleId: 'legal-build-admission',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 12345,
      combatants: [actorId, 'enemy'].map((id, index) => ({
        id,
        teamId: id,
        initiative: stats.initiative.value + 1 - index,
        baseMovementBudget: stats.movement.value,
        hp: stats.maxHp.value,
        maxHp: stats.maxHp.value,
        mp: stats.maxMp.value,
        maxMp: stats.maxMp.value,
        temporaryResources: createPv1fTemporaryResources(
          calculatePv1fBasicAttackDamage({ physicalPower: stats.physicalPower.value }),
        ),
      })),
    }),
  ).state
  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 2,
      height: 1,
      terrains: [{ id: 'ground', traversalCost: 1 }],
      tiles: [0, 1].map((x) => ({ position: { x, y: 0 }, terrainId: 'ground', elevation: 0 })),
      movementProfiles: [
        { id: 'ground', maxElevationStep: stats.jump.value, terrainCostOverrides: [] },
      ],
      placements: [actorId, 'enemy'].map((combatantId, x) => ({
        combatantId,
        position: { x, y: 0 },
        facing: x ? 'west' : 'east',
        movementProfileId: 'ground',
      })),
    }),
  )
}

describe('exact proposed roster through legal earned-loadout save and battle admission', () => {
  it('covers all136 Skills,17 pure sources and136 pairs in both Primary orders', () => {
    expect(kits).toHaveLength(306)
    expect(new Set(kits.filter((kit) => !kit.secondary).map((kit) => kit.primary)).size).toBe(17)
    expect(kits.filter((kit) => kit.secondary)).toHaveLength(272)
    expect([...new Set(kits.flatMap((kit) => kit.ids))].sort()).toEqual(
      skillRows.map((row) => row.id).sort(),
    )
    for (const row of rows.filter((row) => row.kind === 'resonance'))
      for (const skill of row.playIdentity!.earnedFourSkillKit) {
        const proposed = skillRows.find((candidate) => candidate.id === skill.id)!
        expect([proposed.after.contentVersion, proposed.after.sourceDisciplineId]).toEqual([
          skill.contentVersion,
          skill.sourceDisciplineId,
        ])
      }
  })
  it.each(kits)(
    '$name saves four earned Skills and pins exact current PvE/PvP versions at Levels1/100',
    async (kit) => {
      for (const level of [1, 100] as const) {
        const { character, repository, learned } = fixture(kit, level)
        const earnedBefore = structuredClone(learned)
        const result = await saveCharacterDisciplineSkills(
          owner,
          character,
          {
            expectedBuildVersion: 1,
            skillIds: kit.ids,
            idempotencyKey: '33333333-3333-4333-8333-333333333333',
          },
          repository,
        )
        expect(result.disciplineSkills.equippedSkills).toHaveLength(4)
        expect(repository.saveDisciplineSkills).toHaveBeenCalledTimes(1)
        const committed = await loadCharacterCommittedBuildSnapshot(owner, characterId, repository)
        const before = JSON.stringify(committed)
        expect(toCombatBuildSnapshot(committed).disciplineSkills).toHaveLength(4)
        for (const context of ['pve', 'pvp'] as const) {
          const authority = await createResolvedBattleBuildAuthoritySnapshot(
            context,
            [{ combatantId: actorId, characterId, snapshot: committed }],
            resolver,
          )
          const restored = parseBattleBuildAuthoritySnapshot(JSON.parse(JSON.stringify(authority)))!
          expect(restored).toEqual(authority)
          expect(authority.catalogVersion).toBe(3)
          expect(
            authority.combatants[0]!.disciplineSkills.map((skill) => [
              skill.skillId,
              skill.contentVersion,
            ]),
          ).toEqual(
            kit.ids.map((id) => [id, skillRows.find((row) => row.id === id)!.after.contentVersion]),
          )
          const definitions = await resolveBattleDisciplineSkillDefinitions(
            restored,
            actorId,
            resolver,
          )
          expect(definitions).toEqual(
            kit.ids.map((id) => skillRows.find((row) => row.id === id)!.after),
          )
          const extension = kit.secondary
            ? await resolvePinnedBattleResonanceDefinition(restored, actorId, resolver)
            : await resolvePinnedBattleEssenceDefinition(restored, actorId, resolver)
          const extensionRow = rows.find((row) =>
            kit.secondary
              ? row.kind === 'resonance' &&
                row.after.disciplinePair.includes(kit.primary) &&
                row.after.disciplinePair.includes(kit.secondary)
              : row.kind === 'essence' && row.after.sourceDisciplineId === kit.primary,
          )!
          expect(extension).toEqual(extensionRow.after)
          expect(
            authority.combatants[0]!.extensions[kit.secondary ? 'essence' : 'resonance'],
          ).toBeNull()
          const sources = await captureBattleBuildAbilitySources(
            encounter(character),
            restored,
            resolver,
          )
          const expected = [
            ...definitions!
              .filter((definition) => definition.ability)
              .map((definition) => ({
                id: definition.id,
                version: definition.contentVersion,
                ability: definition.ability,
              })),
            {
              id: extensionRow.id,
              version: extensionRow.after.contentVersion,
              ability: extensionRow.after.ability,
            },
          ]
          for (const item of expected)
            expect(sources.find((source) => source.abilityId === item.id)).toMatchObject({
              abilityId: item.id,
              contentVersion: item.version,
              definition: item.ability,
              ownerCombatantId: actorId,
            })
          expect(sources.filter((source) => source.sourceKind === 'basic')).toHaveLength(3)
          expect(
            sources
              .filter((source) => source.sourceKind !== 'basic')
              .map((source) => source.abilityId)
              .sort(),
          ).toEqual(expected.map((item) => item.id).sort())
          const derived = calculateDerivedStats({ attributes: character.attributes, level })
          if (level === 100) expect(derived.stats.maxHp.value).toBe(500)
          const current = createDuelBalancedCombatEncounterState(
            {
              ...encounter(character),
              effectTimingPolicy: defaultCombatEffectTimingPolicy(),
              effectStackingPolicyVersion: 1,
              percentageDotPolicyVersion: 1,
              dotTriggerPolicyVersion: 2,
              skillPacketPolicyVersion: 1,
              displacementPolicyVersion: 1,
              frozenGroundPolicyVersion: 1,
              airbornePolicyVersion: 1,
              airborneJumpPolicyVersion: 1,
              elementalDamagePolicyVersion: 2,
              dynamicInitiativePolicyVersion: 1,
              healingDownPolicyVersion: 1,
              blindsideActivationPolicyVersion: 1,
              groundEffectPolicyVersion: 1,
            },
            [actorId, 'enemy'].map((id) =>
              createCharacterDerivedCombatProfile(id, id, level, derived),
            ),
          )
          const admitted = authority.combatants[0]!
          const buildSnapshot = toCombatBuildSnapshot({
            ...committed,
            disciplineSkills: admitted.disciplineSkills,
            extensions: { ...committed.extensions, ...admitted.extensions },
          })
          const state = preparePv1fTurnEconomy(
            attachCombatBuildBridge(
              reattachStatDrivenCombatBridge(
                reconcileCombatAbilitySources(current, sources),
                current.statBridge,
              ),
              [{ combatantId: actorId, characterId, snapshot: buildSnapshot }],
            ),
          )
          const options = { committedSkills: definitions!, canonicalSources: sources }
          const unchanged = JSON.stringify(state)
          const decision = chooseBuildAwareRecruitAiDecision({
            state,
            tieBreakSeed: 11,
            skillOptions: options,
          })
          expect(
            chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 11, skillOptions: options }),
          ).toEqual(decision)
          expect(JSON.stringify(state)).toBe(unchanged)
          if (decision.intent.kind !== 'action' && decision.intent.kind !== 'ability-prime')
            throw new Error(`No opening command for ${kit.name}: ${decision.intent.kind}`)
          const out = executeBuildAwareRecruitAiAction(
            state,
            decision.intent.actionId,
            decision.intent.kind === 'action' ? decision.intent.target : { kind: 'self' },
            options,
            {
              ...decision.intent,
              ...(decision.intent.kind === 'ability-prime'
                ? { controlledOperation: 'prime' as const }
                : {}),
            },
          )
          expect(
            validateStatDrivenCombatEncounterState(JSON.parse(JSON.stringify(out.state))),
          ).toEqual([])
          expect(JSON.stringify(out.state)).not.toBe(unchanged)
          expect(JSON.stringify(state)).toBe(unchanged)
          for (const unit of out.state.tactical.battle.combatants) {
            expect(unit.hp).toBeGreaterThanOrEqual(0)
            expect(unit.hp).toBeLessThanOrEqual(unit.maxHp)
            expect(unit.mp).toBeGreaterThanOrEqual(0)
            expect(unit.mp).toBeLessThanOrEqual(unit.maxMp)
          }
          expect(definitions!.every((definition) => definition.ability !== undefined)).toBe(true)
        }
        expect(JSON.stringify(committed)).toBe(before)
        expect(learned).toEqual(earnedBefore)
        for (const skill of committed.disciplineSkills)
          expect(resolveMatureSkillVersion(skill.skillId, skill.contentVersion)).not.toBeNull()
      }
    },
  )
  it.each(['unlearned', 'duplicate', 'fifth', 'inactive', 'four-from-one-mixed-source'] as const)(
    'rejects %s before committing a loadout',
    async (invalid) => {
      const kit = kits.find(
        (entry) => entry.secondary === 'vanguard' && entry.primary === 'lifebinder',
      )!
      const { character, repository, learned } = fixture(kit, 100)
      let ids = [...kit.ids]
      if (invalid === 'unlearned') repository.listLearnedSkills = vi.fn(async () => [])
      if (invalid === 'duplicate') ids[3] = ids[0]!
      if (invalid === 'fifth') ids.push('vanguard.cleave')
      if (invalid === 'inactive') {
        const inactive = skillRows.find((row) => row.id === 'farstrider.aimed-shot')!
        learned.push({
          skillId: inactive.id,
          contentVersion: inactive.beforeVersion,
          sourceDisciplineId: inactive.after.sourceDisciplineId,
          learnedAt: timestamp,
        })
        ids[3] = inactive.id
      }
      if (invalid === 'four-from-one-mixed-source')
        ids = skillRows
          .filter((row) => row.after.sourceDisciplineId === 'vanguard')
          .slice(0, 4)
          .map((row) => row.id)
      await expect(
        saveCharacterDisciplineSkills(
          owner,
          character,
          {
            expectedBuildVersion: 1,
            skillIds: ids,
            idempotencyKey: '33333333-3333-4333-8333-333333333333',
          },
          repository,
        ),
      ).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
        message: {
          unlearned: 'Only learned Skills eligible for an active Discipline may be equipped.',
          duplicate: 'A Discipline Technique may only be tagged once.',
          fifth: 'That build may tag at most 4 Discipline Techniques.',
          inactive: 'Only learned Skills eligible for an active Discipline may be equipped.',
          'four-from-one-mixed-source':
            'A mixed build may tag at most 3 Techniques from the Secondary Discipline.',
        }[invalid],
      })
      expect(repository.saveDisciplineSkills).not.toHaveBeenCalled()
    },
  )
})
