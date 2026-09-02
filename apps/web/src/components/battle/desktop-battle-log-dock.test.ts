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

describe('desktop battle log shared presentation', () => {
  it('uses one battlefield-owned dock selector for playable PvE and PvP', () => {
    const css = compact(readLocalFile('desktop-battle-log-dock.module.css'))

    expect(css).toContain(
      "#battlefield[data-desktop-battle-log-open='true'] > [data-docked-battle-log='true']",
    )
    expect(css).not.toContain(
      "main[data-pvp-battle='true'] #battlefield[data-desktop-battle-log-open='true'] > [data-docked-battle-log='true']",
    )
  })

  it('fits the dock to the measured tactical-grid row without percentage-height sizing', () => {
    const css = compact(readLocalFile('desktop-battle-log-dock.module.css'))

    expect(css).toContain('grid-row: 1 !important;')
    expect(css).toContain('height: auto !important;')
    expect(css).toContain('margin-top: var(--battle-log-grid-top-inset, 0px) !important;')
    expect(css).toContain('margin-bottom: var(--battle-log-grid-bottom-inset, 0px) !important;')
    expect(css).toContain('align-self: stretch !important;')
    expect(css).not.toContain('grid-row: 1 / span 2 !important;')
  })

  it('keeps the approved inward dock-centering shift shared across playable modes', () => {
    const css = compact(readLocalFile('desktop-battle-log-dock.module.css'))

    expect(css).toContain(
      'transform: translateX(calc(-1 * var(--battle-log-dock-center-shift) + 0.125rem)) !important;',
    )
    expect(css).not.toContain('transform: none !important;')
  })

  it('continues the terrain-footer divider through the shared log column', () => {
    const css = compact(readLocalFile('desktop-battle-log-dock.module.css'))

    expect(css).toContain("#battlefield[data-desktop-battle-log-open='true'])::after")
    expect(css).toContain('grid-column: 2 !important;')
    expect(css).toContain('grid-row: 2 !important;')
    expect(css).toContain('border-top: 1px solid rgba(255, 255, 255, 0.05);')
  })

  it('never hides the PvE difficult-terrain legend while the combat log is open', () => {
    const dockCss = compact(readLocalFile('desktop-battle-log-dock.module.css'))
    const legend = readLocalFile('ai-native-terrain-legend.tsx')

    expect(legend).toContain('<b>Difficult Terrain</b>')
    expect(dockCss).toContain("[data-ai-native-terrain-legend='true']")
    expect(dockCss).toContain('display: grid !important;')
    expect(dockCss).toContain('visibility: visible !important;')
    expect(dockCss).toContain("[data-ai-legacy-terrain-legend='true']")
    expect(dockCss).toContain('display: none !important;')
  })
})
