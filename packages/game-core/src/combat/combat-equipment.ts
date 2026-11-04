import {
  EQUIPMENT_POSITIONS,
  equipmentPositionsForItem,
  type EquipmentPosition,
  type ItemSupportSelection,
} from '../character/item-inventory'
import { parseRuntimeItemDefinition, type RuntimeItemDefinition } from '../content/items'
import { parseCurrentSupportActionId } from './support-actions'
import type { AbilityDefinition } from './combat-definition'

export interface BattleEquipmentUnit {
  readonly position: EquipmentPosition
  readonly ownedStackId: string
  readonly item: RuntimeItemDefinition
}
export interface BattleEquipmentCapture {
  readonly schemaVersion: 1 | 2
  readonly inventoryRevision: number
  readonly selectedSupport: ItemSupportSelection
  readonly equipment: readonly BattleEquipmentUnit[]
}
export type EquipmentActionRole = 'attack' | 'support' | 'use'
export function equipmentActionId(unit: BattleEquipmentUnit, role: EquipmentActionRole): string {
  return `item.${unit.item.id}.${unit.position}.${role}`
}
export function equipmentBehaviorActionId(
  equipment: { unit: BattleEquipmentUnit; roles: Partial<Record<EquipmentActionRole, string>> },
  behaviorId: string,
): string {
  const role = (Object.keys(equipment.roles) as EquipmentActionRole[]).find(
    (role) => equipment.roles[role] === behaviorId,
  )
  return role
    ? equipmentActionId(equipment.unit, role)
    : `item.${equipment.unit.item.id}.${equipment.unit.position}`
}
export function equipmentRoles(
  capture: BattleEquipmentCapture,
  unit: BattleEquipmentUnit,
): Partial<Record<EquipmentActionRole, string>> {
  const weapon =
    capture.equipment.find((x) => x.position === 'main-hand' && x.item.itemClass === 'weapon') ??
    (capture.schemaVersion === 1
      ? capture.equipment.find((x) => x.position === 'off-hand' && x.item.itemClass === 'weapon')
      : undefined)
  const support = capture.selectedSupport
  return {
    ...(weapon?.position === unit.position && unit.item.actions?.attack
      ? { attack: unit.item.actions.attack.behaviorId }
      : {}),
    ...(support.kind === 'equipment' &&
    support.position === unit.position &&
    support.itemId === unit.item.id &&
    unit.item.actions?.support?.behaviorId === support.behaviorId
      ? { support: support.behaviorId }
      : {}),
    ...(unit.item.actions?.use ? { use: unit.item.actions.use.behaviorId } : {}),
  }
}
export function compileEquipmentAbility(
  capture: BattleEquipmentCapture,
  unit: BattleEquipmentUnit,
): AbilityDefinition {
  return compileEquipmentRoles(unit, equipmentRoles(capture, unit))
}
export function compileEquipmentRoles(
  unit: BattleEquipmentUnit,
  roles: Partial<Record<EquipmentActionRole, string>>,
): AbilityDefinition {
  return {
    ...structuredClone(unit.item.ability ?? { schemaVersion: 1 }),
    behaviors: (unit.item.ability?.behaviors ?? [])
      .filter((x) => x.activation !== 'manual' || Object.values(roles).includes(x.id))
      .map((x) => ({
        ...structuredClone(x),
        ...(x.id === roles.use && unit.item.battleUses !== null
          ? {
              maximumUsesPerBattle: Math.min(
                unit.item.battleUses,
                x.maximumUsesPerBattle ?? unit.item.battleUses,
              ),
            }
          : {}),
      })),
  }
}

/** Exact private admission data. Definitions are retained even for unadmitted Manual roles. */
export function parseBattleEquipmentCapture(value: unknown): BattleEquipmentCapture {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid equipment capture.')
  const capture = value as BattleEquipmentCapture
  if (
    ![1, 2].includes(capture.schemaVersion) ||
    !Number.isSafeInteger(capture.inventoryRevision) ||
    capture.inventoryRevision < 0 ||
    !Array.isArray(capture.equipment) ||
    capture.equipment.length > (capture.schemaVersion === 1 ? 6 : 8) ||
    Object.keys(capture).some(
      (x) => !['schemaVersion', 'inventoryRevision', 'selectedSupport', 'equipment'].includes(x),
    )
  )
    throw new TypeError('Invalid equipment capture.')
  const seen = new Set<string>()
  let qp = 0
  for (const unit of capture.equipment) {
    if (
      !unit ||
      !EQUIPMENT_POSITIONS.includes(unit.position) ||
      (capture.schemaVersion === 1 && unit.position.startsWith('consumable-')) ||
      seen.has(unit.position) ||
      typeof unit.ownedStackId !== 'string' ||
      !unit.ownedStackId.trim() ||
      Object.keys(unit).some((x) => !['position', 'ownedStackId', 'item'].includes(x))
    )
      throw new TypeError('Invalid equipped unit.')
    const item = parseRuntimeItemDefinition(unit.item)
    if (
      !item.enabled ||
      !item.equipment ||
      (capture.schemaVersion === 2
        ? !equipmentPositionsForItem(item).includes(unit.position)
        : item.equipment.slot === 'hand'
          ? !['main-hand', 'off-hand'].includes(unit.position)
          : unit.position !== item.equipment.slot) ||
      (item.equipment.hands === 2 &&
        (unit.position !== 'main-hand' ||
          capture.equipment.some((x) => x.position === 'off-hand'))) ||
      (item.inventoryCategory === 'gear' &&
        capture.equipment.some((x) => x !== unit && x.ownedStackId === unit.ownedStackId))
    )
      throw new TypeError('Invalid equipped Item.')
    qp += item.qualityPoints
    seen.add(unit.position)
  }
  if (qp > 100) throw new TypeError('Equipment exceeds 100 QP.')
  const support = capture.selectedSupport
  if (
    !support ||
    (support.kind === 'basic'
      ? !parseCurrentSupportActionId(support.actionId) ||
        Object.keys(support).some((x) => !['kind', 'actionId'].includes(x))
      : support.kind !== 'equipment' ||
        Object.keys(support).some(
          (x) => !['kind', 'position', 'itemId', 'behaviorId'].includes(x),
        ) ||
        !capture.equipment.some(
          (x) =>
            x.position === support.position &&
            x.item.id === support.itemId &&
            x.item.actions?.support?.behaviorId === support.behaviorId,
        ))
  )
    throw new TypeError('Invalid equipped Support.')
  return structuredClone(capture)
}
