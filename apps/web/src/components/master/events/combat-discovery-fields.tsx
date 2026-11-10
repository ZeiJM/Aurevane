'use client'

import type { PersonalCombatDiscovery } from '@aurevane/game-core/events/persistent-event'
import type { EventWorkspaceCatalogue } from '@/server/master/event-authoring-service'
import { EventXpPackageField } from './event-xp-package-field'
import { WorldEncounterPicker } from './world-encounter-picker'
import { WorldEncounterTagField } from './world-encounter-tag-field'
import styles from './event-builder.module.css'

const initialDiscovery: PersonalCombatDiscovery = {
  npcTag: '',
  requiredDefeats: 14,
  timeZone: 'UTC',
  resetMinute: 0,
  opponentNpcId: '',
  mode: 'evergreen',
  ready: '',
  completed: '',
  firstRewardPackageRef: '',
}

export function CombatDiscoveryFields({
  value,
  rewards,
  canEnable,
  change,
}: {
  value?: PersonalCombatDiscovery
  rewards: readonly EventWorkspaceCatalogue['rewards'][number][]
  canEnable: boolean
  change: (next: PersonalCombatDiscovery | undefined) => void
}) {
  return (
    <>
      <p>
        Qualifying World victories reveal a private challenge. Set the daily reset and choose a
        published World encounter for the challenger.
      </p>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={!canEnable && !value}
          onChange={(event) => change(event.target.checked ? initialDiscovery : undefined)}
        />
        Enable a daily combat discovery
      </label>
      <p>Requires a global Hidden Discovery with one manual phase.</p>
      {value ? <ChallengeFields value={value} rewards={rewards} change={change} /> : null}
    </>
  )
}

function ChallengeFields({
  value,
  rewards,
  change,
}: {
  value: PersonalCombatDiscovery
  rewards: readonly EventWorkspaceCatalogue['rewards'][number][]
  change: (next: PersonalCombatDiscovery) => void
}) {
  const resetTime = [Math.floor(value.resetMinute / 60), value.resetMinute % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')

  return (
    <fieldset className={styles.restorationTrial}>
      <legend>Daily combat challenge</legend>
      <div className={styles.grid}>
        <WorldEncounterTagField
          label="Qualifying World encounter tag"
          value={value.npcTag}
          onChange={(npcTag) => change({ ...value, npcTag })}
        />
        <label>
          Required daily defeats
          <input
            type="number"
            min={1}
            max={50}
            value={value.requiredDefeats}
            onChange={(event) => change({ ...value, requiredDefeats: Number(event.target.value) })}
          />
        </label>
        <label>
          Calendar timezone
          <input
            value={value.timeZone}
            placeholder="Area/City"
            onChange={(event) => change({ ...value, timeZone: event.target.value })}
          />
        </label>
        <label>
          Daily reset time
          <input
            type="time"
            value={resetTime}
            onChange={(event) => {
              const [hours, minutes] = event.target.value.split(':').map(Number)
              if (hours !== undefined && minutes !== undefined) {
                change({ ...value, resetMinute: hours * 60 + minutes })
              }
            }}
          />
        </label>
        <label>
          Challenge availability
          <select
            value={value.mode}
            onChange={(event) =>
              change({
                ...value,
                mode: event.target.value === 'seasonal' ? 'seasonal' : 'evergreen',
              })
            }
          >
            <option value="evergreen">Evergreen</option>
            <option value="seasonal">Seasonal</option>
          </select>
        </label>
        <WorldEncounterPicker
          npcId={value.opponentNpcId}
          sectorLabel="Challenge sector"
          npcLabel="Challenge encounter NPC"
          unavailableLabel="Unavailable challenge NPC"
          onChange={(opponentNpcId) => change({ ...value, opponentNpcId })}
        />
      </div>
      <p>
        {value.mode === 'seasonal'
          ? 'Set an End in Schedule. A challenge that has not begun expires when the event ends.'
          : 'An unlocked challenge stays pending across the daily reset.'}
      </p>
      <div className={styles.grid}>
        <EventXpPackageField
          label="First-clear Character XP package"
          value={value.firstRewardPackageRef}
          rewards={rewards}
          change={(firstRewardPackageRef) => change({ ...value, firstRewardPackageRef })}
        />
        <EventXpPackageField
          label="Repeat Character XP package"
          value={value.repeatRewardPackageRef ?? ''}
          rewards={rewards}
          optional
          change={(repeatRewardPackageRef) =>
            change({ ...value, repeatRewardPackageRef: repeatRewardPackageRef || undefined })
          }
        />
      </div>
      <p>
        The first-clear reward is granted once. Repeat XP is limited to once per qualifying day.
      </p>
      <div className={styles.grid}>
        {(
          [
            ['ready', 'Challenge revealed'],
            ['completed', 'Challenge completed'],
          ] as const
        ).map(([field, label]) => (
          <label key={field}>
            {label}
            <textarea
              aria-label={label}
              rows={2}
              maxLength={800}
              value={value[field]}
              onChange={(event) => change({ ...value, [field]: event.target.value })}
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
