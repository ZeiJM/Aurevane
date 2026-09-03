import type {
  CombatActionDefinition,
  CombatEffectDefinition,
  CombatTargetSpec,
  CombatUseRequirement,
} from './actions'
import type { SkillCooldownDefinition } from './skill-cooldowns'

export const MATURE_SKILL_SCHEMA_VERSION = 1 as const
export type MatureSkillCombatContext = 'pve' | 'pvp'

export type MatureSkillUnlockRequirement =
  | { readonly kind: 'discipline-mastery'; readonly minimumStage: number }
  | { readonly kind: 'system-grant'; readonly grantId: string }

export interface MatureSkillAiMetadata {
  readonly enabled: boolean
  readonly baseUtility: number
  readonly purposeTags: readonly string[]
}

export interface MatureSkillContextOverride {
  readonly apCost?: number
  readonly cooldownOwnerTurns?: number
}

export interface MatureSkillMediaHooks {
  readonly iconKey: string | null
  readonly audioCueKey: string | null
  readonly vfxKey: string | null
}

export interface MatureSkillAuthoringMetadata {
  readonly schemaVersion: typeof MATURE_SKILL_SCHEMA_VERSION
  readonly status: 'representative' | 'production'
  readonly validationTags: readonly string[]
}

export interface MatureSkillDefinition {
  readonly id: string
  readonly contentVersion: number
  readonly enabled: boolean
  readonly nameRef: string
  readonly descriptionRef: string
  readonly sourceDisciplineId: string
  readonly unlockRequirement: MatureSkillUnlockRequirement
  readonly apCost: number
  readonly target: CombatTargetSpec
  readonly requirements: readonly CombatUseRequirement[]
  readonly effects: readonly CombatEffectDefinition[]
  readonly tags: readonly string[]
  readonly cooldown: SkillCooldownDefinition
  readonly ai: MatureSkillAiMetadata
  readonly overrides: Readonly<
    Partial<Record<MatureSkillCombatContext, MatureSkillContextOverride>>
  >
  readonly media: MatureSkillMediaHooks
  readonly authoring: MatureSkillAuthoringMetadata
}

export interface ResolvedMatureSkillDefinition extends MatureSkillDefinition {
  readonly combatContext: MatureSkillCombatContext
}

export const P33_REPRESENTATIVE_DISCIPLINE_SKILLS = [
  {
    id: 'vanguard.forceful-strike',
    contentVersion: 1,
    enabled: false,
    nameRef: 'skill.vanguard.forceful-strike.name',
    descriptionRef: 'skill.vanguard.forceful-strike.description',
    sourceDisciplineId: 'vanguard',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 40,
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
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 10 }],
    tags: ['discipline', 'vanguard', 'attack', 'melee'],
    cooldown: { key: 'vanguard.forceful-strike', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 70, purposeTags: ['damage', 'pressure'] },
    overrides: {},
    media: {
      iconKey: 'skill.vanguard.forceful-strike.icon',
      audioCueKey: 'skill.vanguard.forceful-strike.audio',
      vfxKey: 'skill.vanguard.forceful-strike.vfx',
    },
    authoring: {
      schemaVersion: MATURE_SKILL_SCHEMA_VERSION,
      status: 'representative',
      validationTags: ['p3.3', 'representative', 'disabled-stale-version'],
    },
  },
  {
    id: 'vanguard.forceful-strike',
    contentVersion: 2,
    enabled: true,
    nameRef: 'skill.vanguard.forceful-strike.name',
    descriptionRef: 'skill.vanguard.forceful-strike.description',
    sourceDisciplineId: 'vanguard',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 40,
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
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 12 }],
    tags: ['discipline', 'vanguard', 'attack', 'melee'],
    cooldown: { key: 'vanguard.forceful-strike', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 76, purposeTags: ['damage', 'pressure'] },
    overrides: { pvp: { apCost: 45 } },
    media: {
      iconKey: 'skill.vanguard.forceful-strike.icon',
      audioCueKey: 'skill.vanguard.forceful-strike.audio',
      vfxKey: 'skill.vanguard.forceful-strike.vfx',
    },
    authoring: {
      schemaVersion: MATURE_SKILL_SCHEMA_VERSION,
      status: 'representative',
      validationTags: ['p3.3', 'representative'],
    },
  },
  {
    id: 'lifebinder.mending-light',
    contentVersion: 1,
    enabled: true,
    nameRef: 'skill.lifebinder.mending-light.name',
    descriptionRef: 'skill.lifebinder.mending-light.description',
    sourceDisciplineId: 'lifebinder',
    unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
    apCost: 45,
    target: {
      kind: 'self',
      teamPolicy: 'self',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'allies-only',
    },
    requirements: [{ kind: 'actor-hp-at-most', basisPoints: 9_999 }],
    effects: [{ type: 'healing', recipient: 'actor', amount: 16 }],
    tags: ['discipline', 'lifebinder', 'heal', 'support'],
    cooldown: { key: 'lifebinder.mending-light', ownerTurns: 2 },
    ai: { enabled: true, baseUtility: 58, purposeTags: ['heal', 'survival'] },
    overrides: { pvp: { cooldownOwnerTurns: 3 } },
    media: {
      iconKey: 'skill.lifebinder.mending-light.icon',
      audioCueKey: 'skill.lifebinder.mending-light.audio',
      vfxKey: 'skill.lifebinder.mending-light.vfx',
    },
    authoring: {
      schemaVersion: MATURE_SKILL_SCHEMA_VERSION,
      status: 'representative',
      validationTags: ['p3.3', 'representative'],
    },
  },
] as const satisfies readonly MatureSkillDefinition[]

