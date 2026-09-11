import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('Character Profile panel navigation', () => {
  it('updates panel URLs without requesting a new Server Component tree', () => {
    const panels = [
      'character-skill-build-panel.tsx',
      'character-discipline-build-panel.tsx',
      'character-attribute-allocation-panel.tsx',
    ]

    for (const panel of panels) {
      const source = readFileSync(join(here, panel), 'utf8')
      expect(source).toContain("window.history.replaceState(null, '',")
      expect(source).not.toContain('router.replace(')
    }
  })
})
