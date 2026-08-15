'use client'

import { AUDIO_CHANNELS, type AudioChannel } from '@aurevane/audio'
import { GameButton, Kicker, StatusMark } from '@aurevane/ui'

import { useAudioRuntime } from './audio-provider'

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

  const statusMessage =
    audioState === 'ready'
      ? 'Audio ready. Nothing plays unless the game requests it.'
      : audioState === 'unavailable'
        ? 'Audio is unavailable in this browser session.'
        : 'Audio is locked until you choose to enable it.'

  return (
    <details className="audio-menu" data-testid="audio-settings">
      <summary className="audio-menu__summary" aria-label="Sound settings">
        <span className="audio-menu__speaker" aria-hidden="true">
          ◇
        </span>
        <span>Sound</span>
      </summary>

      <div className="audio-menu__panel">
        <div className="audio-menu__heading">
          <div>
            <Kicker marker={<StatusMark />}>Soundscape</Kicker>
            <h2>Audio settings</h2>
          </div>
          <span className="audio-menu__save-note">Saved locally</span>
        </div>

        <p className="audio-menu__status" role="status" data-testid="audio-state">
          {statusMessage}
        </p>

        <div className="audio-menu__actions">
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

        <div className="audio-menu__mix" aria-label="Volume channels">
          {AUDIO_CHANNELS.map((channel) => {
            const percent = Math.round(settings.volumes[channel] * 100)
            return (
              <label className="audio-channel" key={channel}>
                <span className="audio-channel__label">
                  <span>{CHANNEL_LABELS[channel]}</span>
                  <output>{percent}%</output>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={percent}
                  onChange={(event) => setVolume(channel, Number(event.currentTarget.value) / 100)}
                  data-testid={`audio-volume-${channel}`}
                />
              </label>
            )
          })}
        </div>

        <GameButton
          type="button"
          variant="primary"
          className="audio-menu__test"
          onClick={() => void playCalibrationTone()}
          disabled={audioState === 'unavailable'}
          data-testid="audio-test-tone"
        >
          Test UI channel
        </GameButton>
        <p className="audio-menu__fineprint">
          This short calibration tone is synthesized by the runtime. Production music, ambience, and UI
          sounds remain behind approved media requests.
        </p>
      </div>
    </details>
  )
}
