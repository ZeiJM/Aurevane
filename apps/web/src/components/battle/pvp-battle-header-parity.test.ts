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

describe('PvP desktop battle layout parity', () => {
  it('discovers the AP panel from its stable progressbar and mirrors Victory Conditions beside it', () => {
    const releasePolish = readLocalFile('pvp-battle-release-polish.tsx')

    expect(releasePolish).toContain('[role="progressbar"][aria-label="Action Economy remaining"]')
    expect(releasePolish).toContain("economy.dataset.pvpHeaderEconomy = 'true'")
    expect(releasePolish).toContain("button.textContent?.includes('Victory Conditions')")
    expect(releasePolish).toContain('data-pvp-header-victory-mirror="true"')
  })

  it('keeps Action Economy and the compact Victory Conditions button centered as one desktop group', () => {
    const parityCss = readLocalFile('pvp-battle-shell-parity-fix.module.css')
    const [desktopCss, mobileCss = ''] = parityCss.split('@media (max-width: 820px)')
    const desktop = compact(desktopCss)

    expect(desktop).toContain(
      'grid-template-columns: minmax(10rem, 1fr) minmax(23rem, 28rem) auto minmax(10rem, 1fr) !important;',
    )
    expect(desktop).toContain('max-width: 28rem !important;')
    expect(desktop).toContain('grid-column: 3;')
    expect(desktop).toContain('min-width: 6.65rem;')
    expect(desktop).toContain('justify-self: start;')
    expect(desktop).not.toMatch(/\.victoryMirror \{[^}]*width: 100%/)
    expect(desktop).not.toMatch(/\.victoryMirror \{[^}]*align-self: stretch/)

    expect(mobileCss).not.toContain('data-pvp-header-economy')
    expect(mobileCss).not.toContain('.victoryMirror')
    expect(parityCss).not.toContain('calc(100dvh - 7.35rem)')
  })

  it('caps the desktop PvP board at the approved fit scale without leaking that cap into mobile', () => {
    const parityCss = readLocalFile('pvp-battle-shell-parity-fix.module.css')
    const [desktopCss, mobileCss = ''] = parityCss.split('@media (max-width: 820px)')
    const desktop = compact(desktopCss)

    expect(desktop).toContain(
      'width: min(100%, 620px) !important; max-width: 620px !important; height: auto !important; max-height: 100% !important;',
    )
    expect(desktop).not.toContain('width: min(100%, 58rem) !important;')
    expect(mobileCss).not.toContain('620px')
  })
})
