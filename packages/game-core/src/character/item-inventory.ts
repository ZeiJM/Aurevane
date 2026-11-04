import {
  parseCurrentSupportActionId,
  DEFAULT_SUPPORT_ACTION_ID,
  type CurrentSupportActionId,
} from '../combat/support-actions'
import {
  ITEM_INVENTORY_CATEGORIES,
  type ItemDefinition,
  type ItemInventoryCategory,
} from '../content/items'
export const EQUIPMENT_POSITIONS = [
  'head',
  'body',
  'pants',
  'boots',
  'main-hand',
  'off-hand',
  'consumable-1',
  'consumable-2',
] as const
export type EquipmentPosition = (typeof EQUIPMENT_POSITIONS)[number]
export type EquipmentAssignments = Readonly<Partial<Record<EquipmentPosition, string>>>
export type ItemCatalogue = Readonly<Record<string, ItemDefinition>>
/** Current equipment roles; retained battle captures use their own versioned policy. */
export function equipmentPositionsForItem(
  item: Pick<Extract<ItemDefinition, { schemaVersion: 2 }>, 'itemClass' | 'equipment'>,
): readonly EquipmentPosition[] {
  if (!item.equipment) return []
  if (item.itemClass === 'weapon') return ['main-hand']
  if (item.itemClass === 'hand-armor') return ['off-hand']
  if (item.itemClass === 'battle-item') return ['consumable-1', 'consumable-2']
  return item.equipment.slot === 'hand' ? [] : [item.equipment.slot]
}
export interface OwnedItemStack {
  readonly id: string
  readonly characterId: string
  readonly itemId: string
  readonly inventoryCategory: ItemInventoryCategory
  readonly slotIndex: number
  readonly quantity: number
  readonly acquiredAt: string
  readonly acquiredContentVersion: number
  readonly provenance: string
}
export type ItemSupportSelection =
  | { readonly kind: 'basic'; readonly actionId: CurrentSupportActionId }
  | {
      readonly kind: 'equipment'
      readonly position: EquipmentPosition
      readonly itemId: string
      readonly behaviorId: string
    }
export interface InventoryItemGrant {
  readonly itemId: string
  readonly quantity: number
}
/** Private owner data; never include stacks, grant receipts or stack IDs in opponent projections. */
export interface ItemInventorySnapshot {
  readonly characterId: string
  readonly revision: number
  readonly stacks: readonly OwnedItemStack[]
  readonly equipment: EquipmentAssignments
  readonly selectedSupport: ItemSupportSelection
  readonly previousBasicSupport: CurrentSupportActionId
  readonly grants: readonly {
    readonly key: string
    readonly items: readonly InventoryItemGrant[]
  }[]
}
export type ItemInventoryIssueCode =
  | 'overQP'
  | 'hand-conflict'
  | 'slot'
  | 'slot-conflict'
  | 'ownership'
  | 'quantity'
  | 'capacity'
  | 'stale-revision'
  | 'definition'
  | 'support'
  | 'permutation'
  | 'grant-conflict'
  | 'invalid-state'
export interface ItemInventoryIssue {
  readonly code: ItemInventoryIssueCode
  readonly message: string
  readonly qualityPoints?: number
  readonly shortage?: number
}
export type EquipmentValidation =
  | { readonly ok: true; readonly qualityPoints: number }
  | { readonly ok: false; readonly issue: ItemInventoryIssue }
export type ItemInventoryResult =
  | {
      readonly ok: true
      readonly snapshot: ItemInventorySnapshot
      readonly notices: readonly 'equipment-support-removed'[]
    }
  | { readonly ok: false; readonly issue: ItemInventoryIssue }

