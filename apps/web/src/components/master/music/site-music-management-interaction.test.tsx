import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells))
      hooks.cells[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      hooks.cells[i],
      (next: unknown) => {
        hooks.cells[i] =
          typeof next === 'function' ? (next as (old: unknown) => unknown)(hooks.cells[i]) : next
      },
    ]
  },
  useEffect() {},
  useMemo(factory: () => unknown) {
    return factory()
  },
  useRef(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = { current: initial }
    return hooks.cells[i]
  },
}))

const storage = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    storage: { from: () => ({ uploadToSignedUrl: storage.upload }) },
  }),
}))
import { SiteMusicManagement } from './site-music-management'
import {
  createDefaultSiteMusicConfig,
  parseSiteMusicDraft,
  resolveSiteMusicTrack,
} from '@/lib/site-music'
type Props = Record<string, unknown> & { children?: ReactNode }
function all(
  node: ReactNode,
  predicate: (node: ReactElement<Props>) => boolean,
): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap((child) => all(child, predicate))
  if (!isValidElement<Props>(node)) return []
  return [...(predicate(node) ? [node] : []), ...all(node.props.children, predicate)]
}
const find = (node: ReactNode, predicate: (node: ReactElement<Props>) => boolean) =>
  all(node, predicate)[0]!
const control = (tree: ReactNode, label: string) =>
  find(
    find(
      tree,
      (node) =>
        node.type === 'label' &&
        Array.isArray(node.props.children) &&
        node.props.children[0] === label,
    ).props.children,
    (node) => ['select', 'input'].includes(String(node.type)),
  )
const change = (node: ReactElement<Props>, value: string) =>
  (node.props.onChange as (e: unknown) => void)({ currentTarget: { value }, target: { value } })
const renderWith = (fn: () => ReactNode) => () => {
  hooks.index = 0
  return fn()
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
})
afterEach(() => vi.unstubAllGlobals())

const click = async (node: ReactElement<Props>) => (node.props.onClick as () => unknown)()
const button = (tree: ReactNode, text: string) =>
  find(tree, (node) => node.props.children === text && typeof node.props.onClick === 'function')
const pageButton = (tree: ReactNode, name: string) =>
  find(
    tree,
    (node) =>
      node.type === 'button' &&
      all(node.props.children, (child) => child.type === 'strong' && child.props.children === name)
        .length > 0,
  )
const editor = (tree: ReactNode) =>
  find(tree, (node) => typeof node.type === 'function' && 'onUpload' in node.props)

it('persists all page choices, resets explicitly over broad legacy silence, searches and restores inheritance only on remove', async () => {
  const config = createDefaultSiteMusicConfig()
  config.enabled = false
  config.routeOverrides = [
    {
      id: 'legacy',
      label: 'Legacy Game',
      pathPrefix: '/game',
      enabled: false,
      track: config.defaultTrack,
    },
  ]
  const published = vi.fn()
  vi.stubGlobal('window', { dispatchEvent: published })
  const request = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    return Response.json({
      config: { ...config, ...parseSiteMusicDraft(body.config), revision: 2 },
    })
  })
  vi.stubGlobal('fetch', request)
  const render = renderWith(() => SiteMusicManagement({ initialConfig: config }))
  change(control(render(), 'Search pages'), 'world')
  expect(
    all(
      find(render(), (node) => node.props['aria-label'] === 'Page music'),
      (node) => node.type === 'strong',
    ).map((node) => node.props.children),
  ).toEqual(['Global Music', 'World', 'World Environment'])
  await click(pageButton(render(), 'World'))
  expect(control(render(), 'Page music').props.value).toBe('inherited')
  change(control(render(), 'Page music'), 'custom')
  const custom = {
    ...config.defaultTrack,
    label: 'World custom',
    url: 'https://media.example.test/world.mp3',
    source: 'url' as const,
  }
  ;(editor(render()).props.onChange as (track: unknown) => void)(custom)
  expect(request).not.toHaveBeenCalled()
  expect(published).not.toHaveBeenCalled()
  await click(button(render(), 'Save Changes'))
  const first = JSON.parse(String(request.mock.calls[0]![1].body))
  expect(first.expectedRevision).toBe(1)
  expect(first.config.routeOverrides[0]).toEqual(config.routeOverrides[0])
  expect(resolveSiteMusicTrack({ ...config, ...first.config }, '/game/world')?.label).toBe(
    'World custom',
  )
  expect(published).toHaveBeenCalledTimes(1)
  await click(button(render(), 'Reset to Global'))
  await click(button(render(), 'Save Changes'))
  const reset = JSON.parse(String(request.mock.calls[1]![1].body))
  expect(reset.expectedRevision).toBe(2)
  expect(reset.config.routeOverrides[1].mode).toBe('global')
  expect(resolveSiteMusicTrack({ ...config, ...reset.config }, '/game/world')).toBeNull()
  change(control(render(), 'Page music'), 'silent')
  expect(editor(render())).toBeUndefined()
  await click(button(render(), 'Remove page rule and inherit'))
  expect(control(render(), 'Page music').props.value).toBe('inherited')
})

