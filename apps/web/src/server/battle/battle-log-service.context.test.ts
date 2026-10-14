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
import { formatBattleLogForClipboard } from '../../components/battle/battle-log-clipboard'
import { buildBattleChronicle } from '../../components/battle/battle-log-chronicle-model'

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
  it.each(['poison', 'burn'] as const)(
    'resolves a viewer-visible %s tick to its pinned source Skill title',
    async (statusId) => {
      const result = await getLog(
        [
          record({ event: 'combat_action_used', actorId: ACTOR, actionId: SKILL }, 0),
          record(
            {
              event: 'persistent_effect_applied',
              sourceCombatantId: ACTOR,
              targetCombatantId: OTHER,
              actionId: SKILL,
              statusId,
            },
            1,
          ),
          record(
            {
              event: 'damage_applied',
              sourceCombatantId: ACTOR,
              targetCombatantId: OTHER,
              actionId: `status.${statusId}.current.v1`,
              sourceActionId: SKILL,
              statusId,
              amount: 4,
            },
            2,
          ),
        ],
        async () => definition(),
      )
      const tick = result.entries.find((entry) => entry.periodicStatusId === statusId)!
      expect(tick.actionContext).toMatchObject({
        skillId: SKILL,
        name: 'Forceful Strike',
        contentVersion: 12,
      })
    },
  )

  it('uses the pinned actor pronouns for the canonical Defenseless system action', async () => {
    const build = buildAuthority()
    build.combatants[0]!.narratorIdentity = { name: 'Zei', pronounPresetId: 'he_him' }
    const result = await getLog(
      [
        record(
          { event: 'combat_action_used', actorId: ACTOR, actionId: 'battle.lowered-guard.apply' },
          0,
        ),
        record(
          {
            event: 'effect_pending',
            sourceCombatantId: ACTOR,
            targetCombatantId: ACTOR,
            actionId: 'battle.lowered-guard.apply',
            effectTag: 'lowered-guard',
            activationRound: 3,
            remainingOwnerTurnEnds: 1,
          },
          1,
        ),
        record(
          {
            event: 'pvp_lowered_guard_applied',
            combatantId: ACTOR,
            timingState: 'pending',
            remainingOwnerTurnStarts: 1,
          },
          2,
        ),
      ],
      async () => null,
      { build },
    )
    expect(result.entries[0].actorNarrator).toEqual(build.combatants[0]!.narratorIdentity)
    expect(result.entries[2].effectTimingState).toBe('pending')
    const actions = buildBattleChronicle(result.entries)[0].actors[0].actions
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({
      title: 'Defenseless',
      flavorTemplate: '{actor} lowered {actor.possessive} guard!',
    })
  })
  it('merges the actual result-before-activation Resonance sequence into one named entry', async () => {
    const pinned = {
      ...resolveResonanceForPair('vanguard', 'lifebinder')!,
      contentVersion: 19,
      flavorLine: undefined,
    }
    const build = buildAuthority()
    build.combatants[0]!.secondary = { disciplineId: 'lifebinder', definitionVersion: 1 }
    build.combatants[0]!.extensions.resonance = {
      resonanceId: pinned.id,
      contentVersion: 19,
      disciplinePair: pinned.disciplinePair,
    }
    const result = await getLog(
      [
        record({ event: 'combat_action_used', actorId: ACTOR, actionId: SKILL }, 0),
        record(
          {
            event: 'damage_applied',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: SKILL,
            amount: 8,
          },
          1,
        ),
        record(
          {
            event: 'resource_changed',
            sourceCombatantId: ACTOR,
            targetCombatantId: ACTOR,
            actionId: SKILL,
            resource: 'MP',
            delta: 0,
            effectOrigin: { family: 'resonance', contentId: pinned.id, contentVersion: 19 },
          },
          2,
        ),
        record(
          {
            event: 'resonance_activated',
            actorId: ACTOR,
            resonanceId: pinned.id,
            contentVersion: 19,
            setupActionId: SKILL,
            triggerActionId: SKILL,
            payoffActionId: SKILL,
          },
          3,
        ),
      ],
      async () => definition(),
      { build, resolver: { resolvePinnedResonanceDefinition: async () => pinned } },
    )
    const chronicle = buildBattleChronicle(result.entries, { combatantNames: { [ACTOR]: 'Zei' } })
    const specials = chronicle[0].actors[0].actions[0].specials
    expect(specials).toHaveLength(1)
    expect(specials[0]).toMatchObject({
      title: pinned.name,
      family: 'resonance',
      fallbackNarration: "Zei's disciplines answer together.",
      hasRecordedResult: true,
    })
    expect(specials[0].outcomes.map((result) => result.text)).toEqual(['+0 MP'])
  })

  it('does not leak periodic or summon source Skill IDs through public outcomes of hidden casts', async () => {
    const result = await getLog(
      [
        record({ event: 'combat_action_used', actorId: ACTOR, actionId: SKILL }, 0),
        record(
          {
            event: 'damage_applied',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: SKILL,
            sourceActionId: SKILL,
            statusId: 'bleed',
            amount: 4,
          },
          1,
        ),
        record(
          {
            event: 'summon_spawned',
            ownerCombatantId: ACTOR,
            combatantId: 'summon:test',
            sourceSkillId: SKILL,
            sourceSkillVersion: 12,
            profileId: 'summon.test',
          },
          2,
        ),
      ],
      async () => definition(),
      {
        hidden: true,
        eventVisibilityOverrides: [
          { eventIndex: 1, visibility: { kind: 'public' } },
          { eventIndex: 2, visibility: { kind: 'public' } },
        ],
      },
    )
    expect(JSON.stringify(result)).not.toContain(SKILL)
    const damage = result.entries.find((entry) => entry.eventType === 'damage_applied')
    expect(damage).toMatchObject({
      actionId: null,
      periodicStatusId: 'bleed',
      templateValues: { amount: '4' },
    })
    expect(damage?.actionContext).toBeUndefined()
  })
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
    ]
    const visible = await getLog(events, async () => definition(), { build })
    expect(visible.entries[0]?.actionContext?.narrator).toEqual({
      actor: { name: 'Recorded Ari', pronounPresetId: 'she_her' },
    })
    expect(visible.entries[1]?.actionContext?.narrator?.target).toEqual({
      name: 'Recorded Bryn',
      pronounPresetId: 'he_him',
    })
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
        record(
          {
            event: 'persistent_effect_applied',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: pinned.skill.id,
            statusId: 'burn',
          },
          1,
        ),
        record(
          {
            event: 'damage_applied',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: 'status.burn.current.v1',
            sourceActionId: pinned.skill.id,
            statusId: 'burn',
            amount: 4,
          },
          2,
        ),
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
    expect(result.entries[2].actionContext).toMatchObject({
      family: 'essence',
      contentId: pinned.essenceId,
      contentVersion: 17,
      name: pinned.name,
    })
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
        record(
          {
            event: 'damage_applied',
            sourceCombatantId: ACTOR,
            targetCombatantId: OTHER,
            actionId: SKILL,
            amount: 1,
            hpAfter: 91,
            effectOrigin: {
              family: 'resonance',
              contentId: pinned.id,
              contentVersion: 19,
              sourceInstanceId: 'private-execution-source',
              behaviorId: 'private-behavior',
              effectId: 'private-effect',
            },
            abilityCommandFacts: { rootActionId: 'private-command' },
          },
          3,
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
    expect(result.entries[3]?.effectOrigin).toBeUndefined()
    expect(JSON.stringify(result)).not.toMatch(
      /private-execution-source|private-behavior|private-effect|private-command/,
    )
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

describe('departed summon identity', () => {
  it.each(['summon_expired', 'summon_defeated'])(
    'names movement, incoming attacks and the %s receipt without an ability cast',
    async (eventType) => {
      const parent = resolveMatureSkillVersion('wildwarden.renewing-herbs')!
      const summonId = 'summon:recorded'
      const records = [
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
        record(
          {
            event: 'combatant_moved',
            combatantId: summonId,
            from: { x: 1, y: 1 },
            to: { x: 2, y: 1 },
            apCost: 10,
          },
          1,
        ),
        record(
          {
            event: 'damage_applied',
            sourceCombatantId: OTHER,
            targetCombatantId: summonId,
            actionId: 'basic.attack.unarmed.basic',
            amount: 16,
          },
          2,
        ),
        record({ event: eventType, combatantId: summonId }, 3),
      ]
      const resolve = vi.fn(async (id: string, version: number) =>
        id === parent.id && version === parent.contentVersion ? parent : null,
      )
      const result = await getLog(records, resolve)
      expect(
        result.entries.find((entry) => entry.eventType === 'combatant_moved')?.actorNarrator,
      ).toEqual({ name: 'Verdant Stalker' })
      expect(
        result.entries.find((entry) => entry.eventType === 'damage_applied')?.targetNarrator,
      ).toEqual({ name: 'Verdant Stalker' })
      const departure = result.entries.find((entry) => entry.eventType === eventType)
      expect(departure).toMatchObject({
        actorCombatantId: summonId,
        actionId: null,
        actorNarrator: { name: 'Verdant Stalker' },
      })
      const chronicle = buildBattleChronicle(result.entries)
      expect(JSON.stringify(chronicle)).toContain('Verdant Stalker')
      expect(
        chronicle.flatMap((round) => round.actors).find((actor) => actor.actorId === summonId)
          ?.name,
      ).toBe('Verdant Stalker')
      expect(
        chronicle.flatMap((round) =>
          round.actors.flatMap((actor) =>
            actor.actions.flatMap((action) => action.outcomes.map((outcome) => outcome.text)),
          ),
        ),
      ).toContain(
        eventType === 'summon_expired'
          ? 'Verdant Stalker faded as the summon duration ended.'
          : 'Verdant Stalker was dispelled after being defeated.',
      )
      const copied = formatBattleLogForClipboard(result.entries)
      expect(copied).toContain('Verdant Stalker moves.')
      expect(copied).toContain(
        eventType === 'summon_expired'
          ? 'Verdant Stalker faded as the summon duration ended.'
          : 'Verdant Stalker was dispelled after being defeated.',
      )
      expect(copied).not.toContain('Combatant moves.')
      expect(resolve).toHaveBeenCalledTimes(1)
      resolve.mockClear()
      const hidden = await getLog(records, resolve, { hidden: true })
      expect(JSON.stringify(hidden)).not.toContain('Verdant Stalker')
      expect(hidden.entries.every((entry) => !entry.actorNarrator && !entry.targetNarrator)).toBe(
        true,
      )
      expect(resolve).not.toHaveBeenCalled()
    },
  )
})

it('Chronicle and Copy Full Log retain recorded Suppress percentage and lifetime', async () => {
  const result = await getLog(
    [
      record({ event: 'combat_action_used', actionId: SKILL, actorId: ACTOR }),
      record(
        {
          event: 'effect_pending',
          actionId: SKILL,
          sourceCombatantId: ACTOR,
          targetCombatantId: OTHER,
          effectTag: 'suppress',
          potencyBasisPoints: 2534,
          activationRound: 3,
          remainingRoundBoundaries: 2,
          durationScope: 'rounds',
        },
        1,
      ),
      record(
        {
          event: 'status_applied',
          actionId: SKILL,
          sourceCombatantId: ACTOR,
          targetCombatantId: OTHER,
          statusId: 'suppress',
          potencyBasisPoints: 4000,
          stacks: 1,
          remainingOwnerTurnStarts: 2,
          expiryBoundary: 'owner-turn-end',
          refreshed: true,
          stacked: false,
        },
        2,
      ),
    ],
    async () => definition(),
  )
  expect(JSON.stringify(buildBattleChronicle(result.entries))).toContain('Suppress [25.34%]')
  const copied = formatBattleLogForClipboard(result.entries)
  expect(copied).toContain('Suppress [25.34%]')
  expect(copied).toContain('Suppress [40%]')
  expect(copied).toContain('2 turns')
})

it.each(['effect_pending', 'status_applied'] as const)(
  'sanitizes and preserves recorded Suppress percentage for %s without leaking hidden history',
  async (eventType) => {
    const raw = {
      event: eventType,
      actionId: SKILL,
      sourceCombatantId: ACTOR,
      targetCombatantId: OTHER,
      ...(eventType === 'effect_pending'
        ? {
            effectTag: 'suppress',
            activationRound: 3,
            remainingRoundBoundaries: 2,
            durationScope: 'rounds',
          }
        : {
            statusId: 'suppress',
            stacks: 1,
            remainingOwnerTurnStarts: 2,
            expiryBoundary: 'owner-turn-end',
            refreshed: false,
            stacked: false,
          }),
      potencyBasisPoints: 10000,
    }
    const records = [
      record({ event: 'combat_action_used', actionId: SKILL, actorId: ACTOR }),
      record(raw, 1),
    ]
    const resolve = vi.fn(async () => definition())
    const visible = await getLog(records, resolve)
    expect(visible.entries.find((entry) => entry.eventType === eventType)).toMatchObject({
      statusId: 'suppress',
      potencyBasisPoints: 10000,
    })
    const outcomes = buildBattleChronicle(visible.entries).flatMap((round) =>
      round.actors.flatMap((actor) => actor.actions.flatMap((action) => action.outcomes)),
    )
    expect(outcomes).toContainEqual(
      expect.objectContaining({ statusId: 'suppress', potencyBasisPoints: 10000 }),
    )
    const hidden = await getLog(records, resolve, { hidden: true })
    expect(hidden.entries.every((entry) => entry.potencyBasisPoints === undefined)).toBe(true)
    expect(JSON.stringify(hidden)).not.toContain('Suppress')
    for (const invalid of [0, 99, 10001, 100.5, '10000']) {
      const invalidLog = await getLog(
        [records[0], record({ ...raw, potencyBasisPoints: invalid }, 1)],
        resolve,
      )
      expect(invalidLog.entries.find((entry) => entry.eventType === eventType)).not.toHaveProperty(
        'potencyBasisPoints',
      )
      expect(invalidLog.entries.find((entry) => entry.eventType === eventType)?.headline).toBe(
        'Suppress',
      )
    }
  },
)
