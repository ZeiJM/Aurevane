import { mkdir, writeFile } from 'node:fs/promises'
import { test, type Page } from '@playwright/test'

import { selectDiscipline } from './discipline-library-helpers'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

// Evidence-gathering audit (never fails on findings): walks every page at common phone
// widths and records overflow, clipped text, tiny text, small tap targets and scroll traps.
// Findings are written to MOBILE_AUDIT_OUTPUT/findings.json for the workflow to annotate.

type Finding = { page: string; viewport: string; kind: string; detail: string }

const PAGES: { name: string; path: string; prep?: (page: Page) => Promise<void> }[] = [
  { name: 'world', path: '/game/world' },
  {
    name: 'world-details',
    path: '/game/world',
    prep: async (page) => {
      await page.getByRole('button', { name: 'Details', exact: true }).click()
    },
  },
  {
    name: 'world-chat',
    path: '/game/world',
    prep: async (page) => {
      await page.getByRole('button', { name: 'Details', exact: true }).click()
      await page.getByRole('tab', { name: /Chat/ }).click()
    },
  },
  { name: 'character', path: '/game/character' },
  { name: 'haven', path: '/game/haven' },
  { name: 'nexus', path: '/game/nexus' },
  { name: 'loadout', path: '/game/loadout' },
  { name: 'loadout-items', path: '/game/loadout/items' },
  { name: 'arsenal', path: '/game/arsenal' },
  { name: 'training', path: '/game/training' },
  { name: 'battle-hall', path: '/game/battle' },
  {
    name: 'battle-pvp',
    path: '/game/battle',
    prep: async (page) => {
      await page.getByRole('button', { name: 'PVP', exact: true }).click()
    },
  },
  {
    name: 'battle-pvp-create',
    path: '/game/battle',
    prep: async (page) => {
      await page.getByRole('button', { name: 'PVP', exact: true }).click()
      await page.getByRole('button', { name: 'Create Lobby', exact: true }).click()
    },
  },
  {
    name: 'discipline-mgmt',
    path: '/game/nexus',
    prep: async (page) => {
      await page.getByRole('button', { name: /Manage Disciplines/ }).click()
    },
  },
  {
    name: 'techniques',
    path: '/game/nexus',
    prep: async (page) => {
      await page.getByRole('button', { name: /Manage Techniques/ }).click()
      await page.getByTestId('learned-skill-list').waitFor()
    },
  },
  {
    name: 'techniques-preview',
    path: '/game/nexus',
    prep: async (page) => {
      await page.getByRole('button', { name: /Manage Techniques/ }).click()
      await page.getByTestId('learned-skill-list').locator('article label').nth(2).click()
    },
  },
  { name: 'online', path: '/game/online' },
  { name: 'titles', path: '/game/account/titles' },
  { name: 'settings-audio', path: '/game/settings/audio' },
  { name: 'settings-controls', path: '/game/settings/controls' },
  { name: 'account-menu', path: '/game/nexus', prep: openAccountMenu },
  { name: 'news', path: '/news' },
  { name: 'manual', path: '/manual' },
  { name: 'rules', path: '/rules' },
]

async function openAccountMenu(page: Page) {
  await page
    .getByRole('button', { name: /Account/ })
    .first()
    .click()
}

