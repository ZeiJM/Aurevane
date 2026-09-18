import { execFileSync } from 'node:child_process'

import { expect, test, type Page, type Response } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

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

function publishedVersion(payload: unknown): number {
  if (
    !isRecord(payload) ||
    !isRecord(payload.published) ||
    !positiveInteger(payload.published.contentVersion)
  ) {
    throw new TypeError('Publish response is missing the immutable content version.')
  }
  return payload.published.contentVersion
}

function publishedMediaHooks(payload: unknown): {
  iconKey: string | null
  audioCueKey: string | null
} {
  if (
    !isRecord(payload) ||
    !isRecord(payload.published) ||
    !isRecord(payload.published.definition) ||
    !isRecord(payload.published.definition.media)
  ) {
    throw new TypeError('Publish response is missing the Skill media definition.')
  }
  const { iconKey, audioCueKey } = payload.published.definition.media
  if (
    (iconKey !== null && typeof iconKey !== 'string') ||
    (audioCueKey !== null && typeof audioCueKey !== 'string')
  ) {
    throw new TypeError('Publish response contains invalid Skill media hooks.')
  }
  return { iconKey, audioCueKey }
}

function currentVersionFromText(value: string | null): number {
  const match = value?.match(/Current version\s*v(\d+)/)
  const version = match ? Number(match[1]) : Number.NaN
  if (!positiveInteger(version))
    throw new TypeError('Master Panel did not render a current version.')
  return version
}

function nextVersionFromText(value: string | null): number {
  const match = value?.match(/New v(\d+)/)
  const version = match ? Number(match[1]) : Number.NaN
  if (!positiveInteger(version)) {
    throw new TypeError('Master Panel did not render the next publication version.')
  }
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

async function equipAuthoringSkill(page: Page): Promise<void> {
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
  }, SKILL_ID)

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
    { id: battleSessionId, version: expectedBattleVersion },
  )

  expect(result.status).toBe(200)
  expect(battleIdentity(result.body).battleVersion).toBeGreaterThan(expectedBattleVersion)
}

function isMasterOperationResponse(response: Response, operation: string): boolean {
  if (
    response.request().method() !== 'POST' ||
    new URL(response.url()).pathname !== '/api/master/combat-content'
  ) {
    return false
  }

  try {
    const body = response.request().postDataJSON() as { operation?: unknown }
    return body.operation === operation
  } catch {
    return false
  }
}

async function runMasterOperation(
  page: Page,
  operation: string,
  buttonName: string,
): Promise<unknown> {
  const pending = page.waitForResponse((response) => isMasterOperationResponse(response, operation))
  await page.getByRole('button', { name: buttonName, exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  return (await response.json()) as unknown
}

async function selectAuthoringSkill(page: Page): Promise<void> {
  await page.getByLabel('Discipline').selectOption('vanguard')
  await page.getByLabel('Skill', { exact: true }).selectOption(SKILL_ID)
  await expect(page.getByRole('heading', { name: 'Forceful Strike' })).toBeVisible()
}

test('Master combat authoring publishes versioned content, pins battles, and rolls back safely', async ({
  page,
}, testInfo) => {
  test.slow()
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

  grantLocalMasterOperator(email)

  await page.goto('/master')
  await expect(page.getByRole('heading', { name: 'Operational control' })).toBeVisible()
  await expect(page.getByText(/WORLDWRIGHT · GAME OWNER/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Staff & Authority/ })).toBeVisible()

  await page.goto('/master/staff')
  await expect(page.getByRole('heading', { name: 'Staff authority' })).toBeVisible()
  await expect(page.getByText(/WORLDWRIGHT · GAME OWNER/)).toBeVisible()

  await page.goto('/master')

  await equipAuthoringSkill(page)

  const oldBattlePayload = await launchRecruitBattle(page)
  const oldBattle = battleIdentity(oldBattlePayload)
  const oldVersion = pinnedSkillVersion(oldBattlePayload, SKILL_ID)

  await page.goto('/master/combat-content')
  await expect(page.getByRole('heading', { name: 'Skill authoring' })).toBeVisible()
  await selectAuthoringSkill(page)

  const versionState = page.locator('[aria-label="Content version state"]')
  expect(currentVersionFromText(await versionState.textContent())).toBe(oldVersion)

  const apInput = page.getByLabel('Action Economy (AP)')
  const originalAp = Number(await apInput.inputValue())
  expect(Number.isSafeInteger(originalAp)).toBe(true)
  const nextAp = originalAp === 100 ? 99 : originalAp + 1
  await apInput.fill(String(nextAp))

  await page.getByLabel('Skill artwork hook').selectOption('skill.lifebinder.mend.icon')
  await expect(page.getByLabel('Skill artwork preview').locator('img')).toHaveAttribute(
    'src',
    /skill-lifebinder-mend-v01\.webp$/,
  )
  await page.getByLabel('Skill audio hook').selectOption('skill.ironfist.breakfall.audio')
  await expect(page.getByLabel('Battle audio preview')).toHaveAttribute(
    'src',
    /ironfist-action-v01-1\.mp3$/,
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

  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const publicationConfirmation = page.locator('section[aria-label="Confirm publication"]')
  await expect(publicationConfirmation).toBeVisible()
  const expectedPublishedVersion = nextVersionFromText(await publicationConfirmation.textContent())
  expect(expectedPublishedVersion).toBeGreaterThan(oldVersion)

  const publishPayload = await runMasterOperation(page, 'publish', 'Confirm publish')
  const newVersion = publishedVersion(publishPayload)
  expect(newVersion).toBe(expectedPublishedVersion)
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
  await expect(publishedSkillButton.locator('img')).toHaveAttribute(
    'src',
    /skill-lifebinder-mend-v01\.webp$/,
  )

  await page.goto('/master/combat-content')
  await selectAuthoringSkill(page)
  await expect
    .poll(async () => currentVersionFromText(await versionState.textContent()))
    .toBe(newVersion)

  const history = page.locator('section[aria-labelledby="version-history-heading"]')
  const priorVersionLabel = history.getByText(`v${oldVersion}`, { exact: true })
  await expect(priorVersionLabel).toBeVisible()
  const priorVersionRow = priorVersionLabel.locator('..').locator('..')
  await priorVersionRow.getByRole('button', { name: 'Rollback', exact: true }).click()

  const rollbackConfirmation = page.locator('section[aria-label="Confirm rollback"]')
  await expect(rollbackConfirmation).toContainText(`Confirm rollback to v${oldVersion}`)
  await runMasterOperation(page, 'rollback', 'Confirm rollback')

  await expect
    .poll(async () => currentVersionFromText(await versionState.textContent()))
    .toBe(oldVersion)
  await expect(history).toContainText(`v${newVersion}`)
  await expect(history).toContainText(`v${oldVersion}`)

  const newBattleAfterRollback = await readBattle(page, newBattle.battleSessionId)
  expect(pinnedSkillVersion(newBattleAfterRollback, SKILL_ID)).toBe(newVersion)

  const newBattleAfterRollbackIdentity = battleIdentity(newBattleAfterRollback)
  await surrenderBattle(
    page,
    newBattleAfterRollbackIdentity.battleSessionId,
    newBattleAfterRollbackIdentity.battleVersion,
  )
})
