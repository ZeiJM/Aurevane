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

describe('desktop battle log PvP/PvE presentation parity', () => {
  it('uses the same dock component in both playable battle boundaries', () => {
    const pvp = readLocalFile('pvp-battle-client-boundary.tsx')
    const pve = readLocalFile('battle-session-client-boundary.tsx')

    expect(pvp).toContain('<DesktopBattleLogDock')
    expect(pve).toContain('<DesktopBattleLogDock')
  })

  it('gives the PvE dock a real two-row grid area instead of percentage-height sizing', () => {
    const css = compact(readLocalFile('desktop-battle-log-dock.module.css'))

    expect(css).toContain(
      "main:not([data-pvp-battle='true']) #battlefield[data-desktop-battle-log-open='true']",
    )
    expect(css).toContain('grid-template-rows: minmax(0, 1fr) auto !important;')
    expect(css).toContain('grid-row: 1 / span 2 !important;')
    expect(css).toContain('height: auto !important;')
    expect(css).toContain('align-self: stretch !important;')
    expect(css).not.toContain(
      'height: calc( 100% - var(--battle-log-dock-vertical-inset) - var(--battle-log-dock-vertical-inset) ) !important;',
    )
  })

  it('keeps the dock centering shift in PvP and removes it from PvE', () => {
    const css = compact(readLocalFile('desktop-battle-log-dock.module.css'))

    expect(css).toContain(
      "main[data-pvp-battle='true'] #battlefield[data-desktop-battle-log-open='true'] > [data-docked-battle-log='true']",
    )
    expect(css).toContain(
      'transform: translateX(calc(-1 * var(--battle-log-dock-center-shift))) !important;',
    )
    expect(css).toContain('transform: none !important;')
  })

  it('keeps the footer continuation hack PvP-only', () => {
    const css = compact(readLocalFile('desktop-battle-log-dock.module.css'))

    expect(css).toContain(
      "main[data-pvp-battle='true'] #battlefield[data-desktop-battle-log-open='true'] > [aria-label='Terrain legend']",
    )
    expect(css).toContain(')::after { position: absolute;')
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
