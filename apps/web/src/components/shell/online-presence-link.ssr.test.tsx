import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { OnlinePresenceLink } from './online-presence-link'

vi.mock('next/link', () => ({
  default: ({ children, prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => {
    void prefetch
    return createElement('a', props, children)
  },
}))

it('renders the initial server count without retaining character-specific browser heartbeat state', () => {
  const characterId = 'server-render-only-presence-character'
  const writes = vi.spyOn(Map.prototype, 'set')
  let markup: string
  let retainedCharacter: boolean
  try {
    markup = renderToStaticMarkup(<OnlinePresenceLink characterId={characterId} initialCount={7} />)
    retainedCharacter = writes.mock.calls.some(([key]) => key === characterId)
  } finally {
    writes.mockRestore()
  }
  expect(markup).toContain('7')
  expect(retainedCharacter).toBe(false)
})
