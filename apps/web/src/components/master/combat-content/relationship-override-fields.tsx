'use client'
import { MasterHelp } from '../master-help'
import type { AuthoredDiscipline } from '@aurevane/game-core/content/authored-content'
export function RelationshipOverrideFields({
  value,
  onChange,
  choices,
}: {
  value: AuthoredDiscipline
  onChange: (next: AuthoredDiscipline) => void
  choices: readonly { id: string; label: string }[]
}) {
  const selected = value.relationshipOverride
  const available = [
    ...(value.essenceId ? [{ id: '', label: 'None (Essence)' }] : []),
    ...(value.resonanceSelections ?? []).map((row) => ({
      id: row.withDisciplineId,
      label: choices.find((c) => c.id === row.withDisciplineId)?.label ?? row.withDisciplineId,
    })),
  ]
  return (
    <fieldset>
      <label>
        <input
          type="checkbox"
          checked={selected != null}
          disabled={!available.length}
          onChange={(event) =>
            onChange({
              ...value,
              relationshipOverride: event.target.checked
                ? { withDisciplineId: available[0]!.id || null }
                : null,
            })
          }
        />
        Use one relationship for all combinations
      </label>
      {selected != null && (
        <label>
          Relationship
          <select
            value={selected.withDisciplineId ?? ''}
            onChange={(event) =>
              onChange({
                ...value,
                relationshipOverride: { withDisciplineId: event.target.value || null },
              })
            }
          >
            {available.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <MasterHelp label="Relationship priority">
        Applies with any partner or no partner. If both Disciplines use this option, one fixed
        Discipline priority selects the power, regardless of which is Primary.
      </MasterHelp>
    </fieldset>
  )
}
