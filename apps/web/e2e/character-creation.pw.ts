import { expect, test } from '@playwright/test'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Wayfarer ${letters}`
}

test('creates one permanent character, renders its profile, and resumes it across sign-in', async ({
  page,
}, testInfo) => {
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `p15-${projectSlug}-${Date.now()}@example.com`
  const password = 'P15-browser-character-2026!'
  const characterName = uniqueCharacterName()

  await page.goto('/')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click()

  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByTestId('character-creation')).toBeVisible()

  const nameInput = page.getByLabel('Character name')
  await nameInput.click()
  await expect(nameInput).toBeFocused()
  await nameInput.fill(characterName)

  expect(await hasHorizontalOverflow(page)).toBe(false)

  await page.getByRole('button', { name: 'Choose your foundation' }).click()
  await expect(page.getByTestId('attribute-points')).toContainText('0 points remaining')
  await page.getByRole('button', { name: 'Review character' }).click()
  await expect(page.getByRole('heading', { name: 'Make this adventurer permanent.' })).toBeVisible()

  await page.getByRole('button', { name: 'Create permanent character' }).click()
  const established = page.getByTestId('character-established')
  await expect(established).toBeVisible()
  await expect(established).toContainText(characterName)
  await expect(established).toContainText('Vanguard')

  await page.reload()
  await expect(page.getByTestId('character-established')).toContainText(characterName)
  await expect(page.getByTestId('character-creation')).toHaveCount(0)

  const profileLink = page.getByRole('link', { name: 'Open character profile' })
  await profileLink.focus()
  await expect(profileLink).toBeFocused()
  await profileLink.press('Enter')

  await expect(page).toHaveURL(/\/game\/character$/)
  const profile = page.getByTestId('character-profile')
  await expect(profile).toContainText(characterName)
  await expect(profile).toContainText('Level 1 Vanguard')
  await expect(page.getByTestId('profile-attribute-might')).toContainText('6')
  await expect(page.getByTestId('profile-attribute-finesse')).toContainText('6')
  await expect(page.getByTestId('profile-attribute-intellect')).toContainText('6')
  await expect(page.getByTestId('profile-attribute-resolve')).toContainText('6')
  await expect(page.getByTestId('derived-stat-maxHp')).toContainText('164')
  await expect(page.getByTestId('derived-stat-maxMp')).toContainText('90')
  await expect(page.getByTestId('derived-stat-accuracy')).toContainText('74%')
  await expect(page.getByTestId('derived-stat-criticalChance')).toContainText('8%')
  await expect(page.getByTestId('derived-stat-movement')).toContainText('4 steps')

  const levelProgress = page.getByTestId('level-progress')
  await expect(levelProgress).toContainText('Progress to Level 2')
  await expect(levelProgress).toContainText('0 / 100 XP')
  await expect(page.getByRole('progressbar', { name: 'Level progress' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  )

  await expect(
    page.locator('[data-media-status="requested"][data-media-request="ART-CHR-001"]').first(),
  ).toBeVisible()
  expect(await hasHorizontalOverflow(page)).toBe(false)

  const backLink = page.getByRole('link', { name: 'Return to game entry' })
  await backLink.focus()
  await expect(backLink).toBeFocused()
  await backLink.press('Enter')
  await expect(page).toHaveURL(/\/game$/)

  const signOut = page.getByRole('button', { name: 'Sign out' })
  await signOut.scrollIntoViewIfNeeded()
  const geometry = await signOut.evaluate((button) => {
    function rect(element: Element | null) {
      if (!element) return null
      const value = element.getBoundingClientRect()
      return {
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        left: value.left,
        width: value.width,
        height: value.height,
      }
    }

    const surface = button.closest('.av-surface')
    const form = button.closest('form')
    const buttonRect = button.getBoundingClientRect()
    const centerX = buttonRect.left + buttonRect.width / 2
    const centerY = buttonRect.top + buttonRect.height / 2
    const hit = document.elementFromPoint(centerX, centerY)

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollY: window.scrollY,
      },
      button: rect(button),
      form: rect(form),
      surface: rect(surface),
      paragraphs: surface
        ? Array.from(surface.querySelectorAll('p')).map((paragraph) => ({
            text: paragraph.textContent?.trim() ?? '',
            rect: rect(paragraph),
            position: getComputedStyle(paragraph).position,
            display: getComputedStyle(paragraph).display,
            marginTop: getComputedStyle(paragraph).marginTop,
            marginBottom: getComputedStyle(paragraph).marginBottom,
            lineHeight: getComputedStyle(paragraph).lineHeight,
          }))
        : [],
      hit: hit
        ? {
            tag: hit.tagName,
            className: hit.getAttribute('class') ?? '',
            text: hit.textContent?.trim().slice(0, 160) ?? '',
            rect: rect(hit),
          }
        : null,
      buttonStyles: {
        position: getComputedStyle(button).position,
        display: getComputedStyle(button).display,
        transform: getComputedStyle(button).transform,
        marginTop: getComputedStyle(button).marginTop,
        marginBottom: getComputedStyle(button).marginBottom,
      },
      surfaceStyles: surface
        ? {
            position: getComputedStyle(surface).position,
            display: getComputedStyle(surface).display,
            height: getComputedStyle(surface).height,
            overflow: getComputedStyle(surface).overflow,
          }
        : null,
    }
  })
  console.log(`SIGN_OUT_GEOMETRY ${JSON.stringify(geometry)}`)

  await signOut.click()
  await expect(page).toHaveURL(/\/$/)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Enter AUREVANE' }).click()

  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByTestId('character-established')).toContainText(characterName)
})

async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
}
