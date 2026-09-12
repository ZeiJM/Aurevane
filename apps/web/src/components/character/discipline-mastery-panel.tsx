'use client'

import { useState } from 'react'

import type { DisciplineAtlasState } from '@aurevane/game-core/character/discipline-atlas'

import { FoundationDisciplineSigil } from './foundation-discipline-sigil'
import styles from './discipline-mastery-panel.module.css'

const STAGES = ['', 'Initiate', 'Practiced', 'Adept', 'Expert', 'Master'] as const
const BAND_LABELS = {
  foundation: 'Foundations',
  'first-journey': 'First Journey',
  'rekindling-1': 'After Rekindling I',
  'rekindling-2': 'After Rekindling II',
  'rekindling-3': 'After Rekindling III',
} as const
const BAND_ORDER = [
  'foundation',
  'first-journey',
  'rekindling-1',
  'rekindling-2',
  'rekindling-3',
] as const

type AtlasBand = (typeof BAND_ORDER)[number]

interface AtlasMasteryView {
  xp: number
  stage: number
  demonstratedSkillCount: number
}

interface AtlasEntryView {
  key: string
  disciplineId: string | null
  name: string
  summary: string
  family: string
  band: AtlasBand
  publication: 'published' | 'planned'
  state: DisciplineAtlasState
  releaseEligible: boolean
  effectiveSelectable: boolean
  requirementSummary: string
  unmetRequirements: string[]
  masteryRite: string | null
  power: {
    reliability: number
    flexibility: number
    setup: number
    ruleAccess: number
    execution: number
  } | null
  mastery: AtlasMasteryView | null
}

interface AtlasResponse {
  atlas?: {
    progressionCycleNumber: number
    rekindlingCount: number
    testingAccess: boolean
    totalDisciplines: number
    publishedDisciplines: number
    entries: AtlasEntryView[]
  }
  error?: { message?: string }
}

function stateLabel(entry: AtlasEntryView): string {
  if (entry.state === 'testing') return 'Testing access'
  if (entry.state === 'unlocked') return 'Unlocked'
  if (entry.state === 'veiled') return 'Veiled'
  if (entry.state === 'rumored') return 'Rumored'
  if (entry.publication === 'planned') return 'Planned'
  return 'Revealed'
}

function masteryLabel(mastery: AtlasMasteryView | null): string {
  if (!mastery) return 'Not yet practiced'
  return `${STAGES[Math.max(1, Math.min(5, mastery.stage)) as 1 | 2 | 3 | 4 | 5]} · ${mastery.xp}/1,000 XP`
}

function PowerMeter({ label, value }: { label: string; value: number }) {
  return (
    <span className={styles.powerItem} title={`${label}: ${value} of 5`}>
      <span>{label}</span>
      <i aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <b key={index} data-filled={index < value ? 'true' : 'false'} />
        ))}
      </i>
    </span>
  )
}

