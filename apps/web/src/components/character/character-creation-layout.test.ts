import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { CharacterCreationExperience } from './character-creation-experience'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe('Character Creation layout ownership', () => {
  it('offers the manual builder without a separate starter outfit picker', () => {
    const markup = renderToStaticMarkup(
      createElement(CharacterCreationExperience, { slotIndex: 0 }),
    )

    expect(markup).toContain('Build my character')
    expect(markup).not.toContain('First appearance')
    expect(markup).not.toContain('name="appearance"')
  })

  it('does not hide live choices through obsolete pronoun-position selectors', () => {
    const css = readFileSync(
      new URL('../../app/profile-ui-readability-pass.css', import.meta.url),
      'utf8',
    )
    expect(css).not.toContain("[data-step='identity'] fieldset:nth-of-type(2)")
    expect(css).not.toContain("[data-step='review'] dl > div:nth-child(5)")
  })
})
