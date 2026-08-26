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
  it('uses the native Victory Conditions button', () => {
    const releasePolish = readLocalFile('pvp-battle-release-polish.tsx')

    expect(releasePolish).toContain('[role="progressbar"][aria-label="Action Economy remaining"]')
    expect(releasePolish).toContain('header.dataset.pvpHeaderLayout = APPROVED_HEADER_LAYOUT')
    expect(releasePolish).toContain("economy.dataset.pvpHeaderEconomy = 'true'")
    expect(releasePolish).toContain('economy.dataset.pvpHeaderLayout = APPROVED_HEADER_LAYOUT')
    expect(releasePolish).not.toContain('createPortal')
    expect(releasePolish).not.toContain('data-pvp-header-victory-mirror')
    expect(releasePolish).not.toContain('data-pvp-header-victory-source')
  })

  it('keeps the centered PvP structure while adopting the AI header measurements', () => {
    const parityCss = readLocalFile('pvp-battle-shell-parity-fix.module.css')
    const [desktopCss, mobileCss = ''] = parityCss.split('@media (max-width: 820px)')
    const desktop = compact(desktopCss)
    const headerGrid = 'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;'
    const economyGrid = 'grid-template-columns: minmax(13rem, 24rem) 8.4rem !important;'

    expect(desktop).toContain("header[data-pvp-header-layout='approved']")
    expect(desktop).toContain(headerGrid)
    expect(desktop).toContain('min-height: 3.25rem !important;')
    expect(desktop).toContain('padding: 0.35rem clamp(0.55rem, 1vw, 0.85rem) !important;')
    expect(desktop).toContain('grid-column: 2 !important;')
    expect(desktop).toContain(economyGrid)
    expect(desktop).toContain('width: min(100%, 32.95rem) !important;')
    expect(desktop).toContain('font: 700 0.45rem/1 var(--av-font-mono) !important;')
    expect(desktop).toContain('font: 750 0.58rem/1 var(--av-font-mono) !important;')
    expect(desktop).toContain('height: 0.46rem !important;')
    expect(desktop).toContain('width: 8.4rem !important;')
    expect(desktop).toContain('min-width: 6.1rem !important;')
    expect(desktop).toContain('font: 750 0.52rem/1 var(--av-font-mono) !important;')
    expect(desktop.match(/height: 2\.15rem !important;/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(desktop).toContain('> button:last-child ) { grid-column: 3 !important;')

    expect(parityCss).not.toContain('.victoryMirror')
    expect(parityCss).not.toContain('data-pvp-header-victory-source')
    expect(parityCss).not.toContain('620px')
    expect(mobileCss).not.toContain('data-pvp-header-layout')
    expect(mobileCss).not.toContain('height: 2.15rem')
  })

  it('stretches the generated AI-style economy surface instead of collapsing it to a line', () => {
    const parityCss = readLocalFile('pvp-battle-shell-parity-fix.module.css')
    const [desktopCss, mobileCss = ''] = parityCss.split('@media (max-width: 820px)')
    const desktop = compact(desktopCss)

    expect(desktop).toContain(
      "[data-pvp-header-economy='true'][data-pvp-header-layout='approved']::before",
    )
    expect(desktop).toContain('grid-row: 1 / span 2; align-self: stretch !important;')
    expect(desktop).toContain('border: 1px solid var(--av-border);')
    expect(desktop).toContain('background: rgba(255, 255, 255, 0.02);')
    expect(desktop).toContain('background: rgba(207, 169, 93, 0.065) !important;')
    expect(desktop).toContain('font-size: 0.46rem !important; text-transform: none !important;')

    expect(mobileCss).not.toContain("[data-pvp-header-economy='true']::before")
    expect(mobileCss).not.toContain('width: 8.4rem')
  })
})
