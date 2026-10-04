import 'server-only'

import type { BattleEventRecord } from '@aurevane/db/battle-session'
import { parseCopiedSkillCommandId } from '@aurevane/game-core/combat/combat-skill-copy'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import {
  battleFlavorTemplateIssues,
  defaultSkillBattleText,
} from '@aurevane/game-core/combat/battle-narration'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import type { CombatEffectOrigin } from '@aurevane/game-core/combat/actions'
import {
  skillDisplayName,
  skillEffectDescription,
} from '../../components/character/skill-detail-presentation'
import type { CombatContentResolver } from '../combat/combat-content-resolver'
import type { BattleBuildAuthoritySnapshot } from './battle-build-authority'
import type { BattleLogEntry, BattleLogView } from './battle-log-service'

type SkillReference = { skillId: string; contentVersion: number; sourceDisciplineId?: string }
type SkillContext = NonNullable<BattleLogEntry['actionContext']>
type ContextResolver = Pick<
  CombatContentResolver,
  | 'resolvePinnedSkillDefinition'
  | 'resolvePinnedEssenceDefinition'
  | 'resolvePinnedResonanceDefinition'
>

function safeFlavor(flavor: string | undefined): string | null {
  return battleFlavorTemplateIssues(flavor).length === 0 ? flavor! : null
}

function eventObject(record: BattleEventRecord): Record<string, unknown> | null {
  return record.event && typeof record.event === 'object' && !Array.isArray(record.event)
    ? (record.event as Record<string, unknown>)
    : null
}

/** Periodic source IDs reach enrichment only after viewer projection has proven attribution. */
function recordedActionId(entry: BattleLogEntry, event: Record<string, unknown>): string | null {
  const candidate =
    entry.periodicStatusId && event.statusId === entry.periodicStatusId
      ? (event.sourceActionId ?? event.actionId)
      : event.actionId
  return typeof candidate === 'string' ? candidate : null
}

function recordKey(record: Pick<BattleEventRecord, 'battleVersion' | 'eventIndex'>): string {
  return `${record.battleVersion}:${record.eventIndex}`
}

function referenceKey(reference: SkillReference): string {
  return `${reference.skillId}@${reference.contentVersion}`
}

function copyGrant(
  record: BattleEventRecord,
): { actorId: string; reference: SkillReference } | null {
  const event = eventObject(record)
  if (
    event?.event !== 'temporary_skill_copied' ||
    typeof event.combatantId !== 'string' ||
    typeof event.skillId !== 'string' ||
    typeof event.contentVersion !== 'number' ||
    !Number.isSafeInteger(event.contentVersion) ||
    event.contentVersion < 1
  )
    return null
  return {
    actorId: event.combatantId,
    reference: { skillId: event.skillId, contentVersion: event.contentVersion },
  }
}

function precedes(
  grant: Pick<BattleEventRecord, 'battleVersion' | 'eventIndex'>,
  record: Pick<BattleEventRecord, 'battleVersion' | 'eventIndex'>,
): boolean {
  return (
    grant.battleVersion < record.battleVersion ||
    (grant.battleVersion === record.battleVersion && grant.eventIndex <= record.eventIndex)
  )
}

