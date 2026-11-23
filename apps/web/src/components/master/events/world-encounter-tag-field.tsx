'use client'

import { useEffect, useState } from 'react'
import { encounterNpcEndpoint, WorldEncounterSectorField } from './world-encounter-picker'
import styles from './event-builder.module.css'

export function WorldEncounterTagField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (tag: string) => void
}) {
  const [browsing, setBrowsing] = useState(false)
  return (
    <div className={styles.encounterTagField}>
      <label>
        {label}
        <input value={value} maxLength={32} onChange={(event) => onChange(event.target.value)} />
      </label>
      <details onToggle={(event) => setBrowsing(event.currentTarget.open)}>
        <summary>Browse published tags</summary>
        {browsing && <PublishedTagChoices value={value} onChange={onChange} />}
      </details>
    </div>
  )
}

function PublishedTagChoices({
  value,
  onChange,
}: {
  value: string
  onChange: (tag: string) => void
}) {
  const [sectorId, setSectorId] = useState('')
  const [catalogue, setCatalogue] = useState<{
    sectorId: string
    tags: string[] | 'unavailable'
  } | null>(null)
  const result = catalogue?.sectorId === sectorId ? catalogue.tags : null
  const tags = Array.isArray(result) ? result : []

  useEffect(() => {
    if (!sectorId) return
    const controller = new AbortController()
    async function loadTags() {
      try {
        const query = new URLSearchParams({ sectorId, view: 'tags' })
        const response = await fetch(`${encounterNpcEndpoint}?${query}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Published tags are unavailable.')
        const data = (await response.json()) as { tags: string[] }
        if (!controller.signal.aborted) setCatalogue({ sectorId, tags: data.tags })
      } catch {
        if (!controller.signal.aborted) setCatalogue({ sectorId, tags: 'unavailable' })
      }
    }
    void loadTags()
    return () => controller.abort()
  }, [sectorId])

  let placeholder = 'Choose a sector first'
  if (sectorId) {
    if (result === null) placeholder = 'Loading published tags…'
    else if (result === 'unavailable') placeholder = 'Published tags could not be loaded'
    else if (tags.length === 0) placeholder = 'No published tags in this sector'
    else placeholder = 'Choose a published tag'
  }

  return (
    <div className={styles.encounterTagChoices}>
      <WorldEncounterSectorField
        label="Encounter tag sector"
        value={sectorId}
        placeholder="Choose a sector to browse tags"
        onChange={(next) => {
          setCatalogue(null)
          setSectorId(next)
        }}
      />
      <label>
        Published encounter tag
        <select
          aria-label="Published encounter tag"
          value={tags.includes(value) ? value : ''}
          disabled={tags.length === 0}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
