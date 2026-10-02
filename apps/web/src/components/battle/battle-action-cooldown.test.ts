import { describe, expect, it } from 'vitest'
import { createPendingBattle } from '@aurevane/game-core/combat/battle-state'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import {
  PV1F_GUARD_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
} from '@aurevane/game-core/combat/pv1f-skills'
import type { BattleSessionView } from '@/server/battle/battle-session-service'
import type { BattleRuntime } from './battle-runtime'
import { battleActionCooldownTurns } from './battle-action-cooldown'

const actor = createPendingBattle({
  battleId: 'cooldown',
  rulesVersion: 1,
  contentVersion: 1,
  rngSeed: 1,
  combatants: ['actor', 'enemy'].map((id) => ({
    id,
    teamId: id,
    initiative: 1,
    baseMovementBudget: 1,
    hp: 100,
    maxHp: 100,
    mp: 100,
    maxMp: 100,
  })),
}).combatants[0]!
const runtime: BattleRuntime = {
  kind: 'pve',
  playerName: 'Player',
  playerLevel: 1,
  playerPortraitAssetId: 'character.adventure.male-01',
  playerProfileImageUrl: null,
}
const snapshot = (key: string, ticks: number) =>
  ({
    snapshot: {
      tactical: {
        battle: {
          combatants: [
            {
              ...actor,
              temporaryResources: [{ key: `p3.skill-cooldown.${key}`, current: ticks, maximum: 4 }],
            },
          ],
        },
      },
    },
  }) as unknown as BattleSessionView
const essence = resolveEssenceForBuild('vanguard', null)!.skill
const presentation = {
  id: essence.id,
  name: 'Essence',
  contentVersion: essence.contentVersion,
  description: '',
  cooldownOwnerTurns: essence.cooldown?.ownerTurns ?? null,
  apCost: essence.apCost,
  mpCost: essence.mpCost ?? 0,
  targetKind: 'unit' as const,
  targetTeamPolicy: 'enemy' as const,
  minimumRange: 1,
  maximumRange: 1,
  tags: [],
  effectDescriptions: [],
  requirementDescriptions: [],
  definition: essence,
}

describe('authoritative cockpit cooldowns', () => {
  it.each([PV1F_RECOVER_ACTION_ID, PV1F_MP_RECOVER_ACTION_ID])(
    'reads the shared Recovery cooldown for %s',
    (id) => {
      expect(battleActionCooldownTurns(snapshot('basic.recovery', 3), runtime, 'actor', id)).toBe(2)
      expect(battleActionCooldownTurns(snapshot('basic.recovery', 1), runtime, 'actor', id)).toBe(1)
    },
  )
  it('shows configured turns on the cast turn and unlocks only at authoritative zero', () => {
    expect(
      [3, 2, 1, 0].map((ticks) =>
        battleActionCooldownTurns(
          snapshot('basic.guard', ticks),
          runtime,
          'actor',
          PV1F_GUARD_ACTION_ID,
        ),
      ),
    ).toEqual([2, 2, 1, 0])
    expect(
      battleActionCooldownTurns(
        snapshot('basic.recovery', 3),
        runtime,
        'actor',
        PV1F_GUARD_ACTION_ID,
      ),
    ).toBe(0)
  })
  it('uses pinned Essence cooldown keys and context duration', () => {
    expect(
      battleActionCooldownTurns(
        snapshot(essence.cooldown!.key, 4),
        { ...runtime, essence: presentation },
        'actor',
        essence.id,
      ),
    ).toBe(essence.cooldown!.ownerTurns)
  })
  it('uses the authoritative snapshot context before the runtime fallback', () => {
    const definition = { ...essence, overrides: { pvp: { cooldownOwnerTurns: 2 } } }
    const battle = snapshot(essence.cooldown!.key, 7)
    battle.snapshot.buildAuthority = {
      combatContext: 'pvp',
    } as NonNullable<BattleSessionView['snapshot']['buildAuthority']>
    expect(
      battleActionCooldownTurns(
        battle,
        { ...runtime, essence: { ...presentation, definition } },
        'actor',
        essence.id,
      ),
    ).toBe(2)
  })
  it('reads a copied command through its pinned source definition instead of the copied action id', () => {
    const copiedId = 'temporary.copy.fixture.v1'
    const copied = {
      ...presentation,
      id: copiedId,
      sourceSkillId: essence.id,
      sourceDisciplineId: 'vanguard',
      category: 'attack' as const,
    }
    expect(
      battleActionCooldownTurns(
        snapshot(essence.cooldown!.key, 2),
        { ...runtime, copiedSkills: [copied] },
        'actor',
        copiedId,
      ),
    ).toBe(2)
  })
  it('does not invent cooldowns for retired ordinary Technique metadata or absent actors', () => {
    const definition = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
    const technique = {
      ...presentation,
      id: definition.id,
      definition,
      sourceDisciplineId: 'vanguard',
      category: 'attack' as const,
    }
    expect(definition.cooldown).not.toBeNull()
    expect(
      battleActionCooldownTurns(
        snapshot(definition.cooldown!.key, 3),
        { ...runtime, techniques: [technique] },
        'actor',
        definition.id,
      ),
    ).toBe(0)
    expect(
      battleActionCooldownTurns(
        snapshot('basic.guard', 3),
        runtime,
        'missing',
        PV1F_GUARD_ACTION_ID,
      ),
    ).toBe(0)
  })
})
