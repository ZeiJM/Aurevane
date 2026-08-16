'use client'

import { AUDIO_CHANNELS, type AudioChannel } from '@aurevane/audio'
import { GameButton, Kicker, StatusMark } from '@aurevane/ui'
import { useEffect, useId, useRef, useState } from 'react'

import { useAudioRuntime } from './audio-provider'
import styles from './audio-settings-menu.module.css'

const CHANNEL_LABELS: Record<AudioChannel, string> = {
  master: 'Master',
  music: 'Music',
  sfx: 'Sound effects',
  ambience: 'Ambience',
  ui: 'UI sounds',
}

export function AudioSettingsMenu() {
  const { settings, audioState, setVolume, toggleMute, unlock, playCalibrationTone } =
    useAudioRuntime()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    function closeFromOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (target instanceof Node && !rootRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    function closeFromEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeFromOutsidePointer, true)
    document.addEventListener('keydown', closeFromEscape)

    return () => {
      document.removeEventListener('pointerdown', closeFromOutsidePointer, true)
      document.removeEventListener('keydown', closeFromEscape)
    }
  }, [open])

  function updateVolume(channel: AudioChannel, value: string) {
    setVolume(channel, Number(value) / 100)
  }

  const statusMessage =
    audioState === 'ready'
      ? 'Audio ready. Nothing plays unless the game requests it.'
      : audioState === 'unavailable'
        ? 'Audio is unavailable in this browser session.'
        : 'Audio is locked until you choose to enable it.'

  return (
    <div className={styles.root} data-testid="audio-settings" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label="Sound settings"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.speaker} aria-hidden="true">
          ◇
        </span>
        <span className={styles.triggerLabel}>Sound</span>
      </button>

      {open ? (
        <div
          id={panelId}
          className={styles.panel}
          role="dialog"
          aria-modal="false"
          aria-label="Audio settings"
        >
          <div className={styles.heading}>
            <div>
              <Kicker marker={<StatusMark />}>Soundscape</Kicker>
              <h2>Audio settings</h2>
            </div>
            <div className={styles.headingActions}>
              <span className={styles.saveNote}>Saved locally</span>
              <button
                type="button"
                className={styles.close}
                aria-label="Close audio settings"
                onClick={() => {
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
              >
                ×
              </button>
            </div>
          </div>

          <p className={styles.status} role="status" data-testid="audio-state">
            {statusMessage}
          </p>

          <div className={styles.actions}>
            <GameButton
              type="button"
              variant="quiet"
              onClick={() => void unlock()}
              disabled={audioState === 'ready' || audioState === 'unavailable'}
              data-testid="audio-unlock"
            >
              {audioState === 'ready' ? 'Audio enabled' : 'Enable audio'}
            </GameButton>
            <GameButton type="button" variant="quiet" onClick={toggleMute} data-testid="audio-mute">
              {settings.muted ? 'Unmute all' : 'Mute all'}
            </GameButton>
          </div>

          <div className={styles.mix} aria-label="Volume channels">
            {AUDIO_CHANNELS.map((channel) => {
              const percent = Math.round(settings.volumes[channel] * 100)
              return (
                <label className={styles.channel} key={channel}>
                  <span className={styles.channelLabel}>
                    <span>{CHANNEL_LABELS[channel]}</span>
                    <output>{percent}%</output>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={percent}
                    onChange={(event) => updateVolume(channel, event.currentTarget.value)}
                    data-testid={`audio-volume-${channel}`}
                  />
                </label>
              )
            })}
          </div>

          <GameButton
            type="button"
            variant="primary"
            className={styles.test}
            onClick={() => void playCalibrationTone()}
            disabled={audioState === 'unavailable'}
            data-testid="audio-test-tone"
          >
            Test UI channel
          </GameButton>
          <p className={styles.fineprint}>
            This short calibration tone is synthesized by the runtime. Production music, ambience,
            and UI sounds remain behind approved media requests.
          </p>
        </div>
      ) : null}
    </div>
  )
}
