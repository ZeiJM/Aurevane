import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const stylesheetUrl = new URL('./sitewide-layout-v2.css', import.meta.url)
const layoutUrl = new URL('./layout.tsx', import.meta.url)

const requiredSelectors = [
  "[data-character-select-page='true']",
  "[data-testid='account-shell']",
  "[data-public-concept='true']",
  '[data-hall-concept]',
  '[data-training-concept]',
  '[data-online-concept]',
] as const

describe('sitewide layout v2', () => {
  it('loads one final global layout layer covering every major shell and hub', () => {
    expect(existsSync(fileURLToPath(stylesheetUrl))).toBe(true)

    const rootLayout = readFileSync(fileURLToPath(layoutUrl), 'utf8')
    expect(rootLayout).toContain("import './sitewide-layout-v2.css'")

    const stylesheet = readFileSync(fileURLToPath(stylesheetUrl), 'utf8')
    // Profile's scoped module owns its geometry; the browser regression covers actual fit.
    expect(stylesheet).not.toContain('[data-profile-workspace]')
    for (const selector of requiredSelectors) {
      expect(stylesheet).toContain(selector)
    }
  })
})
