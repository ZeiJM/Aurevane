import {
  disciplineSkillCapacity,
  type DisciplineSkillReference,
} from '../character/discipline-skill-loadout'
import type { EssenceSnapshotReference } from './essence'
import type { ResonanceSnapshotReference } from './resonance'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

export const COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION = 1 as const
export const COMBAT_BUILD_BRIDGE_SCHEMA_VERSION = 1 as const

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
const COMBATANT_ID_PATTERN = /^[A-Za-z0-9]+(?:[.:_-][A-Za-z0-9]+)*$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/

export interface CombatBuildSnapshot {
  readonly schemaVersion: typeof COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION
  readonly sourceBuildSchemaVersion: number
  readonly sourceBuildVersion: number
  readonly fingerprint: string
  readonly primary: {
    readonly disciplineId: string
    readonly definitionVersion: number
    readonly profileVersion: number
  }
  readonly secondary: {
    readonly disciplineId: string
    readonly definitionVersion: number
  } | null
  readonly disciplineSkills: readonly (DisciplineSkillReference & { readonly slotIndex: number })[]
  readonly extensions: {
    readonly resonance: ResonanceSnapshotReference | null
    readonly essence: EssenceSnapshotReference | null
    readonly equipmentSkills: readonly never[]
    readonly supernatural: null
    readonly prestige: null
  }
}

export interface CombatBuildBridgeEntry {
  readonly combatantId: string
  readonly characterId: string
  readonly snapshot: CombatBuildSnapshot
}

export interface CombatBuildBridgeState {
  readonly schemaVersion: typeof COMBAT_BUILD_BRIDGE_SCHEMA_VERSION
  readonly combatants: readonly CombatBuildBridgeEntry[]
}

export type CombatBuildSnapshottedEncounterState = StatDrivenCombatEncounterState & {
  readonly buildBridge: CombatBuildBridgeState
}

export interface CombatBuildSnapshotIssue {
  readonly field: string
  readonly message: string
}

export function validateCombatBuildSnapshot(
  snapshot: CombatBuildSnapshot,
): readonly CombatBuildSnapshotIssue[] {
  const issues: CombatBuildSnapshotIssue[] = []
  if (snapshot.schemaVersion !== COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION) {
    issues.push({ field: 'schemaVersion', message: 'Unsupported combat build snapshot schema.' })
    return issues
  }
  positiveIntegerIssue(issues, snapshot.sourceBuildSchemaVersion, 'sourceBuildSchemaVersion')
  positiveIntegerIssue(issues, snapshot.sourceBuildVersion, 'sourceBuildVersion')
  if (!SHA256_PATTERN.test(snapshot.fingerprint)) {
    issues.push({ field: 'fingerprint', message: 'Combat build fingerprint must be SHA-256.' })
  }

  stableIdIssue(issues, snapshot.primary.disciplineId, 'primary.disciplineId')
  positiveIntegerIssue(issues, snapshot.primary.definitionVersion, 'primary.definitionVersion')
  positiveIntegerIssue(issues, snapshot.primary.profileVersion, 'primary.profileVersion')

  const secondaryId = snapshot.secondary?.disciplineId ?? null
  if (snapshot.secondary) {
    stableIdIssue(issues, snapshot.secondary.disciplineId, 'secondary.disciplineId')
    positiveIntegerIssue(
      issues,
      snapshot.secondary.definitionVersion,
      'secondary.definitionVersion',
    )
    if (snapshot.secondary.disciplineId === snapshot.primary.disciplineId) {
      issues.push({
        field: 'secondary.disciplineId',
        message: 'Primary and Secondary Discipline must differ.',
      })
    }
  }

  if (snapshot.disciplineSkills.length > disciplineSkillCapacity(secondaryId)) {
    issues.push({
      field: 'disciplineSkills',
      message: 'Combat build snapshot exceeds Discipline Skill capacity.',
    })
  }
  const allowedSources = new Set(
    secondaryId === null
      ? [snapshot.primary.disciplineId]
      : [snapshot.primary.disciplineId, secondaryId],
  )
  const seenSkills = new Set<string>()
  const seenSlots = new Set<number>()
  for (const [index, skill] of snapshot.disciplineSkills.entries()) {
    const prefix = `disciplineSkills.${index}`
    stableIdIssue(issues, skill.skillId, `${prefix}.skillId`)
    stableIdIssue(issues, skill.sourceDisciplineId, `${prefix}.sourceDisciplineId`)
    positiveIntegerIssue(issues, skill.contentVersion, `${prefix}.contentVersion`)
    positiveIntegerIssue(issues, skill.slotIndex, `${prefix}.slotIndex`)
    if (!allowedSources.has(skill.sourceDisciplineId)) {
      issues.push({
        field: `${prefix}.sourceDisciplineId`,
        message: 'Combat Skill source is not an active Discipline.',
      })
    }
    if (seenSkills.has(skill.skillId)) {
      issues.push({ field: `${prefix}.skillId`, message: 'Combat Skills must be unique.' })
    }
    if (seenSlots.has(skill.slotIndex)) {
      issues.push({ field: `${prefix}.slotIndex`, message: 'Combat Skill slots must be unique.' })
    }
    seenSkills.add(skill.skillId)
    seenSlots.add(skill.slotIndex)
  }

  if (secondaryId === null && snapshot.extensions.resonance !== null) {
    issues.push({ field: 'extensions.resonance', message: 'Pure builds cannot carry Resonance.' })
  }
  if (secondaryId !== null && snapshot.extensions.essence !== null) {
    issues.push({ field: 'extensions.essence', message: 'Mixed builds cannot carry Essence.' })
  }
  if (snapshot.extensions.resonance) {
    const resonance = snapshot.extensions.resonance
    stableIdIssue(issues, resonance.resonanceId, 'extensions.resonance.resonanceId')
    positiveIntegerIssue(issues, resonance.contentVersion, 'extensions.resonance.contentVersion')
    if (
      resonance.disciplinePair.length !== 2 ||
      !resonance.disciplinePair.includes(snapshot.primary.disciplineId) ||
      secondaryId === null ||
      !resonance.disciplinePair.includes(secondaryId)
    ) {
      issues.push({
        field: 'extensions.resonance.disciplinePair',
        message: 'Resonance pair must match the committed Primary and Secondary.',
      })
    }
  }
  if (snapshot.extensions.essence) {
    const essence = snapshot.extensions.essence
    stableIdIssue(issues, essence.essenceId, 'extensions.essence.essenceId')
    stableIdIssue(issues, essence.sourceDisciplineId, 'extensions.essence.sourceDisciplineId')
    stableIdIssue(issues, essence.skillId, 'extensions.essence.skillId')
    positiveIntegerIssue(issues, essence.contentVersion, 'extensions.essence.contentVersion')
    positiveIntegerIssue(
      issues,
      essence.skillContentVersion,
      'extensions.essence.skillContentVersion',
    )
    if (essence.sourceDisciplineId !== snapshot.primary.disciplineId) {
      issues.push({
        field: 'extensions.essence.sourceDisciplineId',
        message: 'Essence source must match the committed Primary Discipline.',
      })
    }
  }
  if (snapshot.extensions.equipmentSkills.length !== 0) {
    issues.push({
      field: 'extensions.equipmentSkills',
      message: 'Equipment Skill snapshots are not supported by the current build bridge.',
    })
  }
  if (snapshot.extensions.supernatural !== null || snapshot.extensions.prestige !== null) {
    issues.push({
      field: 'extensions',
      message: 'Deferred supernatural/prestige build extensions must remain empty.',
    })
  }

  return issues
}

