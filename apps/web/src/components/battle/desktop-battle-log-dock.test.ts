import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function readLocalFile(name: string): string {
  return readFileSync(join(here, name), 'utf8')
}

describe('desktop battle log PvP/PvE presentation parity', () => {
  it('uses the same dock component in both playable battle boundaries', () => {
    const shared = readLocalFile('battle-client-boundary.tsx')
    expect(shared).toContain('<DesktopBattleLogDock')
    expect(shared).toContain("eventDriven={runtime.kind === 'pvp'}")
    expect(readLocalFile('battle-pve-enhancements.tsx')).not.toContain('<DesktopBattleLogDock')
    expect(readLocalFile('battle-pvp-enhancements.tsx')).not.toContain('<DesktopBattleLogDock')
  })

  it('docks into the shared flow target without resizing the battlefield for the log', () => {
    const panel = readLocalFile('battle-log-panel.tsx')
    const dock = readLocalFile('desktop-battle-log-dock.tsx')
    const shared = readLocalFile('battle-experience.tsx')
    expect(panel).toContain('[data-battle-flow-log-target="true"]')
    expect(shared).toContain('data-battle-flow-log-target="true"')
    expect(dock).not.toContain('ResizeObserver')
    expect(dock).not.toContain('getBoundingClientRect')
  })
})
