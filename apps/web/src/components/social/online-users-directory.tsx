'use client'

import { Kicker } from '@aurevane/ui'
import { useEffect, useMemo, useState } from 'react'

import type {
  CharacterPresenceDirectoryEntry,
  OnlineCharacter,
} from '@/server/presence/character-presence-service'

import {
  compareDirectoryCharacters,
  formatLastSeenAt,
  readableDisciplinePair,
  readableIdentity,
  type DirectorySortOrder,
} from './online-users-directory-utils'
import { PublicCharacterPortrait, PublicCharacterProfile } from './public-character-profile'
import styles from './online-users-directory.module.css'

type PresenceCharacter = OnlineCharacter | CharacterPresenceDirectoryEntry

function isOnline(character: PresenceCharacter): boolean {
  return 'isOnline' in character ? character.isOnline : true
}

export function OnlineUsersDirectory({ characters }: { characters: OnlineCharacter[] }) {
  const [selected, setSelected] = useState<PresenceCharacter | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [directory, setDirectory] = useState<CharacterPresenceDirectoryEntry[] | null>(null)
  const [loadingDirectory, setLoadingDirectory] = useState(false)
  const [directoryError, setDirectoryError] = useState<string | null>(null)
  const [classFilter, setClassFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState<DirectorySortOrder>('recent')
  const [nowMs, setNowMs] = useState(0)

  const classOptions = useMemo(() => {
    const options = new Map<string, string>()
    for (const character of directory ?? []) {
      for (const disciplineId of [character.disciplineId, character.secondaryDisciplineId]) {
        const label = readableIdentity(disciplineId)
        if (disciplineId && label) options.set(disciplineId, label)
      }
    }
    return [...options.entries()].sort((left, right) => left[1].localeCompare(right[1], 'en'))
  }, [directory])

  const orderedCharacters = useMemo(() => {
    const source: PresenceCharacter[] = showAll ? (directory ?? []) : characters
    const filtered =
      showAll && classFilter !== 'all'
        ? source.filter(
            (character) =>
              character.disciplineId === classFilter ||
              character.secondaryDisciplineId === classFilter,
          )
        : source

    return [...filtered].sort((left, right) => compareDirectoryCharacters(left, right, sortOrder))
  }, [characters, classFilter, directory, showAll, sortOrder])

  useEffect(() => {
    if (!showAll) return
    const interval = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [showAll])

  async function loadDirectory() {
    setLoadingDirectory(true)
    setDirectoryError(null)
    try {
      const response = await fetch('/api/presence/directory', { cache: 'no-store' })
      if (!response.ok) throw new Error('directory request failed')
      const payload: unknown = await response.json()
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('characters' in payload) ||
        !Array.isArray(payload.characters)
      ) {
        throw new Error('directory response was invalid')
      }
      setDirectory(payload.characters as CharacterPresenceDirectoryEntry[])
    } catch {
      setDirectory(null)
      setDirectoryError('The full character directory is unavailable right now.')
    } finally {
      setLoadingDirectory(false)
    }
  }

  function toggleDirectory() {
    setSelected(null)
    if (showAll) {
      setShowAll(false)
      return
    }
    setNowMs(Date.now())
    setShowAll(true)
    void loadDirectory()
  }

  const currentNow = nowMs

  return (
    <>
      <header className={styles.heading} data-online-users-heading="true">
        <div className={styles.headingCopy}>
          <Kicker marker="◇">The realm, together</Kicker>
          <h1>Online Users</h1>
        </div>

        <div
          className={`${styles.heroControls} ${styles.heroControlsExpanded}`}
          data-directory-controls="true"
        >
          <div
            className={styles.filters}
            data-online-only={!showAll || undefined}
            aria-label="Character directory filters"
          >
            {showAll ? (
              <label>
                <span>Class</span>
                <select
                  value={classFilter}
                  disabled={!directory}
                  onChange={(event) => setClassFilter(event.target.value)}
                >
                  <option value="all">All classes</option>
                  {classOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span>Sort</span>
              <select
                value={sortOrder}
                disabled={showAll && !directory}
                onChange={(event) => setSortOrder(event.target.value as DirectorySortOrder)}
              >
                <option value="recent">Last seen: most recent</option>
                <option value="oldest">Last seen: least recent</option>
                <option value="alphabetical">Alphabetical: A to Z</option>
                <option value="level-desc">Level: highest first</option>
                <option value="level-asc">Level: lowest first</option>
                <option value="exp-desc">EXP: highest first</option>
                <option value="exp-asc">EXP: lowest first</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            className={styles.toggleButton}
            aria-pressed={showAll}
            onClick={toggleDirectory}
          >
            {showAll ? 'Show online only' : 'Show all characters'}
          </button>
        </div>
      </header>

      <section
        className={styles.rosterPanel}
        data-directory-roster="true"
        data-directory-table="true"
        data-av-surface="ink"
        aria-label={showAll ? 'All character directory' : 'Online character roster'}
      >
        {showAll && loadingDirectory ? (
          <p className={styles.loading} role="status">
            Loading character directory…
          </p>
        ) : null}
        {showAll && directoryError ? (
          <div className={styles.error} role="status">
            <span>{directoryError}</span>
            <button type="button" onClick={() => void loadDirectory()}>
              Retry
            </button>
          </div>
        ) : null}

        {!(showAll && loadingDirectory) &&
        !(showAll && directoryError) &&
        orderedCharacters.length === 0 ? (
          <p className={styles.empty}>
            {showAll
              ? 'No characters match the selected filters.'
              : 'No characters are currently visible online.'}
          </p>
        ) : null}

        {orderedCharacters.length > 0 ? (
          <div className={styles.columnHeadings} aria-hidden="true">
            <span>Character</span>
            <span>Level</span>
            <span>EXP</span>
            <span>Discipline</span>
            <span>Presence</span>
          </div>
        ) : null}
        {orderedCharacters.length > 0 ? (
          <div className={styles.list} data-directory-list="true">
            {orderedCharacters.map((character) => {
              const discipline = readableDisciplinePair(
                character.disciplineId,
                character.secondaryDisciplineId,
              )
              const online = isOnline(character)
              const lastSeen = formatLastSeenAt(character.lastSeenAt, currentNow)
              return (
                <button
                  type="button"
                  className={styles.characterRow}
                  data-directory-character="true"
                  data-online={online || undefined}
                  aria-haspopup="dialog"
                  key={character.characterId}
                  onClick={() => setSelected(character)}
                >
                  <span className={styles.avatarWrap}>
                    <PublicCharacterPortrait character={character} />
                    <i
                      className={styles.presenceDot}
                      data-online={online || undefined}
                      aria-hidden="true"
                    />
                  </span>
                  <span className={styles.identity}>
                    <strong>{character.name}</strong>
                    {character.personalTitle ? (
                      <span className={styles.personalTitle}>{character.personalTitle}</span>
                    ) : null}
                    <small>
                      Level {character.level}
                      {` · ${character.xp === null ? 'EXP unavailable' : `${character.xp.toLocaleString('en-US')} EXP`}`}
                      {discipline ? ` · ${discipline}` : ''}
                    </small>
                  </span>
                  <span className={styles.level} aria-hidden="true">
                    {character.level}
                  </span>
                  <span className={styles.experience} aria-hidden="true">
                    {character.xp === null ? '—' : character.xp.toLocaleString('en-US')}
                  </span>
                  <span className={styles.discipline} aria-hidden="true">
                    {discipline ?? 'Not displayed'}
                  </span>
                  <span className={styles.presence} data-online={online || undefined}>
                    {online ? 'Online' : lastSeen}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </section>

      {selected ? (
        <PublicCharacterProfile
          character={selected}
          nowMs={currentNow}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  )
}
