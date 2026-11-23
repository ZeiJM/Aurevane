'use client'

import type {
  EventRecurrence,
  PersonalHuntJourney,
  RepeatableTravel,
} from '@aurevane/game-core/events/persistent-event'
import type { EventWorkspaceCatalogue } from '@/server/master/event-authoring-service'
import type { StoryNpcCatalogue } from './event-phase-cast'
import { initialPersonalJourney, PersonalJourneyFields } from './personal-journey-fields'
import { EventRecurrenceField } from './event-recurrence-field'
import { WorldEncounterTagField } from './world-encounter-tag-field'
import styles from './event-builder.module.css'

const initialHunt: PersonalHuntJourney = {
  type: 'defeat-and-report',
  giverId: '',
  npcTag: '',
  requiredDefeats: 1,
  rewardPackageRef: '',
  offer: '',
  active: '',
  ready: '',
  completed: '',
}

type Rewards = readonly EventWorkspaceCatalogue['rewards'][number][]

function RepeatableHuntFields({
  journey,
  storyNpcs,
  rewards,
  change,
}: {
  journey: PersonalHuntJourney
  storyNpcs: StoryNpcCatalogue
  rewards: Rewards
  change: (journey: PersonalHuntJourney) => void
}) {
  const npcs = Array.isArray(storyNpcs) ? storyNpcs : []
  return (
    <>
      <p>
        Choose Global audience in Setup and a Story NPC with a published World placement. Players
        accept in person and earn credit for victories against encounters with the published tag.
        Reporting starts the cooldown and reserves the XP reward.
      </p>
      {storyNpcs === 'unavailable' && <p role="status">Story NPCs could not be loaded.</p>}
      <label>
        Quest giver
        <select
          aria-label="Quest giver"
          value={journey.giverId}
          onChange={(event) => change({ ...journey, giverId: event.target.value })}
        >
          <option value="">
            {storyNpcs === null ? 'Loading Story NPCs…' : 'Choose a published Story NPC'}
          </option>
          {journey.giverId && !npcs.some((npc) => npc.id === journey.giverId) && (
            <option value={journey.giverId}>Unavailable NPC</option>
          )}
          {npcs.map((npc) => (
            <option key={npc.id} value={npc.id}>
              {npc.name}
            </option>
          ))}
        </select>
      </label>
      <WorldEncounterTagField
        label="World encounter tag"
        value={journey.npcTag}
        onChange={(npcTag) => change({ ...journey, npcTag })}
      />
      <label>
        Required defeats
        <input
          type="number"
          min={1}
          max={25}
          value={journey.requiredDefeats}
          onChange={(event) => change({ ...journey, requiredDefeats: Number(event.target.value) })}
        />
      </label>
      <label>
        Character XP reward
        <select
          aria-label="Character XP reward"
          value={journey.rewardPackageRef}
          onChange={(event) => change({ ...journey, rewardPackageRef: event.target.value })}
        >
          <option value="">Choose an approved XP package</option>
          {journey.rewardPackageRef &&
            !rewards.some((reward) => reward.key === journey.rewardPackageRef) && (
              <option value={journey.rewardPackageRef}>
                {journey.rewardPackageRef} · unavailable
              </option>
            )}
          {rewards.map((reward) => (
            <option key={reward.key} value={reward.key}>
              {reward.label} · {reward.key}
            </option>
          ))}
        </select>
      </label>
      {(
        [
          ['offer', 'Offer the quest'],
          ['active', 'Explain what to defeat'],
          ['ready', 'Ask for the report'],
          ['completed', 'Confirm completion'],
        ] as const
      ).map(([field, label]) => (
        <label key={field}>
          {label}
          <textarea
            aria-label={label}
            maxLength={800}
            value={journey[field]}
            onChange={(event) => change({ ...journey, [field]: event.target.value })}
          />
        </label>
      ))}
    </>
  )
}

export function RepeatableTravelFields({
  value,
  storyNpcs,
  rewards,
  change,
}: {
  value?: RepeatableTravel
  storyNpcs: StoryNpcCatalogue
  rewards: Rewards
  change: (next: RepeatableTravel | undefined) => void
}) {
  const journey = value?.journey
  const policy = value?.recurrence
  const setJourney = (next: RepeatableTravel['journey']) =>
    change({ journey: next, recurrence: policy ?? { mode: 'rolling-24h' } })
  const setPolicy = (recurrence: EventRecurrence) => {
    if (value) change({ ...value, recurrence })
  }
  return (
    <>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={Boolean(journey)}
          onChange={(event) =>
            event.target.checked ? setJourney(initialPersonalJourney) : change(undefined)
          }
        />
        Enable repeatable activity
      </label>
      {journey && (
        <>
          <label>
            Activity type
            <select
              aria-label="Activity type"
              value={journey.type}
              onChange={(event) => {
                if (event.target.value === journey.type) return
                const next =
                  event.target.value === 'defeat-and-report' ? initialHunt : initialPersonalJourney
                setJourney({
                  ...next,
                  offer: journey.offer,
                  active: journey.active,
                  ready: journey.ready,
                  completed: journey.completed,
                })
              }}
            >
              <option value="travel-and-report">Travel and report</option>
              <option value="defeat-and-report">Defeat and report</option>
            </select>
          </label>
          {journey.type === 'defeat-and-report' ? (
            <RepeatableHuntFields
              journey={journey}
              storyNpcs={storyNpcs}
              rewards={rewards}
              change={setJourney}
            />
          ) : (
            <PersonalJourneyFields
              journey={journey}
              storyNpcs={[]}
              repeatable
              change={(next) => {
                if (next?.type === 'travel-and-report') setJourney(next)
              }}
            />
          )}
        </>
      )}
      {value && policy && (
        <EventRecurrenceField
          policy={policy}
          setPolicy={setPolicy}
          rollingLabel="24 hours after reporting"
        />
      )}
    </>
  )
}
