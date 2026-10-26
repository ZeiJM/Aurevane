import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const store = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/server/music/site-music-store', () => ({ readSiteMusicConfig: store.read }))
import { GET } from './route'
import { createDefaultSiteMusicConfig } from '@/lib/site-music'
it('sends playback assignments without publishing the unused Owner song library', async () => {
  const config = createDefaultSiteMusicConfig()
  store.read.mockResolvedValue({
    ...config,
    songLibrary: [{ ...config.defaultTrack, label: 'For later', url: '/later.mp3' }],
  })
  const response = await GET()
  expect((await response.json()).config).toEqual(config)
})
