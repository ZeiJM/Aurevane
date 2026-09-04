import {
  readCombatBuildSnapshot,
  validateCombatBuildSnapshot,
  type CombatBuildSnapshot,
} from './build-snapshot'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function parseSnapshot(value: unknown): CombatBuildSnapshot | null {
  if (!isRecord(value) || !isRecord(value.primary) || !isRecord(value.extensions)) return null
  if (
    value.snapshotSchemaVersion !== 1 ||
    !positiveInteger(value.buildSchemaVersion) ||
    !positiveInteger(value.buildVersion) ||
    typeof value.fingerprint !== 'string' ||
    typeof value.primary.disciplineId !== 'string' ||
    !positiveInteger(value.primary.definitionVersion) ||
    !positiveInteger(value.primary.profileVersion) ||
    !Array.isArray(value.disciplineSkills)
  ) {
    return null
  }

  let secondary: CombatBuildSnapshot['secondary'] = null
  if (value.secondary !== null) {
    if (
      !isRecord(value.secondary) ||
      typeof value.secondary.disciplineId !== 'string' ||
      !positiveInteger(value.secondary.definitionVersion)
    ) {
      return null
    }
    secondary = {
      disciplineId: value.secondary.disciplineId,
      definitionVersion: value.secondary.definitionVersion,
    }
  }

  const disciplineSkills: Array<CombatBuildSnapshot['disciplineSkills'][number]> = []
  for (const candidate of value.disciplineSkills) {
    if (
      !isRecord(candidate) ||
      !positiveInteger(candidate.slotIndex) ||
      typeof candidate.skillId !== 'string' ||
      !positiveInteger(candidate.contentVersion) ||
      typeof candidate.sourceDisciplineId !== 'string'
    ) {
      return null
    }
    disciplineSkills.push({
      slotIndex: candidate.slotIndex,
      skillId: candidate.skillId,
      contentVersion: candidate.contentVersion,
      sourceDisciplineId: candidate.sourceDisciplineId,
    })
  }

  const resonance = value.extensions.resonance
  const essence = value.extensions.essence
  const snapshot: CombatBuildSnapshot = {
    schemaVersion: 1,
    sourceBuildSchemaVersion: value.buildSchemaVersion,
    sourceBuildVersion: value.buildVersion,
    fingerprint: value.fingerprint,
    primary: {
      disciplineId: value.primary.disciplineId,
      definitionVersion: value.primary.definitionVersion,
      profileVersion: value.primary.profileVersion,
    },
    secondary,
    disciplineSkills: disciplineSkills.sort((left, right) => left.slotIndex - right.slotIndex),
    extensions: {
      resonance:
        resonance === null
          ? null
          : isRecord(resonance) &&
              typeof resonance.resonanceId === 'string' &&
              positiveInteger(resonance.contentVersion) &&
              Array.isArray(resonance.disciplinePair) &&
              resonance.disciplinePair.length === 2 &&
              typeof resonance.disciplinePair[0] === 'string' &&
              typeof resonance.disciplinePair[1] === 'string'
            ? {
                resonanceId: resonance.resonanceId,
                contentVersion: resonance.contentVersion,
                disciplinePair: [resonance.disciplinePair[0], resonance.disciplinePair[1]],
              }
            : null,
      essence:
        essence === null
          ? null
          : isRecord(essence) &&
              typeof essence.essenceId === 'string' &&
              positiveInteger(essence.contentVersion) &&
              typeof essence.sourceDisciplineId === 'string' &&
              typeof essence.skillId === 'string' &&
              positiveInteger(essence.skillContentVersion)
            ? {
                essenceId: essence.essenceId,
                contentVersion: essence.contentVersion,
                sourceDisciplineId: essence.sourceDisciplineId,
                skillId: essence.skillId,
                skillContentVersion: essence.skillContentVersion,
              }
            : null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }

  return validateCombatBuildSnapshot(snapshot).length === 0 ? snapshot : null
}

export function readBattleAuthorityCombatBuildSnapshot(
  state: StatDrivenCombatEncounterState & {
    readonly buildAuthority?: unknown
    readonly buildBridge?: unknown
  },
  combatantId: string,
): CombatBuildSnapshot | null {
  if (isRecord(state.buildAuthority) && Array.isArray(state.buildAuthority.combatants)) {
    const entry = state.buildAuthority.combatants.find(
      (candidate) => isRecord(candidate) && candidate.combatantId === combatantId,
    )
    const snapshot = parseSnapshot(entry)
    if (snapshot) return snapshot
  }

  // Compatibility only for pre-reconciliation P3.7 fixtures/old persisted snapshots.
  // New battles use buildAuthority and never create a parallel buildBridge.
  return readCombatBuildSnapshot(state, combatantId)
}
