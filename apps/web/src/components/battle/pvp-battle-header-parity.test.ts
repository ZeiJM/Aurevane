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

describe('PvP AI-style header parity', () => {
  it('discovers the AP panel from its stable progressbar and mirrors Victory Conditions beside it', () => {
    const releasePolish = readLocalFile('pvp-battle-release-polish.tsx')

    expect(releasePolish).toContain(
      '[role="progressbar"][aria-label="Action Economy remaining"]',
    )
    expect(releasePolish).toContain("economy.dataset.pvpHeaderEconomy = 'true'")
    expect(releasePolish).toContain("button.textContent?.includes('Victory Conditions')")
    expect(releasePolish).toContain('data-pvp-header-victory-mirror="true"')
  })

  it('uses the AI desktop header columns without leaking the desktop treatment into mobile', () => {
    const parityCss = readLocalFile('pvp-battle-shell-parity-fix.module.css')
    const [desktopCss, mobileCss = ''] = parityCss.split('@media (max-width: 820px)')
    const desktop = compact(desktopCss)

    expect(desktop).toContain(
      'grid-template-columns: minmax(10rem, 1fr) minmax(13rem, 24rem) 8.4rem minmax(10rem, 1fr) !important;',
    )
    expect(desktop).toContain('max-width: 24rem !important;')
    expect(desktop).toContain('grid-column: 3;')
    expect(desktop).toContain('min-width: 8.4rem;')
    expect(desktop).toContain('background: rgba(255, 255, 255, 0.02) !important;')

    expect(mobileCss).not.toContain('data-pvp-header-economy')
    expect(mobileCss).not.toContain('.victoryMirror')
    expect(parityCss).not.toContain('calc(100dvh - 7.35rem)')
  })
})