export function attachCombatBuildBridge(
  state: StatDrivenCombatEncounterState,
  entries: readonly CombatBuildBridgeEntry[],
): CombatBuildSnapshottedEncounterState {
  const bridge: CombatBuildBridgeState = {
    schemaVersion: COMBAT_BUILD_BRIDGE_SCHEMA_VERSION,
    combatants: entries
      .map(copyEntry)
      .sort((left, right) => left.combatantId.localeCompare(right.combatantId)),
  }
  const next = { ...state, buildBridge: bridge }
  const issues = validateCombatBuildBridge(next, true)
  if (issues.length > 0) {
    throw new TypeError(`Invalid combat build bridge: ${issues[0]?.field} ${issues[0]?.message}`)
  }
  return next
}

export function validateCombatBuildBridge(
  state: StatDrivenCombatEncounterState & { readonly buildBridge?: unknown },
  required = false,
): readonly CombatBuildSnapshotIssue[] {
  if (state.buildBridge === undefined) {
    return required ? [{ field: 'buildBridge', message: 'Combat build bridge is required.' }] : []
  }
  if (!isBridge(state.buildBridge)) {
    return [{ field: 'buildBridge', message: 'Combat build bridge shape is invalid.' }]
  }
  const issues: CombatBuildSnapshotIssue[] = []
  if (state.buildBridge.schemaVersion !== COMBAT_BUILD_BRIDGE_SCHEMA_VERSION) {
    return [
      { field: 'buildBridge.schemaVersion', message: 'Unsupported combat build bridge schema.' },
    ]
  }

  const combatantIds = new Set(state.tactical.battle.combatants.map((combatant) => combatant.id))
  const seenCombatants = new Set<string>()
  const seenCharacters = new Set<string>()
  for (const [index, entry] of state.buildBridge.combatants.entries()) {
    const prefix = `buildBridge.combatants.${index}`
    if (!COMBATANT_ID_PATTERN.test(entry.combatantId)) {
      issues.push({ field: `${prefix}.combatantId`, message: 'Invalid combatant ID.' })
    }
    if (!UUID_PATTERN.test(entry.characterId)) {
      issues.push({ field: `${prefix}.characterId`, message: 'Invalid character ID.' })
    }
    if (!combatantIds.has(entry.combatantId)) {
      issues.push({
        field: `${prefix}.combatantId`,
        message: 'Build snapshot combatant is absent.',
      })
    }
    if (seenCombatants.has(entry.combatantId)) {
      issues.push({
        field: `${prefix}.combatantId`,
        message: 'Build snapshot combatants must be unique.',
      })
    }
    if (seenCharacters.has(entry.characterId)) {
      issues.push({
        field: `${prefix}.characterId`,
        message: 'Build snapshot characters must be unique.',
      })
    }
    for (const issue of validateCombatBuildSnapshot(entry.snapshot)) {
      issues.push({ field: `${prefix}.snapshot.${issue.field}`, message: issue.message })
    }
    seenCombatants.add(entry.combatantId)
    seenCharacters.add(entry.characterId)
  }
  return issues
}

