import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./character-profile-details.tsx', import.meta.url), 'utf8')

describe('Profile stat detail presentation contract', () => {
  it('uses a lightweight non-modal popover instead of the old full-screen detail modal', () => {
    expect(source).toContain('data-profile-stat-popover="true"')
    expect(source).toContain('aria-haspopup="dialog"')
    expect(source).not.toContain('className={styles.backdrop}')
    expect(source).not.toContain('aria-modal="true"')
    expect(source).not.toContain('className={styles.dialog}')
  })
})
