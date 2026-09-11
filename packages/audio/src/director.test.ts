import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioDirector } from './director'
import type { AudioAssetDescriptor } from './registry'
import { createDefaultAudioSettings } from './settings'

const elements: FakeAudio[] = []
let hidden = false
let pendingPlay: Promise<void> | null = null
class FakeAudio extends EventTarget {
  loop = false
  preload = 'none'
  pause = vi.fn()
  play = vi.fn(() => pendingPlay ?? Promise.resolve())
  constructor(public src: string) {
    super()
    elements.push(this)
  }
}
class FakeContext {
  state = 'running'
  destination = {}
  createGain = () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })
  createMediaElementSource = () => ({ connect: vi.fn(), disconnect: vi.fn() })
  close = async () => {
    this.state = 'closed'
  }
}
const candidate: AudioAssetDescriptor = {
  id: 'audio.phase4.bastion.action',
  kind: 'sfx',
  channel: 'sfx',
  status: 'candidate',
  requestId: 'AUDIO-DISC-001',
  src: '/review/bastion.mp3',
  loop: false,
  preload: 'none',
}
const approved = { ...candidate, status: 'approved' } as const
beforeEach(() => {
  elements.length = 0
  hidden = false
  pendingPlay = null
  vi.stubGlobal('window', { AudioContext: FakeContext })
  vi.stubGlobal('document', {
    get hidden() {
      return hidden
    },
  })
  vi.stubGlobal('Audio', FakeAudio)
})
afterEach(() => vi.unstubAllGlobals())

describe('central audio audition and playback boundaries', () => {
  it('never plays an unapproved candidate through ordinary playback', async () => {
    const director = new AudioDirector()
    await director.unlock()
    expect(await director.playAsset(candidate)).toBe(false)
    expect(elements).toHaveLength(0)
    expect(await director.auditionAsset(candidate)).toBe(true)
    await director.close()
  })
  it('requires gesture unlock and rejects missing candidate media', async () => {
    const director = new AudioDirector()
    expect(await director.auditionAsset(candidate)).toBe(false)
    await director.unlock()
    expect(await director.auditionAsset({ ...candidate, src: undefined })).toBe(false)
    expect(elements).toHaveLength(0)
  })
  it('does not start muted, zero-volume or hidden-tab cues', async () => {
    const director = new AudioDirector()
    await director.unlock()
    const settings = createDefaultAudioSettings()
    director.setSettings({ ...settings, muted: true })
    expect(await director.auditionAsset(candidate)).toBe(false)
    director.setSettings({ ...settings, volumes: { ...settings.volumes, sfx: 0 } })
    expect(await director.auditionAsset(candidate)).toBe(false)
    director.setSettings(settings)
    hidden = true
    expect(await director.auditionAsset(candidate)).toBe(false)
    expect(elements).toHaveLength(0)
  })
  it('limits effects to two voices while preserving higher-priority cues', async () => {
    const director = new AudioDirector()
    await director.unlock()
    await director.playAsset(approved, 90)
    await director.playAsset(approved, 80)
    expect(await director.playAsset(approved, 30)).toBe(false)
    expect(elements).toHaveLength(2)
    expect(await director.playAsset(approved, 95)).toBe(true)
    expect(elements[0]!.pause).not.toHaveBeenCalled()
    expect(elements[1]!.pause).toHaveBeenCalledOnce()
    director.stopAll()
    expect(elements[0]!.pause).toHaveBeenCalledOnce()
    expect(elements[2]!.pause).toHaveBeenCalledOnce()
  })
  it('does not replay a loading cue after a hidden-tab or route stop', async () => {
    const director = new AudioDirector()
    await director.unlock()
    let complete!: () => void
    pendingPlay = new Promise<void>((resolve) => {
      complete = resolve
    })
    const playing = director.auditionAsset(candidate)
    director.stopAll()
    hidden = true
    complete()
    expect(await playing).toBe(false)
    expect(elements[0]!.pause).toHaveBeenCalledOnce()
    hidden = false
    pendingPlay = null
    expect(await director.auditionAsset(candidate)).toBe(true)
    await director.close()
  })
  it('releases ended and failed voices once, including later close', async () => {
    const director = new AudioDirector()
    await director.unlock()
    await director.auditionAsset(candidate)
    elements[0]!.dispatchEvent(new Event('ended'))
    elements[0]!.dispatchEvent(new Event('error'))
    await director.close()
    expect(elements[0]!.pause).toHaveBeenCalledOnce()
  })
})
