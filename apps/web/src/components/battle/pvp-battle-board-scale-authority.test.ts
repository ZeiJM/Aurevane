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

describe('final desktop PvP board scale authority', () => {
  it('loads after the older parity layers', () => {
    const releasePolish = readLocalFile('pvp-battle-release-polish.tsx')

    expect(releasePolish).toContain(
      "import boardScaleStyles from './pvp-battle-board-scale-authority.module.css'",
    )
    expect(releasePolish).toContain('${boardScaleStyles.hook}')
  })

  it('owns a flexible board row and one naturally sized terrain row', () => {
    const css = compact(readLocalFile('pvp-battle-board-scale-authority.module.css'))

    expect(css).toContain(
      "main[data-pvp-battle='true'][data-pvp-desktop-parity='true'] #battlefield",
    )
    expect(css).toContain('display: grid !important;')
    expect(css).toContain('grid-template-rows: minmax(0, 1fr) auto !important;')
    expect(css).toContain('height: 100% !important;')
    expect(css).toContain("#battlefield > [aria-label='Terrain legend']")
    expect(css).toContain('height: auto !important;')
    expect(css).toContain('min-height: 2.35rem !important;')
    expect(css).toContain('max-height: none !important;')
    expect(css).toContain('overflow: visible !important;')
    expect(css).toContain('max-width: min(100%, 620px) !important;')
    expect(css).toContain('height: min(100%, 482px) !important;')
    expect(css).toContain('aspect-ratio: var(--battlefield-aspect-ratio) !important;')
  })
})
