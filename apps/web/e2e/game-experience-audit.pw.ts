import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

// Explicitly opt-in diagnostic, not a substitute for regression assertions. Findings are data,
// including existing small text/overflow; the audit must not hide them to manufacture a pass.
test('records current page geometry, typography and local navigation timings', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.AUREVANE_EXPERIENCE_AUDIT !== '1' || testInfo.project.name !== 'desktop-chromium',
    'Opt-in experience baseline.',
  )
  test.setTimeout(180_000)
  const seed = Date.now().toString()
  const name = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  const findings: unknown[] = []
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  async function capture(label: string, navigationMs: number | null = null) {
    await page.evaluate(() => document.fonts.ready)
    const metrics = await page.evaluate(() => {
      const main = document.querySelector('main')
      const footer = document.querySelector('[data-testid="authenticated-shell"] > footer')
      const footerTop = footer?.getBoundingClientRect().top ?? innerHeight
      const smallText = Array.from(
        main?.querySelectorAll('p, small, label, legend, button, a') ?? [],
      ).flatMap((element) => {
        const bounds = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        const size = parseFloat(style.fontSize)
        if (
          !bounds.width ||
          !bounds.height ||
          style.visibility !== 'visible' ||
          bounds.top >= footerTop ||
          bounds.bottom <= 0 ||
          size === 0 ||
          size >= 12
        )
          return []
        return [{ text: element.textContent?.trim().slice(0, 90), fontPx: size }]
      })
      const coveredControls = Array.from(
        footer ? (main?.querySelectorAll('button, input, select, textarea, a') ?? []) : [],
      ).flatMap((element) => {
        const bounds = element.getBoundingClientRect()
        if (
          !bounds.width ||
          !bounds.height ||
          bounds.top >= footerTop ||
          bounds.bottom <= footerTop + 1
        )
          return []
        return [
          { text: element.textContent?.trim().slice(0, 90), bottom: bounds.bottom, footerTop },
        ]
      })
      return {
        path: location.pathname,
        viewport: { width: innerWidth, height: innerHeight },
        verticalOverflow: Math.max(
          0,
          document.documentElement.scrollHeight - document.documentElement.clientHeight,
        ),
        horizontalOverflow: Math.max(
          0,
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        smallText,
        coveredControls,
      }
    })
    findings.push({ label, navigationMs, ...metrics })
    const path = testInfo.outputPath(`${label}.png`)
    await page.screenshot({ path, animations: 'disabled' })
    await testInfo.attach(label, { path, contentType: 'image/png' })
  }

  await page.goto('/')
  await expect(page.getByTestId('account-shell')).toBeVisible()
  await capture('account-entry')
  await provisionAccountAndEnterCharacter({
    page,
    email: `experience-audit.${seed}@example.com`,
    password: 'ExperienceAudit!42',
    characterName: `Experience ${name}`,
  })

  const routes = [
    ['/game/character', 'profile'],
    ['/game/training', 'passive-training'],
    ['/game/settings/controls', 'controls'],
    ['/game/account/titles', 'titles-display'],
    ['/game/online', 'online-users'],
    ['/game', 'character-select'],
    ['/game/create/1', 'character-creation'],
    ['/news', 'news'],
    ['/manual', 'manual'],
    ['/manual/start-here', 'manual-article'],
    ['/rules', 'rules'],
  ] as const
  for (const [route, label] of routes) {
    const start = Date.now()
    await page.goto(route)
    await expect(page.locator('main')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe(route)
    await capture(label, Date.now() - start)
  }

  for (const viewport of [
    { width: 1728, height: 885 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/game/character')
    await expect(page.getByTestId('character-profile')).toBeVisible()
    await capture(`profile-${viewport.width}`)
    await page.goto('/game/battle')
    await expect(page.getByRole('heading', { name: 'Choose your arena.' })).toBeVisible()
    await capture(`hall-ai-empty-${viewport.width}`)
    await page.getByLabel('Battle mode').selectOption('recruit-sparring')
    await capture(`hall-ai-selected-${viewport.width}`)
    await page.getByRole('button', { name: /Player vs Player/ }).click()
    await capture(`hall-pvp-${viewport.width}`)
    await page.getByLabel('Battle format').selectOption('flex-teams')
    await capture(`hall-flex-teams-${viewport.width}`)
    await page.getByRole('button', { name: /^03.*Spectate/ }).click()
    await capture(`hall-spectate-${viewport.width}`)
  }
  await testInfo.attach('experience-findings', {
    body: JSON.stringify(
      {
        environment:
          'CI production build with local Supabase; timings are not live-user speed measurements',
        findings,
        runtimeErrors,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  })
})
