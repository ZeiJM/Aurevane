import { type ReactElement } from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  index: 0,
  cells: [] as unknown[],
  effects: [] as (() => void)[],
  path: '/game/world',
}))
vi.mock('next/navigation', () => ({ usePathname: () => harness.path }))
vi.mock('react', async (original) => {
  const react = await original<typeof import('react')>()
  function memo(value: () => unknown, dependencies: unknown[]) {
    const i = harness.index++
    const previous = harness.cells[i] as { dependencies: unknown[]; value: unknown } | undefined
    if (!previous || dependencies.some((dep, index) => dep !== previous.dependencies[index]))
      harness.cells[i] = { dependencies, value: value() }
    return (harness.cells[i] as { value: unknown }).value
  }
  function state(initial: unknown) {
    const i = harness.index++
    if (!(i in harness.cells))
      harness.cells[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      harness.cells[i],
      (next: unknown) => {
        harness.cells[i] =
          typeof next === 'function' ? (next as (old: unknown) => unknown)(harness.cells[i]) : next
      },
    ]
  }
  return {
    ...react,
    useState: state,
    useRef: (initial: unknown) => memo(() => ({ current: initial }), []),
    useMemo: memo,
    useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps),
    useReducer: (
      reducer: (state: unknown, action: unknown) => unknown,
      arg: unknown,
      init: (value: unknown) => unknown,
    ) => {
      const [current, set] = state(() => init(arg))
      return [
        current,
        (action: unknown) =>
          (set as (update: unknown) => void)((previous: unknown) => reducer(previous, action)),
      ]
    },
    useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
      const i = harness.index++
      const old = harness.cells[i] as { deps: unknown[]; cleanup?: () => void } | undefined
      if (!old || deps.some((dep, index) => dep !== old.deps[index])) {
        const cell = { deps, cleanup: undefined as (() => void) | undefined }
        harness.cells[i] = cell
        harness.effects.push(() => {
          old?.cleanup?.()
          cell.cleanup = effect()
        })
      }
    },
  }
})
vi.mock('@aurevane/audio', async (original) => ({
  ...(await original<typeof import('@aurevane/audio')>()),
  AudioDirector: class {
    setSettings() {}
    stopAll() {}
    close() {}
    unlock() {
      return Promise.resolve('ready')
    }
  },
}))
import { AudioProvider } from './audio-provider'
import {
  createDefaultSiteMusicConfig,
  SITE_MUSIC_UPDATED_EVENT,
  SITE_MUSIC_PREVIEW_EVENT,
} from '@/lib/site-music'

let element: {
  dataset: Record<string, string>
  src: string
  paused: boolean
  currentTime: number
  duration: number
  loop: boolean
  volume: number
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  load: ReturnType<typeof vi.fn>
  removeAttribute(name: string): void
}
let audioProps: Record<string, unknown>
function render() {
  harness.index = 0
  const tree = AudioProvider({}) as ReactElement<{
    value: {
      music: { error?: string | null }
      toggleMusicPlayback(): Promise<void>
      setVolume(channel: string, value: number): void
      toggleMute(): void
    }
    children: ReactElement[]
  }>
  audioProps = tree.props.children[0]!.props as Record<string, unknown>
  ;(audioProps.ref as { current: unknown }).current = element
  harness.effects.splice(0).forEach((effect) => effect())
  return tree.props.value
}
async function settle() {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve()
    render()
  }
}
function emit(name: string, detail: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }))
}
beforeEach(() => {
  harness.index = 0
  harness.cells = []
  harness.effects = []
  harness.path = '/game/world'
  vi.stubGlobal(
    'window',
    Object.assign(new EventTarget(), { localStorage: { getItem: () => null, setItem() {} } }),
  )
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }))
  element = {
    dataset: {},
    src: '',
    paused: true,
    currentTime: 0,
    duration: 120,
    loop: false,
    volume: 1,
    play: vi.fn(async () => {
      element.paused = false
      ;(audioProps.onPlay as () => void)()
    }),
    pause: vi.fn(() => {
      element.paused = true
      ;(audioProps.onPause as () => void)()
    }),
    load: vi.fn(() => {
      element.currentTime = 0
    }),
    removeAttribute(name) {
      if (name === 'src') element.src = ''
      if (name === 'data-track-url') delete element.dataset.trackUrl
    },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ config: createDefaultSiteMusicConfig() }),
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())
it('reports legacy YouTube sources without assigning them to the native player and recovers on replacement', async () => {
  const config = createDefaultSiteMusicConfig()
  config.defaultTrack = {
    ...config.defaultTrack,
    url: 'https://www.youtube.com/watch?v=x06zFQ85gT0',
    source: 'url',
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ config })))
  render()
  await settle()
  expect(element.src).toBe('')
  expect(element.play).not.toHaveBeenCalled()
  expect(render().music.error).toMatch(/YouTube.*background music/)
  await render().toggleMusicPlayback()
  expect(element.play).not.toHaveBeenCalled()
  emit(SITE_MUSIC_UPDATED_EVENT, createDefaultSiteMusicConfig())
  render()
  await settle()
  expect(element.src).toBe('/media/audio/music/road-to-aurevane.webm')
  expect(element.paused).toBe(false)
  expect(render().music.error).toBeNull()
})

