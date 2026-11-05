'use client'
import { useState } from 'react'
import type { AuthoredItem } from '@aurevane/game-core/content/authored-content'
import {
  parseRuntimeItemDefinition,
  type RuntimeItemDefinition,
  type ItemClass,
} from '@aurevane/game-core/content/items'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { AbilityNumber, AbilitySelect, AbilityText } from './ability-editor-fields'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { ItemEquipRequirementsEditor } from './item-equip-requirements-editor'
import { ItemDetails } from '@/components/character/item-details'
import { presentItem } from '@/lib/items/item-presentation'
import { itemCategoryLabel, itemClassLabel } from '@/lib/items/item-class-label'
import styles from './combat-content-editor.module.css'
const categories = {
  armor: 'gear',
  'hand-armor': 'gear',
  weapon: 'gear',
  'battle-item': 'battle-items',
  material: 'materials',
  general: 'general',
  event: 'event',
  companion: 'companion',
} as const
const inventoryClasses = [
  'gear',
  'battle-items',
  'materials',
  'general',
  'event',
  'companion',
] as const
const gearTypes = ['weapon', 'armor', 'hand-armor'] as const
const defaultClassType: Record<RuntimeItemDefinition['inventoryCategory'], ItemClass> = {
  gear: 'weapon',
  'battle-items': 'battle-item',
  materials: 'material',
  general: 'general',
  event: 'event',
  companion: 'companion',
}
/** Explicit conversion preserves authored behavior and refuses unsupported wrapper prerequisites. */
export function upgradeRetainedItem(value: AuthoredItem): RuntimeItemDefinition {
  if (value.requirements !== null)
    throw new TypeError(
      'Resolve the retained Item wrapper Requirements before upgrading. Combat Requirements belong to behavior groups.',
    )
  const itemClass: ItemClass =
    value.itemClass === 'weapon'
      ? 'weapon'
      : value.itemClass === 'armor'
        ? 'armor'
        : value.itemClass === 'accessory'
          ? 'hand-armor'
          : value.itemClass === 'consumable'
            ? 'battle-item'
            : value.itemClass === 'material'
              ? 'material'
              : value.itemClass === 'key'
                ? 'event'
                : 'general'
  const equippable = ['armor', 'hand-armor', 'weapon', 'battle-item'].includes(itemClass)
  const manuals =
    value.ability?.behaviors.filter(
      (row) => row.activation === 'manual' && row.mode === 'action',
    ) ?? []
  if (manuals.length > 1)
    throw new TypeError(
      'Retained Items with multiple Manual actions need explicit binding choices before upgrading.',
    )
  const role = itemClass === 'weapon' ? 'attack' : itemClass === 'battle-item' ? 'use' : 'support'
  return parseRuntimeItemDefinition({
    schemaVersion: 2,
    id: value.id,
    contentVersion: value.contentVersion,
    name: value.name,
    description: value.description,
    sortOrder: value.sortOrder,
    enabled: value.enabled,
    media: structuredClone(value.media),
    inventoryCategory: categories[itemClass],
    itemClass,
    tier: 'D',
    qualityPoints: equippable ? 5 : 0,
    equipment: equippable ? { slot: itemClass === 'armor' ? 'body' : 'hand', hands: 1 } : null,
    maximumStack: categories[itemClass] === 'gear' ? 1 : 99,
    requirements: null,
    ability: value.ability ? structuredClone(value.ability) : null,
    ...(manuals[0] ? { actions: { [role]: { behaviorId: manuals[0].id, name: value.name } } } : {}),
    battleUses: itemClass === 'battle-item' ? 1 : null,
    consumeOnUse: false,
    tags: [],
  })
}
export function RetainedItemUpgrade({
  value,
  onChange,
}: {
  value: AuthoredItem
  onChange(value: RuntimeItemDefinition): void
}) {
  const [error, setError] = useState('')
  return (
    <section>
      <p>
        This retained Item is an authoring draft. Upload its finished artwork, resolve wrapper
        Requirements and choose Upgrade to configure inventory behavior.
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            onChange(upgradeRetainedItem(value))
            setError('')
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : 'Complete the retained Item before upgrading.',
            )
          }
        }}
      >
        Upgrade to runtime Item
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}
function changeClass(value: RuntimeItemDefinition, itemClass: ItemClass): RuntimeItemDefinition {
  const equippable = ['armor', 'hand-armor', 'weapon', 'battle-item'].includes(itemClass)
  const behavior =
    itemClass === 'weapon'
      ? defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability
      : itemClass === 'battle-item'
        ? defaultBasicSkills().find((row) => row.id === 'basic.recover')!.ability
        : null
  const role = itemClass === 'weapon' ? 'attack' : 'use'
  const { equipRequirements, ...identity } = value
  return {
    ...identity,
    ...(equippable && equipRequirements ? { equipRequirements } : {}),
    itemClass,
    inventoryCategory: categories[itemClass],
    qualityPoints: equippable ? Math.max(1, value.qualityPoints) : 0,
    equipment: equippable ? { slot: itemClass === 'armor' ? 'body' : 'hand', hands: 1 } : null,
    maximumStack: categories[itemClass] === 'gear' ? 1 : 99,
    battleUses: itemClass === 'battle-item' ? 3 : null,
    ability: behavior ? structuredClone(behavior) : null,
    actions: behavior
      ? {
          [role]: {
            behaviorId: behavior.behaviors[0]!.id,
            name: itemClass === 'weapon' ? 'Attack' : 'Use',
          },
        }
      : {},
  }
}
export function RuntimeItemEditor({
  value,
  onChange,
  disciplines = [],
}: {
  value: RuntimeItemDefinition
  onChange(value: RuntimeItemDefinition): void
  disciplines?: readonly { id: string; name: string }[]
}) {
  const [classChoice, setClassChoice] = useState(value.itemClass)
  const set = (patch: Partial<RuntimeItemDefinition>) => onChange({ ...value, ...patch })
  const manuals =
    value.ability?.behaviors.filter(
      (row) => row.activation === 'manual' && row.mode === 'action',
    ) ?? []
  const roles =
    value.itemClass === 'weapon'
      ? (['attack'] as const)
      : value.itemClass === 'battle-item'
        ? (['use'] as const)
        : value.equipment
          ? (['support'] as const)
          : []
  let preview: ReturnType<typeof presentItem> | null = null
  let issue = ''
  try {
    preview = presentItem(parseRuntimeItemDefinition(value))
  } catch (cause) {
    issue = cause instanceof Error ? cause.message : 'Complete the Item fields.'
  }
  return (
    <>
      <fieldset className={styles.typedGroup}>
        <legend>Inventory</legend>
        <AbilitySelect
          label="Class"
          value={categories[classChoice]}
          options={inventoryClasses}
          optionLabels={Object.fromEntries(
            inventoryClasses.map((category) => [category, itemCategoryLabel(category)]),
          )}
          onChange={(category) =>
            setClassChoice(
              category === value.inventoryCategory ? value.itemClass : defaultClassType[category],
            )
          }
        />
        {categories[classChoice] === 'gear' ? (
          <AbilitySelect
            label="Type"
            value={classChoice as (typeof gearTypes)[number]}
            options={gearTypes}
            optionLabels={Object.fromEntries(
              gearTypes.map((itemClass) => [itemClass, itemClassLabel(itemClass)]),
            )}
            onChange={setClassChoice}
          />
        ) : (
          <p>Type: {classChoice === 'battle-item' ? 'Consumable' : 'N/A'}</p>
        )}
        {classChoice !== value.itemClass ? (
          <>
            <p>
              Changing class resets behavior groups and bindings. Save a copy first if you want to
              retain them.
            </p>
            <button type="button" onClick={() => onChange(changeClass(value, classChoice))}>
              Apply class and reset behaviors
            </button>
          </>
        ) : null}
        <AbilitySelect
          label="Tier"
          value={value.tier}
          options={['D', 'C', 'B', 'A', 'S']}
          onChange={(tier) => set({ tier })}
        />
        <AbilityNumber
          label="Quality Points"
          value={value.qualityPoints}
          min={value.equipment ? 1 : 0}
          max={value.equipment ? 100 : 0}
          onChange={(qualityPoints) => set({ qualityPoints })}
        />
        {value.equipment ? (
          <>
            {value.itemClass === 'armor' || value.itemClass === 'hand-armor' ? (
              <AbilitySelect
                label="Position"
                value={value.equipment.slot}
                options={['head', 'body', 'pants', 'boots', 'hand'] as const}
                optionLabels={{
                  head: 'Head',
                  body: 'Body',
                  pants: 'Pants',
                  boots: 'Boots',
                  hand: 'Off Hand (Gloves)',
                }}
                onChange={(slot) => {
                  const itemClass = slot === 'hand' ? 'hand-armor' : 'armor'
                  setClassChoice(itemClass)
                  set({ itemClass, equipment: { slot, hands: 1 } })
                }}
              />
            ) : (
              <p>
                Position:{' '}
                {value.itemClass === 'weapon' ? 'Main Hand' : 'Consumable 1 or Consumable 2'}
              </p>
            )}
            {value.itemClass === 'weapon' ? (
              <AbilitySelect
                label="Hands"
                value={String(value.equipment.hands)}
                options={['1', '2']}
                onChange={(hands) =>
                  set({ equipment: { ...value.equipment!, hands: Number(hands) as 1 | 2 } })
                }
              />
            ) : null}
            {value.itemClass === 'weapon' && value.equipment.hands === 2 ? (
              <p>
                Uses both hands and blocks Off Hand armor. Both consumable slots remain available.
              </p>
            ) : null}
          </>
        ) : (
          <p>Position: N/A</p>
        )}
        <AbilityNumber
          label="Maximum stack"
          value={value.maximumStack}
          min={1}
          max={value.inventoryCategory === 'gear' ? 1 : 99}
          onChange={(maximumStack) => set({ maximumStack })}
        />
        {value.itemClass === 'battle-item' ? (
          <AbilityNumber
            label="Battle uses"
            value={value.battleUses ?? 1}
            min={1}
            max={99}
            onChange={(battleUses) => set({ battleUses })}
          />
        ) : null}
      </fieldset>
      {value.equipment ? (
        <ItemEquipRequirementsEditor
          value={value.equipRequirements}
          disciplines={disciplines}
          onChange={(equipRequirements) => {
            const item = { ...value }
            if (equipRequirements) item.equipRequirements = equipRequirements
            else delete item.equipRequirements
            onChange(item)
          }}
        />
      ) : null}
      {value.equipment ? (
        <fieldset className={styles.typedGroup}>
          <legend>Behavior groups and bindings</legend>
          {!value.ability ? (
            <button
              type="button"
              onClick={() =>
                set({
                  ability: structuredClone(
                    defaultBasicSkills().find((row) => row.id === 'basic.recover')!.ability,
                  ),
                })
              }
            >
              Add behavior groups
            </button>
          ) : (
            <AbilityDefinitionEditor
              value={value.ability}
              contentId={value.id}
              allowEffectDescriptions={false}
              onChange={(ability) => set({ ability })}
            />
          )}
          {roles.map((role) => {
            const label =
              role === 'attack' ? 'Basic Attack' : role === 'use' ? 'Consumable action' : 'Support'
            const binding = value.actions?.[role]
            const automatic =
              role !== 'support' && manuals.length === 1 && binding?.behaviorId === manuals[0]!.id
            const controls = (
              <div>
                {!automatic ? (
                  <AbilitySelect
                    label={role === 'use' ? label : `${label} action`}
                    value={binding?.behaviorId ?? ''}
                    options={['', ...manuals.map((row) => row.id)]}
                    optionLabels={Object.fromEntries([
                      ['', 'None'],
                      ...manuals.map((row) => [
                        row.id,
                        `Behavior ${value.ability!.behaviors.indexOf(row) + 1} · ${row.classification[0]!.toUpperCase() + row.classification.slice(1)}`,
                      ]),
                      ...(binding && !manuals.some((row) => row.id === binding.behaviorId)
                        ? [[binding.behaviorId, 'Unavailable action — choose a replacement']]
                        : []),
                    ])}
                    onChange={(behaviorId) => {
                      const actions = { ...value.actions }
                      if (behaviorId) actions[role] = { behaviorId, name: binding?.name ?? label }
                      else delete actions[role]
                      set({ actions })
                    }}
                  />
                ) : null}
                {binding ? (
                  <AbilityText
                    label={`${label} name`}
                    value={binding.name}
                    onChange={(name) =>
                      set({
                        actions: { ...value.actions, [role]: { ...binding, name } },
                      })
                    }
                  />
                ) : null}
              </div>
            )
            return role === 'support' && !binding ? (
              <details key={role}>
                <summary>Optional Support action</summary>
                {controls}
              </details>
            ) : (
              <div key={role}>{controls}</div>
            )
          })}
        </fieldset>
      ) : null}
      <details open>
        <summary>Item preview</summary>
        {preview ? <ItemDetails item={preview} /> : <p role="status">{issue}</p>}
      </details>
    </>
  )
}
