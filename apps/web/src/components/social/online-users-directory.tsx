'use client'

import { useEffect, useState } from 'react'

import type { OnlineCharacter } from '@/server/presence/character-presence-service'

import styles from './online-users-directory.module.css'

function readableIdentity(value: string | null): string | null {
  if (!value) return null
  return value
    .replace(/^starter[.:_-]?/i, '')
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function publicIdentityTags(character: OnlineCharacter): Array<{ kind: 'Discipline' | 'Personal Title'; label: string }> {
  const discipline = readableIdentity(character.disciplineId)
  const tags: Array<{ kind: 'Discipline' | 'Personal Title'; label: string }> = []
  if (discipline) tags.push({ kind: 'Discipline', label: discipline })
  if (character.personalTitle) tags.push({ kind: 'Personal Title', label: character.personalTitle })
  return tags
}

function Portrait({ character, large = false }: { character: OnlineCharacter; large?: boolean }) {
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
  const [selected, setSelected] = useState<OnlineCharacter | null>(null)

  useEffect(() => {
    if (!selected) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [selected])

  if (characters.length === 0) {
    return <p className={styles.empty}>No characters are currently visible online.</p>
  }

  return (
    <>
      <div className={styles.list}>
        {characters.map((character) => {
          const tags = publicIdentityTags(character)
          return (
            <button
              type="button"
              className={styles.characterCard}
              key={character.characterId}
              onClick={() => setSelected(character)}
            >
              <span className={styles.avatarWrap}>
                <Portrait character={character} />
                <i className={styles.presenceDot} aria-hidden="true" />
              </span>
              <span className={styles.identity}>
                <strong>{character.name}</strong>
                <small>
                  Level {character.level}
                  {tags.length > 0 ? ` · ${tags.map((tag) => tag.label).join(' · ')}` : ''}
                </small>
              </span>
              <span className={styles.online}>Online</span>
            </button>
          )
        })}
      </div>

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
              <span className={styles.liveBadge}>● Online</span>
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
                          gap: '0.34rem',
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
                        <small
                          style={{
                            color: 'var(--av-text-dim)',
                            font: '700 .4rem/1 var(--av-font-mono)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {tag.kind === 'Personal Title' ? 'Title' : 'Discipline'}
                        </small>
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
                  <dd>Online</dd>
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