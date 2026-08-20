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

function equippedTitles(character: OnlineCharacter): string[] {
  const titles = [readableIdentity(character.disciplineId), character.personalTitle]
  return titles.filter((title): title is string => Boolean(title))
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
    <span className={`${className} ${styles.fallbackPortrait}`} aria-label={`${character.name} portrait`}>
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
        {characters.map((character) => (
          <button type="button" className={styles.characterCard} key={character.characterId} onClick={() => setSelected(character)}>
            <span className={styles.avatarWrap}><Portrait character={character} /><i className={styles.presenceDot} aria-hidden="true" /></span>
            <span className={styles.identity}>
              <strong>{character.name}</strong>
              <small>Level {character.level}{equippedTitles(character).length > 0 ? ` · ${equippedTitles(character).join(' · ')}` : ''}</small>
            </span>
            <span className={styles.online}>Online</span>
          </button>
        ))}
      </div>

      {selected ? (
        <div className={styles.backdrop} onPointerDown={() => setSelected(null)}>
          <section className={styles.profileCard} role="dialog" aria-modal="true" aria-labelledby="online-profile-name" onPointerDown={(event) => event.stopPropagation()}>
            <button type="button" className={styles.close} aria-label="Close public character profile" onClick={() => setSelected(null)}>×</button>
            <div className={styles.portraitStage}><Portrait character={selected} large /><span className={styles.liveBadge}>● Online</span></div>
            <div className={styles.profileCopy}>
              <span>Public character profile</span>
              <h2 id="online-profile-name">{selected.name}</h2>
              <p className={styles.titleLine}>{selected.personalTitle ?? 'Wayfarer'}</p>
              <div aria-label="Equipped titles" style={{ display: 'grid', gap: '0.42rem' }}>
                <span style={{ color: 'var(--av-text-dim)', font: '700 0.46rem/1 var(--av-font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Equipped Titles</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.38rem' }}>
                  {equippedTitles(selected).length > 0 ? equippedTitles(selected).map((title) => (
                    <span key={title} style={{ padding: '0.42rem 0.58rem', border: '1px solid rgba(207,169,93,.4)', borderRadius: '999px', color: 'var(--av-brass-200)', background: 'rgba(207,169,93,.065)', font: '700 .5rem/1 var(--av-font-mono)' }}>{title}</span>
                  )) : <span style={{ color: 'var(--av-text-dim)', fontSize: '.62rem' }}>No titles equipped.</span>}
                </div>
              </div>
              <dl>
                <div><dt>Character Level</dt><dd>{selected.level}</dd></div>
                <div><dt>Presence</dt><dd>Online</dd></div>
              </dl>
              <p className={styles.privacyNote}>Public profiles intentionally omit combat stats, inventory, currencies, account identity, and other private character data.</p>
              <div className={styles.futureActions} aria-label="Planned social actions">
                <button type="button" disabled title="Direct messages arrive with the social phase.">Send Direct Message · Planned</button>
                <button type="button" disabled title="Friends arrive with the social phase.">Add Friend · Planned</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
