import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const baseURL = 'https://aurevane.vercel.app'
const { QA_EMAIL: email, QA_PASSWORD: password, GITHUB_RUN_ID: runId } = process.env
if (!email || !password || !runId) throw new Error('Missing isolated QA fixture configuration')
const evidence = new URL('./live-page-fit-evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
page.setDefaultTimeout(30_000)
const rows = []
const errors = []
page.on('pageerror', (error) => errors.push(error.message))

async function screenshot(name) {
  await page.screenshot({ path: new URL(`${name}.png`, evidence).pathname })
}

async function hallFit(label) {
  await page.evaluate(() => document.fonts.ready)
  const metrics = await page.evaluate(() => {
    const main = document.querySelector('#game-main')
    const hall = document.querySelector('#battle-launch')
    const footer = document.querySelector('[data-testid="authenticated-shell"] > footer')
    const mr = main.getBoundingClientRect(), hr = hall.getBoundingClientRect(), fr = footer.getBoundingClientRect()
    const invalid = [...hall.querySelectorAll('button,input,select,label,legend')]
      .filter((e) => e.checkVisibility())
      .filter((e) => {
        const r = e.getBoundingClientRect(), s = getComputedStyle(e)
        return r.bottom > fr.top + 1 || r.top < mr.top - 1 || r.left < hr.left - 1 || r.right > hr.right + 1 || parseFloat(s.fontSize) < (e.matches('input,select') ? 12.99 : 11.99)
      }).map((e) => (e.textContent || e.id).trim().slice(0, 80))
    return { documentOverflow: document.documentElement.scrollHeight - innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      innerOverflow: main.scrollHeight - main.clientHeight,
      panelFooterOverlap: hr.bottom - fr.top, invalid,
      footerPosition: getComputedStyle(footer).position }
  })
  rows.push({ label, ...metrics })
  expect(metrics.documentOverflow, label).toBeLessThanOrEqual(1)
  expect(metrics.horizontalOverflow, label).toBeLessThanOrEqual(1)
  expect(metrics.innerOverflow, label).toBeLessThanOrEqual(1)
  expect(metrics.panelFooterOverlap, label).toBeLessThanOrEqual(1)
  expect(metrics.invalid, label).toEqual([])
  expect(metrics.footerPosition).toBe('sticky')
}

try {
  // This disposable fixture has no privileged role. No password, cookie or bearer token is
  // written to source, logs or evidence. The password exists only in this runner's environment.
  let signedIn = false
  for (let attempt = 0; attempt < 24 && !signedIn; attempt++) {
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Enter AUREVANE', exact: true }).click()
    try { await page.waitForURL('**/game', { timeout: 10_000 }); signedIn = true }
    catch { console.log(`Awaiting isolated QA fixture: attempt ${attempt + 1}`); await new Promise((r) => setTimeout(r, 5_000)) }
  }
  if (!signedIn) throw new Error('QA fixture was not provisioned within the bounded login window')
  await expect(page.getByRole('heading', { name: 'Choose your character.' })).toBeVisible()
  await page.getByRole('link', { name: 'Create Character' }).first().click()
  await expect(page.getByTestId('character-creation')).toBeVisible()
  const suffix = runId.slice(-7).split('').map((d) => String.fromCharCode(65 + Number(d))).join('')
  await page.getByLabel('Character name').fill(`QA ${suffix}`)
  await page.getByRole('button', { name: 'Choose your discipline' }).click()
  await page.getByRole('button', { name: 'Review character' }).click()
  await page.getByRole('button', { name: 'Create character', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/character$/)
  for (let attempt = 0; attempt < 24; attempt++) {
    const ready = await page.locator('[data-testid="authenticated-shell"] > footer').evaluate((e) => getComputedStyle(e).position === 'sticky')
    if (ready) break
    if (attempt === 23) throw new Error('The verified desktop stylesheet is not serving on production')
    await new Promise((r) => setTimeout(r, 5_000)); await page.reload()
  }
  for (const [width, height] of [[1728,885],[1440,900],[1366,768],[1280,720],[1024,768],[1024,576]]) {
    await page.setViewportSize({ width, height })
    const size = `${width}x${height}`
    await page.goto('/game/character')
    await expect(page.getByTestId('character-profile')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const profileBefore = await page.evaluate(() => ({ height: innerHeight, documentHeight: document.documentElement.scrollHeight,
      footer: getComputedStyle(document.querySelector('[data-testid="authenticated-shell"] > footer')).position }))
    expect(profileBefore.footer).toBe('sticky')
    if (width >= 1280 && height >= 720) expect(profileBefore.documentHeight).toBeLessThanOrEqual(height + 1)
    else { await page.mouse.move(width/3, height/2); await page.mouse.wheel(0, 1800)
      if (profileBefore.documentHeight > height + 1) await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0) }
    const reset = page.getByRole('button', { name: 'Reset / Redistribute Attributes', exact: true })
    const resetBox = await reset.boundingBox()
    const footerBox = await page.locator('[data-testid="authenticated-shell"] > footer').boundingBox()
    expect(resetBox.y + resetBox.height).toBeLessThanOrEqual(footerBox.y + 1)
    await reset.click({ trial: true })
    rows.push({ label: `Profile ${size}`, ...profileBefore, resetAboveFooter: true })
    await screenshot(`profile-${size}`)
    await reset.click()
    const resetDialog = page.getByRole('dialog', { name: 'Redistribute Attributes', exact: true })
    await expect(resetDialog).toBeVisible()
    await expect(resetDialog.getByText('Resets available', { exact: true })).toBeVisible()
    await resetDialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(resetDialog).toHaveCount(0)
    await page.goto('/game/battle')
    const tabs = page.getByRole('navigation', { name: 'Battle Hall sections' })
    await expect(page.locator('#ai-mode')).toBeVisible()
    await hallFit(`AI empty ${size}`)
    for (const mode of ['recruit-sparring','guided-fundamentals']) {
      await page.locator('#ai-mode').selectOption(mode)
      await expect(page.getByRole('button', { name: 'Enter Battle', exact: true })).toBeEnabled()
      await hallFit(`${mode} ${size}`)
    }
    await screenshot(`hall-ai-${size}`)
    await tabs.locator('[data-tone="pvp"]').click()
    for (const mode of ['1v1','2v2','3v3','1v1v1','flex-teams']) {
      await page.locator('#pvp-mode').selectOption(mode)
      if (mode === 'flex-teams') {
        const selectors = page.locator('[data-pvp-create-card] > div:has(select) select')
        await selectors.nth(0).selectOption('3'); await selectors.nth(1).selectOption('3')
      }
      await hallFit(`${mode} ${size}`)
    }
    await screenshot(`hall-pvp-${size}`)
    await page.getByRole('button', { name: 'Expanded', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Expanded', exact: true })).toHaveAttribute('aria-pressed','true')
    await page.locator('#lobby-key').fill('avlabcd1234')
    await expect(page.locator('#lobby-key')).toHaveValue('AVL-ABCD-1234')
    await expect(page.getByRole('button', { name: 'Join Battle Lobby', exact: true })).toBeEnabled()
    await tabs.locator('[data-tone="spectate"]').click()
    await page.getByRole('textbox', { name: 'Battle Key', exact: true }).fill('AVB-ABCD-1234')
    await expect(page.getByRole('button', { name: 'Spectate Battle', exact: true })).toBeEnabled()
    await hallFit(`Spectate ${size}`)
    await screenshot(`hall-spectate-${size}`)
  }
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.getByRole('button', { name: 'Navigation', exact: true }).click()
  await page.getByRole('navigation', { name: 'Game navigation' }).getByRole('link', { name: /^Profile/ }).click()
  await expect(page).toHaveURL(/\/game\/character$/)
  for (const [panel, name] of [['primary-build-panel','Discipline Management'],['skill-build-panel','Techniques']]) {
    await page.getByTestId(panel).locator(':scope > button').click()
    const dialog = page.getByRole('dialog', { name, exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name:'Close', exact:true }).click()
    await expect(dialog).toHaveCount(0)
  }
  expect(errors).toEqual([])
  await writeFile(new URL('results.json',evidence), JSON.stringify({ baseURL, sourceCommit: process.env.EXPECTED_SOURCE_SHA, success:true, rows, errors },null,2))
  console.log(`LIVE PAGE CHECK PASSED: ${rows.length} state/viewport measurements, reset dialogs, Navigation, both build launchers; no uncaught page errors.`)
} catch (error) {
  await writeFile(new URL('results.json',evidence), JSON.stringify({ baseURL, success:false, message: error.message, rows, errors },null,2))
  throw error
} finally { await context.close(); await browser.close() }
