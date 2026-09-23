'use client'

import { USER_AUDIO_CHANNELS, type UserAudioChannel } from '@aurevane/audio'
import { GameButton } from '@aurevane/ui'
import { useEffect, useId, useRef, useState } from 'react'

import { useAudioRuntime } from './audio-provider'
import styles from './audio-settings-menu.module.css'

const CHANNEL_LABELS: Record<UserAudioChannel, string> = {
  music: 'Music',
  sfx: 'Sound effects',
}

interface AudioSettingsMenuProps {
  rootClassName?: string
  triggerClassName?: string
  triggerLabel?: string
  triggerRole?: 'menuitem'
  showTriggerMarker?: boolean
}

export function AudioSettingsMenu({
  rootClassName,
  triggerClassName,
  triggerLabel = 'Sound',
  triggerRole,
  showTriggerMarker = true,
}: AudioSettingsMenuProps = {}) {
  const { settings, audioState, setVolume, toggleMute } = useAudioRuntime()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    // The browser's top layer keeps this nested utility clear of shell filters
    // and stacking contexts while retaining the account menu's outside handler.
    const panel = panelRef.current
    panel?.showPopover()

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
      panel?.hidePopover()
      document.removeEventListener('pointerdown', closeFromOutsidePointer, true)
      document.removeEventListener('keydown', closeFromEscape)
    }
  }, [open])

  function updateVolume(channel: UserAudioChannel, value: string) {
    setVolume(channel, Number(value) / 100)
  }

  const triggerAriaLabel = triggerLabel === 'Sound' ? 'Sound settings' : triggerLabel

  return (
    <div
      className={rootClassName ? `${styles.root} ${rootClassName}` : styles.root}
      data-testid="audio-settings"
      data-audio-state={audioState}
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ?? styles.trigger}
        role={triggerRole}
        aria-label={triggerAriaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {showTriggerMarker ? (
          <span className={styles.speaker} aria-hidden="true">
            ◇
          </span>
        ) : null}
        <span className={triggerClassName ? undefined : styles.triggerLabel}>{triggerLabel}</span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          popover="manual"
          className={styles.panel}
          role="dialog"
          aria-modal="false"
          aria-label="Audio settings"
        >
          <div className={styles.heading}>
            <h2>Audio settings</h2>
          </div>

          <div className={styles.actions}>
            <GameButton type="button" variant="quiet" onClick={toggleMute} data-testid="audio-mute">
              {settings.muted ? 'Unmute all' : 'Mute all'}
            </GameButton>
          </div>

          <div className={styles.mix} aria-label="Volume channels">
            {USER_AUDIO_CHANNELS.map((channel) => {
              const percent = settings.muted
                ? 0
                : Math.round(settings.volumes[channel] * 100)
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
                    disabled={settings.muted}
                    onChange={(event) => updateVolume(channel, event.currentTarget.value)}
                    data-testid={`audio-volume-${channel}`}
                  />
                </label>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
