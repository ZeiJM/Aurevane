'use client'

import type { MentorChallenge } from '@aurevane/game-core/events/persistent-event'
import type { EventWorkspaceCatalogue } from '@/server/master/event-authoring-service'
import { EventRecurrenceField } from './event-recurrence-field'
import { EventXpPackageField } from './event-xp-package-field'
import { WorldEncounterPicker } from './world-encounter-picker'
import styles from './event-builder.module.css'

const initialMentor: MentorChallenge = {
  opponentNpcId: '',
  offer: '',
  victory: '',
  defeat: '',
  victoryRewardPackageRef: '',
  defeatRewardPackageRef: '',
  recurrence: { mode: 'rolling-24h' },
}

export function MentorChallengeFields({
  value,
  rewards,
  change,
}: {
  value?: MentorChallenge
  rewards: readonly EventWorkspaceCatalogue['rewards'][number][]
  change: (next: MentorChallenge | undefined) => void
}) {
  return (
    <>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => change(event.target.checked ? initialMentor : undefined)}
        />
        Enable a Mentor challenge
      </label>
      {value ? (
        <fieldset className={styles.restorationTrial}>
          <legend>Mentor challenge</legend>
          <p>
            Use Global audience, one manual phase, and a published World encounter with no
            qualification tags. A genuine defeat unlocks practice. Practice grants no challenge XP.
          </p>
          <WorldEncounterPicker
            npcId={value.opponentNpcId}
            sectorLabel="Mentor sector"
            npcLabel="Mentor encounter NPC"
            unavailableLabel="Unavailable Mentor NPC"
            onChange={(opponentNpcId) => change({ ...value, opponentNpcId })}
          />
          <div className={styles.grid}>
            <EventXpPackageField
              label="Victory Character XP package"
              value={value.victoryRewardPackageRef}
              other={value.defeatRewardPackageRef}
              rewards={rewards}
              change={(victoryRewardPackageRef) => change({ ...value, victoryRewardPackageRef })}
            />
            <EventXpPackageField
              label="Defeat Character XP package"
              value={value.defeatRewardPackageRef}
              other={value.victoryRewardPackageRef}
              rewards={rewards}
              change={(defeatRewardPackageRef) => change({ ...value, defeatRewardPackageRef })}
            />
          </div>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={Boolean(value.fastVictory)}
              onChange={(event) =>
                change({
                  ...value,
                  fastVictory: event.target.checked
                    ? { withinSeconds: 60, rewardPackageRef: '' }
                    : undefined,
                })
              }
            />
            Add a fast victory bonus
          </label>
          {value.fastVictory ? (
            <div className={styles.grid}>
              <label>
                Fast victory time in seconds
                <input
                  type="number"
                  min={1}
                  max={3600}
                  value={value.fastVictory.withinSeconds}
                  onChange={(event) => {
                    if (value.fastVictory)
                      change({
                        ...value,
                        fastVictory: {
                          ...value.fastVictory,
                          withinSeconds: Number(event.target.value),
                        },
                      })
                  }}
                />
              </label>
              <EventXpPackageField
                label="Fast victory bonus XP package"
                value={value.fastVictory.rewardPackageRef}
                rewards={rewards}
                change={(rewardPackageRef) => {
                  if (value.fastVictory)
                    change({ ...value, fastVictory: { ...value.fastVictory, rewardPackageRef } })
                }}
              />
            </div>
          ) : null}
          {(
            [
              ['offer', 'Challenge offer'],
              ['victory', 'Victory dialogue'],
              ['defeat', 'Defeat dialogue'],
            ] as const
          ).map(([field, label]) => (
            <label key={field}>
              {label}
              <textarea
                maxLength={800}
                value={value[field]}
                onChange={(event) => change({ ...value, [field]: event.target.value })}
              />
            </label>
          ))}
          <EventRecurrenceField
            policy={value.recurrence}
            setPolicy={(recurrence) => change({ ...value, recurrence })}
            rollingLabel="24 hours after the challenge ends"
          />
        </fieldset>
      ) : null}
    </>
  )
}
