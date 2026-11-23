'use client'

import { useState } from 'react'
import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
import type { EventEffectReference } from '@aurevane/game-core/events/persistent-event'
import type { PublishedStoryNpc } from '@aurevane/validation/combat/npc-design'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import styles from './event-builder.module.css'

export function isNpcCastEffect(effect: EventEffectReference): boolean {
  return (
    effect.type === 'npc-presentation' &&
    /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/u.test(effect.referenceKey)
  )
}

export type StoryNpcCatalogue = PublishedStoryNpc[] | 'unavailable' | null

export function EventPhaseCast({
  phaseName,
  effects,
  catalogue,
  canManageNpcs,
  change,
}: {
  phaseName: string
  effects: readonly EventEffectReference[]
  catalogue: StoryNpcCatalogue
  canManageNpcs: boolean
  change: (effects: readonly EventEffectReference[]) => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const npcs = Array.isArray(catalogue) ? catalogue : []
  const search = query.trim().toLowerCase()
  const available = npcs.filter(
    (npc) =>
      `${npc.name} ${npc.id}`.toLowerCase().includes(search) &&
      !effects.some((effect) => isNpcCastEffect(effect) && effect.referenceKey === npc.id),
  )
  const chosen = available.find((npc) => npc.id === selected)

  return (
    <fieldset className={styles.compositionGroup}>
      <legend>{phaseName} cast</legend>
      <p>Add a published Story NPC to this draft. Cast placement is unavailable in live Events.</p>
      {canManageNpcs ? <p>NPC Design opens in a new tab and keeps this draft open.</p> : null}
      {catalogue === 'unavailable' ? (
        <p role="status">Story NPCs could not be loaded. Reopen Phases to try again.</p>
      ) : null}
      <div className={styles.grid}>
        <label>
          Search NPCs
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelected('')
            }}
            placeholder="Name or NPC ID"
          />
        </label>
        <label>
          Published Story NPC
          <select
            value={chosen?.id ?? ''}
            onChange={(event) => setSelected(event.target.value)}
            disabled={!available.length}
          >
            <option value="">
              {catalogue === null
                ? 'Loading Story NPCs…'
                : available.length
                  ? 'Choose an NPC'
                  : 'No matching Story NPCs'}
            </option>
            {available.map((npc) => (
              <option key={npc.id} value={npc.id}>
                {npc.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!chosen}
          onClick={() => {
            if (!chosen) return
            change([
              ...effects,
              { type: 'npc-presentation', referenceKey: chosen.id, enabled: true },
            ])
            setSelected('')
          }}
        >
          Add NPC
        </button>
      </div>
      {effects.map((effect, index) => {
        if (!isNpcCastEffect(effect)) return null
        const npc = npcs.find((entry) => entry.id === effect.referenceKey)
        return (
          <div className={styles.castMember} key={index}>
            {npc ? (
              <details>
                <summary>Preview {npc.name}</summary>
                <div className={styles.castPreview}>
                  <CharacterPortraitImage
                    imageUrl={npc.imageUrl}
                    fallbackAssetId={getStarterPortraitImageAssetId(
                      npc.portraitRef && isStarterCharacterPortraitRef(npc.portraitRef)
                        ? npc.portraitRef
                        : 'portrait.starter.wayfarer-01',
                    )}
                    sizes="72px"
                  />
                  <p>
                    {npc.imageUrl || npc.portraitRef
                      ? 'Published Story appearance'
                      : 'Default portrait'}
                  </p>
                </div>
              </details>
            ) : (
              <p>
                {Array.isArray(catalogue)
                  ? 'Missing or unpublished Story NPC'
                  : 'Story NPC reference'}{' '}
                · {effect.referenceKey}
              </p>
            )}
            {canManageNpcs ? (
              <a
                href={`/master/npc-design?npc=${encodeURIComponent(effect.referenceKey)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in NPC Design
              </a>
            ) : null}
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={effect.enabled}
                onChange={(event) =>
                  change(
                    effects.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, enabled: event.target.checked } : entry,
                    ),
                  )
                }
              />
              Enabled
            </label>
            <button
              type="button"
              aria-label={npc ? `Remove ${npc.name} from cast` : 'Remove Story NPC reference'}
              onClick={() => change(effects.filter((_, entryIndex) => entryIndex !== index))}
            >
              Remove
            </button>
          </div>
        )
      })}
    </fieldset>
  )
}
