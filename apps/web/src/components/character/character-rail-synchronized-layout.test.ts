import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('character rail synchronized layout performance', () => {
  it('avoids duplicate resize measurement when ResizeObserver is available', () => {
    const layout = source('src/components/character/character-rail-synchronized-layout.tsx')

    expect(layout).toContain('let lastHeight')
    expect(layout).toContain('if (height === lastHeight) return')
    expect(layout).toContain('if (observer) {')
    expect(layout).toContain('observer.observe(rail)')
    expect(layout).toContain("window.addEventListener('resize', sync)")
    expect(layout).toContain("window.removeEventListener('resize', sync)")
  })
})
