import type { BattleEventRecord } from '@aurevane/db/battle-session'
import {
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { CombatContentResolver } from '../combat/combat-content-resolver'
import type { BattleBuildAuthoritySnapshot } from './battle-build-authority'
import type { BattleHistoryPrivacyAuthority } from './battle-history-privacy-authority'
import { createViewerSafeBattleLogService } from './battle-log-service'
import { createSpectatorBattleViewerEntitlement } from './battle-viewer-entitlement'

const ACTOR = 'character:actor'
const OTHER = 'character:other'
const SKILL = 'vanguard.forceful-strike'

function definition(overrides: Partial<MatureSkillDefinition> = {}): MatureSkillDefinition {
  return {
    ...resolveMatureSkillVersion(SKILL, 2)!,
    contentVersion: 12,
    flavorLine: 'The recorded blade holds its old promise.',
    effectDescriptions: ['Strike with the recorded force.'],
    ...overrides,
  }
}

function buildAuthority(): BattleBuildAuthoritySnapshot {
  return {
    schemaVersion: 1,
    catalogVersion: 3,
    combatContext: 'pvp',
    combatants: [
      {
        combatantId: ACTOR,
        characterId: 'actor',
        snapshotSchemaVersion: 1,
        buildSchemaVersion: 1,
        buildVersion: 1,
        fingerprint: 'private-build-fingerprint',
        primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
        secondary: null,
        disciplineSkills: [
          { slotIndex: 1, skillId: SKILL, contentVersion: 12, sourceDisciplineId: 'vanguard' },
        ],
        extensions: { resonance: null, essence: null },
      },
    ],
  }
}

function record(event: Record<string, unknown>, eventIndex = 0): BattleEventRecord {
  return { battleVersion: 9, eventIndex, createdAt: '2026-10-02T00:00:00.000Z', event }
}

async function getLog(
  records: readonly BattleEventRecord[],
  resolvePinnedSkillDefinition: CombatContentResolver['resolvePinnedSkillDefinition'],
  options: { hidden?: boolean; legacy?: boolean } = {},
) {
  const authority: BattleHistoryPrivacyAuthority = {
    viewer: createSpectatorBattleViewerEntitlement(),
    journals: [
      {
        schemaVersion: 1,
        battleVersion: 9,
        actorCombatantId: ACTOR,
        actorTeamId: 'team:a',
        eventCount: records.length,
        commandVisibility: options.hidden
          ? { kind: 'team-only', teamId: 'team:a' }
          : { kind: 'public' },
        eventVisibilityOverrides: [],
      },
    ],
    ...(options.legacy ? {} : { buildAuthority: buildAuthority() }),
  }
  return createViewerSafeBattleLogService(
    { findBattleEvents: async () => records },
    { findBattleHistoryPrivacy: async () => authority },
    { resolvePinnedSkillDefinition },
  ).getLog('viewer', 'battle')
}

describe('recorded Battle Log Skill context', () => {
  it('uses the actor pinned version rather than current content or arbitrary event copy', async () => {
    const result = await getLog(
      [
        record({
          event: 'combat_action_used',
          actorId: ACTOR,
          actionId: SKILL,
          contentVersion: 99,
          description: 'unsafe event copy',
        }),
      ],
      async (skillId, version) =>
        skillId === SKILL && version === 12
          ? definition()
          : definition({ contentVersion: 99, flavorLine: 'Current flavor' }),
    )

    expect(result.entries[0]?.actionContext).toEqual({
      skillId: SKILL,
      contentVersion: 12,
      name: 'Forceful Strike',
      description: 'Strike with the recorded force.',
      flavor: 'The recorded blade holds its old promise.',
    })
    expect(JSON.stringify(result)).not.toContain('unsafe event copy')
    expect(JSON.stringify(result)).not.toContain('private-build-fingerprint')
  })

  it('does not resolve or disclose Skill context hidden from the viewer', async () => {
    const resolve = vi.fn(async () => definition())
    const result = await getLog(
      [record({ event: 'combat_action_used', actorId: ACTOR, actionId: SKILL })],
      resolve,
      { hidden: true },
    )
    expect(result.entries[0]?.eventType).toBe('hidden_combat_action')
    expect(result.entries[0]?.actionContext).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain(SKILL)
    expect(resolve).not.toHaveBeenCalled()
  })

  it('retains a copied Skill exact identity from its visible grant and encoded command', async () => {
    const result = await getLog(
      [
        record({
          event: 'temporary_skill_copied',
          combatantId: OTHER,
          sourceCombatantId: ACTOR,
          skillId: SKILL,
          contentVersion: 7,
        }),
        record(
          { event: 'combat_action_used', actorId: OTHER, actionId: `temporary.copy.${SKILL}.v7` },
          1,
        ),
        record(
          {
            event: 'damage_applied',
            sourceCombatantId: OTHER,
            targetCombatantId: ACTOR,
            actionId: `temporary.copy.${SKILL}.v7`,
            amount: 8,
            hpAfter: 92,
          },
          2,
        ),
      ],
      async (skillId, version) =>
        skillId === SKILL && version === 7
          ? definition({ contentVersion: 7, flavorLine: 'Copied historical flavor.' })
          : null,
    )
    expect(result.entries[1]?.actionId).toBe(SKILL)
    expect(result.entries[1]?.actionContext).toMatchObject({
      skillId: SKILL,
      contentVersion: 7,
      flavor: 'Copied historical flavor.',
    })
    expect(result.entries[2]?.actionContext?.contentVersion).toBe(7)
  })

  it('omits copied context when no visible matching grant establishes provenance', async () => {
    const resolve = vi.fn(async () => definition({ contentVersion: 7 }))
    const result = await getLog(
      [
        record({
          event: 'combat_action_used',
          actorId: OTHER,
          actionId: `temporary.copy.${SKILL}.v7`,
        }),
      ],
      resolve,
    )
    expect(result.entries[0]?.actionContext).toBeUndefined()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('does not borrow another combatant pinned Skill for an unmatched actor', async () => {
    const resolve = vi.fn(async () => definition())
    const result = await getLog(
      [record({ event: 'combat_action_used', actorId: OTHER, actionId: SKILL })],
      resolve,
    )
    expect(result.entries[0]?.actionContext).toBeUndefined()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('omits a pinned definition attributed to a different source Discipline', async () => {
    const result = await getLog(
      [record({ event: 'combat_action_used', actorId: ACTOR, actionId: SKILL })],
      async () => definition({ sourceDisciplineId: 'lifebinder' }),
    )
    expect(result.entries[0]?.actionContext).toBeUndefined()
  })

  it('keeps legacy recorded results without guessing a missing version', async () => {
    const resolve = vi.fn(async () => definition())
    const result = await getLog(
      [
        record({
          event: 'damage_applied',
          sourceCombatantId: ACTOR,
          targetCombatantId: OTHER,
          actionId: SKILL,
          amount: 8,
          hpAfter: 92,
        }),
      ],
      resolve,
      { legacy: true },
    )
    expect(result.entries[0]?.facts).toContainEqual({ label: '8 DMG', tone: 'damage' })
    expect(result.entries[0]?.actionContext).toBeUndefined()
    expect(resolve).not.toHaveBeenCalled()
  })

  it.each(['missing', 'disabled', 'mismatched', 'failed'] as const)(
    'retains history when the pinned definition is %s',
    async (kind) => {
      const result = await getLog(
        [record({ event: 'combat_action_used', actorId: ACTOR, actionId: SKILL })],
        async () => {
          if (kind === 'failed') throw new Error('unavailable pinned content')
          if (kind === 'missing') return null
          return definition(kind === 'disabled' ? { enabled: false } : { contentVersion: 99 })
        },
      )
      expect(result.entries[0]?.eventType).toBe('combat_action_used')
      expect(result.entries[0]?.actionContext).toBeUndefined()
    },
  )

  it('resolves a repeated visible Skill once and omits absent authored flavor', async () => {
    const resolve = vi.fn(async () => definition({ flavorLine: undefined }))
    const result = await getLog(
      [
        record({ event: 'combat_action_used', actorId: ACTOR, actionId: SKILL }),
        record(
          {
            event: 'damage_applied',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: SKILL,
            amount: 8,
            hpAfter: 92,
          },
          1,
        ),
      ],
      resolve,
    )
    expect(result.entries.every((entry) => entry.actionContext?.flavor === null)).toBe(true)
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve).toHaveBeenCalledWith(SKILL, 12)
  })
})
