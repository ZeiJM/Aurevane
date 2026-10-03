import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./character-arsenal-shell.module.css', import.meta.url), 'utf8')

describe('Nexus Attunement reading panels', () => {
  it('uses the shared positioned, dismissible report instead of a capped scrolling tooltip', () => {
    const source = readFileSync(new URL('./character-arsenal-shell.tsx', import.meta.url), 'utf8')
    expect(source).toContain('BattleInfoPopover')
    expect(css).not.toContain('.attunementHover')
  })
})

describe('Nexus content row budget', () => {
  it('keeps Skills and Attunement together instead of spending free height above Manage Techniques', () => {
    expect(css).toMatch(
      /\.arsenal\s*\{[^}]*grid-template-rows:\s*auto max-content auto[^}]*align-content:\s*start/su,
    )
    expect(css).not.toMatch(/grid-template-rows:\s*(?:6\.5rem|8rem|auto) minmax\([^;]*1fr/su)
    expect(css).not.toMatch(
      /\.techniquesPanel :global\(\[data-testid='skill-build-panel'\]\)\s*\{[^}]*margin-top:\s*auto/su,
    )
    expect(css).not.toContain('container-type: size')
  })
})