const collect = () => {
  const vw = window.innerWidth
  const out: { kind: string; detail: string }[] = []
  const label = (el: Element) => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
    const cls =
      typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : ''
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls.split(' ')[0].slice(0, 30) : ''}${text ? ` "${text}"` : ''}`
  }
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
  }
  const inScroller = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p)
      if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) return true
    }
    return false
  }
  if (document.documentElement.scrollWidth > vw + 1)
    out.push({
      kind: 'h-overflow',
      detail: `document ${document.documentElement.scrollWidth}px > ${vw}px`,
    })
  for (const lab of Array.from(document.querySelectorAll('[data-technique-card] label'))) {
    const r = lab.getBoundingClientRect()
    if (r.width < 1) continue
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    if (hit && !lab.contains(hit) && hit !== lab)
      out.push({ kind: 'tap-blocked', detail: `${label(lab)} covered by ${label(hit)}` })
  }
  const all = Array.from(document.body.querySelectorAll('*'))
  const seen = { off: 0, clip: 0, tiny: 0, tap: 0, trap: 0 }
  for (const el of all) {
    if (!visible(el)) continue
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    const own = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0,
    )
    if ((r.right > vw + 2 || r.left < -2) && s.position !== 'fixed' && !inScroller(el)) {
      if (seen.off++ < 8)
        out.push({
          kind: 'off-screen',
          detail: `${label(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`,
        })
    }
    if (own && el.scrollWidth > el.clientWidth + 2 && /(hidden|clip)/.test(s.overflowX)) {
      if (seen.clip++ < 10)
        out.push({
          kind: 'clipped-text',
          detail: `${label(el)} ${el.scrollWidth}>${el.clientWidth}`,
        })
    }
    if (own && parseFloat(s.fontSize) < 11) {
      if (seen.tiny++ < 6) out.push({ kind: 'tiny-text', detail: `${label(el)} ${s.fontSize}` })
    }
    if (
      el.matches(
        'button, a[href], [role="button"], [role="tab"], select, input:not([type="hidden"])',
      )
    ) {
      if (Math.min(r.width, r.height) < 30 && !el.closest('canvas')) {
        if (seen.tap++ < 12)
          out.push({
            kind: 'small-target',
            detail: `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`,
          })
      }
    }
    if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) {
      if (seen.trap++ < 6)
        out.push({ kind: 'scroller', detail: `${label(el)} ${el.clientHeight}/${el.scrollHeight}` })
    }
  }
  return out
}

test('records mobile layout findings for every page', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone audit only')
  test.setTimeout(600_000)
  const password = 'AurevaneTest!42'
  const seed = `${Date.now()}`
  const name = `Audit ${seed
    .slice(-7)
    .split('')
    .map((d) => String.fromCharCode(65 + Number(d)))
    .join('')}`
  await provisionAccountAndEnterCharacter({
    page,
    email: `mobile-audit.${seed}@example.com`,
    password,
    characterName: name,
  })

  const findings: Finding[] = []
  try {
    await page.goto('/game/nexus')
    await page.getByRole('button', { name: /Manage Disciplines/ }).click()
    const management = page.getByRole('dialog', { name: 'Discipline Management' })
    await selectDiscipline(management, 'Primary', 'Ironfist')
    await management.getByRole('button', { name: 'Close', exact: true }).click()
  } catch (error) {
    findings.push({
      page: 'setup',
      viewport: 'n/a',
      kind: 'audit-error',
      detail: String(error).split('\n')[0].slice(0, 160),
    })
  }
  page.setDefaultTimeout(6_000)
  page.setDefaultNavigationTimeout(20_000)
  const flush = async () => {
    const dir = process.env.MOBILE_AUDIT_OUTPUT
    if (!dir) return
    await mkdir(dir, { recursive: true })
    await writeFile(`${dir}/findings.json`, JSON.stringify(findings, null, 1))
  }
  for (const viewport of [
    { width: 412, height: 915 },
    { width: 360, height: 740 },
  ]) {
    await page.setViewportSize(viewport)
    for (const entry of PAGES) {
      const tag = `${viewport.width}x${viewport.height}`
      try {
        await page.goto(entry.path, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1200)
        if (entry.prep) await entry.prep(page)
        await page.waitForTimeout(500)
        const results = await page.evaluate(collect)
        if (results.length === 0)
          findings.push({ page: entry.name, viewport: tag, kind: 'clean', detail: '' })
        for (const r of results) findings.push({ page: entry.name, viewport: tag, ...r })
        const dir = process.env.MOBILE_AUDIT_OUTPUT
        if (dir) {
          await mkdir(dir, { recursive: true })
          await page.screenshot({ path: `${dir}/${entry.name}-${tag}.png`, fullPage: false })
        }
      } catch (error) {
        findings.push({
          page: entry.name,
          viewport: tag,
          kind: 'audit-error',
          detail: String(error).split('\n')[0].slice(0, 160),
        })
      }
      await flush()
    }
  }
  const dir = process.env.MOBILE_AUDIT_OUTPUT
  if (dir) {
    await mkdir(dir, { recursive: true })
    await writeFile(`${dir}/findings.json`, JSON.stringify(findings, null, 1))
  }
})
