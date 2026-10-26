import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'

/** Resolve the protected-facts card used by the authenticated zoom workflow. */
export function protectedPlayerReader(page: Page): Locator {
  return page
    .getByRole('button', { name: 'Refresh player', exact: true })
    .locator('xpath=ancestor::section[1]')
}

/** Actual authenticated controls. Call only inside the extension-verified 200% session. */
export async function exerciseMasterAtBrowserZoom(
  page: Page,
  route: string,
  identity: { email: string; characterName: string },
  info: TestInfo,
  readZoom: () => Promise<number>,
) {
  const evidence: unknown[] = []
  const slug = route.split('/').at(-1)!
  async function control(target: Locator, label: string) {
    await expect(target).toBeVisible()
    await target.scrollIntoViewIfNeeded()
    await expect(target).toBeInViewport({ ratio: 1 })
    const measured = await target.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      const clippedBy: string[] = []
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const css = getComputedStyle(parent),
          box = parent.getBoundingClientRect()
        if (
          (/hidden|clip|auto|scroll/.test(css.overflowX) &&
            (rect.left < box.left - 1 || rect.right > box.right + 1)) ||
          (/hidden|clip|auto|scroll/.test(css.overflowY) &&
            (rect.top < box.top - 1 || rect.bottom > box.bottom + 1))
        )
          clippedBy.push(`${parent.tagName}.${parent.className}`)
      }
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: innerWidth,
        height: innerHeight,
        unobscured: hit === element || element.contains(hit),
        hitElement: hit?.tagName ?? null,
        hitWithinPrimaryDock: !!hit?.closest('[data-av-game-rail]'),
        clippedBy,
      }
    })
    evidence.push({ label, ...measured })
    try {
      expect(measured.left, label).toBeGreaterThanOrEqual(-1)
      expect(measured.right, label).toBeLessThanOrEqual(measured.width + 1)
      expect(measured.top, label).toBeGreaterThanOrEqual(-1)
      expect(measured.bottom, label).toBeLessThanOrEqual(measured.height + 1)
      expect(measured.unobscured, label).toBe(true)
      expect(measured.clippedBy, label).toEqual([])
    } catch (error) {
      await info.attach(`master-real200-${slug}-${label}-failure.json`, {
        body: JSON.stringify(evidence),
        contentType: 'application/json',
      })
      throw error
    }
  }
  async function activate(target: Locator, label: string) {
    await expect(target).toBeEnabled()
    await target.focus()
    // Traverse the real tab order back into the named Master control, then activate it.
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(target).toBeFocused()
    await control(target, label)
    const focus = await target.evaluate((element) => {
      const css = getComputedStyle(element)
      return {
        visible: element.matches(':focus-visible'),
        outline: css.outlineStyle,
        width: parseFloat(css.outlineWidth),
        color: css.outlineColor,
        shadow: css.boxShadow,
      }
    })
    expect(focus.visible, label).toBe(true)
    expect(
      (focus.outline !== 'none' && focus.width > 0 && focus.color !== 'rgba(0, 0, 0, 0)') ||
        focus.shadow !== 'none',
      label,
    ).toBe(true)
    evidence.push({ label, focus })
    await page.screenshot({ path: info.outputPath(`master-real200-${slug}-${label}-focus.png`) })
    await page.keyboard.press('Enter')
  }
  async function state(label: string, container: Locator) {
    expect(await readZoom()).toBe(2)
    await expect(container).toBeVisible()
    const measured = await container.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      rootWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      cssZoom: getComputedStyle(document.documentElement).zoom,
    }))
    expect(measured.cssZoom).toBe('1')
    expect(measured.rootWidth, label).toBeLessThanOrEqual(measured.viewport + 1)
    expect(measured.scrollWidth, label).toBeLessThanOrEqual(measured.clientWidth + 1)
    evidence.push({ label, zoom: 2, ...measured })
    await page.screenshot({
      path: info.outputPath(`master-real200-${slug}-${label}.png`),
      fullPage: true,
    })
  }
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  if (route === '/master/combat-content') {
    const workspace = page.getByRole('region', { name: 'Game Content workspace', exact: true })
    await page.getByLabel('Content category').selectOption('basic')
    await page.getByLabel('Search content').fill('no-matching-zoom-content')
    await activate(button('Search'), 'search-empty')
    await expect(workspace.locator('[data-content-key]')).toHaveCount(0)
    await state('empty', workspace)
    await page.getByLabel('Search content').fill('')
    await activate(button('Search'), 'search-reset')
    await activate(workspace.locator('[data-content-key="unarmed.basic"]'), 'select-basic')
    await expect(workspace.locator('[data-content-key="unarmed.basic"]')).toHaveAttribute(
      'aria-current',
      'true',
    )
    const name = page.getByLabel('Name', { exact: true }),
      ap = page.getByLabel('AP cost', { exact: true })
    await expect(name).toBeEnabled()
    const originalAP = await ap.inputValue()
    await name.fill(
      'A long Basic Attack title demonstrating wrapped authoring and reader content at actual browser zoom',
    )
    await ap.fill('0')
    await expect(page.getByRole('status', { name: 'Content version state' })).toContainText(
      'Unsaved changes',
    )
    await expect(button('Commit Now')).toBeEnabled()
    await control(name, 'long-title')
    await state('long-dirty', workspace)
    await activate(button('Commit Now'), 'commit-invalid')
    const validation = page.getByRole('alert').filter({ hasText: 'positive authored AP cost' })
    await expect(validation).toBeVisible()
    await expect(validation).toContainText('Your local edits are retained.')
    await expect(page.getByRole('status', { name: 'Content version state' })).toContainText(
      'Unsaved changes',
    )
    await validation.scrollIntoViewIfNeeded()
    await state('validation-error', workspace)
    await ap.fill(originalAP)
    await activate(button('Commit Now'), 'commit-content')
    await expect(
      page.getByText('Changes committed and available to the game.', { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('status', { name: 'Content version state' })).toHaveText('Current')
    await activate(button('History'), 'open-history')
    const history = page.getByRole('region', { name: 'Content history', exact: true })
    await expect(
      history.getByRole('heading', { name: 'Current and Previous', exact: true }),
    ).toBeVisible()
    const systemOriginal = history.locator('summary').filter({ hasText: /^System original$/ })
    await activate(systemOriginal, 'open-system-original')
    await control(button('Restore System original'), 'original-restore')
    await state('saved-history', workspace)
    await activate(button('Restore System original'), 'restore-original')
    await expect(
      page.getByText('Previous settings loaded. Review them, then Commit Now to apply.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByRole('status', { name: 'Content version state' })).toHaveText(
      'Uncommitted changes',
    )
    await state('restored', workspace)
    await activate(button('Commit Now'), 'commit-restored-original')
    await expect(
      page.getByText('Changes committed and available to the game.', { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('status', { name: 'Content version state' })).toHaveText('Current')
    await state('restored-current', workspace)
  } else if (route === '/master/combat-timing') {
    const form = page
      .locator('form')
      .filter({ has: page.getByRole('heading', { name: 'Effect timing' }) })
    const search = page.getByLabel('Search effect tags')
    await search.fill('no-matching-zoom-tag')
    await expect(form.locator('tbody tr')).toHaveCount(0)
    await state('empty', form)
    await search.fill('')
    await expect(form.locator('tbody tr').first()).toBeVisible()
    await page.getByLabel('Sort effect tags').selectOption('timing-asc')
    const usage = form.getByRole('button', { name: /current definitions/ }).first()
    await activate(usage, 'used-by-dialog')
    const definitions = page.getByRole('dialog', { name: /definitions$/ })
    await expect(definitions).toBeVisible()
    await expect(definitions.getByRole('listitem').first()).toBeVisible()
    await expect(definitions.getByRole('button', { name: /^Close / })).toBeFocused()
    await state('expanded-reader', definitions)
    await page.keyboard.press('Escape')
    await expect(definitions).toBeHidden()
    await expect(usage).toBeFocused()
    await activate(usage, 'reopen-definitions')
    await page.mouse.click(2, 2)
    await expect(definitions).toBeHidden()
    await expect(usage).toBeFocused()
    await activate(form.getByRole('button', { name: 'Save Changes', exact: true }), 'save-timing')
    await expect(form.getByRole('status')).toHaveText('Timing updated.')
  } else if (route === '/master/world-environment') {
    const form = page.getByRole('form', { name: 'World environment' })
    const day = page.getByLabel('Day length (real minutes)')
    const original = await day.inputValue()
    await day.fill('0')
    await expect(form.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
    expect(
      await day.evaluate((element) => (element as HTMLInputElement).validity.rangeUnderflow),
    ).toBe(true)
    await control(day, 'invalid-day')
    await state('invalid-form', form)
    await day.fill(original)
    await activate(form.getByRole('button', { name: 'Save Changes' }), 'save-environment')
    await expect(form.getByRole('status')).toContainText('World environment saved.')
    await state('saved', form)
  } else if (route === '/master/music') {
    const library = page.getByRole('navigation', { name: 'Page music' })
    const search = page.getByLabel('Search pages')
    await search.fill('no-matching-zoom-page')
    await expect(library.getByRole('button')).toHaveCount(1)
    await state('empty', library)
    await search.fill('')
    await activate(
      library.getByRole('button').filter({ has: page.locator('strong', { hasText: /^World$/ }) }),
      'world-music',
    )
    const mode = page.getByRole('combobox', { name: 'Page music', exact: true })
    const changedMode = (await mode.inputValue()) === 'silent' ? 'global' : 'silent'
    await mode.selectOption(changedMode)
    await expect(mode).toHaveValue(changedMode)
    await expect(page.getByText(/^Effective music:/)).toBeVisible()
    await expect(button('Save Changes')).toBeEnabled()
    await control(mode, 'page-music-mode')
    await state('dirty-page-rule', page.getByRole('region', { name: 'Site Music' }))
    const savedResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/master/site-music',
    )
    await activate(button('Save Changes'), 'save-page-rule')
    expect((await savedResponse).status()).toBe(200)
    await page.reload()
    await activate(
      page
        .getByRole('navigation', { name: 'Page music' })
        .getByRole('button')
        .filter({ has: page.locator('strong', { hasText: /^World$/ }) }),
      'reload-world-music',
    )
    await expect(mode).toHaveValue(changedMode)
    await state('persisted-page-rule', page.getByRole('region', { name: 'Site Music' }))
    await activate(button('Reset to Global'), 'reset-page-rule')
    await expect(mode).toHaveValue('global')
  } else if (route === '/master/staff') {
    const lookup = page.getByLabel('Character name or verified email')
    await lookup.fill(identity.email)
    await activate(button('Find identity'), 'lookup-identity')
    const editor = page.getByRole('region', { name: 'Character access' })
    await expect(editor).toContainText(identity.email)
    await control(page.getByLabel('Linked character · choose exactly one'), 'linked-character')
    await state('identity-reader', editor)
    await activate(button('Close editor'), 'close-identity')
    await expect(editor).toHaveCount(0)
  } else if (route === '/master/players') {
    const search = page.getByLabel('Character name', { exact: true })
    await search.fill('zzzoomnomatchingcharacter')
    await activate(button('Find players'), 'empty-player-search')
    await expect(
      page.getByText('No matching characters. Try a more specific name.', { exact: true }),
    ).toBeVisible()
    await state('empty', search.locator('xpath=ancestor::section[1]'))
    await search.fill(identity.characterName)
    await activate(button('Find players'), 'player-search')
    await activate(button(`Inspect ${identity.characterName}`), 'inspect-player')
    const reader = protectedPlayerReader(page)
    await expect(reader).toHaveCount(1)
    await expect(reader).toContainText('Identity and account access are protected.')
    await state('protected-player-reader', reader)
    await activate(button('Refresh player'), 'refresh-player')
  } else if (route === '/master/events') {
    await activate(button('New Event'), 'new-event')
    await page.getByLabel('Event key', { exact: true }).fill(`zoom-${Date.now()}`)
    await page
      .getByLabel('Title', { exact: true })
      .fill(
        'A long private Event title demonstrating wrapped authoring and preview at actual browser zoom',
      )
    await activate(page.getByText('Template identity', { exact: true }), 'template-disclosure')
    await control(page.getByLabel('Template key', { exact: true }), 'template-key')
    const workspace = page
      .locator('section')
      .filter({ has: page.getByRole('navigation', { name: 'Event authoring sections' }) })
      .first()
    await state('long-event', workspace)
    await activate(button('Save draft'), 'save-event-draft')
    await expect(page.getByText(/Draft v\d+ saved\./)).toBeVisible()
    await activate(
      page
        .getByRole('navigation', { name: 'Event authoring sections' })
        .getByRole('button', { name: 'Preview', exact: true }),
      'preview-tab',
    )
    await activate(
      page.getByRole('button', { name: 'Preview', exact: true }).last(),
      'preview-event',
    )
    const preview = page.getByRole('article', { name: 'Event preview' })
    await expect(preview).toContainText('No run, participation, effect or reward was created.')
    await expect(
      page.getByText('Preview ready. No Event Run was created.', { exact: true }),
    ).toBeVisible()
    await state('event-preview', preview)
  } else if (route === '/master/events/live') {
    const navigator = page.getByRole('complementary', { name: 'Live operations navigator' })
    await activate(navigator.getByRole('button', { name: 'Refresh', exact: true }), 'refresh-runs')
    await page.getByLabel('Search runs').fill('no-matching-zoom-run')
    await expect(navigator.getByRole('button')).toHaveCount(1)
    await control(page.getByLabel('Search runs'), 'run-search')
    await state('empty-runs', navigator)
  } else throw new Error(`Missing real-zoom workflow for ${route}`)
  await info.attach(`master-real200-${slug}-interactions.json`, {
    body: JSON.stringify(evidence),
    contentType: 'application/json',
  })
}
