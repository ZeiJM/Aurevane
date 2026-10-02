import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./character-arsenal-shell.module.css', import.meta.url), 'utf8')

describe('Nexus Attunement preview placement', () => {
  it('prefers the right side on desktop and keeps the mobile above-anchor fallback', () => {
    expect(css).toMatch(/\.attunementHover\s*\{[^}]*left:\s*calc\(100% \+ 0\.5rem\)/su)
    expect(css).not.toMatch(/\.attunementHover\s*\{[^}]*right:\s*calc\(100% \+ 0\.5rem\)/su)
    expect(css).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.attunementHover\s*\{[^}]*bottom:\s*calc\(100% \+ 0\.45rem\)[^}]*left:\s*0/su,
    )
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
