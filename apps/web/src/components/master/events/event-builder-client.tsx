'use client'

import { useMemo, useState } from 'react'

import {
  EVENT_EFFECT_TYPES,
  EVENT_FAMILIES,
  EVENT_OBJECTIVE_TYPES,
  type EventEffectReference,
  type EventObjectiveDefinition,
  type EventPhaseTransition,
  type EventScope,
  type PersistentEventDefinition,
  type PersistentEventPhaseDefinition,
} from '@aurevane/game-core/events/persistent-event'

import styles from './event-builder.module.css'

interface Props {
  canPublish: boolean
  canUseGlobalScope: boolean
}

interface WorkspaceResponse {
  draft: {
    definition: PersistentEventDefinition
    baseVersion: number | null
    draftVersion: number
  } | null
  current: {
    definitionVersion: number
    definition: PersistentEventDefinition
  } | null
  versions: Array<{
    definitionVersion: number
    current?: boolean
    publishedAt: string
  }>
}

interface ScheduledRun {
  runId: string
  stateVersion: number
}

const blankPhase = (index: number): PersistentEventPhaseDefinition => ({
  id: `phase-${index + 1}`,
  name: `Phase ${index + 1}`,
  objectives: [],
  effects: [],
  cleanupEffects: [],
  transition: { type: 'manual' },
})

const initialDefinition: PersistentEventDefinition = {
  schemaVersion: 1,
  eventKey: 'event.new-event',
  templateKey: 'template.live-event',
  contentVersion: 1,
  title: 'New Event',
  summary: 'Describe the player-facing purpose of this event.',
  internalNotes: '',
  family: 'regional-event',
  scope: { type: 'region', key: 'region.frostmere' },
  phases: [blankPhase(0)],
  rewardPackageRefs: [],
  aftermathRefs: [],
}

function csv(value: readonly string[]): string {
  return value.join(', ')
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch('/api/master/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const error = payload.error as { message?: string } | undefined
    throw new Error(error?.message ?? 'Event Builder request failed.')
  }
  return payload
}

function transitionFor(type: EventPhaseTransition['type']): EventPhaseTransition {
  switch (type) {
    case 'manual':
      return { type: 'manual' }
    case 'elapsed':
      return { type: 'elapsed', afterSeconds: 3600 }
    case 'scheduled':
      return { type: 'scheduled', at: new Date(Date.now() + 3_600_000).toISOString() }
    case 'objective-threshold':
      return { type: 'objective-threshold', objectiveId: 'objective-1' }
  }
}

function effect(): EventEffectReference {
  return { type: 'world-pulse', referenceKey: 'announcement.event', enabled: true }
}

function objective(index: number): EventObjectiveDefinition {
  return {
    id: `objective-${index + 1}`,
    type: 'community-threshold',
    referenceKey: `objective.event-${index + 1}`,
    target: 1,
  }
}

