'use client'

import { useEffect, useMemo, useState } from 'react'

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
    if (!selected) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
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

  return (
    <>
      <div className={styles.toolbar}>
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
        ) : (
          <span className={styles.toolbarSpacer} />
        )}
        <button
          type="button"
          className={`${styles.toggleButton} ${showAll ? styles.toggleButtonActive : ''}`}
          aria-pressed={showAll}
          onClick={toggleDirectory}
        >
          {showAll ? 'Show online only' : 'Show all characters'}
        </button>
      </div>

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

      {!loadingDirectory && !directoryError && orderedCharacters.length === 0 ? (
        <p className={styles.empty}>
          {showAll
            ? 'No characters match the selected filters.'
            : 'No characters are currently visible online.'}
        </p>
      ) : null}

      {orderedCharacters.length > 0 ? (
        <div className={styles.list}>
          {orderedCharacters.map((character) => {
            const discipline = readableIdentity(character.disciplineId)
            const online = isOnline(character)
            const lastSeen = formatLastSeenAt(character.lastSeenAt, currentNow)
            return (
              <button
                type="button"
                className={styles.characterCard}
                key={character.characterId}
                onClick={() => setSelected(character)}
              >
                <span className={styles.avatarWrap}>
                  <Portrait character={character} />
                  <i
                    className={`${styles.presenceDot} ${online ? '' : styles.presenceDotOffline}`}
                    aria-hidden="true"
                  />
                </span>
                <span className={styles.identity}>
                  <strong>{character.name}</strong>
                  <small>
                    Level {character.level}
                    {discipline ? ` · ${discipline}` : ''}
                  </small>
                </span>
                <span className={online ? styles.online : styles.lastSeen}>
                  {online ? 'Online' : lastSeen}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      {selected ? (
        <div className={styles.backdrop} onPointerDown={() => setSelected(null)}>
          <section
            className={styles.profileCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="online-profile-name"
            onPointerDown={(event) => event.stopPropagation()}
          >
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
              <span className={isOnline(selected) ? styles.liveBadge : styles.offlineBadge}>
                {isOnline(selected) ? '● Online' : '○ Offline'}
              </span>
            </div>
            <div className={styles.profileCopy}>
              <span>Public character profile</span>
              <h2 id="online-profile-name">{selected.name}</h2>
              <div aria-label="Character identity tags" style={{ display: 'grid', gap: '0.5rem' }}>
                <span
                  style={{
                    color: 'var(--av-text-dim)',
                    font: '700 0.46rem/1 var(--av-font-mono)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Identity
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.38rem' }}>
                  {publicIdentityTags(selected).length > 0 ? (
                    publicIdentityTags(selected).map((tag) => (
                      <span
                        key={`${tag.kind}:${tag.label}`}
                        title={tag.kind}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.42rem 0.58rem',
                          border: '1px solid rgba(207,169,93,.4)',
                          borderRadius: '999px',
                          color:
                            tag.kind === 'Personal Title'
                              ? 'var(--av-verdant-400)'
                              : 'var(--av-brass-200)',
                          background:
                            tag.kind === 'Personal Title'
                              ? 'rgba(76,147,104,.08)'
                              : 'rgba(207,169,93,.065)',
                          font: '700 .5rem/1 var(--av-font-mono)',
                        }}
                      >
                        {tag.label}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: 'var(--av-text-dim)', fontSize: '.62rem' }}>
                      No public identity tags are set.
                    </span>
                  )}
                </div>
              </div>
              <dl>
                <div>
                  <dt>Character Level</dt>
                  <dd>{selected.level}</dd>
                </div>
                <div>
                  <dt>Presence</dt>
                  <dd>
                    {isOnline(selected)
                      ? 'Online'
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
          </section>
        </div>
      ) : null}
    </>
  )
}
