import 'server-only'

import type { BattleEventRecord } from '@aurevane/db/battle-session'
import { parseCopiedSkillCommandId } from '@aurevane/game-core/combat/combat-skill-copy'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import {
  skillDisplayName,
  skillEffectDescription,
} from '../../components/character/skill-detail-presentation'
import type { CombatContentResolver } from '../combat/combat-content-resolver'
import type { BattleBuildAuthoritySnapshot } from './battle-build-authority'
import type { BattleLogEntry, BattleLogView } from './battle-log-service'

type SkillReference = { skillId: string; contentVersion: number; sourceDisciplineId?: string }
type SkillContext = NonNullable<BattleLogEntry['actionContext']>

function eventObject(record: BattleEventRecord): Record<string, unknown> | null {
  return record.event && typeof record.event === 'object' && !Array.isArray(record.event)
    ? (record.event as Record<string, unknown>)
    : null
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

function precedes(grant: BattleEventRecord, record: BattleEventRecord): boolean {
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
  resolver?: Pick<CombatContentResolver, 'resolvePinnedSkillDefinition'>,
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
    const copied =
      typeof event.actionId === 'string' ? parseCopiedSkillCommandId(event.actionId) : null
    if (grant) {
      reference = grant.reference
    } else if (copied) {
      const provenance = visibleGrants.get(`${entry.actorCombatantId}:${referenceKey(copied)}`)
      if (provenance && precedes(provenance, record)) reference = copied
    } else if (event.actionId === entry.actionId) {
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
            skillId: definition.id,
            contentVersion: definition.contentVersion,
            name: skillDisplayName(definition),
            description: definition.effects
              .map(
                (effect, index) =>
                  definition.effectDescriptions?.[index] ?? skillEffectDescription(effect),
              )
              .join(' '),
            flavor: definition.flavorLine ?? null,
          })
          sourceDisciplines.set(referenceKey(reference), definition.sourceDisciplineId)
        } catch {
          // Optional historical copy must not make recorded authoritative results unavailable.
        }
      }
    }),
  )

  return {
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
}
