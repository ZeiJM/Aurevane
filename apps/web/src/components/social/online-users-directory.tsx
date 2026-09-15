'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type {
  CharacterPresenceDirectoryEntry,
  OnlineCharacter,
} from '@/server/presence/character-presence-service'

import {
  compareLastSeenAt,
  formatLastSeenAt,
  readableIdentity,
  type LastSeenSortOrder,
} from './online-users-directory-utils'
import styles from './online-users-directory.module.css'

type PresenceCharacter = OnlineCharacter | CharacterPresenceDirectoryEntry
type DirectorySortOrder = LastSeenSortOrder | 'alphabetical'

function publicIdentityTags(
  character: PresenceCharacter,
): Array<{ kind: 'Discipline' | 'Personal Title'; label: string }> {
  const discipline = readableIdentity(character.disciplineId)
  const tags: Array<{ kind: 'Discipline' | 'Personal Title'; label: string }> = []
  if (discipline) tags.push({ kind: 'Discipline', label: discipline })
  if (character.personalTitle) tags.push({ kind: 'Personal Title', label: character.personalTitle })
  return tags
}

function onlineNameBucket(name: string): number {
  const first = name.trim().charAt(0)
  if (/^[A-Za-z]$/.test(first)) return 0
  if (/^[0-9]$/.test(first)) return 1
  return 2
}

function compareNames(left: PresenceCharacter, right: PresenceCharacter): number {
  const bucketDifference = onlineNameBucket(left.name) - onlineNameBucket(right.name)
  if (bucketDifference !== 0) return bucketDifference
  return left.name.localeCompare(right.name, 'en', { sensitivity: 'base', numeric: true })
}

function isOnline(character: PresenceCharacter): boolean {
  return 'isOnline' in character ? character.isOnline : true
}

