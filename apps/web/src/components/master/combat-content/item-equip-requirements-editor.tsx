'use client'
import styles from './item-equip-requirements-editor.module.css'
import { CHARACTER_ATTRIBUTE_IDS } from '@aurevane/game-core/character/creation'
import type { ItemEquipRequirements } from '@aurevane/game-core/character/item-equip-requirements'
export function ItemEquipRequirementsEditor({
  value,
  onChange,
  disciplines = [],
  disabled = false,
}: {
  value?: ItemEquipRequirements
  onChange: (value: ItemEquipRequirements | undefined) => void
  disciplines?: readonly { id: string; name: string }[]
  disabled?: boolean
}) {
  const update = (next: ItemEquipRequirements) => {
    const clean = Object.fromEntries(
      Object.entries(next).filter(
        ([, v]) => v !== undefined && (typeof v !== 'object' || Object.keys(v).length),
      ),
    )
    onChange(Object.keys(clean).length ? clean : undefined)
  }
  const choices = [
    ...disciplines,
    ...(value?.disciplineIds ?? [])
      .filter((id) => !disciplines.some((d) => d.id === id))
      .map((id) => ({ id, name: id })),
  ]
  return (
    <fieldset disabled={disabled} className={styles.requirements}>
      <legend>Equip requirements (optional)</legend>
      <label>
        Minimum level
        <input
          aria-label="Minimum level"
          type="number"
          min={1}
          step={1}
          value={value?.minimumLevel ?? ''}
          onChange={(event) =>
            update({
              ...value,
              minimumLevel: event.target.value === '' ? undefined : Number(event.target.value),
            })
          }
        />
      </label>
      <fieldset className={styles.disciplines}>
        <legend>Allowed equipped disciplines (any)</legend>
        <div className={styles.choices}>
          {choices.map((d) => (
            <label key={d.id}>
              <input
                type="checkbox"
                checked={value?.disciplineIds?.includes(d.id) ?? false}
                onChange={(event) =>
                  update({
                    ...value,
                    disciplineIds: event.target.checked
                      ? [...(value?.disciplineIds ?? []), d.id]
                      : value?.disciplineIds?.filter((id) => id !== d.id),
                  })
                }
              />
              {d.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className={styles.stats}>
        {CHARACTER_ATTRIBUTE_IDS.map((id) => (
          <label key={id}>
            Base {id.charAt(0).toUpperCase() + id.slice(1)}
            <input
              aria-label={`Base ${id.charAt(0).toUpperCase() + id.slice(1)}`}
              type="number"
              min={1}
              step={1}
              value={value?.minimumCoreStats?.[id] ?? ''}
              onChange={(event) => {
                const stats = { ...value?.minimumCoreStats }
                if (event.target.value === '') delete stats[id]
                else stats[id] = Number(event.target.value)
                update({ ...value, minimumCoreStats: stats })
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
