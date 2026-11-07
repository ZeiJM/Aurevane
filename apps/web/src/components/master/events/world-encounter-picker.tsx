'use client'

import { useEffect, useState } from 'react'
import { CHARTED_SECTORS } from '@/world/catalog'

type Choice = { id: string; name: string }
type SavedEncounter = Choice & { sectorId: string }
type SavedEncounterLookup = { npcId: string; npc: SavedEncounter | null | 'unavailable' }
const encounterNpcEndpoint = '/api/master/events/restoration-trial-npcs'
const defaultSectors: readonly Choice[] = CHARTED_SECTORS
type EncounterCatalogue = {
  sectorId: string
  npcs: Choice[] | 'unavailable'
}

export function WorldEncounterPicker({
  npcId,
  fallbackSectorId = '',
  sectorLabel,
  npcLabel,
  unavailableLabel,
  onChange,
}: {
  npcId: string
  fallbackSectorId?: string
  sectorLabel: string
  npcLabel: string
  unavailableLabel: string
  onChange: (next: string) => void
}) {
  const [sectorOverride, setSectorOverride] = useState<string>()
  const [sectorOptions, setSectorOptions] = useState(defaultSectors)
  const [catalogue, setCatalogue] = useState<EncounterCatalogue | null>(null)
  const [savedLookup, setSavedLookup] = useState<SavedEncounterLookup | null>(null)
  const savedResult = savedLookup?.npcId === npcId ? savedLookup.npc : undefined
  const savedNpc = savedResult === 'unavailable' ? undefined : savedResult
  const locatingSavedNpc = Boolean(npcId) && savedResult === undefined
  const sectorId =
    sectorOverride ?? savedNpc?.sectorId ?? (locatingSavedNpc ? '' : fallbackSectorId)
  const result = catalogue?.sectorId === sectorId ? catalogue.npcs : null
  const npcs = Array.isArray(result) ? result : []

  useEffect(() => {
    const controller = new AbortController()
    async function loadSectors() {
      try {
        const response = await fetch(encounterNpcEndpoint, { signal: controller.signal })
        if (!response.ok) return
        const { sectors } = (await response.json()) as { sectors: Choice[] }
        if (!controller.signal.aborted) setSectorOptions(sectors)
      } catch {
        // Keep the built-in sector choices when the full map list is unavailable.
      }
    }
    void loadSectors()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!npcId) return
    let request: AbortController | undefined
    async function loadSavedNpc() {
      request?.abort()
      const next = new AbortController()
      request = next
      try {
        const response = await fetch(`${encounterNpcEndpoint}?npcId=${encodeURIComponent(npcId)}`, {
          signal: next.signal,
        })
        if (!response.ok) throw new Error('The saved encounter could not be loaded.')
        const { npc } = (await response.json()) as { npc: SavedEncounter | null }
        if (!next.signal.aborted) setSavedLookup({ npcId, npc })
      } catch {
        if (!next.signal.aborted) {
          setSavedLookup((current) =>
            current?.npcId === npcId ? current : { npcId, npc: 'unavailable' },
          )
        }
      }
    }
    void loadSavedNpc()
    window.addEventListener('focus', loadSavedNpc)
    return () => {
      request?.abort()
      window.removeEventListener('focus', loadSavedNpc)
    }
  }, [npcId])

  useEffect(() => {
    if (!sectorId) return
    let request: AbortController | undefined
    async function loadEncounterNpcs() {
      request?.abort()
      const next = new AbortController()
      request = next
      try {
        const response = await fetch(
          `${encounterNpcEndpoint}?sectorId=${encodeURIComponent(sectorId)}`,
          { signal: next.signal },
        )
        if (!response.ok) throw new Error('World encounters are unavailable.')
        const { npcs } = (await response.json()) as { npcs: Choice[] }
        if (!next.signal.aborted) setCatalogue({ sectorId, npcs })
      } catch {
        if (!next.signal.aborted) setCatalogue({ sectorId, npcs: 'unavailable' })
      }
    }
    void loadEncounterNpcs()
    window.addEventListener('focus', loadEncounterNpcs)
    return () => {
      request?.abort()
      window.removeEventListener('focus', loadEncounterNpcs)
    }
  }, [sectorId])

  return (
    <>
      <label>
        {sectorLabel}
        <select
          aria-label={sectorLabel}
          value={sectorId}
          onChange={(event) => setSectorOverride(event.target.value)}
        >
          <option value="">
            {locatingSavedNpc ? 'Locating saved encounter…' : 'Choose a sector to list encounters'}
          </option>
          {sectorId && !sectorOptions.some((sector) => sector.id === sectorId) ? (
            <option value={sectorId}>{sectorId}</option>
          ) : null}
          {sectorOptions.map((sector) => (
            <option key={sector.id} value={sector.id}>
              {sector.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {npcLabel}
        <select
          aria-label={npcLabel}
          value={npcId}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">
            {!sectorId
              ? 'Choose a sector first'
              : result === null
                ? 'Loading World encounters…'
                : result === 'unavailable'
                  ? 'World encounters could not be loaded'
                  : npcs.length
                    ? 'Choose a World encounter NPC'
                    : 'No published encounters in this sector'}
          </option>
          {npcId && !npcs.some((npc) => npc.id === npcId) ? (
            <option value={npcId}>
              {savedNpc?.name ??
                `${savedResult === null ? unavailableLabel : 'Saved NPC'} · ${npcId}`}
            </option>
          ) : null}
          {npcs.map((npc) => (
            <option key={npc.id} value={npc.id}>
              {npc.name}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