export function DisciplineMasteryPanel() {
  const [atlas, setAtlas] = useState<NonNullable<AtlasResponse['atlas']> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function load() {
    if (pending || atlas) return
    setPending(true)
    try {
      const response = await fetch('/api/character/mastery', { cache: 'no-store' })
      const body = (await response.json()) as AtlasResponse
      if (!response.ok || !body.atlas)
        throw new Error(body.error?.message ?? 'The Discipline Atlas is temporarily unavailable.')
      setAtlas(body.atlas)
      setError(null)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The Discipline Atlas is temporarily unavailable.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <details
      className={styles.panel}
      onToggle={(event) => {
        if (event.currentTarget.open) void load()
      }}
    >
      <summary>
        <span>
          <strong>Discipline Atlas &amp; Mastery</strong>
          <small>See what you know, what your history can open, and what still lies ahead.</small>
        </span>
      </summary>

      <div className={styles.intro}>
        <p>
          The Atlas is a map of combat traditions, not an upgrade tree. Later Disciplines trade
          simplicity and reliability for stranger rules, heavier setup or harder execution; they do
          not receive a larger raw power budget simply because they are harder to reach.
        </p>
        <p>
          Mastery is earned through use. The current track is Initiate → Practiced at 100 XP → Adept
          at 300 → Expert at 600 → Master at 1,000, with Technique demonstrations and authored
          trials becoming the proof behind the higher ranks.
        </p>
      </div>

      {pending ? <p role="status">Opening the Atlas…</p> : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}{' '}
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : null}

      {atlas ? (
        <>
          <div className={styles.overview}>
            <div>
              <span>Known design</span>
              <strong>{atlas.totalDisciplines} Disciplines</strong>
            </div>
            <div>
              <span>Published now</span>
              <strong>{atlas.publishedDisciplines}</strong>
            </div>
            <div>
              <span>Your history</span>
              <strong>
                {atlas.rekindlingCount === 0
                  ? 'First journey'
                  : `${atlas.rekindlingCount} Rekindling${atlas.rekindlingCount === 1 ? '' : 's'}`}
              </strong>
            </div>
          </div>

          {atlas.testingAccess ? (
            <aside className={styles.testingNote}>
              <strong>Testing access is open.</strong>
              <span>
                Every published Discipline remains selectable for development testing. The Atlas
                still shows its eventual release path, and this testing entitlement does not count
                as earned Mastery.
              </span>
            </aside>
          ) : null}

          <div className={styles.bands}>
            {BAND_ORDER.map((band) => {
              const entries = atlas.entries.filter((entry) => entry.band === band)
              if (entries.length === 0) return null
              return (
                <section className={styles.band} key={band}>
                  <header>
                    <span>{BAND_LABELS[band]}</span>
                    <small>{entries.length} traditions</small>
                  </header>
                  <div className={styles.rows}>
                    {entries.map((entry) => (
                      <article
                        className={styles.row}
                        data-state={entry.state}
                        data-publication={entry.publication}
                        key={entry.key}
                      >
                        <div className={styles.identity}>
                          <span className={styles.sigil} aria-hidden="true">
                            {entry.disciplineId ? (
                              <FoundationDisciplineSigil disciplineId={entry.disciplineId} />
                            ) : (
                              '◇'
                            )}
                          </span>
                          <div>
                            <span className={styles.state}>{stateLabel(entry)}</span>
                            <strong>{entry.name}</strong>
                            <small>{entry.summary}</small>
                          </div>
                        </div>

                        {entry.disciplineId ? (
                          <>
                            <div className={styles.masteryLine}>
                              <span>{masteryLabel(entry.mastery)}</span>
                              {entry.mastery ? (
                                <span>{entry.mastery.demonstratedSkillCount}/8 demonstrated</span>
                              ) : null}
                            </div>
                            <progress
                              aria-label={`${entry.name} Mastery`}
                              value={entry.mastery?.xp ?? 0}
                              max={1000}
                            />
                          </>
                        ) : null}

                        <div className={styles.requirements}>
                          <span>Path</span>
                          <strong>{entry.requirementSummary}</strong>
                          {entry.effectiveSelectable && !entry.releaseEligible ? (
                            <small>
                              Release requirements still outstanding:{' '}
                              {entry.unmetRequirements.join(' · ')}
                            </small>
                          ) : null}
                          {entry.masteryRite ? (
                            <small>Mastery Rite: {entry.masteryRite}</small>
                          ) : null}
                        </div>

                        {entry.power ? (
                          <div
                            className={styles.power}
                            aria-label={`${entry.name} identity profile`}
                          >
                            <PowerMeter label="Reliability" value={entry.power.reliability} />
                            <PowerMeter label="Flexibility" value={entry.power.flexibility} />
                            <PowerMeter label="Setup" value={entry.power.setup} />
                            <PowerMeter label="Rule access" value={entry.power.ruleAccess} />
                            <PowerMeter label="Execution" value={entry.power.execution} />
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>

          <p className={styles.footerNote}>
            Power-profile marks describe how a Discipline asks you to play; they are not a strength
            rating. Foundation Disciplines remain endgame-viable through reliability, clean action
            economy and broad build compatibility.
          </p>
        </>
      ) : null}
    </details>
  )
}
