import { useState } from 'react'
import {
  type EventCategory,
  hasConfirmedEventProducer,
  type PersistentEventDefinition,
  type PersistentEventPhaseDefinition,
} from '@aurevane/game-core/events/persistent-event'
import { OFFSHORE_DISCOVERY } from '@/world/discovery-sites'
import { FERRY_MAINLAND_DOCK } from '@/world/ferry'
import styles from './event-builder.module.css'

const starters = [
  { id: 'timed-world', label: 'Timed World Event', category: 'world-events' },
  { id: 'world-arrival', label: 'World arrival', category: 'world-events' },
  { id: 'lanternward-watch', label: 'Lanternward Watch', category: 'world-events' },
  { id: 'travel-and-report', label: 'Travel and report', category: 'story-campaigns' },
] as const

type EventStarter = (typeof starters)[number]['id']

export function blankPhase(index: number): PersistentEventPhaseDefinition {
  return {
    id: `phase-${index + 1}`,
    name: `Phase ${index + 1}`,
    objectives: [],
    effects: [],
    cleanupEffects: [],
    transition: { type: 'manual' },
  }
}

export const initialDefinition: PersistentEventDefinition = {
  schemaVersion: 1,
  eventKey: 'event.new-event',
  templateKey: 'template.live-event',
  contentVersion: 1,
  title: 'New Event',
  summary: 'Describe the player-facing purpose of this event.',
  internalNotes: '',
  family: 'regional-event',
  scope: { type: 'region', key: 'frostmere' },
  phases: [blankPhase(0)],
  rewardPackageRefs: [],
  aftermathRefs: [],
}

export function createEventStarter(
  starter: EventStarter,
  eventKey: string,
): PersistentEventDefinition {
  const base = {
    ...structuredClone(initialDefinition),
    eventKey,
    templateKey: `template.${starter}`,
  }
  const destination = { sectorId: 'verdant-expanse', x: 12, y: 4 }
  const verdantScope = { type: 'region', key: destination.sectorId } as const
  switch (starter) {
    case 'timed-world':
      return {
        ...base,
        category: 'world-events',
        title: 'Timed World Event',
        summary: 'A regional event with an active period and a closing phase.',
        phases: [
          {
            ...blankPhase(0),
            id: 'active-window',
            name: 'Active window',
            transition: { type: 'elapsed', afterSeconds: 3600 },
          },
          {
            ...blankPhase(1),
            id: 'wrap-up',
            name: 'Wrap-up',
            transition: { type: 'elapsed', afterSeconds: 900 },
          },
        ],
      }
    case 'world-arrival':
      return {
        ...base,
        category: 'world-events',
        title: 'World arrival',
        summary: 'Reach the marked crossing to contribute an arrival to the regional event.',
        scope: verdantScope,
        phases: [
          {
            ...blankPhase(0),
            id: 'reach-crossing',
            name: 'Reach the crossing',
            objectives: [
              {
                id: 'crossing-arrival',
                type: 'discover',
                referenceKey: 'objective.crossing-arrival',
                target: 1,
                completion: 'world-arrival',
                worldNavigation: { ...destination, autoPath: true, guidance: 'exact' },
              },
            ],
            transition: { type: 'objective-threshold', objectiveId: 'crossing-arrival' },
          },
          { ...blankPhase(1), id: 'wrap-up', name: 'Wrap-up' },
        ],
      }
    case 'lanternward-watch': {
      const checkpoint = (id: string, place: { sectorId: string; x: number; y: number }) => ({
        id,
        type: 'discover' as const,
        referenceKey: `objective.${id}`,
        target: 1,
        completion: 'world-arrival' as const,
        worldNavigation: { ...place, autoPath: true, guidance: 'exact' as const },
      })
      return {
        ...base,
        category: 'world-events',
        family: 'world-crisis',
        scope: { type: 'global' },
        title: 'The Lanternward Watch',
        summary:
          'Riders carry reports of dark sails. Reach Farwater Span or the Ferry Terminal to choose where the Watch sends aid.',
        phases: [
          {
            ...blankPhase(0),
            id: 'answer-call',
            name: 'Answer the coastal call',
            objectives: [
              checkpoint('farwater-signal', {
                sectorId: OFFSHORE_DISCOVERY.bridgeSectorId,
                x: 5,
                y: 4,
              }),
              checkpoint('harbor-signal', FERRY_MAINLAND_DOCK),
            ],
            transition: {
              type: 'objective-branch',
              routes: [
                { objectiveId: 'farwater-signal', nextPhaseId: 'relight-tower' },
                { objectiveId: 'harbor-signal', nextPhaseId: 'reach-terminal' },
              ],
            },
          },
          {
            ...blankPhase(1),
            id: 'relight-tower',
            name: 'Relight Lanternward Tower',
            objectives: [
              checkpoint('reach-lanternward', {
                sectorId: OFFSHORE_DISCOVERY.islandSectorId,
                x: 6,
                y: 4,
              }),
            ],
            transition: { type: 'objective-threshold', objectiveId: 'reach-lanternward' },
            nextPhaseId: 'close-watch',
          },
          {
            ...blankPhase(2),
            id: 'reach-terminal',
            name: 'Secure the harbor approaches',
            objectives: [
              checkpoint('approach-ferry', {
                ...FERRY_MAINLAND_DOCK,
                y: FERRY_MAINLAND_DOCK.y - 1,
              }),
            ],
            transition: { type: 'objective-threshold', objectiveId: 'approach-ferry' },
          },
          { ...blankPhase(3), id: 'close-watch', name: 'Report to the Watch' },
        ],
      }
    }
    case 'travel-and-report':
      return {
        ...base,
        family: 'narrative-event',
        category: 'story-campaigns',
        title: 'Travel and report',
        summary: 'Visit the eastern crossing and report back to the Watch officer.',
        scope: verdantScope,
        phases: [{ ...blankPhase(0), id: 'quest-available', name: 'Quest available' }],
        personalJourney: {
          type: 'travel-and-report',
          giverId: 'eastern-watch-officer',
          destination,
          offer: 'Will you check the eastern crossing for the Watch?',
          active: 'Follow the road east to the crossing, then return to me.',
          ready: 'You made it to the crossing. What did you find?',
          completed: 'Thank you for reporting back.',
        },
      }
  }
}

