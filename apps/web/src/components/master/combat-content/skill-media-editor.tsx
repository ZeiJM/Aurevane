'use client'

import type { MatureSkillMediaHooks } from '@aurevane/game-core/combat/mature-skills'

import {
  resolveSkillAudioCueHook,
  resolveSkillIconHook,
  skillAudioCueHookOptions,
} from '@/media/skill-media-hooks'

import { restoreContentArtworkDefault } from '@/media/content-artwork-defaults'
import { FinalizedMediaEditor } from './finalized-media-editor'

import styles from './combat-content-editor.module.css'
import {
  BATTLE_COMMAND_ARTWORK,
  battleSkillArtwork,
} from '@/components/battle/battle-skill-presentation'
import { PV1F_BASIC_ATTACK_ID } from '@aurevane/game-core/combat/pv1f-skills'

export interface SkillMediaEditorProps {
  readonly contentId?: string
  readonly value: MatureSkillMediaHooks
  readonly onChange: (value: MatureSkillMediaHooks) => void
  readonly onPendingMediaChange?: (pending: boolean) => void
}

export function SkillMediaEditor({
  contentId,
  value,
  onChange,
  onPendingMediaChange,
}: SkillMediaEditorProps) {
  const icon = resolveSkillIconHook(value.iconKey)
  const fallbackArtwork =
    icon?.previewSrc ??
    (contentId === 'basic.move'
      ? BATTLE_COMMAND_ARTWORK.move
      : contentId
        ? battleSkillArtwork(contentId === 'unarmed.basic' ? PV1F_BASIC_ATTACK_ID : contentId)
        : undefined)
  const audio = resolveSkillAudioCueHook(value.audioCueKey)
  const unregisteredAudio = value.audioCueKey && !audio ? value.audioCueKey : null

  return (
    <div className={styles.mediaEditor}>
      <FinalizedMediaEditor
        value={value}
        showArtworkRemoval={false}
        fallbackArtwork={fallbackArtwork}
        onChange={(media) => onChange({ ...value, artwork: media.artwork, audio: media.audio })}
        onPendingMediaChange={onPendingMediaChange}
      />
      <button
        type="button"
        onClick={() => onChange(restoreContentArtworkDefault(contentId, value))}
      >
        Restore default artwork
      </button>

      <div className={styles.mediaGrid}>
        <label className={styles.field}>
          <span>Built-in sound</span>
          <select
            aria-label="Skill audio hook"
            value={audio?.audioGroup ?? value.audioCueKey ?? ''}
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
    </div>
  )
}
