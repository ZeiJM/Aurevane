import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Character Creation layout ownership', () => {
  it('does not hide live choices through obsolete pronoun-position selectors', () => {
    const css = readFileSync(
      new URL('../../app/profile-ui-readability-pass.css', import.meta.url),
      'utf8',
    )
    expect(css).not.toContain("[data-step='identity'] fieldset:nth-of-type(2)")
    expect(css).not.toContain("[data-step='review'] dl > div:nth-child(5)")
  })
})
