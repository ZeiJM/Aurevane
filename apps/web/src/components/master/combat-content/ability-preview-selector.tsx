'use client'

import {
  validateAbilityDefinition,
  type AbilityBehavior,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import styles from './combat-content-editor.module.css'

interface PreviewActionSelection {
  readonly available: boolean
  readonly canonical: boolean
  readonly groups: readonly AbilityBehavior[]
  readonly behaviorId?: string
  readonly message?: string
}

export function previewActionSelection(
  definition: { readonly ability?: AbilityDefinition } | null | undefined,
  requestedId?: string,
): PreviewActionSelection {
  if (!definition) return { available: false, canonical: false, groups: [] }
  if (!Object.hasOwn(definition, 'ability'))
    return { available: true, canonical: false, groups: [] }
  if (validateAbilityDefinition(definition.ability).length > 0)
    return {
      available: false,
      canonical: true,
      groups: [],
      message: 'Resolve Ability compatibility to preview an action group.',
    }
  const groups = definition.ability!.behaviors.filter(
    (group) => group.activation === 'manual' && group.mode === 'action',
  )
  const selected = groups.find((group) => group.id === requestedId) ?? groups[0]
  return selected
    ? { available: true, canonical: true, groups, behaviorId: selected.id }
    : {
        available: false,
        canonical: true,
        groups,
        message: 'No Manual action group is available for a battle preview.',
      }
}

export function AbilityPreviewSelector({
  selection,
  busy,
  onChange,
}: {
  readonly selection: PreviewActionSelection
  readonly busy: boolean
  readonly onChange: (behaviorId: string) => void
}) {
  if (!selection.canonical) return null
  return (
    <section className={styles.tags} aria-label="Battle preview selection">
      {selection.available ? (
        <label className={styles.field}>
          <span>Preview action group</span>
          <select
            aria-label="Preview action group"
            value={selection.behaviorId}
            disabled={busy}
            onChange={(event) => onChange(event.currentTarget.value)}
          >
            {selection.groups.map((group, index) => (
              <option key={group.id} value={group.id}>
                Manual Action {index + 1} · {group.id}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p role="status">{selection.message}</p>
      )}
    </section>
  )
}
