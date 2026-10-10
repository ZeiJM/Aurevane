import { parseAbilityDefinition, type AbilityDefinition } from './combat-definition'
import {
  combatActionSourceKind,
  contentVersion,
  combatantId,
  actionDefinitionId,
  type CombatActionSourceKind,
} from './combat-kernel-types'

export interface CapturedCombatAbilitySource {
  readonly schemaVersion: 1
  readonly sourceInstanceId: string
  readonly ownerCombatantId: string
  readonly abilityId: string
  readonly contentVersion: number
  readonly sourceKind: CombatActionSourceKind
  readonly sourceDisciplineId?: string
  readonly tags: readonly string[]
  readonly definition: AbilityDefinition
}

export function captureCombatAbilitySource(
  input: CapturedCombatAbilitySource,
): CapturedCombatAbilitySource {
  if (
    !input ||
    typeof input !== 'object' ||
    input.schemaVersion !== 1 ||
    Object.keys(input).some(
      (key) =>
        ![
          'schemaVersion',
          'sourceInstanceId',
          'ownerCombatantId',
          'abilityId',
          'contentVersion',
          'sourceKind',
          'sourceDisciplineId',
          'tags',
          'definition',
        ].includes(key),
    ) ||
    !Array.isArray(input.tags) ||
    input.tags.length > 64 ||
    input.tags.some((tag) => typeof tag !== 'string' || !tag.trim())
  )
    throw new TypeError('invalid-captured-ability-source')
  const result: CapturedCombatAbilitySource = {
    schemaVersion: 1,
    sourceInstanceId: actionDefinitionId(input.sourceInstanceId),
    ownerCombatantId: combatantId(input.ownerCombatantId),
    abilityId: actionDefinitionId(input.abilityId),
    contentVersion: contentVersion(input.contentVersion),
    sourceKind: combatActionSourceKind(input.sourceKind),
    ...(input.sourceDisciplineId === undefined
      ? {}
      : { sourceDisciplineId: actionDefinitionId(input.sourceDisciplineId) }),
    tags: [...input.tags],
    definition: parseAbilityDefinition(input.definition),
  }
  return freezeCapture(result)
}

function freezeCapture<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeCapture(child)
    Object.freeze(value)
  }
  return value
}
