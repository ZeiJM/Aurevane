'use client'

import type {
  PersonalInventoryRestoration,
  PersonalInventoryRestorationTrial,
} from '@aurevane/game-core/events/persistent-event'
import type { EventWorkspaceCatalogue } from '@/server/master/event-authoring-service'
import { CHARTED_SECTORS, GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import type { StoryNpcCatalogue } from './event-phase-cast'
import { InventoryRestorationTrialFields } from './inventory-restoration-trial-fields'
import styles from './event-builder.module.css'

const initialRestoration: PersonalInventoryRestoration = {
  giverNpcId: '',
  checkpoint: { sectorId: 'verdant-expanse', x: 12, y: 4 },
  outputItemId: '',
  offer: '',
  travel: '',
  ready: '',
  completed: '',
}

const initialTrial: PersonalInventoryRestorationTrial = {
  npcId: '',
  offer: '',
  active: '',
  ready: '',
  rewardPackageRef: '',
}

export function InventoryRestorationFields({
  value,
  storyNpcs,
  rewards,
  canUseGlobalScope,
  change,
}: {
  value?: PersonalInventoryRestoration
  storyNpcs: StoryNpcCatalogue
  rewards: readonly EventWorkspaceCatalogue['rewards'][number][]
  canUseGlobalScope: boolean
  change: (next: PersonalInventoryRestoration | undefined) => void
}) {
  const npcs = Array.isArray(storyNpcs) ? storyNpcs : []

  return (
    <>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={!canUseGlobalScope && !value}
          onChange={(event) => change(event.target.checked ? initialRestoration : undefined)}
        />
        Enable a recovery route
      </label>
      {value && (
        <fieldset className={`${styles.compositionGroup} ${styles.restorationFields}`}>
          <legend>Inventory restoration</legend>
          <p>
            Recovery is private to characters who discover the clue. They choose the route, reach
            the checkpoint, and return to the giver to trade one of each fragment for the weapon.
          </p>
          <p>
            Choose a Story NPC with a committed World placement and use the ID of an enabled
            hand-slot Weapon from Game Content.
          </p>
          {storyNpcs === 'unavailable' ? (
            <p role="status">Story NPCs could not be loaded.</p>
          ) : null}
          <div className={styles.grid}>
            <label>
              Restoration giver
              <select
                aria-label="Restoration giver"
                value={value.giverNpcId}
                onChange={(event) => change({ ...value, giverNpcId: event.target.value })}
              >
                <option value="">
                  {storyNpcs === null
                    ? 'Loading Story NPCs…'
                    : npcs.length
                      ? 'Choose a published Story NPC'
                      : 'No published Story NPCs available'}
                </option>
                {value.giverNpcId && !npcs.some((npc) => npc.id === value.giverNpcId) ? (
                  <option value={value.giverNpcId}>
                    {Array.isArray(storyNpcs) ? 'Unavailable Story NPC' : 'Saved NPC reference'}
                  </option>
                ) : null}
                {npcs.map((npc) => (
                  <option key={npc.id} value={npc.id}>
                    {npc.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Restored weapon Item ID
              <input
                value={value.outputItemId}
                maxLength={160}
                onChange={(event) => change({ ...value, outputItemId: event.target.value })}
              />
            </label>
          </div>
          <fieldset className={styles.restorationCheckpoint}>
            <legend>Restoration checkpoint</legend>
            <label>
              Sector
              <select
                aria-label="Sector"
                value={value.checkpoint.sectorId}
                onChange={(event) =>
                  change({
                    ...value,
                    checkpoint: { ...value.checkpoint, sectorId: event.target.value },
                  })
                }
              >
                {!CHARTED_SECTORS.some((sector) => sector.id === value.checkpoint.sectorId) ? (
                  <option value={value.checkpoint.sectorId}>Unavailable sector</option>
                ) : null}
                {CHARTED_SECTORS.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </label>
            {(['x', 'y'] as const).map((axis) => (
              <label key={axis}>
                Cell {axis.toUpperCase()}
                <input
                  type="number"
                  min={0}
                  max={(axis === 'x' ? GRID_WIDTH : GRID_HEIGHT) - 1}
                  value={value.checkpoint[axis]}
                  onChange={(event) =>
                    change({
                      ...value,
                      checkpoint: { ...value.checkpoint, [axis]: Number(event.target.value) },
                    })
                  }
                />
              </label>
            ))}
          </fieldset>
          <div className={styles.grid}>
            {(
              [
                ['offer', 'Recovery offer'],
                ['travel', 'Recovery guidance'],
                ['ready', 'Ready to restore'],
                ['completed', 'Restoration completion'],
              ] as const
            ).map(([field, label]) => (
              <label key={field}>
                {label}
                <textarea
                  aria-label={label}
                  maxLength={800}
                  value={value[field]}
                  onChange={(event) => change({ ...value, [field]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={Boolean(value.trial)}
              disabled={!canUseGlobalScope && !value.trial}
              onChange={(event) =>
                change({
                  ...value,
                  trial: event.target.checked ? initialTrial : undefined,
                  recoveryRewardPackageRef: event.target.checked ? '' : undefined,
                })
              }
            />
            Enable a combat trial
          </label>
          {value.trial ? (
            <InventoryRestorationTrialFields
              trial={value.trial}
              recoveryReward={value.recoveryRewardPackageRef ?? ''}
              recoverySectorId={value.checkpoint.sectorId}
              rewards={rewards}
              changeTrial={(trial) => change({ ...value, trial })}
              changeRecoveryReward={(recoveryRewardPackageRef) =>
                change({ ...value, recoveryRewardPackageRef })
              }
            />
          ) : null}
        </fieldset>
      )}
    </>
  )
}
