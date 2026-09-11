import type { AudioAssetDescriptor } from './registry'
import {
  createDefaultAudioSettings,
  type AudioMixSettings,
  type RoutedAudioChannel,
} from './settings'

const ROUTED_CHANNELS = [
  'music',
  'sfx',
  'ambience',
  'ui',
] as const satisfies readonly RoutedAudioChannel[]

export type AudioDirectorState = 'locked' | 'ready' | 'unavailable'

interface ActiveMediaSource {
  element: HTMLAudioElement
  source: MediaElementAudioSourceNode
  channel: RoutedAudioChannel
  priority: number
}

export class AudioDirector {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private channelGains: Partial<Record<RoutedAudioChannel, GainNode>> = {}
  private activeMedia = new Set<ActiveMediaSource>()
  private settings = createDefaultAudioSettings()
  private unavailable = false
  private playbackGeneration = 0

  get state(): AudioDirectorState {
    if (this.unavailable) {
      return 'unavailable'
    }

    if (this.context?.state === 'running') {
      return 'ready'
    }

    return 'locked'
  }

  setSettings(settings: AudioMixSettings): void {
    this.settings = {
      muted: settings.muted,
      volumes: { ...settings.volumes },
    }
    this.applyMix()
  }

  async unlock(): Promise<AudioDirectorState> {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
      this.unavailable = true
      return this.state
    }

    try {
      if (!this.context) {
        this.createGraph(new window.AudioContext())
      }

      if (this.context?.state === 'suspended') {
        await this.context.resume()
      }

      this.unavailable = this.context?.state === 'closed'
      this.applyMix()
      return this.state
    } catch {
      this.unavailable = true
      return this.state
    }
  }

  async playAsset(asset: AudioAssetDescriptor, priority = 50): Promise<boolean> {
    return asset.status === 'approved' && this.playMedia(asset, priority)
  }

  /** Explicit reviewer gesture only. Candidate media never enters ordinary playback. */
  async auditionAsset(asset: AudioAssetDescriptor): Promise<boolean> {
    return asset.status === 'candidate' && this.playMedia(asset, 50)
  }

  stopAll(): void {
    this.playbackGeneration += 1
    for (const activeSource of this.activeMedia) this.releaseMediaSource(activeSource)
  }

  stopChannel(channel: RoutedAudioChannel): void {
    for (const activeSource of this.activeMedia) {
      if (activeSource.channel === channel) this.releaseMediaSource(activeSource)
    }
  }

  private async playMedia(asset: AudioAssetDescriptor, priority: number): Promise<boolean> {
    if (
      !asset.src ||
      this.state !== 'ready' ||
      !this.context ||
      (typeof document !== 'undefined' && document.hidden) ||
      this.settings.muted ||
      this.settings.volumes.master <= 0 ||
      this.settings.volumes[asset.channel] <= 0
    ) {
      return false
    }

    const channelGain = this.channelGains[asset.channel]
    if (!channelGain) {
      return false
    }

    const boundedPriority = Number.isFinite(priority) ? Math.min(100, Math.max(0, priority)) : 50
    const voices = [...this.activeMedia].filter((voice) => voice.channel === 'sfx')
    if (asset.channel === 'sfx' && voices.length >= 2) {
      const lowest = voices.reduce((a, b) => (a.priority <= b.priority ? a : b))
      if (lowest.priority > boundedPriority) return false
      this.releaseMediaSource(lowest)
    }
    const generation = this.playbackGeneration

    const element = new Audio(asset.src)
    element.loop = asset.loop
    element.preload = asset.preload

    const source = this.context.createMediaElementSource(element)
    source.connect(channelGain)

    const activeSource = { element, source, channel: asset.channel, priority: boundedPriority }
    this.activeMedia.add(activeSource)

    const cleanup = () => this.releaseMediaSource(activeSource)
    element.addEventListener('ended', cleanup, { once: true })
    element.addEventListener('error', cleanup, { once: true })

    try {
      await element.play()
      if (
        generation !== this.playbackGeneration ||
        !this.activeMedia.has(activeSource) ||
        (typeof document !== 'undefined' && document.hidden)
      ) {
        cleanup()
        return false
      }
      return true
    } catch {
      cleanup()
      return false
    }
  }

  playCalibrationTone(channel: RoutedAudioChannel = 'ui'): boolean {
    if (this.state !== 'ready' || !this.context) {
      return false
    }

    const channelGain = this.channelGains[channel]
    if (!channelGain) {
      return false
    }

    const oscillator = this.context.createOscillator()
    const toneGain = this.context.createGain()
    const now = this.context.currentTime

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(440, now)
    toneGain.gain.setValueAtTime(0.0001, now)
    toneGain.gain.exponentialRampToValueAtTime(0.16, now + 0.01)
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)

    oscillator.connect(toneGain)
    toneGain.connect(channelGain)
    oscillator.addEventListener(
      'ended',
      () => {
        oscillator.disconnect()
        toneGain.disconnect()
      },
      { once: true },
    )
    oscillator.start(now)
    oscillator.stop(now + 0.11)

    return true
  }

  async close(): Promise<void> {
    this.stopAll()

    const context = this.context
    this.context = null
    this.masterGain = null
    this.channelGains = {}

    if (context && context.state !== 'closed') {
      await context.close()
    }
  }

  private createGraph(context: AudioContext): void {
    this.context = context
    this.masterGain = context.createGain()
    this.masterGain.connect(context.destination)

    for (const channel of ROUTED_CHANNELS) {
      const gain = context.createGain()
      gain.connect(this.masterGain)
      this.channelGains[channel] = gain
    }

    this.applyMix()
  }

  private applyMix(): void {
    if (!this.masterGain) {
      return
    }

    this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.volumes.master

    for (const channel of ROUTED_CHANNELS) {
      const gain = this.channelGains[channel]
      if (gain) {
        gain.gain.value = this.settings.volumes[channel]
      }
    }
  }

  private releaseMediaSource(activeSource: ActiveMediaSource): void {
    if (!this.activeMedia.delete(activeSource)) return
    activeSource.element.pause()
    activeSource.source.disconnect()
  }
}
