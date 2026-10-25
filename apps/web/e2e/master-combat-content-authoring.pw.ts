import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import type { BasicSkillDefinition } from '@aurevane/game-core/combat/combat-basic-actions'

import { expect, test, type Page, type Response } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'
import { selectDiscipline } from './discipline-library-helpers'

const SKILL_ID = 'vanguard.forceful-strike'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function battleIdentity(payload: unknown): { battleSessionId: string; battleVersion: number } {
  if (!isRecord(payload) || !isRecord(payload.battle)) {
    throw new TypeError('Battle response is missing its battle view.')
  }

  const { battleSessionId, battleVersion } = payload.battle
  if (typeof battleSessionId !== 'string' || !positiveInteger(battleVersion)) {
    throw new TypeError('Battle response has an invalid identity.')
  }

  return { battleSessionId, battleVersion }
}

function pinnedSkillVersion(payload: unknown, skillId: string): number {
  if (!isRecord(payload) || !isRecord(payload.battle) || !isRecord(payload.battle.snapshot)) {
    throw new TypeError('Battle response is missing its authoritative snapshot.')
  }

  const authority = payload.battle.snapshot.buildAuthority
  if (!isRecord(authority) || !Array.isArray(authority.combatants)) {
    throw new TypeError('Battle response is missing build authority.')
  }

  for (const combatant of authority.combatants) {
    if (!isRecord(combatant) || !Array.isArray(combatant.disciplineSkills)) continue
    for (const skill of combatant.disciplineSkills) {
      if (isRecord(skill) && skill.skillId === skillId && positiveInteger(skill.contentVersion)) {
        return skill.contentVersion
      }
    }
  }

  throw new TypeError(`Battle build authority does not pin ${skillId}.`)
}

function publishedSnapshot(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload) || !isRecord(payload.record) || !isRecord(payload.record.current))
    throw new TypeError('Publish response has no complete current record.')
  return payload.record.current
}
function publishedVersion(payload: unknown): number {
  const published = publishedSnapshot(payload)
  if (!isRecord(payload) || !isRecord(published) || !positiveInteger(published.contentVersion)) {
    throw new TypeError('Publish response is missing the immutable content version.')
  }
  return published.contentVersion
}

function publishedBleedBasisPoints(payload: unknown): number {
  const published = publishedSnapshot(payload)
  if (
    !isRecord(payload) ||
    !isRecord(published) ||
    !isRecord(published.definition) ||
    !Array.isArray(published.definition.effects)
  )
    throw new TypeError('Publication has no immutable effects.')
  const bleed = published.definition.effects.find(
    (effect: unknown) => isRecord(effect) && effect.type === 'bleed',
  ) as unknown
  if (
    !isRecord(bleed) ||
    !isRecord(bleed.damageProfile) ||
    !positiveInteger(bleed.damageProfile.basisPoints)
  )
    throw new TypeError('Publication has no valid percentage Bleed profile.')
  return bleed.damageProfile.basisPoints
}

function publishedMediaHooks(payload: unknown): {
  iconKey: string | null
  audioCueKey: string | null
} {
  const published = publishedSnapshot(payload)
  if (
    !isRecord(payload) ||
    !isRecord(published) ||
    !isRecord(published.definition) ||
    !isRecord(published.definition.media)
  ) {
    throw new TypeError('Publish response is missing the Skill media definition.')
  }
  const { iconKey, audioCueKey } = published.definition.media
  if (
    (iconKey !== null && typeof iconKey !== 'string') ||
    (audioCueKey !== null && typeof audioCueKey !== 'string')
  ) {
    throw new TypeError('Publish response contains invalid Skill media hooks.')
  }
  return { iconKey, audioCueKey }
}

function currentVersionFromText(value: string | null): number {
  const match = value?.match(/Current\s*v(\d+)/)
  const version = match ? Number(match[1]) : Number.NaN
  if (!positiveInteger(version))
    throw new TypeError('Master Panel did not render a current version.')
  return version
}

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''")
}

function queryLocalDatabase(sql: string): string {
  const dbContainer = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0]

  if (!dbContainer) throw new Error('Local Supabase database container is unavailable.')

  return execFileSync(
    'docker',
    [
      'exec',
      dbContainer,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atqc',
      sql,
    ],
    { encoding: 'utf8' },
  ).trim()
}

function grantLocalMasterOperator(email: string): void {
  const escapedEmail = escapeSqlLiteral(email)
  const userId = queryLocalDatabase(`
    select id::text
    from auth.users
    where email = '${escapedEmail}'
    limit 1;
  `)

  if (!/^[0-9a-f-]{36}$/.test(userId)) {
    throw new Error('Disposable Master Panel account was not found in local Supabase.')
  }

  queryLocalDatabase(`
    insert into app_private.master_panel_role_assignments (
      user_id,
      role,
      enabled,
      note
    )
    values (
      '${userId}'::uuid,
      'game-owner',
      true,
      'Phase 5 local browser verification'
    )
    on conflict (user_id, role) do update
    set enabled = excluded.enabled,
        updated_at = clock_timestamp(),
        note = excluded.note;

    insert into app_private.master_panel_access_versions (user_id, access_version)
    values ('${userId}'::uuid, 1)
    on conflict (user_id) do nothing;
  `)
}

