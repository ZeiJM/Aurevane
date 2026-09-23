'use client'

import {
  AUDIO_SETTINGS_STORAGE_KEY,
  AudioDirector,
  audioAssetRegistry,
  createDefaultAudioSettings,
  parsePersistedAudioSettings,
  reduceAudioSettings,
  serializeAudioSettings,
  type AudioChannel,
  type AudioDirectorState,
  type AudioMixSettings,
} from '@aurevane/audio'
import { usePathname } from 'next/navigation'
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'

import {
  attemptSiteMusicPlayback,
  createDefaultSiteMusicConfig,
  parseSiteMusicConfig,
  resolveSiteMusicTrack,
  SITE_MUSIC_UPDATED_EVENT,
  type SiteMusicConfig,
} from '@/lib/site-music'

interface AudioContextValue {
  settings: AudioMixSettings
  audioState: AudioDirectorState
  setVolume(channel: AudioChannel, value: number): void
  toggleMute(): void
  unlock(): Promise<AudioDirectorState>
  playAsset(id: string, priority?: number): Promise<boolean>
  stopSfx(): void
}

const AudioRuntimeContext = createContext<AudioContextValue | null>(null)

export function AudioProvider({ children }: PropsWithChildren) {
  const pathname = usePathname()
  const musicElementRef = useRef<HTMLAudioElement>(null)
  const [director] = useState(() => new AudioDirector())
  const [settings, dispatch] = useReducer(
    reduceAudioSettings,
    undefined,
    createDefaultAudioSettings,
  )
  const [audioState, setAudioState] = useState<AudioDirectorState>('locked')
  const [storageReady, setStorageReady] = useState(false)
  const [interactionUnlocked, setInteractionUnlocked] = useState(false)
  const [siteMusicConfig, setSiteMusicConfig] = useState<SiteMusicConfig | null>(null)
  const activeTrack = useMemo(
    () => (siteMusicConfig ? resolveSiteMusicTrack(siteMusicConfig, pathname) : null),
    [pathname, siteMusicConfig],
  )
  const musicVolume = settings.muted ? 0 : Math.min(1, Math.max(0, settings.volumes.music))

  useEffect(() => {
    try {
      dispatch({
        type: 'replace',
        settings: parsePersistedAudioSettings(
          window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY),
        ),
      })
    } catch {
      dispatch({ type: 'replace', settings: createDefaultAudioSettings() })
    } finally {
      setStorageReady(true)
    }
  }, [])

  useEffect(() => {
    director.setSettings(settings)

    if (!storageReady) {
      return
    }

    try {
      window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, serializeAudioSettings(settings))
    } catch {
      // Storage may be unavailable in private or constrained browser contexts.
    }
  }, [director, settings, storageReady])

  useEffect(() => {
    const controller = new AbortController()

    void fetch('/api/site-music', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Site music configuration is unavailable.')
        const payload = (await response.json()) as { config?: unknown }
        if (!payload.config) throw new Error('Site music configuration is missing.')
        setSiteMusicConfig(parseSiteMusicConfig(payload.config))
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSiteMusicConfig(createDefaultSiteMusicConfig())
        }
      })

    const receivePublishedConfig = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      try {
        setSiteMusicConfig(parseSiteMusicConfig(event.detail))
      } catch {
        // Ignore malformed same-window events.
      }
    }

    window.addEventListener(SITE_MUSIC_UPDATED_EVENT, receivePublishedConfig)
    return () => {
      controller.abort()
      window.removeEventListener(SITE_MUSIC_UPDATED_EVENT, receivePublishedConfig)
    }
  }, [])

  useEffect(() => {
    const element = musicElementRef.current
    if (!element) return

    if (!activeTrack) {
      element.pause()
      element.removeAttribute('src')
      element.removeAttribute('data-track-url')
      element.load()
      return
    }

    element.loop = activeTrack.loop
    element.preload = 'metadata'
    element.volume = musicVolume

    if (element.dataset.trackUrl !== activeTrack.url) {
      element.pause()
      element.src = activeTrack.url
      element.dataset.trackUrl = activeTrack.url
      element.load()
    }

    void attemptSiteMusicPlayback(() => element.play(), document.hidden)
  }, [activeTrack, musicVolume])

  useEffect(() => {
    const element = musicElementRef.current
    if (element) element.volume = musicVolume
  }, [musicVolume])

  useEffect(() => {
    const element = musicElementRef.current
    return () => {
      if (element) {
        element.pause()
        element.removeAttribute('src')
      }
      void director.close()
    }
  }, [director])

  useEffect(() => {
    const handleVisibility = () => {
      const element = musicElementRef.current
      if (document.hidden) {
        director.stopAll()
        element?.pause()
        return
      }
      if (activeTrack && element) {
        void attemptSiteMusicPlayback(() => element.play(), false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [activeTrack, director])

  const setVolume = useCallback((channel: AudioChannel, value: number) => {
    dispatch({ type: 'set-volume', channel, value })
  }, [])

  const toggleMute = useCallback(() => {
    dispatch({ type: 'toggle-mute' })
  }, [])

  const unlock = useCallback(async () => {
    const nextState = await director.unlock()
    setAudioState(nextState)
    return nextState
  }, [director])

  useEffect(() => {
    if (interactionUnlocked && audioState !== 'locked') {
      return
    }

    let attempting = false
    const unlockFromInteraction = () => {
      setInteractionUnlocked(true)
      const element = musicElementRef.current
      if (activeTrack && element && !document.hidden) {
        void element.play().catch(() => {
          // The same gesture also unlocks the Web Audio graph below.
        })
      }
      if (attempting || audioState !== 'locked') return
      attempting = true
      void unlock().finally(() => {
        attempting = false
      })
    }

    window.addEventListener('pointerdown', unlockFromInteraction, true)
    window.addEventListener('keydown', unlockFromInteraction, true)

    return () => {
      window.removeEventListener('pointerdown', unlockFromInteraction, true)
      window.removeEventListener('keydown', unlockFromInteraction, true)
    }
  }, [activeTrack, audioState, interactionUnlocked, unlock])

  const playAsset = useCallback(
    (id: string, priority = 50) => {
      const asset = audioAssetRegistry.get(id)
      return asset ? director.playAsset(asset, priority) : Promise.resolve(false)
    },
    [director],
  )
  const stopSfx = useCallback(() => director.stopChannel('sfx'), [director])

  return (
    <AudioRuntimeContext.Provider
      value={{
        settings,
        audioState,
        setVolume,
        toggleMute,
        unlock,
        playAsset,
        stopSfx,
      }}
    >
      <audio ref={musicElementRef} aria-hidden="true" data-testid="site-music-player" />
      {children}
    </AudioRuntimeContext.Provider>
  )
}

export function useAudioRuntime(): AudioContextValue {
  const context = useContext(AudioRuntimeContext)
  if (!context) {
    throw new Error('useAudioRuntime must be used inside AudioProvider.')
  }

  return context
}
