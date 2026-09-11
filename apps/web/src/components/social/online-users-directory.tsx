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
  const rosterCount = showAll
    ? directory
      ? `${orderedCharacters.length} shown`
      : loadingDirectory
        ? 'Loading…'
        : 'Directory'
    : `${characters.length} online`

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.toolbarSpacer} />
        <button
          type="button"
          className={`${styles.toggleButton} ${showAll ? styles.toggleButtonActive : ''}`}
          aria-pressed={showAll}
          onClick={toggleDirectory}
        >
          {showAll ? 'Show online only' : 'Show all characters'}
        </button>
      </div>

      <section
        className={styles.rosterPanel}
        aria-label={showAll ? 'All character directory' : 'Online character roster'}
      >
        <header className={styles.rosterHeader}>
          <div className={styles.rosterHeading}>
            <span className={styles.rosterMarker} aria-hidden="true">
              ◇
            </span>
            <div>
              <span className={styles.rosterKicker}>{showAll ? 'Directory' : 'Live roster'}</span>
              <strong>{showAll ? 'Known adventurers' : 'Active adventurers'}</strong>
              <small>
                {showAll
                  ? 'Browse the realm by class or recent activity.'
                  : 'Characters with an active presence heartbeat.'}
              </small>
            </div>
          </div>
          <span className={styles.rosterCount}>{rosterCount}</span>
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
                  className={`${styles.characterCard} ${online ? styles.characterCardOnline : ''}`}
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
      </section>

      {selected ? (
        <div className={styles.backdrop} onPointerDown={() => setSelected(null)}>
          <section
            className={styles.profileCard}
            style={{
              borderColor: 'rgba(207, 169, 93, 0.42)',
              background:
                'radial-gradient(circle at 92% 5%, rgba(95,188,133,.08), transparent 15rem), radial-gradient(circle at 58% 0%, rgba(162,123,226,.08), transparent 18rem), linear-gradient(145deg, #0b1017, #090d13 72%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,.035), 0 2.4rem 7rem rgba(0,0,0,.82), 0 0 0 1px rgba(207,169,93,.035)',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="online-profile-name"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.close}
              style={{
                borderColor: 'rgba(207,169,93,.22)',
                background: 'rgba(5,8,12,.9)',
                boxShadow: '0 .45rem 1rem rgba(0,0,0,.28)',
              }}
              aria-label="Close public character profile"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <div
              className={styles.portraitStage}
              style={{
                background:
                  'radial-gradient(circle at 48% 22%, rgba(207,169,93,.2), transparent 46%), linear-gradient(180deg, rgba(255,255,255,.02), transparent 40%), #06090d',
                boxShadow: 'inset -1px 0 0 rgba(207,169,93,.12)',
              }}
            >
              <Portrait character={selected} large />
              <span className={isOnline(selected) ? styles.liveBadge : styles.offlineBadge}>
                {isOnline(selected) ? '● Online' : '○ Offline'}
              </span>
            </div>
            <div className={styles.profileCopy}>
              <div
                style={{
                  display: 'grid',
                  gap: '.65rem',
                  paddingBottom: '.95rem',
                  borderBottom: '1px solid rgba(207,169,93,.13)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '.45rem',
                    color: 'var(--av-brass-300)',
                    font: '750 .5rem/1 var(--av-font-mono)',
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'grid',
                      width: '1.35rem',
                      height: '1.35rem',
                      placeItems: 'center',
                      border: '1px solid rgba(162,123,226,.32)',
                      borderRadius: '50%',
                      color: '#bda3eb',
                      background: 'rgba(116,91,166,.07)',
                      fontSize: '.55rem',
                    }}
                  >
                    ◇
                  </span>
                  Public character profile
                </div>
                <h2
                  id="online-profile-name"
                  style={{
                    margin: 0,
                    color: '#f3ead8',
                    fontSize:
                      selected.name.length > 20
                        ? 'clamp(1.35rem, 3.2vw, 2.1rem)'
                        : selected.name.length > 14
                          ? 'clamp(1.65rem, 4vw, 2.6rem)'
                          : 'clamp(2rem, 5vw, 3.2rem)',
                    lineHeight: 0.95,
                    letterSpacing: '-.015em',
                    overflowWrap: 'anywhere',
                    textShadow: '0 .08rem 0 rgba(0,0,0,.55)',
                  }}
                >
                  {selected.name}
                </h2>
                <div
                  aria-label="Character identity tags"
                  style={{ display: 'grid', gap: '.38rem' }}
                >
                  <span
                    style={{
                      color: 'var(--av-text-dim)',
                      font: '700 0.43rem/1 var(--av-font-mono)',
                      letterSpacing: '0.065em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Identity
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.38rem' }}>
                    {publicIdentityTags(selected).length > 0 ? (
                      publicIdentityTags(selected).map((tag) => (
                        <span
                          key={`${tag.kind}:${tag.label}`}
                          title={tag.kind}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            minHeight: '1.8rem',
                            padding: '.38rem .62rem',
                            border:
                              tag.kind === 'Personal Title'
                                ? '1px solid rgba(95,188,133,.34)'
                                : '1px solid rgba(207,169,93,.38)',
                            borderRadius: '999px',
                            color:
                              tag.kind === 'Personal Title' ? '#a4ddb7' : 'var(--av-brass-200)',
                            background:
                              tag.kind === 'Personal Title'
                                ? 'linear-gradient(180deg, rgba(55,126,82,.13), rgba(55,126,82,.05))'
                                : 'linear-gradient(180deg, rgba(207,169,93,.09), rgba(207,169,93,.035))',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.025)',
                            font: '700 .48rem/1 var(--av-font-mono)',
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
              </div>

              <dl style={{ gap: '.55rem' }}>
                <div
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderColor: 'rgba(207,169,93,.18)',
                    background:
                      'linear-gradient(135deg, rgba(207,169,93,.055), rgba(255,255,255,.012)), rgba(5,8,12,.36)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.018)',
                  }}
                >
                  <dt>Character Level</dt>
                  <dd style={{ color: '#f1e7d4', fontSize: '1.05rem' }}>{selected.level}</dd>
                </div>
                <div
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderColor: isOnline(selected)
                      ? 'rgba(95,188,133,.24)'
                      : 'rgba(151,157,168,.2)',
                    background: isOnline(selected)
                      ? 'linear-gradient(135deg, rgba(55,126,82,.09), rgba(255,255,255,.012)), rgba(5,8,12,.36)'
                      : 'linear-gradient(135deg, rgba(120,128,140,.045), rgba(255,255,255,.012)), rgba(5,8,12,.36)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.018)',
                  }}
                >
                  <dt>Presence</dt>
                  <dd
                    style={{
                      color: isOnline(selected) ? '#a4ddb7' : '#e8e1d3',
                      fontSize: '.9rem',
                      lineHeight: 1.25,
                    }}
                  >
                    {isOnline(selected)
                      ? 'Online now'
                      : formatLastSeenAt(selected.lastSeenAt, currentNow)}
                  </dd>
                </div>
              </dl>

              <p
                className={styles.privacyNote}
                style={{
                  padding: '.68rem .76rem',
                  border: '1px solid rgba(162,123,226,.14)',
                  borderRadius: 'var(--av-radius-sm)',
                  background:
                    'linear-gradient(90deg, rgba(116,91,166,.055), rgba(255,255,255,.008))',
                }}
              >
                Public profiles intentionally omit combat stats, inventory, currencies, account
                identity, and other private character data.
              </p>
              <div className={styles.futureActions} aria-label="Planned social actions">
                <button
                  type="button"
                  disabled
                  style={{
                    borderColor: 'rgba(207,169,93,.16)',
                    background: 'rgba(255,255,255,.012)',
                  }}
                  title="Direct messages arrive with the social phase."
                >
                  Send Direct Message · Planned
                </button>
                <button
                  type="button"
                  disabled
                  style={{
                    borderColor: 'rgba(207,169,93,.16)',
                    background: 'rgba(255,255,255,.012)',
                  }}
                  title="Friends arrive with the social phase."
                >
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
