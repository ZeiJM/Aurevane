import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const roamingPages = [
  'src/app/game/(roaming)/character/page.tsx',
  'src/app/game/(roaming)/nexus/page.tsx',
  'src/app/game/(roaming)/training/page.tsx',
  'src/app/game/(roaming)/online/page.tsx',
  'src/app/game/(roaming)/account/titles/page.tsx',
  'src/app/game/(roaming)/settings/controls/page.tsx',
] as const

describe('persistent roaming shell architecture', () => {
  it('owns one authenticated shell at the roaming layout boundary', () => {
    const layoutPath = 'src/app/game/(roaming)/layout.tsx'
    expect(existsSync(resolve(process.cwd(), layoutPath))).toBe(true)

    const layout = source(layoutPath)
    expect(layout).toContain('AuthenticatedShellFrame')
    expect(layout).toContain('{children}')

    for (const pagePath of roamingPages) {
      expect(existsSync(resolve(process.cwd(), pagePath))).toBe(true)
    }
  })

  it('keeps identity and battle boundaries outside the persistent layout', () => {
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

  it('does not nest another authenticated shell inside roaming content', () => {
    for (const pagePath of roamingPages) {
      expect(source(pagePath)).not.toContain('<AuthenticatedShellFrame')
    }

    for (const componentPath of [
      'src/components/character/character-profile-shell.tsx',
      'src/components/character/character-arsenal-shell.tsx',
      'src/components/wayfarers-practice/offline-training-shell.tsx',
    ]) {
      expect(source(componentPath)).not.toContain('<AuthenticatedShellFrame')
    }
  })

  it('uses body-only persistence recovery inside the persistent shell', () => {
    const shell = source('src/components/shell/authenticated-game-shell.tsx')
    expect(shell).toContain('export function AuthenticatedGameRecoveryContent()')

    for (const pagePath of [
      'src/app/game/(roaming)/character/page.tsx',
      'src/app/game/(roaming)/nexus/page.tsx',
      'src/app/game/(roaming)/training/page.tsx',
      'src/app/game/(roaming)/account/titles/page.tsx',
    ]) {
      const page = source(pagePath)
      expect(page).toContain('AuthenticatedGameRecoveryContent')
      expect(page).not.toContain('<AuthenticatedGameRecovery />')
    }
  })

  it('keeps the future Arsenal route as a legacy redirect while Nexus owns build management', () => {
    const legacyArsenal = source('src/app/game/(roaming)/arsenal/page.tsx')
    expect(legacyArsenal).toContain("redirect('/game/nexus')")
  })

  it('moves the Character page test with its route and keeps its logger mock resolvable', () => {
    const testPath = 'src/app/game/(roaming)/character/page.test.ts'
    expect(existsSync(resolve(process.cwd(), testPath))).toBe(true)
    const testFile = source(testPath)
    expect(testFile).toContain("import('../../../../server/logging')")
  })

  it('keeps workflow source checks aligned with the grouped Character route', () => {
    for (const workflowPath of [
      '../../.github/workflows/attribute-allocation.yml',
      '../../.github/workflows/essence-build.yml',
      '../../.github/workflows/profile-skill-build.yml',
      '../../.github/workflows/representative-buildcraft.yml',
      '../../.github/workflows/resonance-build.yml',
      '../../.github/workflows/profile-layout-review.yml',
    ]) {
      const workflow = source(workflowPath)
      if (workflowPath.endsWith('profile-layout-review.yml')) {
        expect(workflow).toContain('apps/web/src/app/game/(roaming)/online/')
        expect(workflow).not.toContain('apps/web/src/app/game/online/')
      } else {
        expect(workflow).toContain('apps/web/src/app/game/(roaming)/character/page.tsx')
        expect(workflow).not.toContain('apps/web/src/app/game/character/page.tsx')
        expect(workflow).not.toContain('src/app/game/character/')
      }
    }
  })
})
