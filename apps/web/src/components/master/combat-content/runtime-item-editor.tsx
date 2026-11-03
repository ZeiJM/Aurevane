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
import { ItemDetails } from '@/components/character/item-details'
import { presentItem } from '@/lib/items/item-presentation'
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
const classes = Object.keys(categories) as ItemClass[]
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
  return {
    ...value,
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
}: {
  value: RuntimeItemDefinition
  onChange(value: RuntimeItemDefinition): void
}) {
  const [classChoice, setClassChoice] = useState(value.itemClass)
  const set = (patch: Partial<RuntimeItemDefinition>) => onChange({ ...value, ...patch })
  const manuals =
    value.ability?.behaviors.filter(
      (row) => row.activation === 'manual' && row.mode === 'action',
    ) ?? []
  const roles =
    value.itemClass === 'weapon'
      ? (['attack', 'support'] as const)
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
          label="Item class"
          value={classChoice}
          options={classes}
          onChange={setClassChoice}
        />
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
        <p>Inventory category: {value.inventoryCategory.replaceAll('-', ' ')}</p>
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
            <AbilitySelect
              label="Equipment slot"
              value={value.equipment.slot}
              options={value.itemClass === 'armor' ? ['head', 'body', 'pants', 'boots'] : ['hand']}
              onChange={(slot) => set({ equipment: { ...value.equipment!, slot } })}
            />
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
          </>
        ) : null}
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
          {roles.map((role) => (
            <div key={role}>
              <AbilitySelect
                label={`${role[0]!.toUpperCase() + role.slice(1)} binding`}
                value={value.actions?.[role]?.behaviorId ?? ''}
                options={['', ...manuals.map((row) => row.id)]}
                optionLabels={{ '': 'None' }}
                onChange={(behaviorId) => {
                  const actions = { ...value.actions }
                  if (behaviorId)
                    actions[role] = { behaviorId, name: value.actions?.[role]?.name ?? role }
                  else delete actions[role]
                  set({ actions })
                }}
              />
              {value.actions?.[role] ? (
                <AbilityText
                  label={`${role} name`}
                  value={value.actions[role]!.name}
                  onChange={(name) =>
                    set({
                      actions: { ...value.actions, [role]: { ...value.actions![role]!, name } },
                    })
                  }
                />
              ) : null}
            </div>
          ))}
        </fieldset>
      ) : null}
      <details open>
        <summary>Item preview</summary>
        {preview ? <ItemDetails item={preview} /> : <p role="status">{issue}</p>}
      </details>
    </>
  )
}