/** Enrichment receives only projected history; hidden commands cannot trigger content reads. */
export async function attachRecordedBattleLogSkillContext(
  view: BattleLogView,
  projected: readonly BattleEventRecord[],
  authority: BattleBuildAuthoritySnapshot | undefined,
  resolver?: ContextResolver,
  copyPolicyVersion: number | null = null,
): Promise<BattleLogView> {
  if (!authority) return view
  const records = new Map(projected.map((record) => [recordKey(record), record]))
  const visibleGrants = new Map<string, BattleEventRecord>()
  for (const record of projected) {
    const grant = copyGrant(record)
    if (!grant) continue
    const key = `${grant.actorId}:${referenceKey(grant.reference)}`
    const previous = visibleGrants.get(key)
    if (!previous || precedes(record, previous)) visibleGrants.set(key, record)
  }

  const referencesByEntry = new Map<BattleLogEntry, SkillReference>()
  const uniqueReferences = new Map<string, SkillReference>()
  for (const entry of view.entries) {
    if (!entry.actionId || !entry.actorCombatantId) continue
    const record = records.get(recordKey(entry))
    const event = record ? eventObject(record) : null
    if (!record || !event) continue
    let reference: SkillReference | undefined
    const grant = copyGrant(record)
    const actionId = recordedActionId(entry, event)
    const copied = actionId ? parseCopiedSkillCommandId(actionId) : null
    if (grant) {
      reference = grant.reference
    } else if (copied) {
      const provenance = visibleGrants.get(`${entry.actorCombatantId}:${referenceKey(copied)}`)
      if (provenance && precedes(provenance, record)) reference = copied
    } else if (actionId === entry.actionId) {
      reference = authority.combatants
        .find((combatant) => combatant.combatantId === entry.actorCombatantId)
        ?.disciplineSkills.find((skill) => skill.skillId === entry.actionId)
    }
    if (!reference || reference.skillId !== entry.actionId) continue
    referencesByEntry.set(entry, reference)
    uniqueReferences.set(referenceKey(reference), reference)
  }

  const contexts = new Map<string, SkillContext>()
  const sourceDisciplines = new Map<string, string>()
  // At most one lookup per visible pinned identity (four build slots per actor plus
  // recorded copied grants). Four workers bound fan-out across the complete history.
  const pending = [...uniqueReferences.values()]
  let nextIndex = 0
  await Promise.all(
    Array.from({ length: Math.min(4, pending.length) }, async () => {
      while (nextIndex < pending.length) {
        const reference = pending[nextIndex++]!
        try {
          const definition =
            authority.catalogVersion === 3
              ? await resolver?.resolvePinnedSkillDefinition(
                  reference.skillId,
                  reference.contentVersion,
                )
              : resolveMatureSkillVersion(reference.skillId, reference.contentVersion)
          if (
            !definition ||
            !definition.enabled ||
            definition.id !== reference.skillId ||
            definition.contentVersion !== reference.contentVersion
          )
            continue
          contexts.set(referenceKey(reference), {
            family: 'skill',
            skillId: definition.id,
            contentVersion: definition.contentVersion,
            name: skillDisplayName(definition),
            description: definition.effects
              .map((effect, index) =>
                effect.type === 'copy'
                  ? skillEffectDescription(effect, copyPolicyVersion)
                  : (definition.effectDescriptions?.[index] ?? skillEffectDescription(effect)),
              )
              .join(' '),
            flavor: safeFlavor(definition.flavorLine),
            battleText: safeFlavor(definition.battleText) ?? defaultSkillBattleText(definition),
          })
          sourceDisciplines.set(referenceKey(reference), definition.sourceDisciplineId)
        } catch {
          // Optional historical copy must not make recorded authoritative results unavailable.
        }
      }
    }),
  )

  const skillView = {
    ...view,
    entries: view.entries.map((entry) => {
      const reference = referencesByEntry.get(entry)
      const actionContext = reference ? contexts.get(referenceKey(reference)) : undefined
      if (!actionContext) return entry
      if (
        reference?.sourceDisciplineId &&
        sourceDisciplines.get(referenceKey(reference)) !== reference.sourceDisciplineId
      )
        return entry
      return { ...entry, actionContext }
    }),
  }
  const extensionView = await attachRecordedBuildExtensionContext(
    skillView,
    projected,
    authority,
    resolver,
  )
  const summonView = await attachRecordedSummonSkillContext(
    extensionView,
    projected,
    authority,
    resolver,
  )
  return {
    ...summonView,
    entries: summonView.entries.map((entry) => {
      const record = records.get(recordKey(entry))
      const effectOrigin = record
        ? verifiedRecordedEffectOrigin(entry, record, authority, visibleGrants)
        : null
      const actorIdentity =
        (entry.actionContext || entry.actionId === 'battle.lowered-guard.apply') &&
        entry.actorCombatantId
          ? authority.combatants.find(
              (combatant) => combatant.combatantId === entry.actorCombatantId,
            )?.narratorIdentity
          : undefined
      // Copy's recorded source is its donor, not the recipient of an authored action.
      const targetIdentity =
        actorIdentity && entry.targetCombatantId && entry.eventType !== 'temporary_skill_copied'
          ? authority.combatants.find(
              (combatant) => combatant.combatantId === entry.targetCombatantId,
            )?.narratorIdentity
          : undefined
      return {
        ...entry,
        ...(effectOrigin ? { effectOrigin } : {}),
        ...(actorIdentity && entry.actionId === 'battle.lowered-guard.apply'
          ? { actorNarrator: { ...actorIdentity } }
          : {}),
        ...(actorIdentity && entry.actionContext
          ? {
              actionContext: {
                ...entry.actionContext,
                narrator: {
                  actor: { ...actorIdentity },
                  ...(targetIdentity ? { target: { ...targetIdentity } } : {}),
                },
              },
            }
          : {}),
      }
    }),
  }
}

