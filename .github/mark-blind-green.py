from pathlib import Path

ROOT = Path('packages/game-core/src/combat')
def replace(path, old, new, count=1):
    p = ROOT / path
    s = p.read_text()
    assert s.count(old) == count, (path, repr(old), s.count(old))
    p.write_text(s.replace(old, new))

def create(path, text):
    p = ROOT / path
    assert not p.exists(), path
    p.write_text(text)

create('combat-accuracy-status.ts', '''import type {
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
      throw new RangeError('Mark and Blind magnitude must be an integer from 1 to 3000 basis points.')
    }
  }
  if (
    (mark !== undefined && blind !== undefined) ||
    status.polarity !== 'negative' || status.reactionClass !== 'ordinary' ||
    status.maximumStacks !== 1 || status.damageTakenMultiplierBasisPoints !== 10_000 ||
    (status.damageModifiers?.length ?? 0) > 0 || status.endOfTurn !== undefined ||
    status.nextRoundInitiative !== undefined || status.movement !== undefined ||
    status.absorbHpBasisPoints !== undefined || status.absorbMpBasisPoints !== undefined ||
    status.reflectBasisPoints !== undefined
  ) {
    throw new TypeError('Mark and Blind must be separate single-stack, negative, ordinary accuracy statuses.')
  }
}

function compareIdentity(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function compareCombatStatusInstances(left: CombatStatusInstance, right: CombatStatusInstance): number {
  return compareIdentity(left.statusId, right.statusId) ||
    compareIdentity(left.sourceCombatantId, right.sourceCombatantId)
}

/** Historical statuses retain their unique ID. Only explicit current Marks permit source pairs. */
export function collectCombatStatusIdentityIssues(
  statuses: readonly CombatStatusInstance[], prefix: string,
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
    if (first && (first.sourceScopedMark !== true || status.sourceScopedMark !== true ||
      first.statusVersion !== status.statusVersion)) {
      issues.push({ field, message: 'Only source-scoped Marks of one pinned version may share a status ID.' })
    }
    const identity = JSON.stringify([status.statusId,
      status.sourceScopedMark === true ? status.sourceCombatantId : null])
    if (seen.has(identity)) {
      issues.push({ field, message: 'A combatant cannot have duplicate status identities.' })
    }
    seen.add(identity)
    firstById.set(status.statusId, first ?? status)
    const previous = statuses[index - 1]
    if (previous && compareCombatStatusInstances(previous, status) > 0) {
      issues.push({ field: prefix, message: 'Statuses must use stable status ID and source ordering.' })
    }
  }
  return issues
}

/** Catalog-bound checks are limited to the new metadata; historical snapshot rules stay intact. */
export function assertValidCombatAccuracyStatusState(
  state: CombatEncounterState, content: CombatContentCatalog,
): void {
  const definitions = new Map(content.statuses.map((status) => [status.id, status]))
  for (const row of state.statusState) {
    for (const status of row.statuses) {
      const definition = definitions.get(status.statusId)
      const isMark = definition?.markAccuracyBonusBasisPoints !== undefined
      const isBlind = definition?.blindAccuracyPenaltyBasisPoints !== undefined
      if (!isMark && !isBlind && status.sourceScopedMark === undefined) continue
      if (!definition || (status.sourceScopedMark === true) !== isMark ||
        status.statusVersion !== definition.version || status.stacks !== 1 ||
        status.remainingOwnerTurnStarts > definition.durationOwnerTurnStarts) {
        throw new TypeError('Current accuracy status must match its pinned definition, source scope, stack and duration.')
      }
    }
  }
}

/** Non-stacking magnitudes: only the strongest eligible Mark and strongest Blind contribute. */
export function combatAccuracyStatusModifier(
  state: CombatEncounterState, actorId: string, targetId: string, content: CombatContentCatalog,
): number {
  let mark = 0
  let blind = 0
  for (const row of state.statusState) {
    if (row.combatantId !== actorId && row.combatantId !== targetId) continue
    for (const status of row.statuses) {
      const definition = content.statuses.find((candidate) =>
        candidate.id === status.statusId && candidate.version === status.statusVersion)
      if (row.combatantId === actorId) {
        blind = Math.max(blind, definition?.blindAccuracyPenaltyBasisPoints ?? 0)
      }
      if (row.combatantId === targetId && status.sourceScopedMark === true && status.sourceCombatantId === actorId) {
        mark = Math.max(mark, definition?.markAccuracyBonusBasisPoints ?? 0)
      }
    }
  }
  return mark - blind
}
''')

