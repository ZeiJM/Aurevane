import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) =>
    createElement('a', props, children),
}))

import { LoadoutTabs } from './loadout-tabs'

describe('Loadout sections', () => {
  it.each(['nexus', 'items'] as const)('offers both destinations and selects only %s', (active) => {
    const markup = renderToStaticMarkup(<LoadoutTabs active={active} />)
    expect(markup).toContain('aria-label="Loadout sections"')
    expect(markup).toContain('href="/game/nexus"')
    expect(markup).toContain('href="/game/loadout/items"')
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1)
    expect(markup).toMatch(new RegExp(`data-loadout-section="${active}"[^>]*aria-current="page"`))
    expect(markup).not.toContain('Back')
  })
})