it('keeps one source continuous across shared-track pages, respects user pause and stops for explicit silence', async () => {
  render()
  await settle()
  element.currentTime = 41
  const loads = element.load.mock.calls.length
  harness.path = '/game/character'
  render()
  await settle()
  expect(element.load).toHaveBeenCalledTimes(loads)
  expect(element.currentTime).toBe(41)
  expect(element.loop).toBe(true)
  await render().toggleMusicPlayback()
  expect(element.paused).toBe(true)
  harness.path = '/game/nexus'
  render()
  await settle()
  expect(element.paused).toBe(true)
  const config = createDefaultSiteMusicConfig()
  config.routeOverrides = [
    {
      id: 'nexus',
      label: 'Nexus',
      pathPrefix: '/game/nexus',
      enabled: false,
      track: config.defaultTrack,
    },
  ]
  emit(SITE_MUSIC_UPDATED_EVENT, config)
  render()
  await settle()
  expect(element.paused).toBe(true)
  expect(element.src).toBe('')
})
it('pauses background music during a preview and resumes only when user intent permits it', async () => {
  render()
  await settle()
  expect(element.paused).toBe(false)
  emit(SITE_MUSIC_PREVIEW_EVENT, true)
  expect(element.paused).toBe(true)
  harness.path = '/game/character'
  render()
  await settle()
  expect(element.paused).toBe(true)
  emit(SITE_MUSIC_PREVIEW_EVENT, false)
  await settle()
  expect(element.paused).toBe(false)
  await render().toggleMusicPlayback()
  emit(SITE_MUSIC_PREVIEW_EVENT, true)
  emit(SITE_MUSIC_PREVIEW_EVENT, false)
  await settle()
  expect(element.paused).toBe(true)
})
it('reports real rejected playback and media errors without fabricating playback, and clears after actual play', async () => {
  element.play.mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
  render()
  await settle()
  expect(render().music.error).toMatch(/Play music/)
  expect(element.paused).toBe(true)
  ;(audioProps.onError as () => void)()
  expect(render().music.error).toMatch(/audio source/)
  element.play.mockImplementation(async () => {
    element.paused = false
    ;(audioProps.onPlay as () => void)()
  })
  await render().toggleMusicPlayback()
  expect(render().music.error).toBeNull()
})

it('retains volume and mute across route replacement and honors a user pause after hiding the page', async () => {
  render()
  await settle()
  render().setVolume('music', 0.35)
  render()
  expect(element.volume).toBe(0.35)
  render().toggleMute()
  render()
  expect(element.volume).toBe(0)
  const config = createDefaultSiteMusicConfig()
  config.routeOverrides = [
    {
      id: 'character',
      label: 'Character',
      pathPrefix: '/game/character',
      enabled: true,
      mode: 'custom',
      track: { ...config.defaultTrack, url: '/character.mp3' },
    },
  ]
  emit(SITE_MUSIC_UPDATED_EVENT, config)
  harness.path = '/game/character'
  render()
  await settle()
  expect(element.src).toBe('/character.mp3')
  expect(element.volume).toBe(0)
  render().toggleMute()
  render()
  expect(element.volume).toBe(0.35)
  await render().toggleMusicPlayback()
  Object.assign(document, { hidden: true })
  document.dispatchEvent(new Event('visibilitychange'))
  Object.assign(document, { hidden: false })
  document.dispatchEvent(new Event('visibilitychange'))
  await settle()
  expect(element.paused).toBe(true)
})