function Portrait({ character, large = false }: { character: PresenceCharacter; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  const className = large ? styles.heroPortrait : styles.avatar

  if (character.imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className}
        src={character.imageUrl}
        alt={`${character.name} portrait`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span
      className={`${className} ${styles.fallbackPortrait}`}
      aria-label={`${character.name} portrait`}
    >
      {character.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function OnlineUsersDirectory({ characters }: { characters: OnlineCharacter[] }) {
  const [selected, setSelected] = useState<PresenceCharacter | null>(null)
  const profileDialog = useRef<HTMLDialogElement>(null)
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
      const label = readableIdentity(character.disciplineId)
      if (character.disciplineId && label) options.set(character.disciplineId, label)
    }
    return [...options.entries()].sort((left, right) => left[1].localeCompare(right[1], 'en'))
  }, [directory])

  const orderedCharacters = useMemo(() => {
    const source: PresenceCharacter[] = showAll ? (directory ?? []) : characters
    const filtered =
      showAll && classFilter !== 'all'
        ? source.filter((character) => character.disciplineId === classFilter)
        : source

    return [...filtered].sort((left, right) => {
      if (showAll && sortOrder !== 'alphabetical') {
        const lastSeenDifference = compareLastSeenAt(left.lastSeenAt, right.lastSeenAt, sortOrder)
        if (lastSeenDifference !== 0) return lastSeenDifference
      }
      return compareNames(left, right)
    })
  }, [characters, classFilter, directory, showAll, sortOrder])

  useEffect(() => {
    const dialog = profileDialog.current
    if (!selected || !dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [selected])

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
  const rosterCount = showAll
    ? directory
      ? `${orderedCharacters.length} shown`
      : loadingDirectory
        ? 'Loading…'
        : 'Directory'
    : `${characters.length} online`
  const selectedTags = selected ? publicIdentityTags(selected) : []
  const selectedOnline = selected ? isOnline(selected) : false

  return (
    <>
      <section
        className={styles.rosterPanel}
        data-directory-roster="true"
        data-av-surface="ink"
        aria-label={showAll ? 'All character directory' : 'Online character roster'}
      >
        <header className={styles.rosterHeader}>
          <div className={styles.rosterHeading}>
            <span className={styles.rosterMarker} aria-hidden="true">
              ◇
            </span>
            <div>
              <span className={styles.rosterKicker}>{showAll ? 'Directory' : 'Live roster'}</span>
              <h2>{showAll ? 'Known adventurers' : 'Active adventurers'}</h2>
              <small>
                {showAll
                  ? 'Browse the realm by class or recent activity.'
                  : 'Characters with an active presence heartbeat.'}
              </small>
            </div>
          </div>
          <div className={styles.toolbar} data-directory-controls="true">
            <span className={styles.rosterCount} aria-live="polite">
              {rosterCount}
            </span>
            <button
              type="button"
              className={`${styles.toggleButton} ${showAll ? styles.toggleButtonActive : ''}`}
              aria-pressed={showAll}
              onClick={toggleDirectory}
            >
              {showAll ? 'Show online only' : 'Show all characters'}
            </button>
          </div>
        </header>

        {showAll && directory ? (
          <div className={styles.filters} aria-label="Character directory filters">
            <label>
              <span>Class</span>
              <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                <option value="all">All classes</option>
                {classOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as DirectorySortOrder)}
              >
                <option value="recent">Last seen: most recent</option>
                <option value="oldest">Last seen: least recent</option>
                <option value="alphabetical">Alphabetical: A to Z</option>
              </select>
            </label>
            <span className={styles.directorySummary}>
              {orderedCharacters.length} of {directory.length} characters
            </span>
          </div>
        ) : null}

        {showAll && loadingDirectory ? (
          <p className={styles.loading}>Loading character directory…</p>
        ) : null}
        {showAll && directoryError ? (
          <div className={styles.error} role="status">
            <span>{directoryError}</span>
            <button type="button" onClick={() => void loadDirectory()}>
              Retry
            </button>
          </div>
        ) : null}

        {!(showAll && (loadingDirectory || directoryError)) && orderedCharacters.length === 0 ? (
          <p className={styles.empty}>
            {showAll
              ? 'No characters match the selected filters.'
              : 'No characters are currently visible online.'}
          </p>
        ) : null}

        {orderedCharacters.length > 0 ? (
          <>
            <div className={styles.columns} data-directory-columns="true" aria-hidden="true">
              <span>#</span>
              <span>Character</span>
              <span>Level</span>
              <span>Discipline</span>
              <span>Presence</span>
              <span />
            </div>
            <ul className={styles.list} data-directory-list="true" aria-label="Adventurer rows">
              {orderedCharacters.map((character, index) => {
                const discipline = readableIdentity(character.disciplineId)
                const online = isOnline(character)
                return (
                  <li key={character.characterId}>
                    <button
                      type="button"
                      className={styles.characterCard}
                      data-directory-row="true"
                      onClick={() => setSelected(character)}
                    >
                      <span className={styles.rowNumber} aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className={styles.identityCell}>
                        <Portrait character={character} />
                        <span className={styles.identity}>
                          <strong>{character.name}</strong>
                          <small>
                            Level {character.level}
                            {discipline ? ` · ${discipline}` : ''}
                          </small>
                        </span>
                      </span>
                      <span className={styles.level}>
                        <span className={styles.mobileLabel}>Level </span>
                        {character.level}
                      </span>
                      <span className={styles.discipline}>{discipline ?? 'Not set'}</span>
                      <span className={online ? styles.online : styles.lastSeen}>
                        <i
                          className={online ? styles.presenceDot : styles.presenceDotOffline}
                          aria-hidden="true"
                        />
                        {online ? 'Online' : formatLastSeenAt(character.lastSeenAt, currentNow)}
                      </span>
                      <span className={styles.rowAction} aria-hidden="true">
                        ↗
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        ) : null}
      </section>

      <dialog
        ref={profileDialog}
        className={styles.profileCard}
        data-av-surface="ink"
        aria-labelledby="online-profile-name"
        onCancel={(event) => {
          event.preventDefault()
          setSelected(null)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          // The only available action is Close; keep keyboard focus off the inert page.
          const close =
            event.currentTarget.querySelector<HTMLButtonElement>('button:not(:disabled)')
          if (close) {
            event.preventDefault()
            close.focus()
          }
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          if (
            event.target === event.currentTarget &&
            (event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom)
          )
            setSelected(null)
        }}
      >
        {selected ? (
          <>
            <button
              type="button"
              className={styles.close}
              aria-label="Close public character profile"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <div className={styles.portraitStage}>
              <Portrait character={selected} large />
              <span className={selectedOnline ? styles.liveBadge : styles.offlineBadge}>
                {selectedOnline ? '● Online' : '○ Offline'}
              </span>
            </div>
            <div className={styles.profileCopy}>
              <div className={styles.profileHeading}>
                <div className={styles.profileEyebrow}>
                  <span aria-hidden="true">◇</span>
                  Public character profile
                </div>
                <h2 id="online-profile-name">{selected.name}</h2>
                <div className={styles.identityTags} aria-label="Character identity tags">
                  <span className={styles.identityLabel}>Identity</span>
                  <div className={styles.tagList}>
                    {selectedTags.length > 0 ? (
                      selectedTags.map((tag) => (
                        <span
                          key={`${tag.kind}:${tag.label}`}
                          className={
                            tag.kind === 'Personal Title' ? styles.titleTag : styles.disciplineTag
                          }
                          title={tag.kind}
                        >
                          {tag.label}
                        </span>
                      ))
                    ) : (
                      <span className={styles.noTags}>No public identity tags are set.</span>
                    )}
                  </div>
                </div>
              </div>

              <dl>
                <div className={styles.profileStat}>
                  <dt>Character Level</dt>
                  <dd>{selected.level}</dd>
                </div>
                <div
                  className={`${styles.profileStat} ${selectedOnline ? styles.profileStatOnline : ''}`}
                >
                  <dt>Presence</dt>
                  <dd>
                    {selectedOnline
                      ? 'Online now'
                      : formatLastSeenAt(selected.lastSeenAt, currentNow)}
                  </dd>
                </div>
              </dl>

              <p className={styles.privacyNote}>
                Public profiles intentionally omit combat stats, inventory, currencies, account
                identity, and other private character data.
              </p>
              <div className={styles.futureActions} aria-label="Planned social actions">
                <button
                  type="button"
                  disabled
                  title="Direct messages arrive with the social phase."
                >
                  Send Direct Message · Planned
                </button>
                <button type="button" disabled title="Friends arrive with the social phase.">
                  Add Friend · Planned
                </button>
              </div>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  )
}
