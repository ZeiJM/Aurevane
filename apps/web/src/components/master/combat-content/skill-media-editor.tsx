'use client'

import type { MatureSkillMediaHooks } from '@aurevane/game-core/combat/mature-skills'
import Image from 'next/image'

import {
  resolveSkillAudioCueHook,
  resolveSkillIconHook,
  skillAudioCueHookOptions,
  skillIconHookOptions,
} from '@/media/skill-media-hooks'

import { FinalizedMediaEditor } from './finalized-media-editor'

import styles from './combat-content-editor.module.css'
import { phase4SkillArtwork } from '@/components/battle/phase4-combat-art'

export interface SkillMediaEditorProps {
  readonly contentId?: string
  readonly value: MatureSkillMediaHooks
  readonly onChange: (value: MatureSkillMediaHooks) => void
}

export function SkillMediaEditor({ contentId, value, onChange }: SkillMediaEditorProps) {
  const icon = resolveSkillIconHook(value.iconKey)
  const audio = resolveSkillAudioCueHook(value.audioCueKey)
  const unregisteredIcon = value.iconKey && !icon ? value.iconKey : null
  const unregisteredAudio = value.audioCueKey && !audio ? value.audioCueKey : null

  return (
    <fieldset className={styles.typedGroup}>
      <legend>Media</legend>
      <FinalizedMediaEditor
        value={value}
        fallbackArtwork={
          icon?.previewSrc ?? (contentId ? (phase4SkillArtwork(contentId) ?? undefined) : undefined)
        }
        onChange={(media) => onChange({ ...value, artwork: media.artwork, audio: media.audio })}
      />

      <div className={styles.mediaGrid}>
        <label className={styles.field}>
          <span>Built-in artwork</span>
          <select
            aria-label="Skill artwork hook"
            value={value.iconKey ?? ''}
            onChange={(event) =>
              onChange({
                ...value,
                iconKey: event.currentTarget.value || null,
              })
            }
          >
            <option value="">Default artwork</option>
            {unregisteredIcon ? (
              <option value={unregisteredIcon}>Unregistered · {unregisteredIcon}</option>
            ) : null}
            {skillIconHookOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.mediaPreview} aria-label="Skill artwork preview">
          {icon ? (
            <>
              <Image
                src={icon.previewSrc}
                width={144}
                height={144}
                alt={`${icon.label} artwork preview`}
                unoptimized
              />
            </>
          ) : (
            <span>No registered artwork selected.</span>
          )}
        </div>

        <label className={styles.field}>
          <span>Built-in sound</span>
          <select
            aria-label="Skill audio hook"
            value={value.audioCueKey ?? ''}
            onChange={(event) =>
              onChange({
                ...value,
                audioCueKey: event.currentTarget.value || null,
              })
            }
          >
            <option value="">No sound</option>
            {unregisteredAudio ? (
              <option value={unregisteredAudio}>Unregistered · {unregisteredAudio}</option>
            ) : null}
            {skillAudioCueHookOptions.map((option) => (
              <option
                key={option.key}
                value={option.key}
                disabled={!option.available && option.key !== value.audioCueKey}
              >
                {option.label}
                {option.available ? '' : ' · runtime audio not produced yet'}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.mediaAudioPreview}>
          {audio?.available && audio.sampleSrc ? (
            <>
              <audio
                aria-label="Battle audio preview"
                controls
                preload="none"
                src={audio.sampleSrc}
              />
            </>
          ) : (
            <span>
              {value.audioCueKey
                ? 'This hook is reserved, but no approved runtime audio is available yet.'
                : 'No battle audio selected.'}
            </span>
          )}
        </div>
      </div>
    </fieldset>
  )
}
