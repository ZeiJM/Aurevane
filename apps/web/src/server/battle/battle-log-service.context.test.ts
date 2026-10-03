import type { BattleEventRecord } from '@aurevane/db/battle-session'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import {
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { CombatContentResolver } from '../combat/combat-content-resolver'
import type { BattleBuildAuthoritySnapshot } from './battle-build-authority'
import type { BattleHistoryPrivacyAuthority } from './battle-history-privacy-authority'
import type { BattlePrivacyEventOverride } from './battle-history-privacy'
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
  options: {
    hidden?: boolean
    legacy?: boolean
    build?: BattleBuildAuthoritySnapshot
    resolver?: Partial<CombatContentResolver>
    eventVisibilityOverrides?: readonly BattlePrivacyEventOverride[]
  } = {},
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
        eventVisibilityOverrides: options.eventVisibilityOverrides ?? [],
      },
    ],
    ...(options.legacy ? {} : { buildAuthority: options.build ?? buildAuthority() }),
  }
  return createViewerSafeBattleLogService(
    { findBattleEvents: async () => records },
    { findBattleHistoryPrivacy: async () => authority },
    { resolvePinnedSkillDefinition, ...options.resolver },
  ).getLog('viewer', 'battle')
}

describe('recorded Battle Log Skill context', () => {
  it('uses only pinned actor identities and explicitly authorized outcome recipients for narration', async () => {
    const build = buildAuthority()
    build.combatants[0]!.narratorIdentity = { name: 'Recorded Ari', pronounPresetId: 'she_her' }
    build.combatants = [
      ...build.combatants,
      {
        ...build.combatants[0]!,
        combatantId: OTHER,
        characterId: 'other',
        narratorIdentity: { name: 'Recorded Bryn', pronounPresetId: 'he_him' },
      },
    ]
    const events = [
      record({ event: 'combat_action_used', actorId: ACTOR, actionId: SKILL }),
      record(
        {
          event: 'damage_applied',
          sourceCombatantId: ACTOR,
          targetCombatantId: OTHER,
          actionId: SKILL,
          amount: 5,
        },
        1,
      ),
      record(
        {
          event: 'temporary_skill_copied',
          combatantId: ACTOR,
          sourceCombatantId: OTHER,
          skillId: SKILL,
          contentVersion: 12,
        },
        2,
      ),
    ]
    const visible = await getLog(events, async () => definition(), { build })
    expect(visible.entries[0]?.actionContext?.narrator).toEqual({
      actor: { name: 'Recorded Ari', pronounPresetId: 'she_her' },
    })
    expect(visible.entries[1]?.actionContext?.narrator?.target).toEqual({
      name: 'Recorded Bryn',
      pronounPresetId: 'he_him',
    })
    expect(visible.entries[2]?.actionContext?.narrator?.target).toBeUndefined()
    build.combatants[0]!.narratorIdentity!.name = 'Later rename'
    expect(visible.entries[0]?.actionContext?.narrator?.actor.name).toBe('Recorded Ari')
    const concealed = await getLog(events, async () => definition(), {
      build,
      eventVisibilityOverrides: [
        {
          eventIndex: 1,
          visibility: { kind: 'team-only', teamId: 'team:a', requiredTeamIds: ['team:b'] },
        },
      ],
    })
    expect(concealed.entries[0]?.actionContext?.narrator?.target).toBeUndefined()
    expect(JSON.stringify(concealed)).not.toContain('Recorded Bryn')
  })

  it('filters later delayed source-private receipts and copied grants before any enrichment or export facts', async () => {
    const resolve = vi.fn(async () => definition())
    const result = await getLog(
      [
        record({
          event: 'status_applied',
          sourceCombatantId: ACTOR,
          targetCombatantId: OTHER,
          actionId: SKILL,
          statusId: 'hexed',
          remainingOwnerTurnStarts: 1,
          sourceCommandVisibility: { kind: 'team-only', teamId: 'team:a' },
        }),
        record(
          {
            event: 'temporary_skill_copied',
            combatantId: ACTOR,
            sourceCombatantId: OTHER,
            skillId: SKILL,
            contentVersion: 12,
          },
          1,
        ),
      ],
      resolve,
      {
        eventVisibilityOverrides: [
          {
            eventIndex: 0,
            visibility: { kind: 'team-only', teamId: 'team:a', requiredTeamIds: ['team:b'] },
          },
          { eventIndex: 1, visibility: { kind: 'team-only', teamId: 'team:a' } },
        ],
      },
    )
    expect(result.entries).toEqual([])
    expect(resolve).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toContain(SKILL)
    expect(JSON.stringify(result)).not.toContain('hexed')
  })
  it('projects only recorded Barrier grants, absorption and scheduled recovery quantities', async () => {
    const result = await getLog(
      [
        record(
          {
            event: 'barrier_changed',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: SKILL,
            amount: 7,
            before: 0,
            after: 7,
            authoredMaximum: 999,
          },
          0,
        ),
        record(
          {
            event: 'barrier_absorbed',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: SKILL,
            amount: 3,
            before: 7,
            after: 4,
          },
          1,
        ),
        record(
          {
            event: 'recovery_scheduled',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: SKILL,
            resource: 'hp',
            amountPerTick: 5,
            remainingFutureTicks: 2,
          },
          2,
        ),
        record(
          {
            event: 'combatant_rewound',
            combatantId: ACTOR,
            actionId: SKILL,
            from: { x: 3, y: 2 },
            to: { x: 1, y: 0 },
          },
          3,
        ),
      ],
      async () => definition(),
    )
    expect(result.entries).toHaveLength(4)
    expect(result.entries[0]).toMatchObject({
      actorCombatantId: ACTOR,
      targetCombatantId: OTHER,
      statusId: 'barrier',
      facts: [
        { label: '+7 Barrier', tone: 'benefit' },
        { label: '7 Barrier remaining', tone: 'neutral' },
      ],
    })
    expect(result.entries[1]?.facts).toContainEqual({ label: '3 damage absorbed', tone: 'benefit' })
    expect(result.entries[2]?.facts).toContainEqual({
      label: '5 HP per tick scheduled',
      tone: 'neutral',
    })
    expect(result.entries[3]).toMatchObject({
      actorCombatantId: ACTOR,
      actionId: SKILL,
      eventType: 'combatant_rewound',
    })
    expect(JSON.stringify(result)).not.toContain('999')
  })
  it('uses the exact pinned Essence outer and nested identity rather than a current Skill lookup', async () => {
    const essence = resolveEssenceForBuild('vanguard', null)!
    const pinned = {
      ...essence,
      contentVersion: 17,
      flavorLine: '{actor} draws a decisive line.',
      skill: { ...essence.skill, contentVersion: 17 },
    }
    const build = buildAuthority()
    const actor = build.combatants[0]!
    const authority = {
      ...build,
      combatants: [
        {
          ...actor,
          extensions: {
            resonance: null,
            essence: {
              essenceId: pinned.essenceId,
              contentVersion: 17,
              sourceDisciplineId: pinned.sourceDisciplineId,
              skillId: pinned.skill.id,
              skillContentVersion: 17,
            },
          },
        },
      ],
    }
    const skillLookup = vi.fn(async () => definition())
    const essenceLookup = vi.fn(async () => pinned)
    const result = await getLog(
      [
        record({
          event: 'combat_action_used',
          actorId: ACTOR,
          actionId: pinned.skill.id,
          contentVersion: 99,
        }),
      ],
      skillLookup,
      { build: authority, resolver: { resolvePinnedEssenceDefinition: essenceLookup } },
    )
    expect(result.entries[0]?.actionContext).toMatchObject({
      family: 'essence',
      contentId: pinned.essenceId,
      skillId: pinned.skill.id,
      contentVersion: 17,
      flavor: pinned.flavorLine,
    })
    expect(essenceLookup).toHaveBeenCalledWith('vanguard', null, pinned.essenceId, 17)
    expect(skillLookup).not.toHaveBeenCalled()
  })

  it('projects visible Resonance activation with owner identity and exact pinned metadata, without invented bonus amounts', async () => {
    const resonance = resolveResonanceForPair('vanguard', 'lifebinder')!
    const pinned = {
      ...resonance,
      contentVersion: 19,
      flavorLine: '{actor} turns mercy into an opening.',
    }
    const build = buildAuthority()
    const authority = {
      ...build,
      combatants: [
        {
          ...build.combatants[0]!,
          secondary: { disciplineId: 'lifebinder', definitionVersion: 1 },
          extensions: {
            essence: null,
            resonance: {
              resonanceId: pinned.id,
              contentVersion: 19,
              disciplinePair: pinned.disciplinePair,
            },
          },
        },
      ],
    }
    const lookup = vi.fn(async () => pinned)
    const result = await getLog(
      [
        record({
          event: 'resonance_activated',
          actorId: ACTOR,
          resonanceId: pinned.id,
          contentVersion: 19,
          triggerActionId: SKILL,
          amount: 9999,
        }),
        record(
          {
            event: 'damage_applied',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: SKILL,
            amount: 6,
            hpAfter: 94,
            effectOrigin: { family: 'resonance', contentId: pinned.id, contentVersion: 19 },
          },
          1,
        ),
        record(
          {
            event: 'damage_applied',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: SKILL,
            amount: 2,
            hpAfter: 92,
            effectOrigin: { family: 'resonance', contentId: pinned.id, contentVersion: 99 },
          },
          2,
        ),
      ],
      async () => null,
      { build: authority, resolver: { resolvePinnedResonanceDefinition: lookup } },
    )
    expect(result.entries[0]).toMatchObject({
      eventType: 'resonance_activated',
      actorCombatantId: ACTOR,
      actionId: pinned.id,
      actionContext: { family: 'resonance', contentVersion: 19, flavor: pinned.flavorLine },
      facts: [],
    })
    expect(lookup).toHaveBeenCalledWith('vanguard', 'lifebinder', pinned.id, 19)
    expect(result.entries[1]?.effectOrigin).toEqual({
      family: 'resonance',
      contentId: pinned.id,
      contentVersion: 19,
    })
    expect(result.entries[2]?.effectOrigin).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain('9999')
    lookup.mockClear()
    const hidden = await getLog(
      [
        record({
          event: 'resonance_activated',
          actorId: ACTOR,
          resonanceId: pinned.id,
          contentVersion: 19,
        }),
      ],
      async () => null,
      { hidden: true, build: authority, resolver: { resolvePinnedResonanceDefinition: lookup } },
    )
    expect(hidden.entries[0]?.actionContext).toBeUndefined()
    expect(lookup).not.toHaveBeenCalled()
  })

  it('retains stable status identity and source actor rather than attributing the result to its recipient', async () => {
    const result = await getLog(
      [
        record({
          event: 'status_applied',
          sourceCombatantId: ACTOR,
          targetCombatantId: OTHER,
          actionId: SKILL,
          statusId: 'burn',
          remainingOwnerTurnStarts: 1,
        }),
      ],
      async () => definition(),
    )
    expect(result.entries[0]).toMatchObject({
      statusId: 'burn',
      actorCombatantId: ACTOR,
      targetCombatantId: OTHER,
      actionId: SKILL,
    })
  })

  it('omits hidden Essence reads and never guesses a missing nested pinned version', async () => {
    const essence = resolveEssenceForBuild('vanguard', null)!
    const build = buildAuthority()
    const authority: BattleBuildAuthoritySnapshot = {
      ...build,
      combatants: [
        {
          ...build.combatants[0]!,
          extensions: {
            resonance: null,
            essence: {
              essenceId: essence.essenceId,
              contentVersion: essence.contentVersion,
              sourceDisciplineId: essence.sourceDisciplineId,
              skillId: essence.skill.id,
              skillContentVersion: essence.skill.contentVersion,
            },
          },
        },
      ],
    }
    const lookup = vi.fn(async () => essence)
    const event = record({
      event: 'combat_action_used',
      actorId: ACTOR,
      actionId: essence.skill.id,
    })
    const hidden = await getLog([event], async () => null, {
      hidden: true,
      build: authority,
      resolver: { resolvePinnedEssenceDefinition: lookup },
    })
    expect(hidden.entries[0]?.actionContext).toBeUndefined()
    expect(lookup).not.toHaveBeenCalled()
    const missing = await getLog([event], async () => null, { build: authority })
    expect(missing.entries[0]?.actionContext).toBeUndefined()
    const mismatched = await getLog([event], async () => null, {
      build: authority,
      resolver: {
        resolvePinnedEssenceDefinition: async () => ({
          ...essence,
          skill: { ...essence.skill, contentVersion: 999 },
        }),
      },
    })
    expect(mismatched.entries[0]?.actionContext).toBeUndefined()
    expect(mismatched.entries[0]?.eventType).toBe('combat_action_used')
  })

  it('withholds Resonance enrichment for a mismatched event version, actor, pair, missing definition or resolver failure', async () => {
    const resonance = resolveResonanceForPair('vanguard', 'lifebinder')!
    const build = buildAuthority()
    const authority: BattleBuildAuthoritySnapshot = {
      ...build,
      combatants: [
        {
          ...build.combatants[0]!,
          secondary: { disciplineId: 'lifebinder', definitionVersion: 1 },
          extensions: {
            essence: null,
            resonance: {
              resonanceId: resonance.id,
              contentVersion: resonance.contentVersion,
              disciplinePair: resonance.disciplinePair,
            },
          },
        },
      ],
    }
    const event = {
      event: 'resonance_activated',
      actorId: ACTOR,
      resonanceId: resonance.id,
      contentVersion: resonance.contentVersion,
    }
    const lookup = vi.fn(async () => resonance)
    for (const badEvent of [
      { ...event, contentVersion: 999 },
      { ...event, actorId: OTHER },
    ]) {
      const result = await getLog([record(badEvent)], async () => null, {
        build: authority,
        resolver: { resolvePinnedResonanceDefinition: lookup },
      })
      expect(result.entries[0]?.actionContext).toBeUndefined()
    }
    expect(lookup).not.toHaveBeenCalled()
    const mismatch = await getLog([record(event)], async () => null, {
      build: authority,
      resolver: {
        resolvePinnedResonanceDefinition: async () => ({
          ...resonance,
          disciplinePair: ['chronist', 'vanguard'],
        }),
      },
    })
    expect(mismatch.entries[0]?.actionContext).toBeUndefined()
    for (const resolve of [
      async () => null,
      async () => {
        throw new Error('Unavailable version')
      },
    ]) {
      const result = await getLog([record(event)], async () => null, {
        build: authority,
        resolver: { resolvePinnedResonanceDefinition: resolve },
      })
      expect(result.entries[0]?.actionContext).toBeUndefined()
      expect(result.entries[0]?.eventType).toBe('resonance_activated')
    }
  })

  it('withholds malformed authored templates while retaining pinned name and actual outcomes', async () => {
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
      async () => definition({ flavorLine: '{private_build}' }),
    )
    expect(result.entries[0]?.actionContext).toMatchObject({
      name: 'Forceful Strike',
      flavor: null,
    })
    expect(result.entries[0]?.facts).toContainEqual({ label: '8 DMG', tone: 'damage' })
    expect(JSON.stringify(result)).not.toContain('private_build')
  })

  it('attributes actual effects only to exact actor pins or a preceding visible copied grant', async () => {
    const effect = {
      event: 'damage_applied',
      sourceCombatantId: ACTOR,
      targetCombatantId: OTHER,
      actionId: SKILL,
      amount: 8,
      hpAfter: 92,
    }
    const origin = { family: 'skill', contentId: SKILL, contentVersion: 12 }
    const valid = await getLog([record({ ...effect, effectOrigin: origin })], async () =>
      definition(),
    )
    expect(valid.entries[0]?.effectOrigin).toEqual(origin)
    for (const effectOrigin of [
      { ...origin, contentVersion: 99 },
      { ...origin, contentId: 'private.skill' },
      { ...origin, secret: 'do-not-project' },
    ]) {
      const invalid = await getLog([record({ ...effect, effectOrigin })], async () => definition())
      expect(invalid.entries[0]?.effectOrigin).toBeUndefined()
      expect(invalid.entries[0]?.facts).toContainEqual({ label: '8 DMG', tone: 'damage' })
    }
    const borrowed = await getLog(
      [record({ ...effect, sourceCombatantId: OTHER, effectOrigin: origin })],
      async () => definition(),
    )
    expect(borrowed.entries[0]?.effectOrigin).toBeUndefined()
    const copyOrigin = { ...origin, contentVersion: 7 }
    const copyEvent = {
      ...effect,
      sourceCombatantId: OTHER,
      actionId: `temporary.copy.${SKILL}.v7`,
      effectOrigin: copyOrigin,
    }
    const copied = await getLog(
      [
        record({
          event: 'temporary_skill_copied',
          combatantId: OTHER,
          sourceCombatantId: ACTOR,
          skillId: SKILL,
          contentVersion: 7,
        }),
        record(copyEvent, 1),
      ],
      async () => definition({ contentVersion: 7 }),
    )
    expect(copied.entries[1]?.effectOrigin).toEqual(copyOrigin)
    const withoutGrant = await getLog([record(copyEvent)], async () => definition())
    expect(withoutGrant.entries[0]?.effectOrigin).toBeUndefined()
  })

  it('projects pending and actual persistent effects distinctly without authored magnitude substitution', async () => {
    const result = await getLog(
      [
        record(
          {
            event: 'effect_pending',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: SKILL,
            effectTag: 'poison',
            activationRound: 3,
            amount: 999,
          },
          0,
        ),
        record(
          {
            event: 'persistent_effect_applied',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: SKILL,
            statusId: 'poison',
          },
          1,
        ),
      ],
      async () => definition(),
    )
    expect(result.entries[0]).toMatchObject({
      eventType: 'effect_pending',
      statusId: 'poison',
      facts: [{ label: 'Pending until round 3', tone: 'neutral' }],
    })
    expect(result.entries[1]).toMatchObject({
      eventType: 'persistent_effect_applied',
      statusId: 'poison',
      actorCombatantId: ACTOR,
      targetCombatantId: OTHER,
    })
    expect(JSON.stringify(result)).not.toContain('999')
  })

  it('describes current affected-turn duration without reinterpreting historical owner-turn-start receipts', async () => {
    const event = {
      event: 'status_applied',
      sourceCombatantId: ACTOR,
      targetCombatantId: OTHER,
      actionId: SKILL,
      statusId: 'root',
      remainingOwnerTurnStarts: 1,
    }
    const result = await getLog(
      [record(event), record({ ...event, expiryBoundary: 'owner-turn-end' }, 1)],
      async () => definition(),
    )
    expect(result.entries[0]?.message).toContain('1 owner-turn start')
    expect(result.entries[1]?.message).toContain('1 affected turn')
  })

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
      family: 'skill',
      skillId: SKILL,
      contentVersion: 12,
      name: 'Forceful Strike',
      description: 'Strike with the recorded force.',
      flavor: 'The recorded blade holds its old promise.',
      battleText: '{actor} channels vanguard power into {ability}.',
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

describe('in-battle Skill text', () => {
  it('uses editable action text separately from the catalogue flavor', async () => {
    const result = await getLog(
      [record({ event: 'combat_action_used', actorId: ACTOR, actionId: SKILL })],
      async () =>
        definition({ battleText: '{actor} raises {actor.possessive} blade toward {target}.' }),
    )
    expect(result.entries[0]?.actionContext?.battleText).toBe(
      '{actor} raises {actor.possessive} blade toward {target}.',
    )
  })
  it('derives actor-led action text when an old Skill has only descriptive flavor', async () => {
    const result = await getLog(
      [record({ event: 'combat_action_used', actorId: ACTOR, actionId: SKILL })],
      async () => definition(),
    )
    expect(result.entries[0]?.actionContext?.battleText).toContain('{actor}')
  })
  it('uses the exact spawned summon ability name and editable text after the summon expires', async () => {
    const parent = resolveMatureSkillVersion('wildwarden.renewing-herbs')!
    const ability = {
      ...parent.summonProfile!.abilities[1]!,
      battleText: '{actor} weaves living roots around {target}.',
    }
    const pinned = { ...parent, summonProfile: { ...parent.summonProfile!, abilities: [ability] } }
    const summonId = 'summon:recorded'
    const build = buildAuthority()
    build.combatants[0]!.narratorIdentity = {
      name: 'Asha',
      pronounPresetId: 'she_her',
    }
    const result = await getLog(
      [
        record(
          {
            event: 'summon_spawned',
            combatantId: summonId,
            ownerCombatantId: ACTOR,
            sourceSkillId: parent.id,
            sourceSkillVersion: parent.contentVersion,
            profileId: parent.summonProfile!.id,
          },
          0,
        ),
        record({ event: 'combat_action_used', actorId: summonId, actionId: ability.id }, 1),
        record(
          {
            event: 'healing_applied',
            sourceCombatantId: summonId,
            targetCombatantId: ACTOR,
            actionId: ability.id,
            amount: 4,
          },
          2,
        ),
        record({ event: 'summon_expired', combatantId: summonId }, 3),
      ],
      async (id, version) =>
        id === parent.id && version === parent.contentVersion ? pinned : null,
      { build },
    )
    expect(
      result.entries.find((entry) => entry.eventType === 'combat_action_used')?.actionContext,
    ).toMatchObject({
      name: 'Verdant Mend',
      battleText: ability.battleText,
      narrator: { actor: { name: 'Verdant Stalker' } },
    })
    expect(
      result.entries.find((entry) => entry.eventType === 'healing_applied')?.actionContext?.narrator
        ?.target,
    ).toEqual(build.combatants[0]!.narratorIdentity)
  })
})