async function equipAuthoringSkill(page: Page, selectedSkillId = SKILL_ID): Promise<void> {
  const result = await page.evaluate(async (skillId) => {
    const current = await fetch('/api/character/build/skills', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = (await current.json()) as {
      context?: {
        build?: { buildVersion?: number }
        disciplineSkills?: {
          learnedSkills?: readonly { definition?: { id?: string } }[]
        }
      }
    }
    const buildVersion = body.context?.build?.buildVersion
    const learnedSkills = body.context?.disciplineSkills?.learnedSkills ?? []
    const available = learnedSkills.some((entry) => entry.definition?.id === skillId)

    if (!current.ok || !Number.isSafeInteger(buildVersion) || !available) {
      return {
        readStatus: current.status,
        saveStatus: 0,
        available,
      }
    }

    const save = await fetch('/api/character/build/skills', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedBuildVersion: buildVersion,
        idempotencyKey: crypto.randomUUID(),
        skillIds: [skillId],
      }),
    })
    await save.json()

    return {
      readStatus: current.status,
      saveStatus: save.status,
      available,
    }
  }, selectedSkillId)

  expect(result).toEqual({
    readStatus: 200,
    saveStatus: 200,
    available: true,
  })
}

function isBattleCreateResponse(response: Response): boolean {
  return (
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/battles'
  )
}

async function launchRecruitBattle(page: Page): Promise<unknown> {
  await page.goto('/game/battle')
  await expect(page.getByRole('heading', { name: 'Choose your arena.' })).toBeVisible()
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByLabel('AI sparring arena', { exact: true }).selectOption('duel-yard')

  const created = page.waitForResponse(isBattleCreateResponse)
  await page.getByRole('button', { name: 'Enter Battle', exact: true }).click()
  const response = await created

  expect(response.status()).toBe(200)
  const payload: unknown = await response.json()
  const { battleSessionId } = battleIdentity(payload)
  await expect(page).toHaveURL(new RegExp(`/game/battle/${battleSessionId}$`))
  return payload
}