/** Origin attribution is a receipt, never guessed from matching amounts or current content. */
function verifiedRecordedEffectOrigin(
  entry: BattleLogEntry,
  record: BattleEventRecord,
  authority: BattleBuildAuthoritySnapshot,
  visibleGrants: ReadonlyMap<string, BattleEventRecord>,
): CombatEffectOrigin | null {
  const event = eventObject(record)
  const candidate = event?.effectOrigin
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate) ||
    !event ||
    !recordedActionId(entry, event) ||
    !entry.actorCombatantId
  )
    return null
  const origin = candidate as Record<string, unknown>
  if (
    Object.keys(origin).some((key) => !['family', 'contentId', 'contentVersion'].includes(key)) ||
    typeof origin.contentId !== 'string' ||
    !Number.isSafeInteger(origin.contentVersion) ||
    (origin.contentVersion as number) < 1
  )
    return null
  const actionId = recordedActionId(entry, event)!
  const copied = parseCopiedSkillCommandId(actionId)
  const grant = copied
    ? visibleGrants.get(`${entry.actorCombatantId}:${referenceKey(copied)}`)
    : undefined
  const validCopy = copied && grant && precedes(grant, record) ? copied : null
  const build = authority.combatants.find(
    (combatant) => combatant.combatantId === entry.actorCombatantId,
  )
  const skill = build?.disciplineSkills.find((reference) => reference.skillId === actionId)
  const essence = build?.extensions.essence
  const resonance = build?.extensions.resonance
  let valid = false
  if (origin.family === 'skill') {
    const reference = validCopy ?? skill
    valid =
      reference?.skillId === origin.contentId && reference?.contentVersion === origin.contentVersion
  } else if (origin.family === 'essence') {
    valid =
      essence?.skillId === actionId &&
      essence?.essenceId === origin.contentId &&
      essence?.contentVersion === origin.contentVersion
  } else if (origin.family === 'resonance') {
    valid =
      Boolean(skill || validCopy || essence?.skillId === actionId) &&
      resonance?.resonanceId === origin.contentId &&
      resonance?.contentVersion === origin.contentVersion
  }
  return valid
    ? {
        family: origin.family as CombatEffectOrigin['family'],
        contentId: origin.contentId,
        contentVersion: origin.contentVersion as number,
      }
    : null
}

async function attachRecordedBuildExtensionContext(
  view: BattleLogView,
  projected: readonly BattleEventRecord[],
  authority: BattleBuildAuthoritySnapshot,
  resolver?: ContextResolver,
): Promise<BattleLogView> {
  const records = new Map(projected.map((record) => [recordKey(record), record]))
  const builds = new Map(authority.combatants.map((build) => [build.combatantId, build]))
  type Build = BattleBuildAuthoritySnapshot['combatants'][number]
  const pending = new Map<string, { family: 'essence' | 'resonance'; build: Build }>()
  const keys = new Map<BattleLogEntry, string>()
  for (const entry of view.entries) {
    if (!entry.actorCombatantId || !entry.actionId || entry.actionContext) continue
    const build = builds.get(entry.actorCombatantId)
    const record = records.get(recordKey(entry))
    const event = record ? eventObject(record) : null
    if (!build || !event) continue
    const essence = build.extensions.essence
    const resonance = build.extensions.resonance
    let family: 'essence' | 'resonance'
    let id: string
    let version: number
    if (
      essence &&
      recordedActionId(entry, event) === essence.skillId &&
      entry.actionId === essence.skillId
    ) {
      family = 'essence'
      id = essence.essenceId
      version = essence.contentVersion
    } else if (
      resonance &&
      event.event === 'resonance_activated' &&
      event.actorId === build.combatantId &&
      event.resonanceId === resonance.resonanceId &&
      event.contentVersion === resonance.contentVersion &&
      entry.actionId === resonance.resonanceId
    ) {
      family = 'resonance'
      id = resonance.resonanceId
      version = resonance.contentVersion
    } else continue
    // Include build identity so content cannot be borrowed across a mismatched Discipline pair.
    const key = `${family}:${id}@${version}:${build.combatantId}`
    pending.set(key, { family, build })
    keys.set(entry, key)
  }

  const contexts = new Map<string, SkillContext>()
  const lookups = [...pending.entries()]
  let nextIndex = 0
  await Promise.all(
    Array.from({ length: Math.min(4, lookups.length) }, async () => {
      while (nextIndex < lookups.length) {
        const [key, { family, build }] = lookups[nextIndex++]!
        const primary = build.primary.disciplineId
        const secondary = build.secondary?.disciplineId ?? null
        try {
          if (family === 'essence') {
            const reference = build.extensions.essence!
            const definition =
              authority.catalogVersion === 3
                ? await resolver?.resolvePinnedEssenceDefinition?.(
                    primary,
                    secondary,
                    reference.essenceId,
                    reference.contentVersion,
                  )
                : resolveEssenceForBuild(primary, secondary, reference.contentVersion)
            if (
              !definition?.enabled ||
              !definition.skill.enabled ||
              definition.essenceId !== reference.essenceId ||
              definition.contentVersion !== reference.contentVersion ||
              definition.sourceDisciplineId !== reference.sourceDisciplineId ||
              definition.skill.id !== reference.skillId ||
              definition.skill.contentVersion !== reference.skillContentVersion ||
              definition.skill.sourceDisciplineId !== reference.sourceDisciplineId
            )
              continue
            contexts.set(key, {
              family,
              contentId: definition.essenceId,
              skillId: definition.skill.id,
              contentVersion: definition.contentVersion,
              name: definition.name,
              description: definition.description,
              flavor: safeFlavor(definition.flavorLine),
              battleText:
                safeFlavor(definition.skill.battleText) ?? defaultSkillBattleText(definition.skill),
            })
          } else {
            const reference = build.extensions.resonance!
            const definition =
              authority.catalogVersion === 3
                ? await resolver?.resolvePinnedResonanceDefinition?.(
                    primary,
                    secondary,
                    reference.resonanceId,
                    reference.contentVersion,
                  )
                : resolveResonanceForPair(primary, secondary, reference.contentVersion)
            if (
              !definition?.enabled ||
              definition.id !== reference.resonanceId ||
              definition.contentVersion !== reference.contentVersion ||
              definition.disciplinePair[0] !== reference.disciplinePair[0] ||
              definition.disciplinePair[1] !== reference.disciplinePair[1]
            )
              continue
            contexts.set(key, {
              family,
              contentId: definition.id,
              skillId: definition.id,
              contentVersion: definition.contentVersion,
              name: definition.name,
              description: definition.description,
              flavor: safeFlavor(definition.flavorLine),
            })
          }
        } catch {
          // Optional presentation content never prevents access to authorized recorded outcomes.
        }
      }
    }),
  )
  return {
    ...view,
    entries: view.entries.map((entry) => {
      const key = keys.get(entry)
      const actionContext = key ? contexts.get(key) : undefined
      return actionContext ? { ...entry, actionContext } : entry
    }),
  }
}

