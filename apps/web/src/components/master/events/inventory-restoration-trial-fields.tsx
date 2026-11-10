'use client'

import type { PersonalInventoryRestorationTrial } from '@aurevane/game-core/events/persistent-event'
import type { EventWorkspaceCatalogue } from '@/server/master/event-authoring-service'
import { EventXpPackageField } from './event-xp-package-field'
import { WorldEncounterPicker } from './world-encounter-picker'
import styles from './event-builder.module.css'

type Rewards = readonly EventWorkspaceCatalogue['rewards'][number][]
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
  return (
    <fieldset className={styles.restorationTrial}>
      <legend>Combat trial</legend>
      <p>
        Choose a published World encounter. The character must win it and return to the restoration
        giver. Both routes grant the same weapon; choose a different Character XP amount for each.
      </p>
      <div className={styles.grid}>
        <WorldEncounterPicker
          npcId={trial.npcId}
          fallbackSectorId={recoverySectorId}
          sectorLabel="Trial sector"
          npcLabel="Trial encounter NPC"
          unavailableLabel="Unavailable trial NPC"
          onChange={(npcId) => changeTrial({ ...trial, npcId })}
        />
        <EventXpPackageField
          label="Recovery Character XP package"
          value={recoveryReward}
          other={trial.rewardPackageRef}
          rewards={rewards}
          change={changeRecoveryReward}
        />
        <EventXpPackageField
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