export function readCombatBuildSnapshot(
  state: StatDrivenCombatEncounterState & { readonly buildBridge?: unknown },
  combatantId: string,
): CombatBuildSnapshot | null {
  if (!isBridge(state.buildBridge)) return null
  return (
    state.buildBridge.combatants.find((entry) => entry.combatantId === combatantId)?.snapshot ??
    null
  )
}

function copyEntry(entry: CombatBuildBridgeEntry): CombatBuildBridgeEntry {
  return {
    combatantId: entry.combatantId,
    characterId: entry.characterId,
    snapshot: {
      ...entry.snapshot,
      primary: { ...entry.snapshot.primary },
      secondary: entry.snapshot.secondary ? { ...entry.snapshot.secondary } : null,
      disciplineSkills: entry.snapshot.disciplineSkills.map((skill) => ({ ...skill })),
      extensions: {
        resonance: entry.snapshot.extensions.resonance
          ? {
              ...entry.snapshot.extensions.resonance,
              disciplinePair: [...entry.snapshot.extensions.resonance.disciplinePair] as [
                string,
                string,
              ],
            }
          : null,
        essence: entry.snapshot.extensions.essence
          ? { ...entry.snapshot.extensions.essence }
          : null,
        equipmentSkills: [],
        supernatural: null,
        prestige: null,
      },
    },
  }
}

function isBridge(value: unknown): value is CombatBuildBridgeState {
  if (!isRecord(value)) return false
  if (!Number.isSafeInteger(value.schemaVersion) || !Array.isArray(value.combatants)) return false
  return value.combatants.every((entry) => {
    if (!isRecord(entry)) return false
    return (
      typeof entry.combatantId === 'string' &&
      typeof entry.characterId === 'string' &&
      isSnapshotShape(entry.snapshot)
    )
  })
}

function isSnapshotShape(value: unknown): value is CombatBuildSnapshot {
  if (!isRecord(value) || !isRecord(value.primary) || !isRecord(value.extensions)) return false
  if (
    typeof value.schemaVersion !== 'number' ||
    typeof value.sourceBuildSchemaVersion !== 'number' ||
    typeof value.sourceBuildVersion !== 'number' ||
    typeof value.fingerprint !== 'string' ||
    typeof value.primary.disciplineId !== 'string' ||
    typeof value.primary.definitionVersion !== 'number' ||
    typeof value.primary.profileVersion !== 'number' ||
    !Array.isArray(value.disciplineSkills) ||
    !Array.isArray(value.extensions.equipmentSkills)
  ) {
    return false
  }
  if (
    value.extensions.supernatural !== null ||
    value.extensions.prestige !== null ||
    !value.disciplineSkills.every(isSkillShape)
  ) {
    return false
  }
  if (value.secondary !== null && !isSecondaryShape(value.secondary)) return false
  if (value.extensions.resonance !== null && !isResonanceShape(value.extensions.resonance))
    return false
  if (value.extensions.essence !== null && !isEssenceShape(value.extensions.essence)) return false
  return true
}

function isSkillShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.slotIndex === 'number' &&
    typeof value.skillId === 'string' &&
    typeof value.contentVersion === 'number' &&
    typeof value.sourceDisciplineId === 'string'
  )
}

function isSecondaryShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.disciplineId === 'string' &&
    typeof value.definitionVersion === 'number'
  )
}

function isResonanceShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.resonanceId === 'string' &&
    typeof value.contentVersion === 'number' &&
    Array.isArray(value.disciplinePair) &&
    value.disciplinePair.length === 2 &&
    value.disciplinePair.every((disciplineId) => typeof disciplineId === 'string')
  )
}

function isEssenceShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.essenceId === 'string' &&
    typeof value.contentVersion === 'number' &&
    typeof value.sourceDisciplineId === 'string' &&
    typeof value.skillId === 'string' &&
    typeof value.skillContentVersion === 'number'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stableIdIssue(issues: CombatBuildSnapshotIssue[], value: string, field: string): void {
  if (!STABLE_ID_PATTERN.test(value)) issues.push({ field, message: 'Invalid stable content ID.' })
}

function positiveIntegerIssue(
  issues: CombatBuildSnapshotIssue[],
  value: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    issues.push({ field, message: 'Expected a positive safe integer.' })
  }
}
