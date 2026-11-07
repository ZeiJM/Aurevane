'use client'

import { useEffect, useState } from 'react'
import type { PersonalInventoryRestorationTrial } from '@aurevane/game-core/events/persistent-event'
import type { EventWorkspaceCatalogue } from '@/server/master/event-authoring-service'
import { CHARTED_SECTORS } from '@/world/catalog'
import styles from './event-builder.module.css'

type Rewards = readonly EventWorkspaceCatalogue['rewards'][number][]
type Choice = { id: string; name: string }
type SavedEncounter = Choice & { sectorId: string }
type SavedEncounterLookup = { npcId: string; npc: SavedEncounter | null | 'unavailable' }
const trialNpcEndpoint = '/api/master/events/restoration-trial-npcs'
const defaultSectors: readonly Choice[] = CHARTED_SECTORS
type EncounterCatalogue = {
  sectorId: string
  npcs: Choice[] | 'unavailable'
}

function RouteReward({
  label,
  value,
  other,
  rewards,
  change,
}: {
  label: string
  value: string
  other: string
  rewards: Rewards
  change: (next: string) => void
}) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => change(event.target.value)}>
        <option value="">{rewards.length ? 'Choose a package' : 'No XP packages available'}</option>
        {value && !rewards.some((reward) => reward.key === value) ? (
          <option value={value}>{value} · unavailable</option>
        ) : null}
        {rewards.map((reward) => (
          <option
            key={reward.key}
            value={reward.key}
            disabled={reward.key === other && reward.key !== value}
          >
            {reward.label} · {reward.key}
          </option>
        ))}
      </select>
    </label>
  )
}

export function InventoryRestorationTrialFields({
  trial,
  recoveryReward,
  recoverySectorId,
  rewards,
  changeTrial,
  changeRecoveryReward,
}: {
  trial: PersonalInventoryRestorationTrial
  recoveryReward: string
  recoverySectorId: string
  rewards: Rewards
  changeTrial: (next: PersonalInventoryRestorationTrial) => void
  changeRecoveryReward: (next: string) => void
}) {
  const [sectorOverride, setSectorOverride] = useState<string>()
  const [sectorOptions, setSectorOptions] = useState(defaultSectors)
  const [catalogue, setCatalogue] = useState<EncounterCatalogue | null>(null)
  const [savedLookup, setSavedLookup] = useState<SavedEncounterLookup | null>(null)
  const { npcId } = trial
  const savedResult = savedLookup?.npcId === npcId ? savedLookup.npc : undefined
  const savedNpc = savedResult === 'unavailable' ? undefined : savedResult
  const locatingSavedNpc = Boolean(npcId) && savedResult === undefined
  const sectorId =
    sectorOverride ?? savedNpc?.sectorId ?? (locatingSavedNpc ? '' : recoverySectorId)
  const result = catalogue?.sectorId === sectorId ? catalogue.npcs : null
  const npcs = Array.isArray(result) ? result : []

  useEffect(() => {
    const controller = new AbortController()
    async function loadTrialSectors() {
      try {
        const response = await fetch(trialNpcEndpoint, { signal: controller.signal })
        if (!response.ok) return
        const { sectors } = (await response.json()) as { sectors: Choice[] }
        if (!controller.signal.aborted) setSectorOptions(sectors)
      } catch {
        // Keep the built-in sector choices when the full map list is unavailable.
      }
    }
    void loadTrialSectors()
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
        const response = await fetch(`${trialNpcEndpoint}?npcId=${encodeURIComponent(npcId)}`, {
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
          `${trialNpcEndpoint}?sectorId=${encodeURIComponent(sectorId)}`,
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
    <fieldset className={styles.restorationTrial}>
      <legend>Combat trial</legend>
      <p>
        Choose a published World encounter. The character must win it and return to the restoration
        giver. Both routes grant the same weapon; choose a different Character XP amount for each.
      </p>
      <div className={styles.grid}>
        <label>
          Trial sector
          <select
            aria-label="Trial sector"
            value={sectorId}
            onChange={(event) => setSectorOverride(event.target.value)}
          >
            <option value="">
              {locatingSavedNpc
                ? 'Locating saved encounter…'
                : 'Choose a sector to list encounters'}
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
          Trial encounter NPC
          <select
            aria-label="Trial encounter NPC"
            value={trial.npcId}
            onChange={(event) => changeTrial({ ...trial, npcId: event.target.value })}
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
                  `${savedResult === null ? 'Unavailable trial NPC' : 'Saved NPC'} · ${npcId}`}
              </option>
            ) : null}
            {npcs.map((npc) => (
              <option key={npc.id} value={npc.id}>
                {npc.name}
              </option>
            ))}
          </select>
        </label>
        <RouteReward
          label="Recovery Character XP package"
          value={recoveryReward}
          other={trial.rewardPackageRef}
          rewards={rewards}
          change={changeRecoveryReward}
        />
        <RouteReward
          label="Trial Character XP package"
          value={trial.rewardPackageRef}
          other={recoveryReward}
          rewards={rewards}
          change={(rewardPackageRef) => changeTrial({ ...trial, rewardPackageRef })}
        />
      </div>
      <div className={`${styles.grid} ${styles.restorationTrialDialogue}`}>
        {(
          [
            ['offer', 'Trial offer'],
            ['active', 'Trial guidance'],
            ['ready', 'Trial ready to restore'],
          ] as const
        ).map(([field, label]) => (
          <label key={field}>
            {label}
            <textarea
              aria-label={label}
              rows={2}
              maxLength={800}
              value={trial[field]}
              onChange={(event) => changeTrial({ ...trial, [field]: event.target.value })}
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
