import type { CombatTargetSelection } from './actions'
import {
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
  validateMatureSkillDefinition,
} from './mature-skills'
import { executePv1fMatureSkill, type Pv1fTransition } from './pv1f-action-economy'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

export const ESSENCE_SCHEMA_VERSION = 1 as const

export interface EssenceDefinition {
  readonly essenceId: string
  readonly contentVersion: number
  readonly enabled: boolean
  readonly sourceDisciplineId: string
  readonly name: string
  readonly description: string
  readonly skill: MatureSkillDefinition
  readonly authoring: {
    readonly schemaVersion: typeof ESSENCE_SCHEMA_VERSION
    readonly status: 'representative' | 'production'
    readonly validationTags: readonly string[]
  }
}

export interface EssenceSnapshotReference {
  readonly essenceId: string
  readonly contentVersion: number
  readonly sourceDisciplineId: string
  readonly skillId: string
  readonly skillContentVersion: number
}

export const P36_REPRESENTATIVE_ESSENCES = [
  {
    essenceId: 'essence.vanguard.unbroken-strike',
    contentVersion: 1,
    enabled: true,
    sourceDisciplineId: 'vanguard',
    name: 'Unbroken Strike',
    description:
      'A pure Vanguard Essence Skill: commit heavily to a single adjacent enemy for a stronger decisive strike.',
    skill: {
      id: 'essence.vanguard.unbroken-strike',
      contentVersion: 1,
      enabled: true,
      nameRef: 'essence.vanguard.unbroken-strike.name',
      descriptionRef: 'essence.vanguard.unbroken-strike.description',
      sourceDisciplineId: 'vanguard',
      unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
      apCost: 55,
      target: {
        kind: 'unit',
        teamPolicy: 'enemy',
        shape: { kind: 'single' },
        minimumRange: 1,
        maximumRange: 1,
        requiresLineOfSight: false,
        maximumElevationDifference: 1,
        friendlyFire: 'enemies-only',
      },
      requirements: [],
      effects: [{ type: 'damage', recipient: 'primary-unit', amount: 20 }],
      tags: ['essence', 'vanguard', 'attack', 'melee'],
      cooldown: { key: 'essence.vanguard.unbroken-strike', ownerTurns: 3 },
      ai: {
        enabled: true,
        baseUtility: 92,
        purposeTags: ['damage', 'finisher', 'pure-build'],
      },
      overrides: { pvp: { apCost: 60 } },
      media: {
        iconKey: 'essence.vanguard.unbroken-strike.icon',
        audioCueKey: 'essence.vanguard.unbroken-strike.audio',
        vfxKey: 'essence.vanguard.unbroken-strike.vfx',
      },
      authoring: {
        schemaVersion: 1,
        status: 'representative',
        validationTags: ['p3.6', 'representative', 'essence', 'pure-only'],
      },
    },
    authoring: {
      schemaVersion: ESSENCE_SCHEMA_VERSION,
      status: 'representative',
      validationTags: ['p3.6', 'representative', 'pure-only'],
    },
  },
] as const satisfies readonly EssenceDefinition[]

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

export function validateEssenceDefinition(definition: EssenceDefinition): readonly string[] {
  const issues: string[] = []
  if (!STABLE_ID_PATTERN.test(definition.essenceId)) issues.push('essenceId')
  if (!Number.isSafeInteger(definition.contentVersion) || definition.contentVersion < 1) {
    issues.push('contentVersion')
  }
  if (!STABLE_ID_PATTERN.test(definition.sourceDisciplineId)) issues.push('sourceDisciplineId')
  if (!definition.name.trim()) issues.push('name')
  if (!definition.description.trim()) issues.push('description')
  if (definition.skill.id !== definition.essenceId) issues.push('skill.id')
  if (definition.skill.contentVersion !== definition.contentVersion) {
    issues.push('skill.contentVersion')
  }
  if (definition.skill.sourceDisciplineId !== definition.sourceDisciplineId) {
    issues.push('skill.sourceDisciplineId')
  }
  if (!definition.skill.tags.includes('essence')) issues.push('skill.tags.essence')
  if (validateMatureSkillDefinition(definition.skill).length > 0) issues.push('skill.definition')
  if (definition.authoring.schemaVersion !== ESSENCE_SCHEMA_VERSION) {
    issues.push('authoring.schemaVersion')
  }
  return issues
}

export function resolveEssenceForBuild(
  primaryDisciplineId: string,
  secondaryDisciplineId: string | null,
  contentVersion?: number,
): EssenceDefinition | null {
  if (secondaryDisciplineId !== null) return null
  const candidates = P36_REPRESENTATIVE_ESSENCES.filter(
    (definition) =>
      definition.enabled && definition.sourceDisciplineId === primaryDisciplineId,
  )
  if (contentVersion !== undefined) {
    return candidates.find((definition) => definition.contentVersion === contentVersion) ?? null
  }
  return (
    [...candidates].sort((left, right) => right.contentVersion - left.contentVersion)[0] ?? null
  )
}

export function essenceSnapshotReference(definition: EssenceDefinition): EssenceSnapshotReference {
  assertUsableEssence(definition)
  return {
    essenceId: definition.essenceId,
    contentVersion: definition.contentVersion,
    sourceDisciplineId: definition.sourceDisciplineId,
    skillId: definition.skill.id,
    skillContentVersion: definition.skill.contentVersion,
  }
}

export function executePv1fEssenceSkill(input: {
  readonly state: StatDrivenCombatEncounterState
  readonly essence: EssenceDefinition
  readonly primaryDisciplineId: string
  readonly secondaryDisciplineId: string | null
  readonly combatContext: MatureSkillCombatContext
  readonly selection: CombatTargetSelection
}): Pv1fTransition {
  assertUsableEssence(input.essence)
  const resolved = resolveEssenceForBuild(
    input.primaryDisciplineId,
    input.secondaryDisciplineId,
    input.essence.contentVersion,
  )
  if (!resolved || resolved.essenceId !== input.essence.essenceId) {
    throw new Error('That Essence Skill is not legal for the committed Discipline build.')
  }
  return executePv1fMatureSkill(
    input.state,
    input.essence.skill,
    input.selection,
    input.combatContext,
  )
}

function assertUsableEssence(definition: EssenceDefinition): void {
  const issues = validateEssenceDefinition(definition)
  if (issues.length > 0) throw new TypeError(`Invalid Essence definition: ${issues.join(', ')}.`)
  if (!definition.enabled || !definition.skill.enabled) {
    throw new RangeError('That Essence version is disabled.')
  }
}