it('uploads through the signed storage ticket and only publishes after Save Changes', async () => {
  const config = createDefaultSiteMusicConfig()
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
  const track = {
    ...config.defaultTrack,
    label: 'Uploaded',
    url: 'https://storage.example.test/site-music/uploads/track.mp3',
    source: 'upload',
  }
  const request = vi.fn().mockResolvedValue(
    Response.json({
      upload: { bucket: 'site-music', path: 'uploads/track.mp3', token: 'test-ticket', track },
    }),
  )
  vi.stubGlobal('fetch', request)
  storage.upload.mockResolvedValue({ error: null })
  const render = renderWith(() => SiteMusicManagement({ initialConfig: config }))
  const file = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' })
  ;(editor(render()).props.onUpload as (file: File) => void)(file)
  await vi.waitFor(() => expect(editor(render()).props.track).toEqual(track))
  expect(request).toHaveBeenCalledTimes(1)
  expect(JSON.parse(request.mock.calls[0]![1].body).operation).toBe('create-upload')
  expect(storage.upload).toHaveBeenCalledWith('uploads/track.mp3', 'test-ticket', file, {
    cacheControl: '31536000',
    contentType: 'audio/mpeg',
    upsert: false,
  })
  expect(window.dispatchEvent).not.toHaveBeenCalled()
  ;(editor(render()).props.onChange as (track: unknown) => void)({
    ...track,
    url: 'javascript:bad',
  })
  await click(button(render(), 'Save Changes'))
  expect(request).toHaveBeenCalledTimes(1)
  expect(all(render(), (node) => node.props.role === 'status')[0]?.props.children).toMatch(/HTTPS/)
})

it('saves songs for later, reloads the library, assigns songs and explicitly blocks deleting an assigned song', async () => {
  const initialConfig = createDefaultSiteMusicConfig()
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
  let persisted = initialConfig
  const request = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    persisted = {
      ...parseSiteMusicDraft(body.config),
      revision: body.expectedRevision + 1,
      updatedAt: null,
    }
    return Response.json({ config: persisted })
  })
  vi.stubGlobal('fetch', request)
  let render = renderWith(() => SiteMusicManagement({ initialConfig }))
  expect(button(render(), 'Add song')).toBeDefined()
  await click(button(render(), 'Add song'))
  const spare = { ...initialConfig.defaultTrack, label: 'For later', url: '/later.mp3' }
  ;(editor(render()).props.onChange as (track: unknown) => void)(spare)
  await click(button(render(), 'Add to library'))
  await click(button(render(), 'Save Changes'))
  expect(persisted.songLibrary).toContainEqual(spare)
  expect(persisted.defaultTrack).toEqual(initialConfig.defaultTrack)
  hooks.cells = []
  render = renderWith(() => SiteMusicManagement({ initialConfig: persisted }))
  await click(pageButton(render(), 'For later'))
  expect(editor(render()).props.track).toEqual(spare)
  await click(button(render(), 'Use for Global Music'))
  await click(button(render(), 'Save Changes'))
  expect(persisted.defaultTrack).toEqual(spare)
  await click(pageButton(render(), 'For later'))
  await click(button(render(), 'Delete song'))
  expect(all(render(), (node) => node.props.role === 'status')[0]?.props.children).toMatch(
    /still assigned/,
  )
  await click(pageButton(render(), initialConfig.defaultTrack.label))
  await click(button(render(), 'Delete song'))
  await click(button(render(), 'Save Changes'))
  expect(persisted.songLibrary).toEqual([spare])
})

it('uploads a library song through storage without assigning it and includes it only after adding and saving', async () => {
  const config = createDefaultSiteMusicConfig()
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
  const track = {
    ...config.defaultTrack,
    label: 'Stored upload',
    url: 'https://storage.example.test/later.mp3',
    source: 'upload',
  }
  const request = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    return body.operation === 'create-upload'
      ? Response.json({
          upload: { bucket: 'site-music', path: 'later.mp3', token: 'ticket', track },
        })
      : Response.json({
          config: { ...parseSiteMusicDraft(body.config), revision: 2, updatedAt: null },
        })
  })
  vi.stubGlobal('fetch', request)
  storage.upload.mockResolvedValue({ error: null })
  const render = renderWith(() => SiteMusicManagement({ initialConfig: config }))
  await click(button(render(), 'Add song'))
  ;(editor(render()).props.onUpload as (file: File) => void)(
    new File(['audio'], 'later.mp3', { type: 'audio/mpeg' }),
  )
  await vi.waitFor(() => expect(editor(render()).props.track).toEqual(track))
  expect(request).toHaveBeenCalledTimes(1)
  await click(button(render(), 'Add to library'))
  await click(button(render(), 'Save Changes'))
  const saved = JSON.parse(String(request.mock.calls[1]![1].body)).config
  expect(saved.defaultTrack).toEqual(config.defaultTrack)
  expect(saved.songLibrary).toContainEqual(track)
})

it('stores only the completed replacement URL when an assignment is edited through intermediate input values', async () => {
  const config = createDefaultSiteMusicConfig()
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
  const request = vi.fn(async (_url: string, init: RequestInit) =>
    Response.json({
      config: {
        ...parseSiteMusicDraft(JSON.parse(String(init.body)).config),
        revision: 2,
        updatedAt: null,
      },
    }),
  )
  vi.stubGlobal('fetch', request)
  const render = renderWith(() => SiteMusicManagement({ initialConfig: config }))
  for (const url of ['', 'h', 'https://', 'https://media.example.test/final.mp3']) {
    ;(editor(render()).props.onChange as (track: unknown) => void)({
      ...config.defaultTrack,
      label: 'Replacement',
      source: 'url',
      url,
    })
  }
  await click(button(render(), 'Save Changes'))
  expect(request).toHaveBeenCalledTimes(1)
  expect(
    JSON.parse(String(request.mock.calls[0]![1].body)).config.songLibrary.map(
      (song: { url: string }) => song.url,
    ),
  ).toEqual([config.defaultTrack.url, 'https://media.example.test/final.mp3'])
})