replace('combat-effect-state.ts', '    reflectBasisPoints?: number\n', '    reflectBasisPoints?: number\n    markAccuracyBonusBasisPoints?: number\n    blindAccuracyPenaltyBasisPoints?: number\n')
replace('combat-authoring-validation.ts', "import type {", "import { validateCombatAccuracyStatusDefinition } from './combat-accuracy-status'\nimport type {", count=1)
# Function signature may wrap. Anchor the first known body validation instead of its formatting.
p = ROOT / 'combat-authoring-validation.ts'
s = p.read_text()
start = s.index('export function validateCombatStatusDefinition(')
body = s.index('): void {', start) + len('): void {')
s = s[:body] + '\n  validateCombatAccuracyStatusDefinition(status)' + s[body:]
p.write_text(s)

p = ROOT / 'actions-legacy.ts'
s = p.read_text()
s = "import { assertValidCombatAccuracyStatusState, collectCombatStatusIdentityIssues, compareCombatStatusInstances, validateCombatAccuracyStatusDefinition } from './combat-accuracy-status'\n" + s
p.write_text(s)
replace('actions-legacy.ts', 'export interface CombatStatusInstance {\n', 'export interface CombatStatusInstance {\n  /** Only current accuracy Mark definitions use independent source/target identities. */\n  sourceScopedMark?: true\n')
replace('actions-legacy.ts', "  | { event: 'status_expired'; combatantId: string; statusId: string }", "  | { event: 'status_expired'; combatantId: string; statusId: string; sourceCombatantId?: string }")
replace('actions-legacy.ts', '.sort((left, right) => compareStableString(left.statusId, right.statusId))', '.sort(compareCombatStatusInstances)', count=2)
replace('actions-legacy.ts', '  validateCombatContentCatalog(content)\n', '  validateCombatContentCatalog(content)\n  assertValidCombatAccuracyStatusState(state, content)\n', count=3)
replace('actions-legacy.ts', '  for (const status of content.statuses) {\n', '  for (const status of content.statuses) {\n    validateCombatAccuracyStatusDefinition(status)\n')
replace('actions-legacy.ts', '    const statusIds = new Set<string>()\n', '    issues.push(...collectCombatStatusIdentityIssues(row.statuses, `${prefix}.statuses`))\n')
replace('actions-legacy.ts', '''      if (statusIds.has(status.statusId)) {
        issues.push({
          field: `${statusPrefix}.statusId`,
          message: 'A combatant cannot have duplicate status identities.',
        })
      }
      statusIds.add(status.statusId)
''', '')
replace('actions-legacy.ts', '''
    const sortedStatusIds = [...row.statuses]
      .map((status) => status.statusId)
      .sort(compareStableString)
    if (
      !arraysEqual(
        row.statuses.map((status) => status.statusId),
        sortedStatusIds,
      )
    ) {
      issues.push({
        field: `${prefix}.statuses`,
        message: 'Statuses must use stable status ID ordering.',
      })
    }
''', '\n')
replace('actions-legacy.ts', 'const existing = getStatus(state, recipientId, effect.statusId)', 'const existing = getStatus(state, recipientId, effect.statusId, actorId)')
replace('actions-legacy.ts', 'const status = getStatus(nextState, recipientId, effect.statusId)!', 'const status = getStatus(nextState, recipientId, effect.statusId, actorId)!')
replace('actions-legacy.ts', '''  const row = getStatusRow(state, recipientId)
  const existing = row.statuses.find((status) => status.statusId === statusId)
''', '''  const existing = getStatus(state, recipientId, statusId, sourceCombatantId)
''')
# Scope this edit to new-instance creation, not any other status/provenance structure.
replace('actions-legacy.ts', '''    : {
        statusId: definition.id,
        statusVersion: definition.version,
        stacks: nextStacks,''', '''    : {
        ...(definition.markAccuracyBonusBasisPoints !== undefined ? { sourceScopedMark: true as const } : {}),
        statusId: definition.id,
        statusVersion: definition.version,
        stacks: nextStacks,''')
replace('actions-legacy.ts', '...candidate.statuses.filter((status) => status.statusId !== statusId),', '...candidate.statuses.filter((status) => status !== existing),')
replace('actions-legacy.ts', "      events.push({ event: 'status_expired', combatantId, statusId: status.statusId })", "      events.push({ event: 'status_expired', combatantId, statusId: status.statusId,\n        ...(status.sourceScopedMark === true ? { sourceCombatantId: status.sourceCombatantId } : {}),\n      })")
replace('actions-legacy.ts', '''function getStatus(
  state: CombatEncounterState,
  combatantId: string,
  statusId: string,
): CombatStatusInstance | null {
  return (
    getStatusRow(state, combatantId).statuses.find((status) => status.statusId === statusId) ?? null
  )
}''', '''function getStatus(
  state: CombatEncounterState,
  combatantId: string,
  statusId: string,
  sourceCombatantId?: string,
): CombatStatusInstance | null {
  return (
    getStatusRow(state, combatantId).statuses.find((status) =>
      status.statusId === statusId && (status.sourceScopedMark !== true ||
        sourceCombatantId === undefined || status.sourceCombatantId === sourceCombatantId)) ?? null
  )
}''')
replace('combat-effect-provenance.ts', '            if (status.statusId !== effect.statusId) return status', '''            if (status.statusId !== effect.statusId ||
              (status.sourceScopedMark === true && status.sourceCombatantId !== actorId)) return status''')
