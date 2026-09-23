import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const roamingPages = [
  'src/app/game/(roaming)/character/page.tsx',
  'src/app/game/(roaming)/arsenal/page.tsx',
  'src/app/game/(roaming)/training/page.tsx',
  'src/app/game/(roaming)/online/page.tsx',
  'src/app/game/(roaming)/account/titles/page.tsx',
  'src/app/game/(roaming)/settings/controls/page.tsx',
] as const

describe('persistent roaming shell architecture', () => {
  it('owns the shared shell at the roaming route-group boundary', () => {
    const layout = source('src/app/game/(roaming)/layout.tsx')
    expect(layout).toContain('AuthenticatedShellFrame')
    expect(layout).toContain('{children}')

    for (const pagePath of roamingPages) {
      expect(existsSync(resolve(process.cwd(), pagePath))).toBe(true)
    }
  })

  it('keeps identity-changing and battle routes outside the persistent boundary', () => {
    for (const path of [
      'src/app/game/page.tsx',
      'src/app/game/create',
      'src/app/game/select',
      'src/app/game/battle/page.tsx',
      'src/app/game/battle/[battleSessionId]/page.tsx',
      'src/app/game/battle/spectate/[battleKey]/page.tsx',
    ]) {
      expect(existsSync(resolve(process.cwd(), path))).toBe(true)
    }
  })
})