/** Visible spawn receipts pin ability names/text even after a summon is removed from live state. */
async function attachRecordedSummonSkillContext(
  view: BattleLogView,
  projected: readonly BattleEventRecord[],
  authority: BattleBuildAuthoritySnapshot,
  resolver?: ContextResolver,
): Promise<BattleLogView> {
  const sources = new Map<
    string,
    { record: BattleEventRecord; skillId: string; version: number; profileId: string }
  >()
  for (const record of projected) {
    const event = eventObject(record)
    if (
      event?.event !== 'summon_spawned' ||
      typeof event.combatantId !== 'string' ||
      typeof event.sourceSkillId !== 'string' ||
      typeof event.sourceSkillVersion !== 'number' ||
      typeof event.profileId !== 'string'
    )
      continue
    sources.set(event.combatantId, {
      record,
      skillId: event.sourceSkillId,
      version: event.sourceSkillVersion,
      profileId: event.profileId,
    })
  }
  const contexts = new Map<string, SkillContext>()
  const activeSources = new Set(
    view.entries.filter((entry) => entry.actionId).map((entry) => entry.actorCombatantId),
  )
  const pending = [...sources.entries()].filter(([id]) => activeSources.has(id))
  let nextIndex = 0
  await Promise.all(
    Array.from({ length: Math.min(4, pending.length) }, async () => {
      while (nextIndex < pending.length) {
        const [id, source] = pending[nextIndex++]!
        try {
          const definition =
            authority.catalogVersion === 3
              ? await resolver?.resolvePinnedSkillDefinition(source.skillId, source.version)
              : resolveMatureSkillVersion(source.skillId, source.version)
          if (
            !definition?.enabled ||
            definition.id !== source.skillId ||
            definition.contentVersion !== source.version ||
            definition.summonProfile?.id !== source.profileId
          )
            continue
          for (const ability of definition.summonProfile.abilities)
            contexts.set(`${id}:${ability.id}`, {
              family: 'skill',
              skillId: ability.id,
              contentId: ability.id,
              contentVersion: source.version,
              name: ability.name,
              description: ability.description,
              flavor: null,
              battleText: safeFlavor(ability.battleText) ?? defaultSkillBattleText(ability),
              narrator: { actor: { name: definition.summonProfile.name } },
            })
        } catch {
          /* Optional pinned prose must not block recorded outcomes. */
        }
      }
    }),
  )
  return {
    ...view,
    entries: view.entries.map((entry) => {
      const source = entry.actorCombatantId ? sources.get(entry.actorCombatantId) : undefined
      const context = contexts.get(`${entry.actorCombatantId}:${entry.actionId}`)
      const target = entry.targetCombatantId
        ? authority.combatants.find((build) => build.combatantId === entry.targetCombatantId)
            ?.narratorIdentity
        : undefined
      return source && context && precedes(source.record, entry)
        ? {
            ...entry,
            actionContext: {
              ...context,
              narrator: { ...context.narrator!, ...(target ? { target: { ...target } } : {}) },
            },
          }
        : entry
    }),
  }
}
