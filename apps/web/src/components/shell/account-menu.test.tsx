import { createElement, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, useState: vi.fn(actual.useState) }
})
vi.mock('next/navigation', () => ({ usePathname: () => '/game/character' }))
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) =>
    createElement('a', props, children),
}))
vi.mock('@/components/audio/audio-settings-menu', () => ({
  AudioSettingsMenu: () => createElement('button', { 'aria-label': 'Audio settings' }, 'Audio'),
}))
import { AccountMenu } from './account-menu'

afterEach(() => vi.clearAllMocks())
describe('Account settings destinations', () => {
  it('opens Audio as a page link alongside Titles and Controls', () => {
    vi.mocked(useState).mockImplementationOnce(() => [true, vi.fn()])
    const markup = renderToStaticMarkup(createElement(AccountMenu))
    expect(markup).toMatch(/href="\/game\/settings\/audio"[^>]*role="menuitem"[^>]*>Audio<\/a>/)
    expect(markup).toContain('href="/game/account/titles"')
    expect(markup).toContain('href="/game/settings/controls"')
    expect(markup).not.toContain('aria-label="Audio settings"')
  })
})
