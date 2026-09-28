import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { shouldRunAttunementCountdown } from './character-discipline-build-panel'

const css = readFileSync(
  new URL('./character-discipline-build-panel.module.css', import.meta.url),
  'utf8',
)

describe('Discipline Management performance contract', () => {
  it('runs the attunement countdown only while an open dialog has time remaining', () => {
    expect(shouldRunAttunementCountdown(false, { primary: 12, secondary: 0 })).toBe(false)
    expect(shouldRunAttunementCountdown(true, { primary: 0, secondary: 0 })).toBe(false)
    expect(shouldRunAttunementCountdown(true, { primary: 12, secondary: 0 })).toBe(true)
    expect(shouldRunAttunementCountdown(true, { primary: 0, secondary: 8 })).toBe(true)
  })

  it('avoids full-screen live blur and centers native option text where supported', () => {
    expect(css).not.toMatch(/backdrop-filter\s*:\s*blur\(/u)
    expect(css).toMatch(/\.slotSelector select\s*\{[^}]*text-align:\s*center/su)
    expect(css).toMatch(/\.slotSelector select option\s*\{[^}]*text-align:\s*center/ su)
  })
})
