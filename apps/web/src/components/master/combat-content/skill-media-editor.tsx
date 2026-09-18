'use client'

import type { MatureSkillMediaHooks } from '@aurevane/game-core/combat/mature-skills'
import Image from 'next/image'

import {
  resolveSkillAudioCueHook,
  resolveSkillIconHook,
  skillAudioCueHookOptions,
  skillIconHookOptions,
} from '@/media/skill-media-hooks'

import styles from './combat-content-editor.module.css'

export interface SkillMediaEditorProps {
  readonly value: MatureSkillMediaHooks
  readonly onChange: (value: MatureSkillMediaHooks) => void
}

export function SkillMediaEditor({ value, onChange }: SkillMediaEditorProps) {
  const icon = resolveSkillIconHook(value.iconKey)
  const audio = resolveSkillAudioCueHook(value.audioCueKey)
  const unregisteredIcon = value.iconKey && !icon ? value.iconKey : null
  const unregisteredAudio = value.audioCueKey && !audio ? value.audioCueKey : null

  return (
    <fieldset className={styles.typedGroup}>
      <legend>Media</legend>

      <div className={styles.mediaGrid}>
        <label className={styles.field}>
          <span>Skill artwork</span>
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
            <option value="">No artwork hook</option>
            {unregisteredIcon ? (
              <option value={unregisteredIcon}>Unregistered · {unregisteredIcon}</option>
            ) : null}
            {skillIconHookOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <small className={styles.fieldHint}>
            Selects a stable approved artwork hook. Raw URLs and file paths are not authorable.
          </small>
        </label>

        <div className={styles.mediaPreview} aria-label="Skill artwork preview">
          {icon ? (
            <>
              <Image
                src={icon.previewSrc}
                width={96}
                height={96}
                alt={`${icon.label} artwork preview`}
                unoptimized
              />
              <code>{icon.key}</code>
            </>
          ) : (
            <span>No registered artwork selected.</span>
          )}
        </div>

        <label className={styles.field}>
          <span>Battle audio</span>
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
            <option value="">No audio hook</option>
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
          <small className={styles.fieldHint}>
            Produced cues can be reassigned now. A current reserved hook remains visible without
            pretending an audio file exists.
          </small>
        </label>

        <div className={styles.mediaAudioPreview}>
          {audio?.available && audio.sampleSrc ? (
            <>
              <audio aria-label="Battle audio preview" controls preload="none" src={audio.sampleSrc} />
              <code>{audio.sampleAssetId}</code>
            </>
          ) : (
            <span>
              {value.audioCueKey
                ? 'This hook is reserved, but no approved runtime audio is available yet.'
                : 'No battle audio selected.'}
            </span>
          )}
        </div>

        <div className={styles.mediaReadOnly}>
          <span>VFX hook</span>
          <code aria-label="VFX hook read only" data-media-hook-readonly="vfx">
            {value.vfxKey ?? 'None'}
          </code>
          <small>
            Read only for now. VFX becomes editable when the approved VFX registry/runtime exists.
          </small>
        </div>
      </div>
    </fieldset>
  )
}
