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
}

export class AudioDirector {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private channelGains: Partial<Record<RoutedAudioChannel, GainNode>> = {}
  private activeMedia = new Set<ActiveMediaSource>()
  private settings = createDefaultAudioSettings()
  private unavailable = false

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

  async playAsset(asset: AudioAssetDescriptor): Promise<boolean> {
    if (asset.status !== 'approved' || !asset.src || this.state !== 'ready' || !this.context) {
      return false
    }

    const channelGain = this.channelGains[asset.channel]
    if (!channelGain) {
      return false
    }

    const element = new Audio(asset.src)
    element.loop = asset.loop
    element.preload = asset.preload

    const source = this.context.createMediaElementSource(element)
    source.connect(channelGain)

    const activeSource = { element, source }
    this.activeMedia.add(activeSource)

    const cleanup = () => this.releaseMediaSource(activeSource)
    element.addEventListener('ended', cleanup, { once: true })
    element.addEventListener('error', cleanup, { once: true })

    try {
      await element.play()
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
    for (const activeSource of this.activeMedia) {
      activeSource.element.pause()
      activeSource.source.disconnect()
    }
    this.activeMedia.clear()

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
    activeSource.source.disconnect()
    this.activeMedia.delete(activeSource)
  }
}
