import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('desktop battle viewport ownership', () => {
  it('keeps playable and spectator battle scrolling inside their panels', () => {
    const css = readFileSync(join(here, 'battle-viewport.css'), 'utf8')

    expect(css).toContain("body:has(main[data-unified-battle='true'])")
    expect(css).toContain("body:has(main[data-pvp-spectator='true'])")
    expect(css).toContain('height: 100dvh !important;')
    expect(css).toContain('min-height: 0 !important;')
    expect(css).toContain('overflow: hidden;')

    const battleExperience = readFileSync(
      join(here, '../../../components/battle/battle-experience.tsx'),
      'utf8',
    )
    expect(battleExperience).toContain('data-battle-visual-contract="true"')
  })
})