const failure = (
  code: ItemInventoryIssueCode,
  message: string,
): { readonly ok: false; readonly issue: ItemInventoryIssue } => ({
  ok: false,
  issue: { code, message },
})
function revision(s: ItemInventorySnapshot, r: number) {
  return !Number.isSafeInteger(r) ||
    r !== s.revision ||
    !Number.isSafeInteger(s.revision) ||
    s.revision < 0 ||
    s.revision === Number.MAX_SAFE_INTEGER
    ? failure('stale-revision', 'Inventory changed; reload before saving.')
    : null
}
function validateStacks(s: ItemInventorySnapshot, d: ItemCatalogue): EquipmentValidation {
  if (!s.characterId || s.stacks.length > 240)
    return failure('invalid-state', 'Invalid inventory owner or capacity.')
  const ids = new Set<string>(),
    slots = new Set<string>()
  for (const stack of s.stacks) {
    if (!stack.id || ids.has(stack.id) || stack.characterId !== s.characterId)
      return failure('ownership', 'Every stack must belong to this character exactly once.')
    ids.add(stack.id)
    const slot = `${stack.inventoryCategory}:${stack.slotIndex}`
    if (
      !ITEM_INVENTORY_CATEGORIES.includes(stack.inventoryCategory) ||
      !Number.isInteger(stack.slotIndex) ||
      stack.slotIndex < 0 ||
      stack.slotIndex > 39 ||
      slots.has(slot)
    )
      return failure('capacity', 'Each category has 40 distinct slots.')
    slots.add(slot)
    const item = d[stack.itemId]
    if (item?.schemaVersion === 2 && item.inventoryCategory !== stack.inventoryCategory)
      return failure('definition', 'Current Item inventory shape changed.')
    if (
      !Number.isSafeInteger(stack.quantity) ||
      stack.quantity < 1 ||
      (item?.schemaVersion === 2 && stack.quantity > item.maximumStack) ||
      stack.quantity > (stack.inventoryCategory === 'gear' ? 1 : 99)
    )
      return failure('quantity', 'Owned stack quantity exceeds its current maximum.')
  }
  return { ok: true, qualityPoints: 0 }
}
function supportValid(
  s: ItemInventorySnapshot,
  d: ItemCatalogue,
  selection: ItemSupportSelection,
): boolean {
  if (selection.kind === 'basic') return parseCurrentSupportActionId(selection.actionId) !== null
  if (selection.kind !== 'equipment' || !EQUIPMENT_POSITIONS.includes(selection.position))
    return false
  const stack = s.stacks.find((x) => x.id === s.equipment[selection.position])
  const item = stack && d[stack.itemId]
  return (
    !!item &&
    item.schemaVersion === 2 &&
    item.enabled &&
    stack?.itemId === selection.itemId &&
    item.actions?.support?.behaviorId === selection.behaviorId
  )
}
/** Current definitions supply QP and binding authority; acquisition version is provenance only. */
export function validateEquipmentLoadout(
  s: ItemInventorySnapshot,
  d: ItemCatalogue,
): EquipmentValidation {
  const stacks = validateStacks(s, d)
  if (!stacks.ok) return stacks
  let qualityPoints = 0
  const seen = new Map<string, number>()
  for (const [position, id] of Object.entries(s.equipment)) {
    if (!EQUIPMENT_POSITIONS.includes(position as EquipmentPosition))
      return failure('slot', 'Unknown equipment position.')
    const stack = s.stacks.find((x) => x.id === id)
    if (!stack || stack.characterId !== s.characterId)
      return failure('ownership', 'Equipment must reference an owned stack.')
    const item = d[stack.itemId]
    if (!item || item.schemaVersion !== 2 || !item.enabled || !item.equipment)
      return failure('definition', 'This Item cannot currently be equipped.')
    if (item.equipment.hands === 2 && (position !== 'main-hand' || s.equipment['off-hand']))
      return failure('hand-conflict', 'Two-handed weapons require Main Hand and an empty Off Hand.')
    const units = (seen.get(id) ?? 0) + 1
    if (units > stack.quantity)
      return failure('quantity', 'Each equipped slot requires an owned unit.')
    if (units > 1 && item.itemClass !== 'battle-item')
      return failure('ownership', 'Only a battle-item stack may supply both consumable slots.')
    seen.set(id, units)
    if (!equipmentPositionsForItem(item).includes(position as EquipmentPosition))
      return failure('slot', 'Item does not fit this position.')
    if (
      !Number.isSafeInteger(item.qualityPoints) ||
      item.qualityPoints < 1 ||
      item.qualityPoints > 100
    )
      return failure('definition', 'Invalid current Quality Points.')
    qualityPoints += item.qualityPoints
  }
  if (qualityPoints > 100)
    return {
      ok: false,
      issue: {
        code: 'overQP',
        message: `Equipment costs ${qualityPoints} QP; remove ${qualityPoints - 100} QP.`,
        qualityPoints,
        shortage: qualityPoints - 100,
      },
    }
  if (!supportValid(s, d, s.selectedSupport))
    return failure(
      'support',
      'Selected equipment support no longer exists; choose a current support.',
    )
  return { ok: true, qualityPoints }
}
function finish(
  s: ItemInventorySnapshot,
  d: ItemCatalogue,
  equipment: EquipmentAssignments,
  selection = s.selectedSupport,
  removalOnly = false,
): ItemInventoryResult {
  const draft = { ...s, equipment, selectedSupport: selection }
  const removed =
    !supportValid(draft, d, selection) ||
    (selection.kind === 'equipment' &&
      s.equipment[selection.position] !== equipment[selection.position])
  const selectedSupport: ItemSupportSelection = removed
    ? {
        kind: 'basic',
        actionId: parseCurrentSupportActionId(s.previousBasicSupport) ?? DEFAULT_SUPPORT_ACTION_ID,
      }
    : selection
  const next = { ...draft, selectedSupport, revision: s.revision + 1 }
  if (removalOnly) {
    const counts = new Map<string, number>()
    for (const [position, id] of Object.entries(equipment)) {
      if (!EQUIPMENT_POSITIONS.includes(position as EquipmentPosition))
        return failure('slot', 'Unknown equipment position.')
      const stack = next.stacks.find((x) => x.id === id && x.characterId === next.characterId)
      if (!stack)
        return failure('ownership', 'Every remaining assignment must reference an owned stack.')
      const units = (counts.get(id) ?? 0) + 1
      if (units > stack.quantity || (units > 1 && stack.inventoryCategory !== 'battle-items'))
        return failure('quantity', 'Each remaining assignment requires an owned unit.')
      counts.set(id, units)
    }
  }
  const result = removalOnly ? validateStacks(next, {}) : validateEquipmentLoadout(next, d)
  return result.ok
    ? {
        ok: true,
        snapshot: structuredClone(next),
        notices: removed ? ['equipment-support-removed'] : [],
      }
    : result
}
export function equipInventoryItem(
  s: ItemInventorySnapshot,
  d: ItemCatalogue,
  r: number,
  id: string,
  p: EquipmentPosition,
  replace: readonly EquipmentPosition[] = [],
): ItemInventoryResult {
  const stale = revision(s, r)
  if (stale) return stale
  if (
    !EQUIPMENT_POSITIONS.includes(p) ||
    replace.some((x) => !EQUIPMENT_POSITIONS.includes(x)) ||
    new Set(replace).size !== replace.length
  )
    return failure('slot', 'Invalid replacement positions.')
  const equipment = { ...s.equipment }
  for (const position of replace) delete equipment[position]
  if (equipment[p] && equipment[p] !== id)
    return failure('slot-conflict', 'Explicitly replace the occupied position.')
  equipment[p] = id
  return finish(s, d, equipment)
}
export function unequipInventoryItem(
  s: ItemInventorySnapshot,
  d: ItemCatalogue,
  r: number,
  p: EquipmentPosition,
): ItemInventoryResult {
  const stale = revision(s, r)
  if (stale) return stale
  if (!EQUIPMENT_POSITIONS.includes(p)) return failure('slot', 'Unknown equipment position.')
  const equipment = { ...s.equipment }
  const existed = equipment[p] !== undefined
  delete equipment[p]
  return finish(s, d, equipment, s.selectedSupport, existed)
}
export function selectInventorySupport(
  s: ItemInventorySnapshot,
  d: ItemCatalogue,
  r: number,
  selection: ItemSupportSelection,
): ItemInventoryResult {
  const stale = revision(s, r)
  if (stale) return stale
  if (!supportValid(s, d, selection))
    return failure('support', 'Select a Basic support or a binding on currently equipped gear.')
  return finish(
    {
      ...s,
      previousBasicSupport:
        selection.kind === 'basic' ? selection.actionId : s.previousBasicSupport,
    },
    d,
    s.equipment,
    selection,
  )
}
export type ItemInventorySort = 'name' | 'tier' | 'quality-points' | 'quantity' | 'newest' | 'class'
function sortedIds(
  stacks: readonly OwnedItemStack[],
  catalogue: ItemCatalogue,
  sort: ItemInventorySort,
): readonly string[] {
  const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  return [...stacks]
    .sort((a, b) => {
      // Retained stack facts remain sortable when a current definition is unavailable.
      const stackComparison =
        sort === 'quantity'
          ? b.quantity - a.quantity
          : sort === 'newest'
            ? Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt)
            : 0
      if (stackComparison) return stackComparison
      const definitionA = catalogue[a.itemId],
        definitionB = catalogue[b.itemId]
      const x = definitionA?.schemaVersion === 2 ? definitionA : undefined,
        y = definitionB?.schemaVersion === 2 ? definitionB : undefined
      // A consistent availability partition keeps mixed-definition comparisons transitive.
      if (!x || !y) return Number(!!y) - Number(!!x) || compareText(a.id, b.id)
      let comparison = 0
      switch (sort) {
        case 'name':
          comparison = compareText(x.name.toLowerCase(), y.name.toLowerCase())
          break
        case 'tier':
          comparison =
            ['S', 'A', 'B', 'C', 'D'].indexOf(x.tier) - ['S', 'A', 'B', 'C', 'D'].indexOf(y.tier)
          break
        case 'quality-points':
          comparison = y.qualityPoints - x.qualityPoints
          break
        case 'class':
          comparison = compareText(x.itemClass, y.itemClass)
          break
      }
      return (
        comparison ||
        compareText(x.name.toLowerCase(), y.name.toLowerCase()) ||
        compareText(a.id, b.id)
      )
    })
    .map((stack) => stack.id)
}
/** A complete category permutation keeps durable stack identities and assignments unchanged. */
export function sortItemInventory(
  s: ItemInventorySnapshot,
  d: ItemCatalogue,
  r: number,
  category: ItemInventoryCategory,
  order: readonly string[] | ItemInventorySort,
): ItemInventoryResult {
  const stale = revision(s, r)
  if (stale) return stale
  const owned = s.stacks.filter((x) => x.inventoryCategory === category)
  const ids = typeof order === 'string' ? sortedIds(owned, d, order) : order
  if (
    !ITEM_INVENTORY_CATEGORIES.includes(category) ||
    ids.length !== owned.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !owned.some((x) => x.id === id))
  )
    return failure('permutation', 'Sort requires exactly the owned stacks in one category.')
  const valid = validateStacks(s, {})
  if (!valid.ok) return valid
  const next = {
    ...s,
    revision: s.revision + 1,
    stacks: s.stacks.map((stack) =>
      stack.inventoryCategory === category ? { ...stack, slotIndex: ids.indexOf(stack.id) } : stack,
    ),
  }
  return { ok: true, snapshot: structuredClone(next), notices: [] }
}
/** Bounded, atomic grant planning. Persisted RPC uses UUIDs; these deterministic IDs are pure plans. */
export function grantInventoryItems(
  s: ItemInventorySnapshot,
  d: ItemCatalogue,
  r: number,
  key: string,
  items: readonly InventoryItemGrant[],
  at: string,
): ItemInventoryResult {
  if (!key || key.length > 160 || items.length < 1 || items.length > 240)
    return failure('grant-conflict', 'A bounded stable grant identity and item list are required.')
  const previous = s.grants.find((x) => x.key === key)
  const fingerprint = JSON.stringify(items.map((x) => ({ itemId: x.itemId, quantity: x.quantity })))
  if (previous)
    return JSON.stringify(
      previous.items.map((x) => ({ itemId: x.itemId, quantity: x.quantity })),
    ) === fingerprint
      ? { ok: true, snapshot: structuredClone(s), notices: [] }
      : failure('grant-conflict', 'Grant identity was already used for different items.')
  const stale = revision(s, r)
  if (stale) return stale
  if (!Number.isFinite(Date.parse(at)))
    return failure('invalid-state', 'Acquisition date must be valid.')
  const valid = validateStacks(s, d)
  if (!valid.ok) return valid
  const stacks = s.stacks.map((x) => ({ ...x }))
  let ordinal = 0
  for (const grant of items) {
    const item = d[grant.itemId]
    if (
      !item ||
      item.schemaVersion !== 2 ||
      !item.enabled ||
      !Number.isSafeInteger(item.maximumStack) ||
      item.maximumStack < 1 ||
      item.maximumStack > (item.inventoryCategory === 'gear' ? 1 : 99) ||
      !ITEM_INVENTORY_CATEGORIES.includes(item.inventoryCategory)
    )
      return failure(
        'definition',
        'Only current enabled runtime Items with valid stack shapes may be acquired.',
      )
    if (!Number.isSafeInteger(grant.quantity) || grant.quantity < 1 || grant.quantity > 3960)
      return failure('quantity', 'Grant quantity must be 1–3960.')
    let remaining = grant.quantity
    for (const stack of stacks
      .filter((x) => x.itemId === item.id)
      .sort((a, b) => a.slotIndex - b.slotIndex)) {
      const take = Math.min(remaining, item.maximumStack - stack.quantity)
      stack.quantity += take
      remaining -= take
    }
    while (remaining > 0) {
      const slotIndex = Array.from({ length: 40 }, (_, i) => i).find(
        (i) =>
          !stacks.some((x) => x.inventoryCategory === item.inventoryCategory && x.slotIndex === i),
      )
      if (slotIndex === undefined)
        return failure('capacity', `${item.inventoryCategory} inventory is full.`)
      const quantity = Math.min(remaining, item.maximumStack)
      remaining -= quantity
      const id = `grant:${key}:${ordinal++}`
      if (stacks.some((x) => x.id === id))
        return failure('grant-conflict', 'Generated stack identity already exists.')
      stacks.push({
        id,
        characterId: s.characterId,
        itemId: item.id,
        inventoryCategory: item.inventoryCategory,
        slotIndex,
        quantity,
        acquiredAt: at,
        acquiredContentVersion: item.contentVersion,
        provenance: key,
      })
    }
  }
  return {
    ok: true,
    snapshot: structuredClone({
      ...s,
      revision: s.revision + 1,
      stacks,
      grants: [...s.grants, { key, items }],
    }),
    notices: [],
  }
}