async function readBattle(page: Page, battleSessionId: string): Promise<unknown> {
  const result = await page.evaluate(async (id) => {
    const response = await fetch(`/api/battles/${id}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    return {
      status: response.status,
      body: (await response.json()) as unknown,
    }
  }, battleSessionId)

  expect(result.status).toBe(200)
  return result.body
}

async function surrenderBattle(
  page: Page,
  battleSessionId: string,
  expectedBattleVersion: number,
): Promise<void> {
  let version = expectedBattleVersion
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await page.evaluate(
      async ({ id, version }) => {
        const response = await fetch(`/api/battles/${id}/surrender`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedBattleVersion: version,
            idempotencyKey: crypto.randomUUID(),
          }),
        })
        return {
          status: response.status,
          body: (await response.json()) as unknown,
        }
      },
      { id: battleSessionId, version },
    )

    if (result.status === 409) {
      expect(result.body).toMatchObject({ error: { code: 'STALE_VERSION' } })
      version = battleIdentity(await readBattle(page, battleSessionId)).battleVersion
      continue
    }
    expect(result.status).toBe(200)
    expect(battleIdentity(result.body).battleVersion).toBeGreaterThan(version)
    return
  }
  throw new Error('AI battle kept advancing during surrender cleanup.')
}

function isMasterOperationResponse(response: Response, operation: string): boolean {
  if (
    response.request().method() !== 'POST' ||
    new URL(response.url()).pathname !== '/api/master/combat-content'
  ) {
    return false
  }

  try {
    const body = response.request().postDataJSON() as {
      operation?: unknown
      command?: { action?: unknown }
    }
    return ['save', 'publish', 'restore'].includes(operation)
      ? body.operation === 'record' && body.command?.action === operation
      : body.operation === operation
  } catch {
    return false
  }
}

async function runMasterOperation(
  page: Page,
  operation: string,
  buttonName: string,
): Promise<unknown> {
  if (operation === 'preview') {
    const details = page
      .locator('details')
      .filter({ has: page.locator('summary').filter({ hasText: /^Native sample$/ }) })
    if ((await details.getAttribute('open')) === null) await details.locator('summary').click()
  }
  const button = page.getByRole('button', {
    name: operation === 'preview' ? 'Run native sample' : buttonName,
    exact: true,
  })
  await expect(button).toBeEnabled()
  const pending = page.waitForResponse((response) => isMasterOperationResponse(response, operation))
  await button.click()
  const response = await pending
  expect(response.status()).toBe(200)
  return (await response.json()) as unknown
}

async function selectContentRecord(page: Page, key: string, category = 'skill'): Promise<void> {
  const selector = page.getByLabel('Content category', { exact: true })
  if ((await selector.inputValue()) !== category) await selector.selectOption(category)
  await page.getByLabel('Search content', { exact: true }).fill(key)
  const pending = page.waitForResponse(
    (response) =>
      isMasterOperationResponse(response, 'record') &&
      response.request().postDataJSON()?.command?.action === 'list',
  )
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  expect((await pending).status()).toBe(200)
  await page.locator(`[data-content-key="${key}"]`).click()
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled()
}
async function expectSelectedContentHeading(page: Page, name: string): Promise<void> {
  const heading = page
    .getByRole('region', { name: 'Game Content workspace', exact: true })
    .getByRole('heading', { name, level: 2, exact: true })
  await expect(heading).toHaveCount(1)
  await expect(heading).toBeVisible()
}
async function selectAuthoringSkill(page: Page): Promise<void> {
  await selectContentRecord(page, SKILL_ID)
  await expectSelectedContentHeading(page, 'Forceful Strike')
}
async function publishSaved(page: Page): Promise<unknown> {
  await runMasterOperation(page, 'save', 'Save draft')
  return runMasterOperation(page, 'publish', 'Publish saved draft')
}
async function restoreAndPublish(page: Page, version: number): Promise<unknown> {
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await runMasterOperation(page, 'restore', `Restore version ${version} to draft`)
  const before = currentVersionFromText(
    await page.getByLabel('Content version state').textContent(),
  )
  const payload = await runMasterOperation(page, 'publish', 'Publish saved draft')
  expect(publishedVersion(payload)).toBeGreaterThan(before)
  return payload
}

test('Master combat authoring publishes versioned content, pins battles, and restores complete snapshots as new versions', async ({
  page,
}, testInfo) => {
  test.setTimeout(360_000)
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated desktop Chromium proof covers the protected Master authoring workflow.',
  )

  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('Master Panel authoring E2E requires disposable local Supabase.')
  }

  const suffix =
    Date.now()
      .toString(36)
      .replace(/[^a-z]/gi, '')
      .slice(-7) || 'author'
  const email = `master-content-${Date.now()}@example.com`

  await provisionAccountAndEnterCharacter({
    page,
    email,
    password: 'Master-content-browser-2026!',
    characterName: `Author ${suffix}`,
  })

  await page.goto('/master')
  await expect(page).toHaveURL(/\/game$/)

  const deniedElevation = await page.request.post('/api/master/combat-elevation', {
    data: {
      policy: { version: 1, level1BasisPoints: 0, level2BasisPoints: 0, level3BasisPoints: 10000 },
      reason: 'not an Owner',
    },
  })
  expect(deniedElevation.status()).toBe(403)
  try {
    grantLocalMasterOperator(email)

    await page.goto('/game/character')
    await page.getByRole('button', { name: /Account/ }).click()
    await expect(page.getByRole('menuitem', { name: /Master Panel/ })).toBeVisible()
    await page.getByRole('menuitem', { name: /Master Panel/ }).click()
    await expect(page).toHaveURL(/\/master\/combat-content$/)
    await expect(page.getByRole('heading', { name: 'Game Content', exact: true })).toBeVisible()
    await expect(
      page
        .getByRole('navigation', { name: 'Master Panel navigation' })
        .getByRole('link', { name: /Staff & Access/ }),
    ).toBeVisible()
    await expect(page.getByTestId('master-panel-shell')).toBeVisible()

    await page.goto('/master/staff')
    await expect(page.getByRole('heading', { name: 'Staff & Access' })).toBeVisible()
    const ownerRow = page.getByRole('article').filter({
      has: page.getByText(email, { exact: true }),
    })
    await expect(ownerRow).toHaveCount(1)
    await expect(ownerRow.getByText('Game Owner', { exact: true }).last()).toBeVisible()
    await expect(
      ownerRow.getByText('Global administration · protected Owner', { exact: true }),
    ).toBeVisible()
    await expect(ownerRow.getByText('Protected', { exact: true })).toBeVisible()
    await expect(ownerRow.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
    await expect(ownerRow.getByRole('button', { name: 'Revoke', exact: true })).toHaveCount(0)
    await expect(ownerRow.getByRole('button', { name: 'Bind character', exact: true })).toHaveCount(
      0,
    )

    await page.goto('/master')

    await equipAuthoringSkill(page)
    await page.goto('/master/combat-content')
    await selectAuthoringSkill(page)
    const baselinePublication = await publishSaved(page)

    const oldBattlePayload = await launchRecruitBattle(page)
    const oldBattle = battleIdentity(oldBattlePayload)
    const oldVersion = pinnedSkillVersion(oldBattlePayload, SKILL_ID)
    expect(oldVersion).toBe(publishedVersion(baselinePublication))

    await page.goto('/master/combat-content')
    await expect(page.getByRole('heading', { name: 'Game Content', exact: true })).toBeVisible()
    await selectAuthoringSkill(page)

    const versionState = page.locator('[aria-label="Content version state"]')
    expect(currentVersionFromText(await versionState.textContent())).toBe(oldVersion)

    const apInput = page.getByLabel('Action Economy (AP)')
    const originalAp = Number(await apInput.inputValue())
    expect(Number.isSafeInteger(originalAp)).toBe(true)
    const nextAp = originalAp === 100 ? 99 : originalAp + 1
    await apInput.fill(String(nextAp))

    await page.getByRole('button', { name: 'Media', exact: true }).click()
    await page.getByLabel('Skill artwork hook').selectOption('skill.lifebinder.mend.icon')
    const artworkPreview = page.getByLabel('Skill artwork preview').locator('img')
    await expect(artworkPreview).toHaveAttribute(
      'src',
      '/media/art/discipline-skills/lifebinder-mend-v01.webp',
    )
    await expect
      .poll(() => artworkPreview.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)
    await page.getByLabel('Skill audio hook').selectOption('skill.ironfist.breakfall.audio')
    await expect(page.getByLabel('Battle audio preview')).toHaveAttribute(
      'src',
      /ironfist-action-v02-1\.wav$/,
    )

    await runMasterOperation(page, 'validate', 'Validate')
    await expect(page.locator('[data-validation-state="valid"]')).toContainText('Validated')

    await runMasterOperation(page, 'diff', 'Diff')
    const diff = page.locator('section[aria-label="Semantic diff"]')
    await expect(diff).toContainText('apCost')
    await expect(diff).toContainText('media.iconKey')
    await expect(diff).toContainText('media.audioCueKey')

    await runMasterOperation(page, 'preview', 'Preview')
    const preview = page.locator('section[aria-label="Deterministic preview"]')
    await expect(preview).toContainText('Legal in fixture')
    await expect(preview).toContainText(`${nextAp} AP`)

    const publishPayload = await publishSaved(page)
    const newVersion = publishedVersion(publishPayload)
    expect(newVersion).toBeGreaterThan(oldVersion)
    expect(publishedMediaHooks(publishPayload)).toEqual({
      iconKey: 'skill.lifebinder.mend.icon',
      audioCueKey: 'skill.ironfist.breakfall.audio',
    })

    await expect
      .poll(async () => currentVersionFromText(await versionState.textContent()))
      .toBe(newVersion)

    const oldBattleAfterPublication = await readBattle(page, oldBattle.battleSessionId)
    expect(pinnedSkillVersion(oldBattleAfterPublication, SKILL_ID)).toBe(oldVersion)

    const oldBattleAfterPublicationIdentity = battleIdentity(oldBattleAfterPublication)
    await surrenderBattle(
      page,
      oldBattleAfterPublicationIdentity.battleSessionId,
      oldBattleAfterPublicationIdentity.battleVersion,
    )

    const newBattlePayload = await launchRecruitBattle(page)
    const newBattle = battleIdentity(newBattlePayload)
    expect(pinnedSkillVersion(newBattlePayload, SKILL_ID)).toBe(newVersion)
    const publishedSkillButton = page.getByRole('button', { name: /Selected Forceful Strike/ })
    const publishedSkillArtwork = publishedSkillButton.locator('img')
    await expect(publishedSkillArtwork).toHaveAttribute(
      'src',
      '/media/art/discipline-skills/lifebinder-mend-v01.webp',
    )
    await expect
      .poll(() => publishedSkillArtwork.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)

    await page.goto('/master/combat-content')
    await selectAuthoringSkill(page)
    await expect
      .poll(async () => currentVersionFromText(await versionState.textContent()))
      .toBe(newVersion)

    const restoredPublication = await restoreAndPublish(page, oldVersion)
    expect(publishedSnapshot(restoredPublication).definition).toEqual({
      ...(publishedSnapshot(baselinePublication).definition as Record<string, unknown>),
      contentVersion: publishedVersion(restoredPublication),
    })
    await expect(page.getByRole('list', { name: 'Publication history' })).toContainText(
      `Version ${newVersion}`,
    )
    await expect(page.getByRole('list', { name: 'Publication history' })).toContainText(
      `Version ${oldVersion}`,
    )

    const newBattleAfterRestore = await readBattle(page, newBattle.battleSessionId)
    expect(pinnedSkillVersion(newBattleAfterRestore, SKILL_ID)).toBe(newVersion)

    const newBattleAfterRestoreIdentity = battleIdentity(newBattleAfterRestore)
    await surrenderBattle(
      page,
      newBattleAfterRestoreIdentity.battleSessionId,
      newBattleAfterRestoreIdentity.battleVersion,
    )

    // Real audited publication, reload and restore; both responsive editor layouts.
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 768 })
      await page.goto('/master/combat-content')
      const selectGash = async () => {
        await selectContentRecord(page, 'ravager.gash')
        await expectSelectedContentHeading(page, 'Gash')
      }
      await selectGash()
      const gashBaseline = await publishSaved(page)
      const oldGashVersion = publishedVersion(gashBaseline)
      const percentage = page.getByLabel('Damage per tick (% of attack damage)', { exact: true })
      const oldPercentage = await percentage.inputValue()
      await percentage.fill('12.34')
      await runMasterOperation(page, 'validate', 'Validate')
      await expect(page.locator('[data-validation-state="valid"]')).toContainText('Validated')
      await runMasterOperation(page, 'diff', 'Diff')
      await expect(page.locator('section[aria-label="Semantic diff"]')).toContainText('effects')
      await runMasterOperation(page, 'preview', 'Preview')
      const percentagePublication = await publishSaved(page)
      expect(publishedBleedBasisPoints(percentagePublication)).toBe(1234)
      const percentageVersion = publishedVersion(percentagePublication)
      expect(percentageVersion).toBeGreaterThan(oldGashVersion)
      await page.reload()
      await selectGash()
      expect(currentVersionFromText(await versionState.textContent())).toBe(percentageVersion)
      await expect(percentage).toHaveValue('12.34')
      await percentage.scrollIntoViewIfNeeded()
      if (width === 390) {
        const fieldBox = await percentage.boundingBox()
        const reviewBox = await page
          .getByRole('complementary', { name: 'Content previews', exact: true })
          .boundingBox()
        expect(fieldBox).not.toBeNull()
        expect(reviewBox).not.toBeNull()
        expect(reviewBox!.y).toBeGreaterThanOrEqual(fieldBox!.y + fieldBox!.height)
        expect(fieldBox!.x).toBeGreaterThanOrEqual(0)
        expect(fieldBox!.x + fieldBox!.width).toBeLessThanOrEqual(width)
      }
      await page.screenshot({ path: testInfo.outputPath(`master-percentage-${width}.png`) })
      const gashRestore = await restoreAndPublish(page, oldGashVersion)
      expect(publishedSnapshot(gashRestore).definition).toEqual({
        ...(publishedSnapshot(gashBaseline).definition as Record<string, unknown>),
        contentVersion: publishedVersion(gashRestore),
      })
      await page.reload()
      await selectGash()
      await expect(percentage).toHaveValue(oldPercentage)
    }
    // Actual protected Ground and Burn-trigger publication, reload and restore.
    await page.goto('/game/nexus')
    await page.getByRole('button', { name: /Manage Disciplines/ }).click()
    const management = page.getByRole('dialog', { name: 'Discipline Management', exact: true })
    await selectDiscipline(management, 'Primary', 'Cinderweaver')
    await management.getByRole('button', { name: 'Close', exact: true }).click()
    await equipAuthoringSkill(page, 'cinderweaver.flame-burst')
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 768 })
      await page.goto('/master/combat-content')
      const selectFlame = async () => {
        await selectContentRecord(page, 'cinderweaver.flame-burst')
        await expectSelectedContentHeading(page, 'Flame Burst')
      }
      await selectFlame()
      const flameBaseline = await publishSaved(page)
      const oldFlameVersion = publishedVersion(flameBaseline)
      const duration = page.getByLabel('Ground duration (rounds)', { exact: true })
      const preset = page.getByLabel('Ground animation', { exact: true })
      await expect(page.getByLabel('Ground activation', { exact: true })).toHaveCount(0)
      const backlash = page.getByLabel('Backlash (% of burning unit’s hostile damage)', {
        exact: true,
      })
      const original = {
        duration: await duration.inputValue(),
        preset: await preset.inputValue(),
        backlash: await backlash.inputValue(),
      }
      await duration.fill('4')
      await preset.selectOption('frost')
      await backlash.fill('12.34')
      await runMasterOperation(page, 'validate', 'Validate')
      await expect(page.locator('[data-validation-state="valid"]')).toContainText('Validated')
      await runMasterOperation(page, 'diff', 'Diff')
      const groundDiff = page.locator('section[aria-label="Semantic diff"]')
      await expect(groundDiff).toContainText('groundArea.durationRounds')
      await expect(groundDiff).not.toContainText('groundArea.timing')
      await expect(groundDiff).toContainText('groundArea.visualPresetId')
      // Semantic array diffs identify the effects field; publication checks exact Burn values.
      await expect(groundDiff).toContainText('effects')
      await runMasterOperation(page, 'preview', 'Preview')
      await expect(page.locator('section[aria-label="Deterministic preview"]')).toContainText(
        'Ground',
      )
      const publication = await publishSaved(page)
      expect({ published: publishedSnapshot(publication) }).toMatchObject({
        published: {
          definition: {
            groundArea: { durationRounds: 4, visualPresetId: 'frost' },
            effects: expect.arrayContaining([
              expect.objectContaining({ type: 'burn', backlashBasisPoints: 1234 }),
            ]),
          },
        },
      })
      const flameVersion = publishedVersion(publication)
      expect(flameVersion).toBeGreaterThan(oldFlameVersion)
      await page.reload()
      await selectFlame()
      expect(currentVersionFromText(await versionState.textContent())).toBe(flameVersion)
      await expect(duration).toHaveValue('4')
      await expect(preset).toHaveValue('frost')
      await expect(page.getByLabel('Ground activation', { exact: true })).toHaveCount(0)
      await expect(backlash).toHaveValue('12.34')
      await duration.scrollIntoViewIfNeeded()
      const fieldBox = await duration.boundingBox()
      expect(fieldBox).not.toBeNull()
      expect(fieldBox!.x).toBeGreaterThanOrEqual(0)
      expect(fieldBox!.x + fieldBox!.width).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`master-ground-${width}.png`) })
      const createdGroundBattle = battleIdentity(await launchRecruitBattle(page))
      await expect(page.locator('main[data-unified-battle]')).toHaveAttribute(
        'data-local-turn',
        'true',
      )
      const beforeGround = await readBattle(page, createdGroundBattle.battleSessionId)
      expect(pinnedSkillVersion(beforeGround, 'cinderweaver.flame-burst')).toBe(flameVersion)
      const cast = await page.request.post(
        `/api/battles/${createdGroundBattle.battleSessionId}/intents`,
        {
          data: {
            expectedBattleVersion: battleIdentity(beforeGround).battleVersion,
            idempotencyKey: crypto.randomUUID(),
            intent: {
              kind: 'action',
              actionId: 'cinderweaver.flame-burst',
              target: { kind: 'activate', ground: true },
            },
          },
        },
      )
      const castBody: unknown = await cast.json()
      expect(cast.status(), JSON.stringify(castBody)).toBe(200)
      if (!isRecord(castBody) || !isRecord(castBody.battle) || !isRecord(castBody.battle.snapshot))
        throw new Error('Ground cast did not return its authoritative public snapshot.')
      const publicAreas = castBody.battle.snapshot.groundAreas
      expect(publicAreas).toHaveLength(1)
      if (!Array.isArray(publicAreas) || !isRecord(publicAreas[0]))
        throw new Error('Ground area public projection is missing.')
      expect(Object.keys(publicAreas[0]).sort()).toEqual([
        'activationRound',
        'expiresAtRound',
        'id',
        'tiles',
        'visualPresetId',
      ])
      expect(publicAreas[0].visualPresetId).toBe('frost')
      expect(Array.isArray(publicAreas[0].tiles) && publicAreas[0].tiles.length > 0).toBe(true)
      expect(
        queryLocalDatabase(
          `select jsonb_array_length(current_snapshot->'groundAreas') from app_private.battle_sessions where id = '${createdGroundBattle.battleSessionId}'::uuid;`,
        ),
      ).toBe('1')
      await page.reload()
      const reloadedGround = await readBattle(page, createdGroundBattle.battleSessionId)
      expect(reloadedGround).toMatchObject({ battle: { snapshot: { groundAreas: publicAreas } } })
      await expect(page.locator('[data-ground-area-preset="frost"]').first()).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath(`battle-ground-${width}.png`),
        fullPage: true,
      })
      await surrenderBattle(
        page,
        createdGroundBattle.battleSessionId,
        battleIdentity(reloadedGround).battleVersion,
      )
      expect(
        queryLocalDatabase(
          `select coalesce(jsonb_array_length(current_snapshot->'groundAreas'),0) from app_private.battle_sessions where id = '${createdGroundBattle.battleSessionId}'::uuid;`,
        ),
      ).toBe('0')
      await page.goto('/master/combat-content')
      await selectFlame()
      const flameRestore = await restoreAndPublish(page, oldFlameVersion)
      expect(publishedSnapshot(flameRestore).definition).toEqual({
        ...(publishedSnapshot(flameBaseline).definition as Record<string, unknown>),
        contentVersion: publishedVersion(flameRestore),
      })
      await page.reload()
      await selectFlame()
      await expect(duration).toHaveValue(original.duration)
      await expect(preset).toHaveValue(original.preset)
      await expect(page.getByLabel('Ground activation', { exact: true })).toHaveCount(0)
      await expect(backlash).toHaveValue(original.backlash)
    }
    // Audited elevation publication, stale rejection and old/new battle pinning.
    expect(
      queryLocalDatabase(
        `select has_function_privilege('anon','public.read_battlefield_elevation_policy_v1()','execute')::text || ',' || has_function_privilege('authenticated','public.publish_battlefield_elevation_policy_v1(uuid,integer,jsonb,text)','execute')::text;`,
      ),
    ).toBe('false,false')
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 768 })
      const oldPayload = await launchRecruitBattle(page)
      const oldIdentity = battleIdentity(oldPayload)
      const snapshotOf = (payload: unknown) => {
        if (!isRecord(payload) || !isRecord(payload.battle) || !isRecord(payload.battle.snapshot))
          throw new Error('Missing battle snapshot')
        return payload.battle.snapshot
      }
      const beforeSnapshot = snapshotOf(oldPayload)
      if (!isRecord(beforeSnapshot.tactical)) throw new Error('Missing tiles')
      const beforeTiles = beforeSnapshot.tactical.tiles
      await page.goto('/master/combat-timing')
      const editor = page.getByRole('form', { name: 'Elevation chances', exact: true })
      const fields = [1, 2, 3].map((level) =>
        editor.getByLabel(`Elevation level ${level} chance (%)`, { exact: true }),
      )
      const original = await Promise.all(fields.map((field) => field.inputValue()))
      const versionText = await editor.getByRole('heading').innerText()
      const originalVersion = Number(versionText.match(/v(\d+)/)?.[1])
      expect(positiveInteger(originalVersion)).toBe(true)
      const submit = editor.getByRole('button', { name: 'Publish elevation chances', exact: true })
      await fields[0].fill('0')
      await fields[1].fill('0')
      await fields[2].fill('99')
      await editor
        .getByLabel('Elevation change reason', { exact: true })
        .fill('Browser elevation publication')
      await expect(submit).toBeDisabled()
      await fields[2].fill('100')
      await expect(submit).toBeEnabled()
      const publishedResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/master/combat-elevation',
      )
      await submit.click()
      const published = await publishedResponse
      expect(published.status()).toBe(200)
      const publishedBody = (await published.json()) as { policy: { version: number } }
      expect(publishedBody.policy.version).toBe(originalVersion + 1)
      await page.reload()
      await expect(fields[0]).toHaveValue('0')
      await expect(fields[1]).toHaveValue('0')
      await expect(fields[2]).toHaveValue('100')
      await editor.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`master-elevation-${width}.png`) })
      const stale = await page.request.post('/api/master/combat-elevation', {
        data: {
          policy: {
            version: originalVersion,
            level1BasisPoints: 0,
            level2BasisPoints: 0,
            level3BasisPoints: 10000,
          },
          reason: 'Stale tab',
        },
      })
      expect(stale.status()).toBe(409)
      expect(
        queryLocalDatabase(
          `select count(*) from app_private.battlefield_elevation_policy_versions where version = ${publishedBody.policy.version} and published_by is not null and reason = 'Browser elevation publication';`,
        ),
      ).toBe('1')
      const oldReloaded = await readBattle(page, oldIdentity.battleSessionId)
      const oldSnapshot = snapshotOf(oldReloaded)
      if (!isRecord(oldSnapshot.tactical)) throw new Error('Missing saved tiles')
      expect(oldSnapshot.tactical.tiles).toEqual(beforeTiles)
      expect(oldSnapshot.battlefieldElevationPolicy).toEqual(
        beforeSnapshot.battlefieldElevationPolicy,
      )
      const oldCurrent = battleIdentity(oldReloaded)
      await surrenderBattle(page, oldCurrent.battleSessionId, oldCurrent.battleVersion)
      const newPayload = await launchRecruitBattle(page)
      const newSnapshot = snapshotOf(newPayload)
      expect(newSnapshot.battlefieldElevationPolicy).toEqual({
        version: publishedBody.policy.version,
        level1BasisPoints: 0,
        level2BasisPoints: 0,
        level3BasisPoints: 10000,
      })
      if (!isRecord(newSnapshot.tactical) || !Array.isArray(newSnapshot.tactical.tiles))
        throw new Error('Missing generated tiles')
      const raised = newSnapshot.tactical.tiles.filter(
        (tile: unknown) =>
          isRecord(tile) && typeof tile.elevation === 'number' && tile.elevation > 0,
      )
      expect(raised.length).toBeGreaterThan(0)
      expect(raised.every((tile: unknown) => isRecord(tile) && tile.elevation === 3)).toBe(true)
      const newIdentity = battleIdentity(newPayload)
      await surrenderBattle(page, newIdentity.battleSessionId, newIdentity.battleVersion)
      await page.goto('/master/combat-timing')
      for (let index = 0; index < 3; index++) await fields[index]!.fill(original[index]!)
      await editor
        .getByLabel('Elevation change reason', { exact: true })
        .fill('Restore baseline after browser verification')
      const restoreResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/master/combat-elevation',
      )
      await submit.click()
      expect((await restoreResponse).status()).toBe(200)
      await page.reload()
      for (let index = 0; index < 3; index++)
        await expect(fields[index]!).toHaveValue(original[index]!)
    }
  } finally {
    const escapedEmail = escapeSqlLiteral(email)
    queryLocalDatabase(`
      update app_private.master_panel_role_assignments
      set enabled = false, updated_at = clock_timestamp()
      where user_id = (select id from auth.users where email = '${escapedEmail}')
        and role = 'game-owner';
      update app_private.master_panel_access_versions
      set access_version = access_version + 1
      where user_id = (select id from auth.users where email = '${escapedEmail}');
    `)
  }
})

// Actual finalized-media proof remains independent of the publication scenario above.
test('finalized media controls crop actual bytes, replace the same PC file, preview sound and report failed previews', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One real Chromium media decoding proof.')
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host))
    throw new Error('Media E2E requires disposable local Supabase.')
  const email = `master-media-${Date.now()}@example.com`
  await provisionAccountAndEnterCharacter({
    page,
    email,
    password: 'Master-media-browser-2026!',
    characterName: `Media ${crypto
      .randomUUID()
      .replace(/[0-9]/g, (digit) => String.fromCharCode(97 + Number(digit)))
      .replace(/-/g, '')
      .slice(0, 12)}`,
  })
  try {
    grantLocalMasterOperator(email)
    await page.goto('/master/combat-content')
    await selectContentRecord(page, 'basic.guard', 'basic')
    await page.getByRole('button', { name: 'Media', exact: true }).click()
    const panel = page.getByRole('group', { name: 'Uploaded media', exact: true })
    const input = panel.getByLabel('Upload content media')
    // Four real RGBA pixels: selecting y=0 versus y=1 must change the final pixel/hash.
    const sharp = (await import('sharp')).default
    const png = await sharp(
      Buffer.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]),
      { raw: { width: 2, height: 2, channels: 4 } },
    )
      .png()
      .toBuffer()
    const file = { name: 'same-image.png', mimeType: 'image/png', buffer: png }
    async function finalize() {
      const pending = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/master/combat-content/media',
      )
      await panel.getByRole('button', { name: 'Finalize upload', exact: true }).click()
      const response = await pending
      expect(response.status()).toBe(200)
      return (await response.json()).media as {
        id: string
        checksum: string
        width?: number
        height?: number
      }
    }
    await input.setInputFiles(file)
    await expect(panel.getByLabel('Crop size')).toHaveValue('2')
    await panel.getByLabel('Crop size').fill('1')
    await panel.getByLabel('Crop x').fill('0')
    await panel.getByLabel('Crop y').fill('0')
    await expect
      .poll(() =>
        panel
          .getByLabel('Actual crop preview')
          .evaluate((canvas) =>
            Array.from(
              (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(96, 96, 1, 1).data,
            ),
          ),
      )
      .toEqual([255, 0, 0, 255])
    const first = await finalize()
    expect(first).toMatchObject({ width: 1, height: 1 })
    const preview = panel.getByAltText('Finalized artwork crop')
    await expect
      .poll(() => preview.evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBe(1)
    expect((await page.request.get(`/api/content-media/${first.id}`)).status()).toBe(404)
    const stored = await page.request.get(`/api/master/combat-content/media/${first.id}`)
    expect(stored.status()).toBe(200)
    expect(
      Array.from(
        await sharp(await stored.body())
          .raw()
          .toBuffer(),
      ),
    ).toEqual([255, 0, 0, 255])
    // Identical filename/bytes must dispatch a new selection and allow a different crop.
    await input.setInputFiles(file)
    await expect(panel.getByLabel('Crop size')).toHaveValue('2')
    await panel.getByLabel('Crop size').fill('1')
    await panel.getByLabel('Crop y').fill('1')
    const second = await finalize()
    expect(second.id).not.toBe(first.id)
    expect(second.checksum).not.toBe(first.checksum)
    await page.route(`**/api/master/combat-content/media/${second.id}*`, (route) => route.abort())
    await preview.evaluate((image) => {
      ;(image as HTMLImageElement).src += '?retry=1'
    })
    await expect(panel.getByRole('alert')).toContainText('finalized artwork preview is unavailable')
    await panel.getByRole('button', { name: 'Remove uploaded artwork' }).click()
    await expect(preview).toHaveCount(0)

    const wav = Buffer.alloc(44 + 8820)
    wav.write('RIFF', 0)
    wav.writeUInt32LE(wav.length - 8, 4)
    wav.write('WAVEfmt ', 8)
    wav.writeUInt32LE(16, 16)
    wav.writeUInt16LE(1, 20)
    wav.writeUInt16LE(1, 22)
    wav.writeUInt32LE(44100, 24)
    wav.writeUInt32LE(88200, 28)
    wav.writeUInt16LE(2, 32)
    wav.writeUInt16LE(16, 34)
    wav.write('data', 36)
    wav.writeUInt32LE(8820, 40)
    await input.setInputFiles({ name: 'actual.wav', mimeType: 'audio/wav', buffer: wav })
    const localSound = panel.getByLabel('Selected sound preview')
    await expect
      .poll(() => localSound.evaluate((audio) => (audio as HTMLAudioElement).duration))
      .toBeCloseTo(0.1, 3)
    const sound = await finalize()
    const finalizedSound = panel.getByLabel('Finalized sound preview')
    await finalizedSound.evaluate((audio) => (audio as HTMLAudioElement).load())
    await expect
      .poll(() => finalizedSound.evaluate((audio) => (audio as HTMLAudioElement).duration))
      .toBeCloseTo(0.1, 3)
    await page.route(`**/api/master/combat-content/media/${sound.id}*`, (route) => route.abort())
    await finalizedSound.evaluate((audio) => {
      ;(audio as HTMLAudioElement).src += '?retry=1'
      ;(audio as HTMLAudioElement).load()
    })
    await expect(panel.getByRole('alert')).toContainText('finalized sound preview is unavailable')
    await panel.getByRole('button', { name: 'Remove uploaded sound' }).click()
    await input.setInputFiles({
      name: 'invalid.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.from('invalid'),
    })
    await expect(panel.getByRole('alert')).toContainText('sound could not be played')
  } finally {
    const escapedEmail = escapeSqlLiteral(email)
    queryLocalDatabase(
      `update app_private.master_panel_role_assignments set enabled=false, updated_at=clock_timestamp() where user_id=(select id from auth.users where email='${escapedEmail}') and role='game-owner'; update app_private.master_panel_access_versions set access_version=access_version+1 where user_id=(select id from auth.users where email='${escapedEmail}');`,
    )
  }
})

test('all five independent Basic originals restore through the mounted complete editor and real saved publication', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  // Use the same executable-source transport as the native SQL lifecycle proof.
  // Playwright's test loader must not compile core's ESM package as CommonJS.
  const originals: BasicSkillDefinition[] = JSON.parse(
    execFileSync(process.execPath, [resolve('scripts/master-originals-fixture.mjs')], {
      encoding: 'utf8',
    }),
  )
  expect(originals).toHaveLength(5)
  expect(['localhost', '127.0.0.1']).toContain(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname,
  )
  const email = `master-original-${crypto.randomUUID()}@example.test`
  await provisionAccountAndEnterCharacter({
    page,
    email,
    password: 'Disposable-originals-2026!',
    characterName: `Original ${crypto
      .randomUUID()
      .replace(/[^a-z]/g, '')
      .slice(0, 9)}`,
  })
  try {
    grantLocalMasterOperator(email)
    await page.goto('/master/combat-content')
    for (const original of originals) {
      await selectContentRecord(page, original.id, 'basic')
      // Start with a real saved edit/publication, with any prior publications retained.
      await page.getByRole('button', { name: 'Text', exact: true }).click()
      const name = page.getByRole('textbox', { name: 'Name', exact: true })
      await name.fill(`${original.name} integration edit`)
      const edited = await publishSaved(page)
      const version = publishedVersion(edited)
      const physicalBefore = queryLocalDatabase(
        `select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from app_private.combat_content_versions v where content_key='${escapeSqlLiteral(original.id)}';`,
      )
      await page.getByRole('button', { name: 'History', exact: true }).click()
      const restored = await runMasterOperation(
        page,
        'restore',
        'Restore System original v1 to draft',
      )
      expect(
        isRecord(restored) && isRecord(restored.record) && isRecord(restored.record.draft),
      ).toBe(true)
      if (!isRecord(restored) || !isRecord(restored.record) || !isRecord(restored.record.draft))
        throw new Error('Missing complete draft')
      expect(restored.record.draft.definition).toEqual(original)
      expect(restored.record.draft.restoredSource).toBe('builtin')
      expect(
        queryLocalDatabase(
          `select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from app_private.combat_content_versions v where content_key='${escapeSqlLiteral(original.id)}';`,
        ),
      ).toBe(physicalBefore)
      const published = await runMasterOperation(page, 'publish', 'Publish saved draft')
      expect(publishedVersion(published)).toBeGreaterThan(version)
      expect(publishedSnapshot(published)).toMatchObject({
        restoredFrom: 1,
        restoredSource: 'builtin',
        authoredBy: null,
        authoredAt: null,
      })
      await page.getByRole('button', { name: 'History', exact: true }).click()
      await expect(page.getByLabel('Publication history')).toContainText('Authored by System')
      await page.screenshot({
        path: testInfo.outputPath(`master-original-${original.id}.png`),
        fullPage: true,
      })
    }
  } finally {
    queryLocalDatabase(
      `update app_private.master_panel_role_assignments set enabled=false where user_id=(select id from auth.users where email='${escapeSqlLiteral(email)}') and role='game-owner';`,
    )
  }
})
