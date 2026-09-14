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
    const shared = readLocalFile('battle-client-boundary.tsx')

    expect(shared).toContain(
      "import { BattleScreenVisualContract } from './battle-screen-visual-contract'",
    )
    expect(shared).toContain('<BattleScreenVisualContract />')
    expect(shared).toContain('<BattlePveEnhancements')
    expect(shared).toContain('<BattlePvpEnhancements')
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

  it('gives the desktop command deck enough width for commands and contains selected skills', () => {
    const scale = compact(readLocalFile('battle-pvp-scale-authority.module.css'))
    const selectedSkills = compact(readLocalFile('battle-selected-skills.module.css'))

    expect(scale).toContain('grid-template-columns: minmax(0, 3fr) minmax(16rem, 1fr);')
    expect(selectedSkills).toContain('box-sizing: border-box;')
    expect(selectedSkills).toContain('width: min(3.5rem, 15cqw);')
  })

  it('keeps command costs and tags dark enough for the pale command cards', () => {
    const skillCommand = compact(readLocalFile('battle-skill-command.module.css'))

    expect(skillCommand).toContain('color: #3e5563 !important;')
    expect(skillCommand).toContain('.action > .tags > span { color: #304957;')
  })

  it('uses viewport width alone to switch shared battle and rail geometry', () => {
    const unified = compact(readLocalFile('unified-battle-experience.module.css'))
    const rails = compact(readLocalFile('pvp-six-combatant-rails.module.css'))
    const mobileInspect = compact(readLocalFile('mobile-battle-combatant-popup.module.css'))
    const skillCommand = compact(readLocalFile('battle-skill-command.module.css'))

    expect(unified).not.toContain(
      '@media (min-width: 821px), (any-hover: hover) and (any-pointer: fine)',
    )
    expect(unified).not.toContain(
      '@media (max-width: 820px) and (any-hover: none) and (any-pointer: coarse)',
    )
    expect(rails).not.toContain(
      '@media (min-width: 821px), (any-hover: hover) and (any-pointer: fine)',
    )
    expect(mobileInspect).not.toContain('(any-hover: none) and (any-pointer: coarse)')
    expect(skillCommand).not.toContain('(any-hover: none) and (any-pointer: coarse)')
  })

  it('uses the full rail height for one combatant without changing three-combatant stacks', () => {
    const rails = compact(readLocalFile('pvp-six-combatant-rails.module.css'))

    expect(rails).toContain(".stack[data-count='1'] { grid-template-rows: minmax(0, 1fr);")
    expect(rails).toContain(
      ".stack[data-count='1'] .card { grid-template-columns: minmax(0, 1fr); grid-template-rows: 2rem minmax(0, 1fr) auto;",
    )
    expect(rails).toContain(
      ".stack[data-count='1'] { grid-template-rows: minmax(0, 1fr); height: 100%;",
    )
    expect(rails).toContain('grid-template-rows: repeat(3, minmax(0, 1fr));')

    const scale = compact(readLocalFile('battle-pvp-scale-authority.module.css'))
    expect(scale).toContain("> div:not([data-count='1']) > article")
  })

  it('keeps the legacy final-facing pad mounted for keyboard authority but removes it from layout', () => {
    const contract = readLocalFile('battle-screen-visual-contract.tsx')

    expect(contract).toContain('\'[data-unified-facing-pad="true"]\'')
    expect(contract).toContain("facingPad.style.setProperty('display', 'none', 'important')")
  })

  it('does not absorb PvP-only spectator, battle-key, chat transport or timer mechanics', () => {
    const contract = readLocalFile('battle-screen-visual-contract.tsx')

    expect(contract).not.toContain('joinPvpSpectation')
    expect(contract).not.toContain('/api/pvp/spectate')
    expect(contract).not.toContain('battleKey')
    expect(contract).not.toContain('PvpBattleChatBridge')
    expect(contract).not.toContain('turnClock')
  })
})
