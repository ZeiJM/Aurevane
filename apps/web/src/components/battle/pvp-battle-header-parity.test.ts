import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function readLocalFile(name: string): string {
  return readFileSync(join(here, name), 'utf8')
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

describe('PvP desktop header authority', () => {
  it('uses the native Victory Conditions control instead of a portal mirror', () => {
    const releasePolish = readLocalFile('pvp-battle-release-polish.tsx')

    expect(releasePolish).toContain('[role="progressbar"][aria-label="Action Economy remaining"]')
    expect(releasePolish).toContain('header.dataset.pvpHeaderLayout = APPROVED_HEADER_LAYOUT')
    expect(releasePolish).toContain("economy.dataset.pvpHeaderEconomy = 'true'")
    expect(releasePolish).toContain('economy.dataset.pvpHeaderLayout = APPROVED_HEADER_LAYOUT')
    expect(releasePolish).not.toContain('createPortal')
    expect(releasePolish).not.toContain('data-pvp-header-victory-mirror')
    expect(releasePolish).not.toContain('data-pvp-header-victory-source')
  })

  it(
    'centers Action Economy plus compact Victory Conditions as one authoritative desktop group',
    () => {
      const parityCss = readLocalFile('pvp-battle-shell-parity-fix.module.css')
      const [desktopCss, mobileCss = ''] = parityCss.split('@media (max-width: 820px)')
      const desktop = compact(desktopCss)

      expect(desktop).toContain(
        "header[data-pvp-header-layout='approved'] ) { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;",
      )
      expect(desktop).toContain(
        "[data-pvp-header-economy='true'][data-pvp-header-layout='approved'] ) { position: relative !important; grid-column: 2 !important;",
      )
      expect(desktop).toContain(
        'grid-template-columns: clamp(13.5rem, 26vw, 28rem) auto !important;',
      )
      expect(desktop).toContain('width: max-content !important;')
      expect(desktop).toContain('justify-self: center !important;')
      expect(desktop).toContain('min-width: 7.25rem !important;')
      expect(desktop).toContain('width: auto !important;')
      expect(desktop).toContain('> button:last-child ) { grid-column: 3 !important;')

      expect(parityCss).not.toContain('.victoryMirror')
      expect(parityCss).not.toContain('data-pvp-header-victory-source')
      expect(parityCss).not.toContain('620px')
      expect(mobileCss).not.toContain('data-pvp-header-layout')
    },
  )
})
