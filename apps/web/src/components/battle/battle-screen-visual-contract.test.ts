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

describe('PvP-first shared battle visual contract', () => {
  it('is mounted by both playable battle boundaries', () => {
    const pvp = readLocalFile('pvp-battle-client-boundary.tsx')
    const pve = readLocalFile('battle-session-client-boundary.tsx')

    for (const source of [pvp, pve]) {
      expect(source).toContain(
        "import { BattleScreenVisualContract } from './battle-screen-visual-contract'",
      )
      expect(source).toContain('<BattleScreenVisualContract />')
    }
  })

  it('uses the final PvP desktop shell and board geometry as the shared authority', () => {
    const css = compact(readLocalFile('battle-screen-visual-contract.module.css'))

    expect(css).toContain('height: calc(100dvh - 7.35rem) !important;')
    expect(css).toContain('min-height: 34rem !important;')
    expect(css).toContain(
      'grid-template-columns: minmax(10rem, 1fr) minmax(24rem, 34rem) auto !important;',
    )
    expect(css).toContain('max-width: min(100%, 620px) !important;')
    expect(css).toContain('height: min(100%, 482px) !important;')
  })

  it('keeps the approved PvP mobile command, token and coordinate scale in the shared contract', () => {
    const css = compact(readLocalFile('battle-screen-visual-contract.module.css'))

    expect(css).toContain('min-height: 2.55rem !important;')
    expect(css).toContain('border-width: 1.27px !important;')
    expect(css).toContain('width: 4.15rem !important;')
    expect(css).toContain('grid-template-columns: repeat(5, minmax(0, 1fr)) !important;')
  })

  it('does not absorb PvP-only spectator, battle-key, chat transport or timer mechanics', () => {
    const contract = readLocalFile('battle-screen-visual-contract.tsx')

    expect(contract).not.toContain('spectat')
    expect(contract).not.toContain('battleKey')
    expect(contract).not.toContain('PvpBattleChatBridge')
    expect(contract).not.toContain('turnClock')
  })
})
