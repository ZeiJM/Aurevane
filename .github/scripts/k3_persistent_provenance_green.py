from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one replacement target, found {count}")
    file.write_text(text.replace(old, new))


replace_once(
    "packages/game-core/src/combat/combat-effect-state.ts",
    """import type { CombatStatusDefinition } from './actions'\nimport type { CombatEffectCategory } from './combat-effect-categories'\n""",
    """import type { CombatStatusDefinition } from './actions'\nimport type { CombatEffectCategory } from './combat-effect-categories'\nimport type { CombatEffectInstanceProvenance } from './combat-kernel-types'\n""",
)

for interface_body in [
    """export interface CombatOngoingRecovery {\n  kind: 'hp' | 'mp'\n  sourceCombatantId: string\n  targetCombatantId: string\n  sourceActionId: string\n  amountPerTick: number\n  remainingFutureTicks: number\n}\n""",
    """export interface CombatPoisonInstance {\n  targetCombatantId: string\n  sourceCombatantId: string\n  sourceActionId: string\n  profileVersion: number\n  movementRemainder: number\n}\n""",
    """export interface CombatBleedStack {\n  targetCombatantId: string\n  sourceCombatantId: string\n  sourceActionId: string\n  damagePerTick: number\n  remainingTicks: number\n  applicationOrder: number\n}\n""",
    """export interface CombatBurnInstance {\n  targetCombatantId: string\n  sourceCombatantId: string\n  sourceActionId: string\n  profileVersion: number\n  stage: number\n}\n""",
]:
    insert_at = interface_body.rfind("}\n")
    enriched = interface_body[:insert_at] + "  provenance?: CombatEffectInstanceProvenance\n" + interface_body[insert_at:]
    replace_once("packages/game-core/src/combat/combat-effect-state.ts", interface_body, enriched)

replace_once(
    "packages/game-core/src/combat/actions-legacy.ts",
    """import type { CombatEffectState } from './combat-effect-state'\n""",
    """import type { CombatEffectState } from './combat-effect-state'\nimport {\n  validateCombatEffectInstanceProvenance,\n  type CombatEffectInstanceProvenance,\n} from './combat-kernel-types'\n""",
)

replace_once(
    "packages/game-core/src/combat/actions-legacy.ts",
    """export interface CombatStatusInstance {\n  statusId: string\n  statusVersion: number\n  stacks: number\n  remainingOwnerTurnStarts: number\n  sourceCombatantId: string\n}\n""",
    """export interface CombatStatusInstance {\n  statusId: string\n  statusVersion: number\n  stacks: number\n  remainingOwnerTurnStarts: number\n  sourceCombatantId: string\n  provenance?: CombatEffectInstanceProvenance\n}\n""",
)

replace_once(
    "packages/game-core/src/combat/actions-legacy.ts",
    """  const issues: CombatEncounterIssue[] = [\n    ...validateTerrainOverlays(state),\n    ...validateOngoingRecoveryState(state),\n    ...validateCombatDotState(state),\n  ]\n\n  if (state.schemaVersion !== COMBAT_ENCOUNTER_SCHEMA_VERSION) {\n""",
    """  const issues: CombatEncounterIssue[] = [\n    ...validateTerrainOverlays(state),\n    ...validateOngoingRecoveryState(state),\n    ...validateCombatDotState(state),\n  ]\n  collectPersistentProvenanceIssues(state, issues)\n\n  if (state.schemaVersion !== COMBAT_ENCOUNTER_SCHEMA_VERSION) {\n""",
)

replace_once(
    "packages/game-core/src/combat/actions-legacy.ts",
    """  return issues\n}\n\nfunction resolvePrimaryTarget(\n""",
    """  return issues\n}\n\nfunction collectPersistentProvenanceIssues(\n  state: CombatEncounterState,\n  issues: CombatEncounterIssue[],\n): void {\n  const collect = (value: unknown, field: string) => {\n    if (value === undefined) return\n    for (const message of validateCombatEffectInstanceProvenance(value)) {\n      issues.push({ field, message })\n    }\n  }\n\n  for (const [rowIndex, row] of state.statusState.entries()) {\n    for (const [statusIndex, status] of row.statuses.entries()) {\n      collect(status.provenance, `statusState.${rowIndex}.statuses.${statusIndex}.provenance`)\n    }\n  }\n\n  const effectState = state.effectState as unknown as Record<string, unknown> | undefined\n  if (!effectState || typeof effectState !== 'object' || Array.isArray(effectState)) return\n\n  const collections: readonly (readonly [string, unknown])[] = [\n    ['ongoingRecovery', effectState.ongoingRecovery],\n    ['poison', effectState.poison],\n    ['bleed', effectState.bleed],\n    ['burn', effectState.burn],\n  ]\n  for (const [name, rows] of collections) {\n    if (!Array.isArray(rows)) continue\n    rows.forEach((row, index) => {\n      if (!row || typeof row !== 'object' || Array.isArray(row)) return\n      collect(\n        (row as { provenance?: unknown }).provenance,\n        `effectState.${name}.${index}.provenance`,\n      )\n    })\n  }\n}\n\nfunction resolvePrimaryTarget(\n""",
)
