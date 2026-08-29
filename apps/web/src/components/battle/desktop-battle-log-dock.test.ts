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

  it('keeps the PvE dock stretched to the board row when the combat log is open', () => {
    const css = compact(readLocalFile('desktop-battle-log-dock.module.css'))

    expect(css).toContain(
      "main:not([data-pvp-battle='true']) #battlefield[data-desktop-battle-log-open='true']",
    )
    expect(css).toContain('grid-template-rows: minmax(0, 1fr) auto !important;')
    expect(css).toContain(
      'height: calc( 100% - var(--battle-log-dock-vertical-inset) - var(--battle-log-dock-vertical-inset) ) !important;',
    )
    expect(css).toContain('align-self: stretch !important;')
  })

  it('never hides the PvE difficult-terrain legend while the combat log is open', () => {
    const dockCss = compact(readLocalFile('desktop-battle-log-dock.module.css'))
    const legend = readLocalFile('ai-native-terrain-legend.tsx')

    expect(legend).toContain('<b>Difficult Terrain</b>')
    expect(dockCss).toContain("[data-ai-native-terrain-legend='true']")
    expect(dockCss).toContain('display: flex !important;')
    expect(dockCss).toContain('visibility: visible !important;')
    expect(dockCss).toContain("[data-ai-legacy-terrain-legend='true']")
    expect(dockCss).toContain('display: none !important;')
  })
})
