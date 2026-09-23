import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('spherical view input performance', () => {
  it('coalesces pointer-drag camera updates to animation frames and flushes the final position', () => {
    const view = source('src/components/world/spherical-view.tsx')

    expect(view).toContain('pendingCamera')
    expect(view).toContain('pointerFrame')
    expect(view).toContain('window.requestAnimationFrame')
    expect(view).toContain('window.cancelAnimationFrame')
    expect(view).toContain('schedulePointerCamera({')
    expect(view).toContain('flushPointerCamera()')
  })
})