export function EventStarterPicker({
  category,
  start,
}: {
  category: EventCategory
  start: (starter: EventStarter) => void
}) {
  const [selected, setSelected] = useState('')
  const available = starters.filter((starter) => starter.category === category)
  const starter = available.find(({ id }) => id === selected)
  if (!available.length) return null
  return (
    <div className={`${styles.wideField} ${styles.notice}`}>
      <label>
        Starter template
        <select value={starter?.id ?? ''} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Choose a starter</option>
          {available.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p>
        Start an editable definition with its own Event key. Use Save draft when it is ready to
        keep.
      </p>
      <button type="button" disabled={!starter} onClick={() => starter && start(starter.id)}>
        Start from template
      </button>
    </div>
  )
}

function phaseName(phase: PersistentEventPhaseDefinition, index: number): string {
  return phase.name.trim() || `Untitled phase ${index + 1}`
}

function phaseCondition(phase: PersistentEventPhaseDefinition): string | undefined {
  const { transition } = phase
  switch (transition.type) {
    case 'manual':
      return 'When staff advance the run'
    case 'elapsed':
      if (Number.isSafeInteger(transition.afterSeconds) && transition.afterSeconds > 0)
        return `After ${transition.afterSeconds} seconds in this phase`
      return undefined
    case 'scheduled': {
      const at = Date.parse(transition.at)
      if (Number.isFinite(at))
        return `At ${new Date(at)
          .toISOString()
          .replace('T', ' ')
          .replace(/(?:\.000)?Z$/, ' UTC')}`
      return undefined
    }
    case 'objective-branch':
      return undefined
    case 'objective-quorum': {
      const { objectiveIds, required } = transition
      if (
        objectiveIds.length < 2 ||
        !Number.isSafeInteger(required) ||
        required < 1 ||
        required > objectiveIds.length ||
        objectiveIds.some(
          (id) =>
            !phase.objectives.some(
              (objective) =>
                objective.id === id &&
                hasConfirmedEventProducer(objective) &&
                objective.worldNavigation,
            ),
        )
      )
        return undefined
      return required === objectiveIds.length
        ? `After all ${required} selected objectives are complete`
        : `After any ${required} of the ${objectiveIds.length} selected objectives are complete`
    }
    case 'objective-threshold': {
      const objective = phase.objectives.find(({ id }) => id === transition.objectiveId)
      if (
        !objective ||
        !hasConfirmedEventProducer(objective) ||
        !objective.worldNavigation ||
        !Number.isSafeInteger(objective.target) ||
        objective.target < 1
      )
        return undefined
      if (objective.completion === 'world-npc-result' && objective.battleResult)
        return `After ${objective.target} confirmed NPC ${objective.battleResult.outcome === 'victory' ? 'wins' : 'losses'}`
      const arrivals =
        objective.target === 1 ? '1 confirmed arrival' : `${objective.target} confirmed arrivals`
      return `After ${arrivals}${objective.requiredWeather ? ` in ${objective.requiredWeather}` : ''}`
    }
  }
}

function phasePathDescription(phase: PersistentEventPhaseDefinition, nextName?: string): string {
  if (phase.transition.type === 'manual' && !nextName)
    return 'Staff resolve the run from this phase.'
  const condition = phaseCondition(phase)
  if (!condition) return 'Set a valid transition with a supported condition.'
  return nextName ? `${condition}, open ${nextName}.` : `${condition}, move the run to resolution.`
}

export function EventPhasePath({ phases }: { phases: readonly PersistentEventPhaseDefinition[] }) {
  return (
    <details className={styles.notice}>
      <summary>Phase path</summary>
      <ol>
        {phases.map((phase, index) => {
          const nextIndex = phase.nextPhaseId
            ? phases.findIndex(({ id }) => id === phase.nextPhaseId)
            : index + 1
          const next = phases[nextIndex]
          return (
            <li key={index}>
              <strong>{phaseName(phase, index)}</strong>
              {phase.transition.type === 'objective-branch' ? (
                phase.transition.routes.length ? (
                  <ol>
                    {phase.transition.routes.map(({ objectiveId, nextPhaseId }) => {
                      const destinationIndex = phases.findIndex(({ id }) => id === nextPhaseId)
                      const destination = phases[destinationIndex]
                      return (
                        <li key={objectiveId}>
                          When {objectiveId} completes, open{' '}
                          {destination ? phaseName(destination, destinationIndex) : 'a later phase'}
                          .
                        </li>
                      )
                    })}
                  </ol>
                ) : (
                  <p>Assign at least two objectives to later phases.</p>
                )
              ) : (
                <div>
                  {phasePathDescription(phase, next ? phaseName(next, nextIndex + 1) : undefined)}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </details>
  )
}
