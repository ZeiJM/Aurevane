import { parseRuntimeItemDefinition } from '../content/items'
import { EQUIPMENT_POSITIONS } from '../character/item-inventory'
import { finalizedContentMediaIssues, type FinalizedContentMediaSlots } from './content-media'
import { parseAbilityDefinition, type AbilityDefinition } from './combat-definition'
import {
  compileEquipmentAbility,
  compileEquipmentRoles,
  equipmentRoles,
  type BattleEquipmentCapture,
  type BattleEquipmentUnit,
  type EquipmentActionRole,
} from './combat-equipment'
import { parseBasicSkillDefinition, type BasicSkillDefinition } from './combat-basic-actions'
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
  readonly audioCueKey?: string | null
  readonly media?: FinalizedContentMediaSlots
  readonly basic?: BasicSkillDefinition
  readonly equipment?: {
    readonly unit: BattleEquipmentUnit
    readonly roles: Partial<Record<EquipmentActionRole, string>>
  }
}

export function captureEquipmentAbilitySource(
  capture: BattleEquipmentCapture,
  unit: BattleEquipmentUnit,
  ownerCombatantId: string,
): CapturedCombatAbilitySource | null {
  const definition = compileEquipmentAbility(capture, unit)
  if (!definition.behaviors.length) return null
  return captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: JSON.stringify([
      'equipment',
      ownerCombatantId,
      unit.position,
      unit.ownedStackId,
      unit.item.id,
      unit.item.contentVersion,
    ]),
    ownerCombatantId,
    abilityId: `item.${unit.item.id}.${unit.position}`,
    contentVersion: unit.item.contentVersion,
    sourceKind: 'equipment',
    tags: unit.item.tags,
    definition,
    equipment: { unit: structuredClone(unit), roles: equipmentRoles(capture, unit) },
    ...(unit.item.media.artwork ? { media: { artwork: unit.item.media.artwork } } : {}),
  })
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
          'basic',
          'media',
          'audioCueKey',
          'equipment',
        ].includes(key),
    ) ||
    !Array.isArray(input.tags) ||
    input.tags.length > 64 ||
    input.tags.some((tag) => typeof tag !== 'string' || !tag.trim())
  )
    throw new TypeError('invalid-captured-ability-source')
  if (
    input.media &&
    (Object.keys(input.media).some((key) => !['artwork', 'audio'].includes(key)) ||
      finalizedContentMediaIssues(input.media).length)
  )
    throw new TypeError('invalid-captured-media')
  if (
    input.audioCueKey !== undefined &&
    input.audioCueKey !== null &&
    (typeof input.audioCueKey !== 'string' ||
      !input.audioCueKey.trim() ||
      input.audioCueKey.trim() !== input.audioCueKey ||
      input.audioCueKey.length > 256)
  )
    throw new TypeError('invalid-captured-audio-cue')
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
    ...(input.audioCueKey === undefined ? {} : { audioCueKey: input.audioCueKey }),
    definition: parseAbilityDefinition(input.definition),
    ...(input.media
      ? { media: JSON.parse(JSON.stringify(input.media)) as FinalizedContentMediaSlots }
      : {}),
    ...(input.basic === undefined ? {} : { basic: parseBasicSkillDefinition(input.basic) }),
    ...(input.equipment === undefined ? {} : { equipment: structuredClone(input.equipment) }),
  }
  if (result.equipment) {
    const { unit, roles } = result.equipment
    const item = parseRuntimeItemDefinition(unit.item)
    if (
      Object.keys(result.equipment).some((key) => !['unit', 'roles'].includes(key)) ||
      !EQUIPMENT_POSITIONS.includes(unit.position) ||
      Object.keys(unit).some((key) => !['position', 'ownedStackId', 'item'].includes(key)) ||
      typeof unit.ownedStackId !== 'string' ||
      !unit.ownedStackId.trim() ||
      !roles ||
      Object.entries(roles).some(
        ([role, id]) =>
          !['attack', 'support', 'use'].includes(role) ||
          item.actions?.[role as EquipmentActionRole]?.behaviorId !== id,
      ) ||
      result.sourceKind !== 'equipment' ||
      result.sourceDisciplineId !== undefined ||
      result.basic !== undefined ||
      result.abilityId !== `item.${item.id}.${unit.position}` ||
      result.contentVersion !== item.contentVersion ||
      result.sourceInstanceId !==
        JSON.stringify([
          'equipment',
          result.ownerCombatantId,
          unit.position,
          unit.ownedStackId,
          item.id,
          item.contentVersion,
        ]) ||
      !sameCaptureValue(result.definition, compileEquipmentRoles(unit, roles)) ||
      !sameCaptureValue(result.tags, item.tags)
    )
      throw new TypeError('invalid-captured-equipment-definition')
  }

  if (
    result.basic &&
    (result.sourceKind !== 'basic' ||
      result.sourceDisciplineId !== undefined ||
      result.basic.id !== result.abilityId ||
      result.basic.contentVersion !== result.contentVersion ||
      !sameCaptureValue(result.basic.ability, result.definition) ||
      !sameCaptureValue(result.basic.tags, result.tags))
  )
    throw new TypeError('invalid-captured-basic-definition')
  return freezeCapture(result)
}

function freezeCapture<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeCapture(child)
    Object.freeze(value)
  }
  return value
}

/** PostgreSQL JSONB may reorder object keys; ordered arrays and every value stay authoritative. */
export function sameCapturedCombatAbilitySource(
  left: CapturedCombatAbilitySource,
  right: CapturedCombatAbilitySource,
): boolean {
  return sameCaptureValue(left, right)
}

function sameCaptureValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameCaptureValue(value, right[index]))
    )
  const leftRecord = left as Record<string, unknown>,
    rightRecord = right as Record<string, unknown>
  const keys = Object.keys(leftRecord)
  return (
    keys.length === Object.keys(rightRecord).length &&
    keys.every(
      (key) =>
        Object.hasOwn(rightRecord, key) && sameCaptureValue(leftRecord[key], rightRecord[key]),
    )
  )
}