export function EventBuilderClient({ canPublish, canUseGlobalScope }: Props) {
  const [definition, setDefinition] = useState<PersistentEventDefinition>(initialDefinition)
  const [baseVersion, setBaseVersion] = useState<number | null>(null)
  const [draftVersion, setDraftVersion] = useState<number | null>(null)
  const [versions, setVersions] = useState<WorkspaceResponse['versions']>([])
  const [selectedPhaseId, setSelectedPhaseId] = useState(initialDefinition.phases[0]!.id)
  const [testClock, setTestClock] = useState('2026-09-19T12:00')
  const [scheduleStart, setScheduleStart] = useState('')
  const [scheduleEnd, setScheduleEnd] = useState('')
  const [productionReason, setProductionReason] = useState('')
  const [productionConfirmed, setProductionConfirmed] = useState(false)
  const [scheduledRun, setScheduledRun] = useState<ScheduledRun | null>(null)
  const [message, setMessage] = useState('Ready.')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedPhase =
    definition.phases.find((phase) => phase.id === selectedPhaseId) ?? definition.phases[0]

  const productionActionReady =
    productionConfirmed &&
    productionReason.length >= 3 &&
    productionReason.length <= 240 &&
    productionReason.trim() === productionReason

  const globalWarning = useMemo(
    () =>
      definition.scope.type === 'global' && !canUseGlobalScope
        ? 'You can draft/preview global scope, but publishing or scheduling it requires the Owner-granted Global Event Scope capability.'
        : '',
    [definition.scope.type, canUseGlobalScope],
  )

  function patchDefinition(patch: Partial<PersistentEventDefinition>) {
    setDefinition((current) => ({ ...current, ...patch }))
  }

  function patchPhase(index: number, patch: Partial<PersistentEventPhaseDefinition>) {
    patchDefinition({
      phases: definition.phases.map((phase, candidate) =>
        candidate === index ? { ...phase, ...patch } : phase,
      ),
    })
  }

  function patchObjective(
    phaseIndex: number,
    objectiveIndex: number,
    patch: Partial<EventObjectiveDefinition>,
  ) {
    const phase = definition.phases[phaseIndex]!
    patchPhase(phaseIndex, {
      objectives: phase.objectives.map((entry, candidate) =>
        candidate === objectiveIndex ? { ...entry, ...patch } : entry,
      ),
    })
  }

  function patchEffect(
    phaseIndex: number,
    list: 'effects' | 'cleanupEffects',
    effectIndex: number,
    patch: Partial<EventEffectReference>,
  ) {
    const phase = definition.phases[phaseIndex]!
    patchPhase(phaseIndex, {
      [list]: phase[list].map((entry, candidate) =>
        candidate === effectIndex ? { ...entry, ...patch } : entry,
      ),
    })
  }

  async function run(label: string, work: () => Promise<void>) {
    setBusy(true)
    setMessage(label)
    setDetails('')
    try {
      await work()
    } catch (error) {
      setMessage('Request failed.')
      setDetails(error instanceof Error ? error.message : 'Unknown Event Builder error.')
    } finally {
      setBusy(false)
    }
  }

  async function loadWorkspace() {
    await run('Loading authoritative Event workspace…', async () => {
      const payload = await post({ operation: 'load', eventKey: definition.eventKey })
      const workspace = payload.workspace as unknown as WorkspaceResponse
      const chosen = workspace.draft?.definition ?? workspace.current?.definition
      if (chosen) {
        setDefinition(chosen)
        setSelectedPhaseId(chosen.phases[0]!.id)
      }
      setBaseVersion(workspace.current?.definitionVersion ?? null)
      setDraftVersion(workspace.draft?.draftVersion ?? null)
      setVersions(workspace.versions ?? [])
      setMessage(
        workspace.draft
          ? `Loaded draft v${workspace.draft.draftVersion}.`
          : workspace.current
            ? `Loaded published v${workspace.current.definitionVersion}.`
            : 'No existing Event found; editing a new Event.',
      )
    })
  }

  async function validate() {
    await run('Validating typed Event definition…', async () => {
      const payload = await post({ operation: 'validate', definition })
      const validation = payload.validation as {
        valid: boolean
        issues: Array<{ path: string; message: string }>
      }
      setMessage(validation.valid ? 'Definition is valid.' : 'Definition has validation issues.')
      setDetails(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
    })
  }

  async function preview() {
    await run('Building deterministic preview…', async () => {
      const payload = await post({
        operation: 'preview',
        definition,
        phaseId: selectedPhase?.id,
        testClock: testClock ? new Date(testClock).toISOString() : undefined,
      })
      setMessage('Preview ready. No Event Run was created.')
      setDetails(JSON.stringify(payload.preview, null, 2))
    })
  }

  async function saveDraft() {
    await run('Saving private Event draft…', async () => {
      const payload = await post({
        operation: 'save-draft',
        definition,
        baseVersion,
        expectedDraftVersion: draftVersion,
      })
      const draft = payload.draft as {
        draftVersion: number
        baseVersion: number | null
        definition: PersistentEventDefinition
      }
      setDraftVersion(draft.draftVersion)
      setBaseVersion(draft.baseVersion)
      setDefinition(draft.definition)
      setMessage(`Draft v${draft.draftVersion} saved.`)
    })
  }

  async function publish() {
    await run('Publishing immutable Event definition…', async () => {
      const payload = await post({
        operation: 'publish',
        definition,
        expectedBaseVersion: baseVersion,
        correlationKey: crypto.randomUUID(),
        reason: productionReason,
        confirmed: productionConfirmed,
      })
      const published = payload.published as {
        definitionVersion: number
        definition: PersistentEventDefinition
      }
      setBaseVersion(published.definitionVersion)
      setDefinition(published.definition)
      await loadWorkspace()
      setProductionConfirmed(false)
      setMessage(`Published Event definition v${published.definitionVersion}.`)
    })
  }

  async function schedule() {
    await run('Scheduling pinned Event Run…', async () => {
      if (!scheduleStart) throw new Error('Choose a schedule start time.')
      const idempotencyKey = crypto.randomUUID()
      const startIso = new Date(scheduleStart).toISOString()
      const endIso = scheduleEnd ? new Date(scheduleEnd).toISOString() : null
      const payload = await post({
        operation: 'schedule',
        eventKey: definition.eventKey,
        idempotencyKey,
        requestFingerprint: `schedule:${definition.eventKey}:${startIso}:${endIso ?? 'open'}`,
        scheduledStartAt: startIso,
        scheduledEndAt: endIso,
        reason: productionReason,
        confirmed: productionConfirmed,
      })
      const scheduled = payload.scheduled as ScheduledRun
      setScheduledRun(scheduled)
      setProductionConfirmed(false)
      setMessage(`Scheduled run ${scheduled.runId}.`)
    })
  }

  async function unschedule() {
    if (!scheduledRun) return
    await run('Cancelling scheduled Event Run…', async () => {
      const payload = await post({
        operation: 'cancel-scheduled',
        runId: scheduledRun.runId,
        expectedStateVersion: scheduledRun.stateVersion,
        idempotencyKey: crypto.randomUUID(),
        reason: productionReason,
        confirmed: productionConfirmed,
      })
      const transition = payload.transition as { lifecycleStatus: string }
      setProductionConfirmed(false)
      setMessage(`Scheduled run is now ${transition.lifecycleStatus}.`)
      setScheduledRun(null)
    })
  }

  function startNewDefinition() {
    const next = structuredClone(initialDefinition)
    setDefinition(next)
    setBaseVersion(null)
    setDraftVersion(null)
    setVersions([])
    setSelectedPhaseId(next.phases[0]!.id)
    setScheduledRun(null)
    setProductionReason('')
    setProductionConfirmed(false)
    setMessage('New Event workspace ready.')
    setDetails('')
  }

  const publicationState =
    baseVersion !== null ? 'Published' : draftVersion !== null ? 'Draft' : 'New'

  return (
    <section className={styles.builder}>
      <aside className={styles.eventNavigator} aria-label="Event workspace navigator">
        <div className={styles.navigatorHeading}>
          <div>
            <p className={styles.eyebrow}>Event definition</p>
            <h2>Events</h2>
          </div>
          <span>{publicationState}</span>
        </div>

        <label className={styles.navigatorField}>
          Event key
          <input
            value={definition.eventKey}
            onChange={(event) => patchDefinition({ eventKey: event.target.value })}
          />
        </label>

        <div className={styles.navigatorActions}>
          <button type="button" onClick={loadWorkspace} disabled={busy}>
            Load
          </button>
          <button type="button" onClick={startNewDefinition} disabled={busy}>
            New Event
          </button>
        </div>

        <div className={styles.navigatorSummary}>
          <div>
            <span>Published</span>
            <strong>{baseVersion === null ? '—' : `v${baseVersion}`}</strong>
          </div>
          <div>
            <span>Draft</span>
            <strong>{draftVersion === null ? '—' : `d${draftVersion}`}</strong>
          </div>
          <div>
            <span>Phases</span>
            <strong>{definition.phases.length}</strong>
          </div>
        </div>

        <section className={styles.navigatorHistory} aria-label="Event version history">
          <div className={styles.miniHeading}>
            <h3>Recent versions</h3>
            <span>{versions.length}</span>
          </div>
          {versions.length === 0 ? (
            <p>No published history loaded.</p>
          ) : (
            <div className={styles.versionList}>
              {versions.map((version) => (
                <div key={version.definitionVersion}>
                  <span aria-hidden="true">◆</span>
                  <div>
                    <strong>v{version.definitionVersion}</strong>
                    <small>{version.current ? 'Current publication' : 'Published version'}</small>
                  </div>
                  <time>{new Date(version.publishedAt).toLocaleDateString()}</time>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>

      <div className={styles.builderWorkspace}>
        <header className={styles.eventHeader}>
          <div className={styles.eventIdentityIcon} aria-hidden="true">
            ✦
          </div>
          <div className={styles.eventIdentity}>
            <h2 className={styles.definitionHeading}>Persistent Event Definition</h2>
            <strong className={styles.eventTitle}>{definition.title}</strong>
            <p>
              <code>{definition.eventKey}</code>
              <span>{publicationState}</span>
            </p>
          </div>
          <div className={styles.eventHeaderState}>
            <span>{publicationState}</span>
          </div>
        </header>

        <nav className={styles.workspaceTabs} aria-label="Event Builder workspace">
          <a href="#event-details">Details</a>
          <a href="#event-phases">Phases</a>
          <a href="#event-phases">Objectives</a>
          <a href="#event-phases">Effects</a>
          <a href="#event-controls">Schedule</a>
        </nav>

        {!canPublish ? (
          <p className={styles.notice}>
            Production publication is disabled for this account. Draft and preview remain available.
          </p>
        ) : null}
        {globalWarning ? <p className={styles.notice}>{globalWarning}</p> : null}

        <section className={`${styles.card} ${styles.primaryCard}`} id="event-details">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Details</p>
              <h2>Basic information</h2>
            </div>
          </div>

          <label>
            Template key
            <input
              value={definition.templateKey}
              onChange={(event) => patchDefinition({ templateKey: event.target.value })}
            />
          </label>
          <label>
            Family
            <select
              value={definition.family}
              onChange={(event) =>
                patchDefinition({
                  family: event.target.value as PersistentEventDefinition['family'],
                })
              }
            >
              {EVENT_FAMILIES.map((family) => (
                <option key={family}>{family}</option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              value={definition.title}
              onChange={(event) => patchDefinition({ title: event.target.value })}
            />
          </label>
          <label>
            Scope
            <select
              value={definition.scope.type}
              onChange={(event) => {
                const type = event.target.value as EventScope['type']
                patchDefinition({
                  scope: type === 'global' ? { type: 'global' } : { type, key: 'region.frostmere' },
                })
              }}
            >
              <option value="global">global</option>
              <option value="region">region</option>
              <option value="node">node</option>
              <option value="cohort">cohort</option>
            </select>
          </label>
          {definition.scope.type !== 'global' ? (
            <label>
              Scope key
              <input
                value={definition.scope.key}
                onChange={(event) =>
                  patchDefinition({
                    scope: { type: definition.scope.type, key: event.target.value } as EventScope,
                  })
                }
              />
            </label>
          ) : null}
          <label className={styles.wideField}>
            Summary
            <textarea
              value={definition.summary}
              onChange={(event) => patchDefinition({ summary: event.target.value })}
            />
          </label>
          <label className={styles.wideField}>
            Internal notes
            <textarea
              value={definition.internalNotes}
              onChange={(event) => patchDefinition({ internalNotes: event.target.value })}
            />
          </label>
        </section>

        <section className={styles.phases} id="event-phases">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Composition</p>
              <h2>Phases, objectives &amp; effects</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = blankPhase(definition.phases.length)
                patchDefinition({ phases: [...definition.phases, next] })
                setSelectedPhaseId(next.id)
              }}
            >
              Add phase
            </button>
          </div>

          {definition.phases.map((phase, phaseIndex) => (
            <article className={styles.phaseCard} key={`${phase.id}-${phaseIndex}`}>
              <div className={styles.phaseHeader}>
                <div>
                  <span>Phase {phaseIndex + 1}</span>
                  <strong>{phase.name}</strong>
                </div>
                <button
                  type="button"
                  disabled={definition.phases.length === 1}
                  onClick={() => {
                    const remaining = definition.phases.filter((_, index) => index !== phaseIndex)
                    patchDefinition({ phases: remaining })
                    setSelectedPhaseId(remaining[0]!.id)
                  }}
                >
                  Remove
                </button>
              </div>

              <div className={styles.grid}>
                <label>
                  Phase id
                  <input
                    value={phase.id}
                    onChange={(event) => patchPhase(phaseIndex, { id: event.target.value })}
                  />
                </label>
                <label>
                  Name
                  <input
                    value={phase.name}
                    onChange={(event) => patchPhase(phaseIndex, { name: event.target.value })}
                  />
                </label>
                <label>
                  Transition
                  <select
                    value={phase.transition.type}
                    onChange={(event) =>
                      patchPhase(phaseIndex, {
                        transition: transitionFor(
                          event.target.value as EventPhaseTransition['type'],
                        ),
                      })
                    }
                  >
                    <option value="manual">manual</option>
                    <option value="elapsed">elapsed</option>
                    <option value="scheduled">scheduled</option>
                    <option value="objective-threshold">objective-threshold</option>
                  </select>
                </label>
                {phase.transition.type === 'elapsed' ? (
                  <label>
                    After seconds
                    <input
                      type="number"
                      min={1}
                      value={phase.transition.afterSeconds}
                      onChange={(event) =>
                        patchPhase(phaseIndex, {
                          transition: { type: 'elapsed', afterSeconds: Number(event.target.value) },
                        })
                      }
                    />
                  </label>
                ) : null}
                {phase.transition.type === 'scheduled' ? (
                  <label>
                    At
                    <input
                      value={phase.transition.at}
                      onChange={(event) =>
                        patchPhase(phaseIndex, {
                          transition: { type: 'scheduled', at: event.target.value },
                        })
                      }
                    />
                  </label>
                ) : null}
                {phase.transition.type === 'objective-threshold' ? (
                  <label>
                    Objective id
                    <input
                      value={phase.transition.objectiveId}
                      onChange={(event) =>
                        patchPhase(phaseIndex, {
                          transition: {
                            type: 'objective-threshold',
                            objectiveId: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ) : null}
              </div>

              <div className={styles.compositionGroup}>
                <div className={styles.sectionHeading}>
                  <h3>Objectives</h3>
                  <button
                    type="button"
                    onClick={() =>
                      patchPhase(phaseIndex, {
                        objectives: [...phase.objectives, objective(phase.objectives.length)],
                      })
                    }
                  >
                    Add objective
                  </button>
                </div>
                {phase.objectives.map((entry, objectiveIndex) => (
                  <div className={styles.row} key={`${entry.id}-${objectiveIndex}`}>
                    <input
                      value={entry.id}
                      onChange={(event) =>
                        patchObjective(phaseIndex, objectiveIndex, { id: event.target.value })
                      }
                      aria-label="Objective id"
                    />
                    <select
                      value={entry.type}
                      onChange={(event) =>
                        patchObjective(phaseIndex, objectiveIndex, {
                          type: event.target.value as EventObjectiveDefinition['type'],
                        })
                      }
                      aria-label="Objective type"
                    >
                      {EVENT_OBJECTIVE_TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                    <input
                      value={entry.referenceKey}
                      onChange={(event) =>
                        patchObjective(phaseIndex, objectiveIndex, {
                          referenceKey: event.target.value,
                        })
                      }
                      aria-label="Objective reference"
                    />
                    <input
                      type="number"
                      min={1}
                      value={entry.target}
                      onChange={(event) =>
                        patchObjective(phaseIndex, objectiveIndex, {
                          target: Number(event.target.value),
                        })
                      }
                      aria-label="Objective target"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        patchPhase(phaseIndex, {
                          objectives: phase.objectives.filter(
                            (_, index) => index !== objectiveIndex,
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {(['effects', 'cleanupEffects'] as const).map((list) => (
                <div className={styles.compositionGroup} key={list}>
                  <div className={styles.sectionHeading}>
                    <h3>{list === 'effects' ? 'Active effects' : 'Cleanup effects'}</h3>
                    <button
                      type="button"
                      onClick={() => patchPhase(phaseIndex, { [list]: [...phase[list], effect()] })}
                    >
                      Add effect
                    </button>
                  </div>
                  {phase[list].map((entry, effectIndex) => (
                    <div className={styles.row} key={`${entry.referenceKey}-${effectIndex}`}>
                      <select
                        value={entry.type}
                        onChange={(event) =>
                          patchEffect(phaseIndex, list, effectIndex, {
                            type: event.target.value as EventEffectReference['type'],
                          })
                        }
                        aria-label="Effect type"
                      >
                        {EVENT_EFFECT_TYPES.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                      <input
                        value={entry.referenceKey}
                        onChange={(event) =>
                          patchEffect(phaseIndex, list, effectIndex, {
                            referenceKey: event.target.value,
                          })
                        }
                        aria-label="Effect reference"
                      />
                      <label className={styles.checkbox}>
                        <input
                          type="checkbox"
                          checked={entry.enabled}
                          onChange={(event) =>
                            patchEffect(phaseIndex, list, effectIndex, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                        enabled
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          patchPhase(phaseIndex, {
                            [list]: phase[list].filter((_, index) => index !== effectIndex),
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </article>
          ))}
        </section>

        <section className={styles.status}>
          <strong>{message}</strong>
          {details ? <pre>{details}</pre> : null}
          {versions.length > 0 ? (
            <p>
              Published history:{' '}
              {versions
                .map(
                  (version) => `v${version.definitionVersion}${version.current ? ' current' : ''}`,
                )
                .join(' · ')}
            </p>
          ) : null}
        </section>
      </div>

      <aside className={styles.controlCard} id="event-controls">
        <section className={styles.dockSection}>
          <p className={styles.eyebrow}>Preview &amp; testing</p>
          <div className={styles.dockActions}>
            <button type="button" onClick={validate} disabled={busy}>
              Validate
            </button>
            <button type="button" onClick={preview} disabled={busy}>
              Preview
            </button>
            <button type="button" onClick={saveDraft} disabled={busy}>
              Save draft
            </button>
          </div>
          <label>
            Preview phase
            <select
              value={selectedPhase?.id}
              onChange={(event) => setSelectedPhaseId(event.target.value)}
            >
              {definition.phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Test clock
            <input
              type="datetime-local"
              value={testClock}
              onChange={(event) => setTestClock(event.target.value)}
            />
          </label>
        </section>

        <section className={styles.dockSection}>
          <p className={styles.eyebrow}>References</p>
          <label>
            Reward Package refs
            <input
              value={csv(definition.rewardPackageRefs)}
              onChange={(event) =>
                patchDefinition({ rewardPackageRefs: parseCsv(event.target.value) })
              }
              placeholder="reward.event-xp"
            />
          </label>
          <label>
            Aftermath refs
            <input
              value={csv(definition.aftermathRefs)}
              onChange={(event) => patchDefinition({ aftermathRefs: parseCsv(event.target.value) })}
              placeholder="aftermath.event-result"
            />
          </label>
        </section>

        <section className={styles.dockSection}>
          <p className={styles.eyebrow}>Publication</p>
          <div className={styles.publicationState}>
            <span>{publicationState}</span>
            <strong>{baseVersion === null ? 'Not published' : `v${baseVersion}`}</strong>
          </div>
          <label>
            Production action reason
            <textarea
              value={productionReason}
              maxLength={240}
              onChange={(event) => {
                setProductionReason(event.target.value)
                setProductionConfirmed(false)
              }}
              placeholder="Why is this Production action being performed?"
            />
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={productionConfirmed}
              onChange={(event) => setProductionConfirmed(event.target.checked)}
            />
            Confirm Production action
          </label>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={publish}
            disabled={busy || !canPublish || !productionActionReady}
          >
            Publish
          </button>
        </section>

        <section className={styles.dockSection}>
          <p className={styles.eyebrow}>Schedule</p>
          <label>
            Start
            <input
              type="datetime-local"
              value={scheduleStart}
              onChange={(event) => setScheduleStart(event.target.value)}
            />
          </label>
          <label>
            End
            <input
              type="datetime-local"
              value={scheduleEnd}
              onChange={(event) => setScheduleEnd(event.target.value)}
            />
          </label>
          <div className={styles.inlineActions}>
            <button
              type="button"
              onClick={schedule}
              disabled={busy || baseVersion === null || !productionActionReady}
            >
              Schedule
            </button>
            <button
              type="button"
              onClick={unschedule}
              disabled={busy || !scheduledRun || !productionActionReady}
            >
              Unschedule
            </button>
          </div>
        </section>
      </aside>
    </section>
  )
}
