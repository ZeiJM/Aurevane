'use client'
import type {
  EventObjectiveDefinition,
  EventWorldNavigation,
} from '@aurevane/game-core/events/persistent-event'
import { WORLD_REGIONS } from '@/world/catalog'
export function EventNavigationFields({
  value,
  onChange,
}: {
  value: EventObjectiveDefinition['worldNavigation']
  onChange: (value: EventObjectiveDefinition['worldNavigation']) => void
}) {
  const patch = (update: Partial<EventWorldNavigation>) => onChange({ ...value!, ...update })
  return (
    <fieldset style={{ width: '100%' }}>
      <legend>World map guidance</legend>
      <label>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? { sectorId: 'verdant-expanse', x: 12, y: 4, autoPath: true, guidance: 'exact' }
                : null,
            )
          }
        />
        Show this objective on the map
      </label>
      {value ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem' }}>
          <label>
            Region{' '}
            <select value={value.sectorId} onChange={(e) => patch({ sectorId: e.target.value })}>
              {WORLD_REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cell X{' '}
            <input
              type="number"
              min={0}
              max={12}
              value={value.x}
              onChange={(e) => patch({ x: Number(e.target.value) })}
            />
          </label>
          <label>
            Cell Y{' '}
            <input
              type="number"
              min={0}
              max={8}
              value={value.y}
              onChange={(e) => patch({ y: Number(e.target.value) })}
            />
          </label>
          <label>
            Guidance{' '}
            <select
              value={value.guidance}
              onChange={(e) => patch({ guidance: e.target.value as 'exact' | 'clue' })}
            >
              <option value="exact">Exact destination</option>
              <option value="clue">Clues only</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={value.autoPath}
              onChange={(e) => patch({ autoPath: e.target.checked })}
            />
            Allow auto-path for this objective
          </label>
          <small>
            Published settings apply to new runs. Only live production phases appear on the map;
            clue guidance conceals the destination and prevents auto-path.
          </small>
        </div>
      ) : null}
    </fieldset>
  )
}