replace('combat-skill-accuracy.ts', "import { advanceBattleRng } from './battle-state'", "import { advanceBattleRng } from './battle-state'\nimport { combatAccuracyStatusModifier } from './combat-accuracy-status'")
replace('combat-skill-accuracy.ts', '  CombatEncounterState,\n', '  CombatEncounterState,\n  CombatContentCatalog,\n')
replace('combat-skill-accuracy.ts', '  evaluation: CombatActionEvaluation,\n', '  evaluation: CombatActionEvaluation,\n  content: CombatContentCatalog,\n')
replace('combat-skill-accuracy.ts', '  evaluation: CombatActionEvaluation | null,\n', '  evaluation: CombatActionEvaluation | null,\n  content: CombatContentCatalog,\n')
replace('combat-skill-accuracy.ts', '              action.accuracyModifierBasisPoints ?? 0,', '              (action.accuracyModifierBasisPoints ?? 0) +\n                combatAccuracyStatusModifier(state, actorId, targetCombatantId, content),')
replace('combat-skill-accuracy.ts', 'forecastCombatSkillAccuracy(state, action, evaluation)', 'forecastCombatSkillAccuracy(state, action, evaluation, content)')
replace('actions.ts', 'forecastCombatSkillAccuracy(state, action, preview)', 'forecastCombatSkillAccuracy(state, action, preview, content)')
replace('actions.ts', 'rollCombatSkillAccuracy(state, action, evaluation)', 'rollCombatSkillAccuracy(state, action, evaluation, content)')
p = ROOT / 'stat-driven-combat.ts'
s = p.read_text()
p.write_text("import { combatAccuracyStatusModifier } from './combat-accuracy-status'\n" + s)
replace('stat-driven-combat.ts', 'hitChanceBasisPoints: calculateHitChanceBasisPoints(actor, target),', '''hitChanceBasisPoints: calculateHitChanceBasisPoints(actor, target,
      combatAccuracyStatusModifier(state, baseline.actorId, baseline.primaryCombatantId, content)),''')

p = Path('docs/COMBAT.md')
s = p.read_text()
p.write_text(s + '''

## Current Mark and Blind accuracy kernel (staged; not published)

Following the approved September 12 reactive-effects design, new status definitions may opt into
`markAccuracyBonusBasisPoints` or `blindAccuracyPenaltyBasisPoints`. The baseline is 1500 basis
points (15 percentage points); this first authoring policy accepts integer magnitudes from 1 to
3000. They are separate, single-stack, negative, ordinary accuracy statuses. Other status behaviors
must remain separate definitions so source-specific Mark instances cannot multiply unrelated effects.

Current Mark instances use optional `sourceScopedMark: true` in the existing status-state rows.
A source/target/definition relationship refreshes independently. Different sources coexist in stable
status-ID/source-ID order; ordinary historical status IDs remain unique. Catalog-bound validation
checks the marker, pinned version, stack count and remaining duration. Explicit removal by status ID
cleanses every matching source. Current Mark expiry receipts include the expiring source; historical
expiry event shapes are unchanged. K3 provenance refreshes only the applying source's Mark.

Skill and Basic Attack hit chance share the same additive adjustment: actor Accuracy minus target
Evasion, plus the Skill modifier and the actor's eligible Mark, minus the actor's Blind, then clamp
to 0–100%. Alternate definitions cannot stack magnitudes: use the strongest applicable Mark for
that source/target and the strongest Blind on the actor. Their independent remaining durations
are preserved; weaker effects may contribute after a stronger definition expires or is removed.
Mark does not benefit allies. A target being Blind does not reduce its attacker's accuracy.

Forecast and commit read the pre-command state. A Mark inflicted by a strike does not improve that
same strike's roll. Per-target hostile packages retain their single coherent hit/miss decision,
stable RNG ordering and ordinary costs. Automatic Hit remains automatic, and previews never sample
RNG. Basic Attack keeps its existing resolution path and consumes no second accuracy roll.

The published `marked` definition still uses historical source-only damage vulnerability. No live
catalog, battle schema, player-facing UI, AI policy, database or deployment is changed here. This is
kernel support only: full player forecasts, AI expected-value integration and controlled versioned
content publication remain separate gates. K4 and the wider overhaul remain unfinished.
''')
print('IMPLEMENTATION_RECIPE_APPLIED')
