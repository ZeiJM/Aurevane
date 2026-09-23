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

  it('does not re-wrap roaming page bodies in another authenticated shell', () => {
    for (const pagePath of roamingPages) {
      const page = source(pagePath)
      expect(page).not.toContain('<AuthenticatedShellFrame')
    }

    for (const componentPath of [
      'src/components/character/character-profile-shell.tsx',
      'src/components/character/character-arsenal-shell.tsx',
      'src/components/wayfarers-practice/offline-training-shell.tsx',
    ]) {
      const component = source(componentPath)
      expect(component).not.toContain('<AuthenticatedShellFrame')
    }
  })

  it('uses recovery content instead of a nested recovery shell on roaming pages', () => {
    for (const pagePath of [
      'src/app/game/(roaming)/character/page.tsx',
      'src/app/game/(roaming)/arsenal/page.tsx',
      'src/app/game/(roaming)/training/page.tsx',
      'src/app/game/(roaming)/account/titles/page.tsx',
    ]) {
      const page = source(pagePath)
      expect(page).not.toContain('<AuthenticatedGameRecovery />')
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
