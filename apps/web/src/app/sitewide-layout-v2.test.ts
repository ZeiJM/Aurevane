import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const stylesheetUrl = new URL('./sitewide-layout-v2.css', import.meta.url)
const layoutUrl = new URL('./layout.tsx', import.meta.url)

const requiredSelectors = ["[data-testid='account-shell']", "[data-public-concept='true']"] as const

describe('sitewide layout v2', () => {
  it('retains shared shells without overriding component-owned page geometry', () => {
    expect(existsSync(fileURLToPath(stylesheetUrl))).toBe(true)

    const rootLayout = readFileSync(fileURLToPath(layoutUrl), 'utf8')
    expect(rootLayout).toContain("import './sitewide-layout-v2.css'")

    const stylesheet = readFileSync(fileURLToPath(stylesheetUrl), 'utf8')
    // These routes now own their geometry; real browser regressions cover their fit.
    expect(stylesheet).not.toContain('[data-profile-workspace]')
    expect(stylesheet).not.toContain('[data-training-concept]')
    expect(stylesheet).not.toContain('[data-hall-concept]')
    expect(stylesheet).not.toContain('[data-online-concept]')
    expect(stylesheet).not.toContain('[data-character-select-page=')
    expect(stylesheet).not.toContain('[data-roster-stage]')
    expect(stylesheet).not.toContain('[data-character-creation]')
    for (const selector of requiredSelectors) {
      expect(stylesheet).toContain(selector)
    }
  })
})
