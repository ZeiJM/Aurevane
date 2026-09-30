'use client'

import { AurevaneImage } from '@/components/media/aurevane-image'
import { AudioSettingsMenu } from './audio-settings-menu'
import { useAudioRuntime } from './audio-provider'
import styles from './audio-workspace.module.css'

function timeLabel(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function AudioWorkspace() {
  const { music, toggleMusicPlayback } = useAudioRuntime()
  return (
    <div className={styles.workspace} data-audio-workspace>
      <section className={styles.panel} aria-label="Volume settings">
        <AudioSettingsMenu inline />
      </section>
      <section className={styles.panel} aria-labelledby="audio-now-playing">
        <h2 id="audio-now-playing">Now playing</h2>
        <div className={styles.track}>
          <AurevaneImage
            assetId="environment.adventure.threshold"
            className={styles.art}
            sizes="10rem"
          />
          <div>
            <strong>{music.track?.label ?? 'No track selected'}</strong>
            <p>
              {music.track
                ? music.playing
                  ? 'Playing'
                  : 'Paused'
                : 'The current route has no music.'}
            </p>
            <progress
              aria-label="Track progress"
              value={music.currentTime}
              max={music.duration || 1}
            />
            <span className={styles.time}>
              {timeLabel(music.currentTime)} / {timeLabel(music.duration)}
            </span>
          </div>
        </div>
        <button
          type="button"
          className={styles.play}
          data-music-playback
          disabled={!music.track}
          onClick={() => {
            void toggleMusicPlayback()
          }}
        >
          {music.playing ? 'Pause music' : 'Play music'}
        </button>
      </section>
    </div>
  )
}
