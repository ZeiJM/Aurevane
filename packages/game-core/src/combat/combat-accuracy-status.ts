import type {
  CombatContentCatalog,
  CombatEncounterIssue,
  CombatEncounterState,
  CombatStatusDefinition,
  CombatStatusInstance,
} from './actions'

/** Pure accuracy statuses deliberately cannot duplicate other per-source status behavior. */
export function validateCombatAccuracyStatusDefinition(status: CombatStatusDefinition): void {
  const mark = status.markAccuracyBonusBasisPoints
  const blind = status.blindAccuracyPenaltyBasisPoints
  if (mark === undefined && blind === undefined) return
  for (const amount of [mark, blind]) {
    if (amount !== undefined && (!Number.isSafeInteger(amount) || amount < 1 || amount > 3_000)) {
      throw new RangeError(
        'Mark and Blind magnitude must be an integer from 1 to 3000 basis points.',
      )
    }
  }
  if (
    (mark !== undefined && blind !== undefined) ||
    status.polarity !== 'negative' ||
    status.reactionClass !== 'ordinary' ||
    status.maximumStacks !== 1 ||
    status.damageTakenMultiplierBasisPoints !== 10_000 ||
    (status.damageModifiers?.length ?? 0) > 0 ||
    status.endOfTurn !== undefined ||
    status.nextRoundInitiative !== undefined ||
    status.movement !== undefined ||
    status.absorbHpBasisPoints !== undefined ||
    status.absorbMpBasisPoints !== undefined ||
    status.reflectBasisPoints !== undefined
  ) {
    throw new TypeError(
      'Mark and Blind must be separate single-stack, negative, ordinary accuracy statuses.',
    )
  }
}

function compareIdentity(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function compareCombatStatusInstances(
  left: CombatStatusInstance,
  right: CombatStatusInstance,
): number {
  return (
    compareIdentity(left.statusId, right.statusId) ||
    compareIdentity(left.sourceCombatantId, right.sourceCombatantId)
  )
}

/** Historical statuses retain their unique ID. Only explicit current Marks permit source pairs. */
export function collectCombatStatusIdentityIssues(
  statuses: readonly CombatStatusInstance[],
  prefix: string,
): readonly CombatEncounterIssue[] {
  const issues: CombatEncounterIssue[] = []
  const seen = new Set<string>()
  const firstById = new Map<string, CombatStatusInstance>()
  for (const [index, status] of statuses.entries()) {
    const field = `${prefix}.${index}.statusId`
    const first = firstById.get(status.statusId)
    if (status.sourceScopedMark !== undefined && status.sourceScopedMark !== true) {
      issues.push({ field, message: 'Source-scoped Mark marker must be true when supplied.' })
    }
    if (status.sourceScopedMark === true && status.stacks !== 1) {
      issues.push({ field, message: 'Source-scoped Mark cannot stack.' })
    }
    if (
      first &&
      (first.sourceScopedMark !== true ||
        status.sourceScopedMark !== true ||
        first.statusVersion !== status.statusVersion)
    ) {
      issues.push({
        field,
        message: 'Only source-scoped Marks of one pinned version may share a status ID.',
      })
    }
    const identity = JSON.stringify([
      status.statusId,
      status.sourceScopedMark === true ? status.sourceCombatantId : null,
    ])
    if (seen.has(identity)) {
      issues.push({ field, message: 'A combatant cannot have duplicate status identities.' })
    }
    seen.add(identity)
    firstById.set(status.statusId, first ?? status)
    const previous = statuses[index - 1]
    if (previous && compareCombatStatusInstances(previous, status) > 0) {
      issues.push({
        field: prefix,
        message: 'Statuses must use stable status ID and source ordering.',
      })
    }
  }
  return issues
}

/** Catalog-bound checks are limited to the new metadata; historical snapshot rules stay intact. */
export function assertValidCombatAccuracyStatusState(
  state: CombatEncounterState,
  content: CombatContentCatalog,
): void {
  const definitions = new Map(content.statuses.map((status) => [status.id, status]))
  for (const row of state.statusState) {
    for (const status of row.statuses) {
      const definition = definitions.get(status.statusId)
      const isMark = definition?.markAccuracyBonusBasisPoints !== undefined
      const isBlind = definition?.blindAccuracyPenaltyBasisPoints !== undefined
      if (!isMark && !isBlind && status.sourceScopedMark === undefined) continue
      if (
        !definition ||
        (status.sourceScopedMark === true) !== isMark ||
        status.statusVersion !== definition.version ||
        status.stacks !== 1 ||
        status.remainingOwnerTurnStarts > definition.durationOwnerTurnStarts
      ) {
        throw new TypeError(
          'Current accuracy status must match its pinned definition, source scope, stack and duration.',
        )
      }
    }
  }
}

/** Non-stacking magnitudes: only the strongest eligible Mark and strongest Blind contribute. */
export function combatAccuracyStatusModifier(
  state: CombatEncounterState,
  actorId: string,
  targetId: string,
  content: CombatContentCatalog,
): number {
  let mark = 0
  let blind = 0
  for (const row of state.statusState) {
    if (row.combatantId !== actorId && row.combatantId !== targetId) continue
    for (const status of row.statuses) {
      const definition = content.statuses.find(
        (candidate) =>
          candidate.id === status.statusId && candidate.version === status.statusVersion,
      )
      if (row.combatantId === actorId) {
        blind = Math.max(blind, definition?.blindAccuracyPenaltyBasisPoints ?? 0)
      }
      if (
        row.combatantId === targetId &&
        status.sourceScopedMark === true &&
        status.sourceCombatantId === actorId
      ) {
        mark = Math.max(mark, definition?.markAccuracyBonusBasisPoints ?? 0)
      }
    }
  }
  return mark - blind
}
