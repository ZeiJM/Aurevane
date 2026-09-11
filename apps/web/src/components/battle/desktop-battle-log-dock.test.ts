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
    const shared = readLocalFile('battle-client-boundary.tsx')
    expect(shared).toContain('<DesktopBattleLogDock')
    expect(shared).toContain("eventDriven={runtime.kind === 'pvp'}")
    expect(readLocalFile('battle-pve-enhancements.tsx')).not.toContain('<DesktopBattleLogDock')
    expect(readLocalFile('battle-pvp-enhancements.tsx')).not.toContain('<DesktopBattleLogDock')
  })

  it('fits the shared dock to the board row using measured grid insets', () => {
    const css = compact(readLocalFile('desktop-battle-log-dock.module.css'))

    expect(css).toContain(
      "main:not([data-pvp-battle='true']) #battlefield[data-desktop-battle-log-open='true']",
    )
    expect(css).toContain('grid-row: 1 !important;')
    expect(css).toContain('margin-top: var(--battle-log-grid-top-inset, 0px) !important;')
    expect(css).toContain('margin-bottom: var(--battle-log-grid-bottom-inset, 0px) !important;')
    expect(css).toContain('height: auto !important;')
    expect(css).toContain('align-self: stretch !important;')
    expect(css).not.toContain(
      'height: calc( 100% - var(--battle-log-dock-vertical-inset) - var(--battle-log-dock-vertical-inset) ) !important;',
    )
  })

  it('shares the approved dock centering between PvP and PvE', () => {
    const css = compact(readLocalFile('desktop-battle-log-dock.module.css'))

    expect(css).toContain(
      ":global(#battlefield[data-desktop-battle-log-open='true'] > [data-docked-battle-log='true'])",
    )
    expect(css).toContain(
      'transform: translateX(calc(-1 * var(--battle-log-dock-center-shift) + 0.125rem)) !important;',
    )
    expect(css).not.toContain('transform: none !important;')
  })

  it('continues the terrain footer divider through the shared log column', () => {
    const css = compact(readLocalFile('desktop-battle-log-dock.module.css'))

    expect(css).toContain(":global(#battlefield[data-desktop-battle-log-open='true'])::after")
    expect(css).toContain('grid-column: 2 !important; grid-row: 2 !important;')
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
