'use client'

import { useEffect, useRef, useState } from 'react'

import type {
  CharacterPresenceDirectoryEntry,
  OnlineCharacter,
} from '@/server/presence/character-presence-service'

import { formatLastSeenAt, readableIdentity } from './online-users-directory-utils'
import styles from './public-character-profile.module.css'

type PublicCharacter = OnlineCharacter | CharacterPresenceDirectoryEntry

export function PublicCharacterPortrait({
  character,
  large = false,
}: {
  character: PublicCharacter
  large?: boolean
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const className = large ? styles.heroPortrait : styles.avatar
  if (character.imageUrl && failedSource !== character.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className}
        src={character.imageUrl}
        alt={`${character.name} portrait`}
        width={large ? 180 : 48}
        height={large ? 180 : 48}
        loading={large ? 'eager' : 'lazy'}
        referrerPolicy="no-referrer"
        onError={() => setFailedSource(character.imageUrl)}
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

/** This view consumes only the existing shallow public projection, never private build data. */
export function PublicCharacterProfile({
  character,
  nowMs,
  onClose,
}: {
  character: PublicCharacter
  nowMs: number
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const online = 'isOnline' in character ? character.isOnline : true
  const primaryDiscipline = readableIdentity(character.disciplineId)
  const secondaryDiscipline = readableIdentity(character.secondaryDisciplineId)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={styles.profileCard}
      data-public-character-profile="true"
      data-av-surface="ink"
      aria-labelledby="online-profile-name"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close()
      }}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <span>Among the adventurers</span>
            <h2 id="online-profile-name">{character.name}</h2>
            <p>Public character profile</p>
          </div>
        </header>
        <div className={styles.profileBody}>
          <div className={styles.portraitStage}>
            <PublicCharacterPortrait character={character} large />
            <span className={styles.liveBadge} data-online={online || undefined}>
              {online ? '● Online' : '○ Offline'}
            </span>
          </div>
          <div className={styles.profileCopy}>
            <div className={styles.tags} aria-label="Character identity tags">
              {primaryDiscipline ? (
                <span title="Primary Discipline">{primaryDiscipline}</span>
              ) : null}
              {secondaryDiscipline ? (
                <span title="Secondary Discipline">{secondaryDiscipline}</span>
              ) : null}
              {character.personalTitle ? (
                <span title="Personal Title">{character.personalTitle}</span>
              ) : null}
              {!primaryDiscipline && !secondaryDiscipline && !character.personalTitle ? (
                <p>No public identity tags are set.</p>
              ) : null}
            </div>
            <dl>
              <div>
                <dt>Character Level</dt>
                <dd>{character.level}</dd>
              </div>
              <div>
                <dt>Presence</dt>
                <dd>{online ? 'Online now' : formatLastSeenAt(character.lastSeenAt, nowMs)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </dialog>
  )
}