export function validateMatureSkillDefinition(
  definition: MatureSkillDefinition,
): readonly string[] {
  const issues: string[] = []
  const idPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
  if (!idPattern.test(definition.id)) issues.push('id')
  if (!Number.isSafeInteger(definition.contentVersion) || definition.contentVersion < 1) {
    issues.push('contentVersion')
  }
  if (!definition.nameRef.trim()) issues.push('nameRef')
  if (!definition.descriptionRef.trim()) issues.push('descriptionRef')
  if (!idPattern.test(definition.sourceDisciplineId)) issues.push('sourceDisciplineId')
  if (
    !Number.isSafeInteger(definition.apCost) ||
    definition.apCost < 1 ||
    definition.apCost > 100
  ) {
    issues.push('apCost')
  }
  if (definition.tags.length === 0 || definition.tags.some((tag) => !tag.trim()))
    issues.push('tags')
  if (
    definition.unlockRequirement.kind === 'discipline-mastery' &&
    (!Number.isSafeInteger(definition.unlockRequirement.minimumStage) ||
      definition.unlockRequirement.minimumStage < 1)
  ) {
    issues.push('unlockRequirement.minimumStage')
  }
  if (
    definition.unlockRequirement.kind === 'system-grant' &&
    !definition.unlockRequirement.grantId.trim()
  ) {
    issues.push('unlockRequirement.grantId')
  }
  if (!Number.isFinite(definition.ai.baseUtility)) issues.push('ai.baseUtility')
  if (definition.authoring.schemaVersion !== MATURE_SKILL_SCHEMA_VERSION) {
    issues.push('authoring.schemaVersion')
  }
  if (
    !idPattern.test(definition.cooldown.key) ||
    !Number.isSafeInteger(definition.cooldown.ownerTurns) ||
    definition.cooldown.ownerTurns < 1
  ) {
    issues.push('cooldown')
  }
  for (const [context, override] of Object.entries(definition.overrides)) {
    if (
      override?.apCost !== undefined &&
      (!Number.isSafeInteger(override.apCost) || override.apCost < 1 || override.apCost > 100)
    ) {
      issues.push(`overrides.${context}.apCost`)
    }
    if (
      override?.cooldownOwnerTurns !== undefined &&
      (!Number.isSafeInteger(override.cooldownOwnerTurns) || override.cooldownOwnerTurns < 1)
    ) {
      issues.push(`overrides.${context}.cooldownOwnerTurns`)
    }
  }
  return issues
}

export function resolveMatureSkillVersion(
  skillId: string,
  contentVersion?: number,
): MatureSkillDefinition | null {
  const candidates = P33_REPRESENTATIVE_DISCIPLINE_SKILLS.filter(
    (definition) => definition.id === skillId && definition.enabled,
  )
  if (contentVersion !== undefined) {
    return candidates.find((definition) => definition.contentVersion === contentVersion) ?? null
  }
  return (
    [...candidates].sort((left, right) => right.contentVersion - left.contentVersion)[0] ?? null
  )
}

export function resolveMatureSkillForContext(
  definition: MatureSkillDefinition,
  combatContext: MatureSkillCombatContext,
): ResolvedMatureSkillDefinition {
  assertUsableDefinition(definition)
  const override = definition.overrides[combatContext]
  return {
    ...definition,
    apCost: override?.apCost ?? definition.apCost,
    cooldown: {
      ...definition.cooldown,
      ownerTurns: override?.cooldownOwnerTurns ?? definition.cooldown.ownerTurns,
    },
    combatContext,
  }
}

export function toCombatActionDefinition(
  definition: MatureSkillDefinition,
  combatContext: MatureSkillCombatContext,
): CombatActionDefinition {
  const resolved = resolveMatureSkillForContext(definition, combatContext)
  return {
    id: resolved.id,
    version: resolved.contentVersion,
    sourceType: 'discipline-skill',
    tags: resolved.tags,
    target: resolved.target,
    cost: { spendsAction: true, mp: 0 },
    requirements: resolved.requirements,
    effects: resolved.effects,
  }
}

function assertUsableDefinition(definition: MatureSkillDefinition): void {
  const issues = validateMatureSkillDefinition(definition)
  if (issues.length > 0)
    throw new TypeError(`Invalid mature Skill definition: ${issues.join(', ')}.`)
  if (!definition.enabled) throw new RangeError('That mature Skill version is disabled.')
}
