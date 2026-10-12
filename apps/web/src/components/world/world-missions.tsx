'use client'
import { useState } from 'react'
import { FRONTIER_APPROACH } from '@/world/catalog'
import { samePosition } from '@/world/travel'
import type { WorldIntent, WorldView } from '@/world/types'
import styles from './workspace.module.css'
export function WorldMissions({
  view,
  disabled,
  send,
  stopMoving,
}: {
  view: WorldView
  disabled: boolean
  send: (intent: WorldIntent) => void
  stopMoving: () => void
}) {
  const [filter, setFilter] = useState<'active' | 'completed'>('active')
  const local = view.sectors.find((s) => s.id === view.position.sectorId)!
  const legacyExits =
    !local.charted || local.id.startsWith('trail:')
      ? [...new Map(local.exits.map((road) => [road.to.sectorId, road])).values()]
      : []
  const pulseObjectives = view.objectives.filter((o) => o.kind === 'event' && !o.completed),
    questObjectives = view.objectives.filter((o) => o.kind === 'quest'),
    shownQuests = questObjectives.filter((o) => o.completed === (filter === 'completed')),
    interactions = view.interactions.filter(
      (i) => i.progress === 'available' || i.progress === 'active',
    )
  const autoPathButton = (
    objective: WorldView['objectives'][number],
    start: string,
    clues: string,
    running: string,
  ) => (
    <button
      className={styles.primary}
      disabled={
        view.routeObjectiveId !== objective.id &&
        (disabled || !objective.autoPath || !objective.destination)
      }
      onClick={() =>
        view.routeObjectiveId === objective.id
          ? stopMoving()
          : send({ kind: 'autopath', objectiveId: objective.id })
      }
    >
      {view.routeObjectiveId === objective.id
        ? running
        : objective.autoPath && objective.destination
          ? start
          : clues}
    </button>
  )
  return (
    <div className={styles.missions}>
      <div className={styles.missionFilters} role="tablist" aria-label="Mission status">
        {(['active', 'completed'] as const).map((status) => (
          <button
            key={status}
            id={`${status}-missions-tab`}
            role="tab"
            aria-selected={filter === status}
            aria-controls="mission-list"
            onClick={() => setFilter(status)}
          >
            {status === 'active' ? 'Active' : 'Completed'}
          </button>
        ))}
      </div>
      {filter === 'active' && legacyExits.length ? (
        <section className={styles.panel} aria-label="Routes from here">
          <h2>Routes from here</h2>
          {legacyExits.map((road) => (
            <div key={road.to.sectorId} className={styles.quest}>
              <button
                disabled={disabled}
                onClick={() => send({ kind: 'walk', destination: road.to })}
              >
                Follow {road.name}
              </button>
            </div>
          ))}
        </section>
      ) : null}
      {filter === 'active' && interactions.length ? (
        <section className={styles.panel} aria-label="Local interaction">
          <h2>✦ Local interaction</h2>
          <p className={styles.quiet}>At your current position in {local.name}.</p>
          {interactions.map((interaction) => (
            <div className={styles.quest} key={interaction.id}>
              <h3>{interaction.title}</h3>
              <p>
                <strong>{interaction.speaker}</strong> · {interaction.body}
              </p>
              {interaction.actionLabel ? (
                <button
                  className={styles.primary}
                  disabled={disabled || view.route.length > 0}
                  onClick={() => void send({ kind: 'interact', interactionId: interaction.id })}
                >
                  {interaction.actionLabel}
                </button>
              ) : (
                <p className={styles.quiet}>
                  {interaction.progress === 'completed'
                    ? 'This objective is complete.'
                    : 'Return after checking the eastern watch.'}
                </p>
              )}
            </div>
          ))}
        </section>
      ) : null}
      {filter === 'active' && pulseObjectives.length ? (
        <section className={styles.panel} aria-label="World Pulse">
          <h2>✦ World Pulse</h2>
          <p className={styles.quiet}>
            Live happenings that currently reach your part of the world.
          </p>
          {pulseObjectives.map((objective) => (
            <div className={styles.quest} key={objective.id}>
              <h3>{objective.name}</h3>
              <p>○ {objective.description}</p>
              {autoPathButton(
                objective,
                'Follow event route',
                'Follow the clues',
                'Stop Auto-path',
              )}
            </div>
          ))}
        </section>
      ) : null}
      <section
        className={styles.panel}
        id="mission-list"
        role="tabpanel"
        aria-labelledby={`${filter}-missions-tab`}
      >
        {shownQuests.length ? (
          shownQuests.map((objective) => {
            const turnIn =
              objective.progress === 'ready'
                ? view.interactions.find(
                    (interaction) =>
                      interaction.objectiveId === objective.id &&
                      interaction.progress === 'ready' &&
                      interaction.actionLabel,
                  )
                : undefined
            return (
              <div className={styles.quest} key={objective.id}>
                <h3>{objective.name}</h3>
                <p>
                  {objective.completed || objective.progress === 'ready' ? '✓ ' : '○ '}
                  {objective.description}
                </p>
                {turnIn ? (
                  <button
                    className={styles.primary}
                    disabled={disabled || view.route.length > 0}
                    onClick={() => send({ kind: 'interact', interactionId: turnIn.id })}
                  >
                    Complete quest
                  </button>
                ) : !objective.completed ? (
                  autoPathButton(objective, 'Start Auto-path', 'Follow the clues', 'Stop Auto-path')
                ) : null}
              </div>
            )
          })
        ) : (
          <p className={styles.quiet}>No {filter} quests.</p>
        )}
      </section>
      {view.archive.length ? (
        <section className={styles.panel} aria-label="Archive">
          <h2>▤ Archive</h2>
          {view.archive.map((entry) => (
            <div className={styles.quest} key={entry.id}>
              <h3>{entry.title}</h3>
              <p>{entry.summary}</p>
              <p className={styles.quiet}>
                Field Observation · {entry.location} · {entry.provenance}
              </p>
            </div>
          ))}
        </section>
      ) : null}
      {view.anchors?.length ? (
        <section className={styles.panel} aria-label="Frontier Anchors">
          <h2>◇ Frontier Anchors</h2>
          <p className={styles.quiet}>
            Persistent places you have personally confirmed beyond reliable cartography.
          </p>
          {view.anchors.map((anchor) => (
            <div className={styles.quest} key={anchor.id}>
              <h3>{anchor.name}</h3>
              <p className={styles.quiet}>Recorded Anchor · persists in frontier history</p>
            </div>
          ))}
        </section>
      ) : null}
      {!local.charted || samePosition(view.position, FRONTIER_APPROACH) ? (
        <section className={styles.panel}>
          <h2>Beyond the last map</h2>
          <p>Routes beyond this point may not remain where you left them.</p>
          {local.charted ? (
            <button
              className={styles.primary}
              disabled={disabled || view.route.length > 0}
              onClick={() => {
                if (
                  window.confirm(
                    'Cross beyond the last reliable map? Your route ends here; the next steps must be surveyed.',
                  )
                )
                  void send({ kind: 'cross' })
              }}
            >
              Cross into uncharted territory
            </button>
          ) : (
            <p className={styles.quiet}>
              Your survey is saved as you explore. Known ground keeps its coordinates.
            </p>
          )}
        </section>
      ) : null}
    </div>
  )
}
