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
  const expectedResourceErrors: { url: string; status: number }[] = []
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
        focused: element.ownerDocument.activeElement === element,
        scrollMarginBlockStart: getComputedStyle(element).scrollMarginBlockStart,
        stickyTabs: (() => {
          const tabs = element
            .closest('[data-ability-section]')
            ?.parentElement?.querySelector(':scope > [role="tablist"]')
          const box = tabs?.getBoundingClientRect()
          return box ? { top: box.top, bottom: box.bottom, height: box.height } : null
        })(),
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
    const browser = workspace.getByRole('complementary', { name: 'Content browser', exact: true })
    const save = workspace.getByRole('group', { name: 'Save content', exact: true })
    await expect(browser.getByRole('button', { name: 'Commit Now', exact: true })).toHaveCount(0)
    await expect(save.getByRole('button', { name: 'Commit Now', exact: true })).toBeVisible()
    expect(
      await browser.evaluate((element) => {
        const search = element.querySelector('input[type="search"]')!
        const records = element.querySelector('nav')!
        return !!(search.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING)
      }),
    ).toBe(true)
    const name = page.getByLabel('Name', { exact: true }),
      ap = page.getByLabel('AP cost', { exact: true })
    async function showAbilitySection(label: string) {
      const tabs = workspace.getByRole('tablist', { name: 'Ability sections', exact: true })
      const target = tabs.getByRole('tab', { name: label, exact: true })
      await tabs.getByRole('tab', { selected: true }).focus()
      await page.keyboard.press('Home')
      for (let index = 0; index < (await tabs.getByRole('tab').count()); index++) {
        if ((await target.getAttribute('aria-selected')) === 'true') break
        await page.keyboard.press('ArrowRight')
      }
      await expect(target).toHaveAttribute('aria-selected', 'true')
      await expect(target).toBeFocused()
      expect(await target.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
      await control(target, `ability-section-${label.replaceAll(' ', '-').toLowerCase()}`)
    }
    await expect(name).toBeEnabled()
    expect(
      await workspace
        .getByRole('tabpanel', { name: 'Details & Text', exact: true })
        .evaluate((panel) => {
          const requirements = [...panel.querySelectorAll('fieldset')].find(
            (field) => field.querySelector(':scope > legend')?.textContent === 'Requirements',
          )!
          const description = panel.querySelector('[aria-label="Description"]')!
          return !!(
            requirements.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING
          )
        }),
    ).toBe(true)
    const originalAP = await ap.inputValue()
    const originalName = await name.inputValue()
    await name.fill(
      'A long Basic Attack title demonstrating wrapped authoring and reader content at actual browser zoom',
    )
    await showAbilitySection('Action Economy')
    await ap.fill('0')
    await expect(page.getByRole('status', { name: 'Save status' })).toContainText('Unsaved changes')
    await expect(button('Commit Now')).toBeEnabled()
    await showAbilitySection('Details & Text')
    await control(name, 'long-title')
    await state('long-dirty', workspace)
    const rejectedCommit = page.waitForResponse((response) => {
      if (
        response.request().method() !== 'POST' ||
        new URL(response.url()).pathname !== '/api/master/combat-content'
      )
        return false
      const body = response.request().postDataJSON()
      return (
        body?.operation === 'record' &&
        body.command?.action === 'commit' &&
        body.command?.contentKey === 'unarmed.basic'
      )
    })
    await activate(button('Commit Now'), 'commit-invalid')
    const rejected = await rejectedCommit
    expect(rejected.status()).toBe(400)
    expect(await rejected.json()).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Basic Attack requires a positive authored AP cost.',
      },
    })
    expectedResourceErrors.push({ url: rejected.url(), status: rejected.status() })
    const validation = page.getByRole('alert').filter({ hasText: 'positive authored AP cost' })
    await expect(validation).toBeVisible()
    await expect(name).toHaveValue(
      'A long Basic Attack title demonstrating wrapped authoring and reader content at actual browser zoom',
    )
    await expect(ap).toHaveValue('0')
    await expect(page.getByRole('status', { name: 'Save status' })).toContainText('Unsaved changes')
    await validation.scrollIntoViewIfNeeded()
    await state('validation-error', workspace)
    await showAbilitySection('Action Economy')
    await ap.fill(originalAP)
    await showAbilitySection('Details & Text')
    await activate(button('Commit Now'), 'commit-content')
    await expect(
      page.getByText('Changes committed and available to the game.', { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('status', { name: 'Save status' })).toHaveText('Saved')
    await expect(button('History')).toHaveCount(0)
    await expect(workspace.getByRole('button', { name: /^Restore / })).toHaveCount(0)
    const readCurrent = async () => {
      const response = await page.request.post('/api/master/combat-content', {
        data: { operation: 'record', command: { action: 'read', contentKey: 'unarmed.basic' } },
      })
      expect(response.status()).toBe(200)
      return (await response.json()).record
    }
    const beforeRetiredRequests = await readCurrent()
    for (const data of [
      { operation: 'restore-basic-draft', skillId: 'unarmed.basic' },
      { operation: 'rollback', contentKey: 'unarmed.basic', version: 1 },
      {
        operation: 'record',
        command: {
          action: 'restore',
          contentKey: 'unarmed.basic',
          expectedRevision: beforeRetiredRequests.revision,
          source: 'builtin',
        },
      },
    ]) {
      const response = await page.request.post('/api/master/combat-content', { data })
      expect(response.status()).toBe(400)
      expect((await response.json()).error.code).toBe('INVALID_REQUEST')
    }
    const afterRetiredRequests = await readCurrent()
    for (const key of [
      'contentKey',
      'contentKind',
      'lifecycle',
      'revision',
      'versionFloor',
      'createdBy',
      'createdAt',
      'draft',
      'current',
      'history',
      'links',
    ])
      expect(afterRetiredRequests[key]).toEqual(beforeRetiredRequests[key])
    await state('retired-history-unchanged', workspace)
    // Restore the fixture's title through the same explicit authoring controls.
    await name.fill(originalName)
    await expect(button('Commit Now')).toBeEnabled()
    await control(name, 'restore-title-through-editing')
    await activate(button('Commit Now'), 'commit-original-title')
    await expect(
      page.getByText('Changes committed and available to the game.', { exact: true }),
    ).toBeVisible()
    await expect(name).toHaveValue(originalName)
    await expect(ap).toHaveValue(originalAP)
    await expect(page.getByRole('status', { name: 'Save status' })).toHaveText('Saved')
    await state('current-authored-settings', workspace)
  } else if (route === '/master/combat-timing') {
    const form = page
      .locator('form')
      .filter({ has: page.getByRole('heading', { name: 'Effect tags' }) })
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
  } else if (route === '/master/moderation') {
    const directory = page.getByRole('region', { name: 'Find a player', exact: true })
    const lookup = directory.getByLabel('Character name', { exact: true })
    await lookup.fill('no-matching-zoom-player')
    await activate(
      directory.getByRole('button', { name: 'Search', exact: true }),
      'moderation-empty-search',
    )
    await expect(directory.locator('strong')).toHaveCount(0)
    await lookup.fill(identity.characterName)
    await activate(
      directory.getByRole('button', { name: 'Search', exact: true }),
      'moderation-player-search',
    )
    const result = directory.getByRole('button').filter({ hasText: identity.characterName }).first()
    await activate(result, 'moderation-protected-owner')
    const detail = page.getByRole('region', { name: identity.characterName, exact: true })
    await expect(detail).toContainText('Protected account')
    await expect(detail.locator('form')).toHaveCount(0)
    await activate(
      detail.getByRole('button', { name: 'Refresh player', exact: true }),
      'moderation-refresh',
    )
    await expect(detail.getByRole('button', { name: 'Refresh player', exact: true })).toBeEnabled()
    await expect(detail).toContainText('Protected account')
    await state('protected-owner-moderation', detail)
  } else if (route === '/master/activity') {
    const workspace = page.getByRole('region', {
      name: 'Weekly Master Panel activity',
      exact: true,
    })
    const response = page.waitForResponse(
      (res) =>
        res.request().method() === 'GET' && new URL(res.url()).pathname === '/api/master/activity',
    )
    await activate(
      workspace.getByRole('button', { name: 'Refresh', exact: true }),
      'refresh-audit-log',
    )
    expect((await response).status()).toBe(200)
    await expect(workspace.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
    await expect(
      workspace.getByRole('region', { name: 'Recorded changes', exact: true }),
    ).toBeVisible()
    await state('refreshed-audit-log', workspace)
  } else if (route === '/master/staff') {
    const lookup = page.getByLabel('Character name or verified email')
    await lookup.fill(identity.email)
    await activate(button('Find identity'), 'lookup-identity')
    const editor = page.getByRole('region', { name: 'Character access' })
    await expect(editor).toContainText(identity.email)
    await control(
      editor.getByRole('combobox', { name: 'Character', exact: true }),
      'linked-character',
    )
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
    await expect(reader.locator('summary', { hasText: /^More player details$/ })).toHaveCount(0)
    for (const label of [
      'Support action',
      'Calculated maximum resources',
      'World position',
      'Saved loadouts',
    ])
      await expect(reader.locator('dt').filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible()
    await expect(reader).not.toContainText('Identity and account access are protected.')
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
  return expectedResourceErrors
}
