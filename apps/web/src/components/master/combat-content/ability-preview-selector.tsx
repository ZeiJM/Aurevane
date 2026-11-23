'use client'

import {
  validateAbilityDefinition,
  type AbilityBehavior,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import styles from './combat-content-editor.module.css'
import previewStyles from './ability-preview-selector.module.css'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import {
  DEFAULT_COMBAT_CONTENT_EVENT_SAMPLE,
  type CombatContentEventSample,
} from './combat-content-workflow'

const referenceSkills = latestEnabledMatureSkills()

export interface ModifierPreviewRoot {
  readonly skillId: string
  readonly behaviorId?: string
  readonly eventSample?: CombatContentEventSample
}

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
    (group) =>
      group.activation === 'manual' ||
      (group.activation === 'automatic' && group.mode === 'action') ||
      (group.activation === 'ongoing' && group.mode === 'modifier'),
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
    <div className={previewStyles.selection} aria-label="Battle preview selection">
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
                {group.activation === 'ongoing'
                  ? 'Ongoing'
                  : group.activation === 'automatic'
                    ? 'Automatic'
                    : 'Manual'}{' '}
                {group.mode === 'modifier' ? 'Modifier' : 'Action'} {index + 1} · {group.id}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p role="status">{selection.message}</p>
      )}
    </div>
  )
}

export function ModifierPreviewRootSelector({
  root,
  busy,
  onChange,
  automatic = false,
}: {
  readonly root: ModifierPreviewRoot
  readonly busy: boolean
  readonly onChange: (root: ModifierPreviewRoot) => void
  readonly automatic?: boolean
}) {
  const sample = root.eventSample ?? DEFAULT_COMBAT_CONTENT_EVENT_SAMPLE
  return (
    <div
      className={previewStyles.selection}
      aria-label={automatic ? 'Automatic event sample settings' : 'Modifier reference action'}
    >
      <label className={styles.field}>
        <span>Reference action</span>
        <select
          aria-label="Reference action"
          disabled={busy}
          value={root.skillId}
          onChange={(event) =>
            onChange({ ...root, skillId: event.currentTarget.value, behaviorId: undefined })
          }
        >
          <option value="unarmed.basic">Basic Attack</option>
          {referenceSkills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.id}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Reference action group (optional for a single action)</span>
        <input
          aria-label="Reference action group"
          disabled={busy}
          value={root.behaviorId ?? ''}
          onChange={(event) =>
            onChange({ ...root, behaviorId: event.currentTarget.value || undefined })
          }
        />
      </label>
      {automatic ? (
        <>
          <label className={styles.field}>
            <span>Reference actor</span>
            <select
              aria-label="Reference actor"
              disabled={busy}
              value={sample.referenceActor}
              onChange={(event) =>
                onChange({
                  ...root,
                  eventSample: {
                    ...sample,
                    referenceActor: event.currentTarget
                      .value as CombatContentEventSample['referenceActor'],
                  },
                })
              }
            >
              <option value="owner">Owner uses reference action</option>
              <option value="opponent">Opponent uses reference action</option>
            </select>
          </label>
          {(['ownerHpPercent', 'ownerMpPercent'] as const).map((key) => (
            <label className={styles.field} key={key}>
              <span>
                {key === 'ownerHpPercent' ? 'Owner starting HP (%)' : 'Owner starting MP (%)'}
              </span>
              <input
                type="number"
                aria-label={
                  key === 'ownerHpPercent' ? 'Owner starting HP (%)' : 'Owner starting MP (%)'
                }
                min={key === 'ownerHpPercent' ? 1 : 0}
                max={100}
                step={1}
                disabled={busy}
                value={sample[key]}
                onChange={(event) =>
                  onChange({
                    ...root,
                    eventSample: { ...sample, [key]: Number(event.currentTarget.value) },
                  })
                }
              />
            </label>
          ))}
          <label className={styles.field}>
            <span>Owner starting status</span>
            <select
              aria-label="Owner starting status"
              disabled={busy}
              value={sample.ownerStatus}
              onChange={(event) =>
                onChange({
                  ...root,
                  eventSample: {
                    ...sample,
                    ownerStatus: event.currentTarget
                      .value as CombatContentEventSample['ownerStatus'],
                  },
                })
              }
            >
              <option value="none">None</option>
              <option value="poison">Poison</option>
            </select>
          </label>
          <p>
            Runs one current reference command in a seeded local battle. Requirements remain in
            force. It does not advance later turns.
          </p>
        </>
      ) : (
        <p>
          The server resolves the current reference version. Costs and outcomes describe the
          complete combined command; Requirements remain in force.
        </p>
      )}
    </div>
  )
}
