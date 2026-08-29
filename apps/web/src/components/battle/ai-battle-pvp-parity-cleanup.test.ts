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

describe('AI battle PvP presentation cleanup', () => {
  it('keeps AI parity attached to the existing shared presentation authority', () => {
    const boundary = readLocalFile('battle-session-client-boundary.tsx')
    const authority = readLocalFile('ai-battle-pvp-parity-authority.tsx')

    expect(boundary).toContain(
      "import { BattleCommandCockpitPolish } from './battle-command-cockpit-polish'",
    )
    expect(boundary).toContain('<BattleCommandCockpitPolish />')
    expect(boundary).toContain('<AiBattlePvpParityAuthority />')
    expect(authority).toContain(
      "import cleanupStyles from './ai-battle-pvp-parity-cleanup.module.css'",
    )
  })

  it('removes the AI-only rough-terrain AP badge while preserving the elevation cue', () => {
    const css = compact(readLocalFile('ai-battle-pvp-parity-cleanup.module.css'))

    expect(css).toContain(
      "button[data-terrain-presentation='difficult'] > span > b:not([data-terrain-native-elevation='true'])",
    )
    expect(css).toContain('display: none !important;')
  })

  it('uses a neutral portrait fallback for the Recruit rail and battlefield token', () => {
    const css = compact(readLocalFile('ai-battle-pvp-parity-cleanup.module.css'))

    expect(css).toContain(
      "aside[aria-label='Recruit combat status'] button[aria-label='Show Recruit combat details'] > span:first-child",
    )
    expect(css).toContain(
      "[data-map-token-portrait][data-map-token-team='opponent'] > span:first-child",
    )
    expect(css).toContain('font-size: 0 !important;')
    expect(css).toContain("content: '';")
  })
})
