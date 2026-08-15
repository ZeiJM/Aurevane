'use client'

import {
  AUDIO_SETTINGS_STORAGE_KEY,
  AudioDirector,
  createDefaultAudioSettings,
  parsePersistedAudioSettings,
  reduceAudioSettings,
  serializeAudioSettings,
  type AudioChannel,
  type AudioDirectorState,
  type AudioMixSettings,
} from '@aurevane/audio'
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react'

interface AudioContextValue {
  settings: AudioMixSettings
  audioState: AudioDirectorState
  setVolume(channel: AudioChannel, value: number): void
  toggleMute(): void
  unlock(): Promise<AudioDirectorState>
  playCalibrationTone(): Promise<boolean>
}

const AudioRuntimeContext = createContext<AudioContextValue | null>(null)

export function AudioProvider({ children }: PropsWithChildren) {
  const [director] = useState(() => new AudioDirector())
  const [settings, dispatch] = useReducer(
    reduceAudioSettings,
    undefined,
    createDefaultAudioSettings,
  )
  const [audioState, setAudioState] = useState<AudioDirectorState>('locked')
  const [storageReady, setStorageReady] = useState(false)

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

  useEffect(
    () => () => {
      void director.close()
    },
    [director],
  )

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

  const playCalibrationTone = useCallback(async () => {
    const nextState = director.state === 'ready' ? 'ready' : await director.unlock()
    setAudioState(nextState)

    return nextState === 'ready' && director.playCalibrationTone('ui')
  }, [director])

  return (
    <AudioRuntimeContext.Provider
      value={{ settings, audioState, setVolume, toggleMute, unlock, playCalibrationTone }}
    >
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
