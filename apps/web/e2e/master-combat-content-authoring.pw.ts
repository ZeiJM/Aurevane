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

async function readContentRecord(page: Page, key?: string): Promise<Record<string, unknown>> {
  const contentKey =
    key ??
    (await page.locator('[data-content-key][aria-current="true"]').getAttribute('data-content-key'))
  if (!contentKey) throw new Error('No selected complete content record.')
  const response = await page.request.post('/api/master/combat-content', {
    data: { operation: 'record', command: { action: 'read', contentKey } },
  })
  expect(response.status()).toBe(200)
  const payload: unknown = await response.json()
  if (!isRecord(payload) || !isRecord(payload.record))
    throw new Error('Missing authoritative complete content record.')
  return payload.record
}
async function currentContentVersion(page: Page, key?: string): Promise<number> {
  return publishedVersion({ record: await readContentRecord(page, key) })
}
async function verifyAuthoringServices(page: Page, before: unknown, after: unknown) {
  // These service operations remain supported, while the editor now commits in one step.
  const results: Record<string, Record<string, unknown>> = {}
  for (const [operation, fields] of [
    ['validate', { definition: after }],
    ['diff', { before, after }],
    ['preview', { definition: after }],
  ] as const) {
    const response = await page.request.post('/api/master/combat-content', {
      data: { operation, ...fields },
    })
    expect(response.status()).toBe(200)
    const payload: unknown = await response.json()
    if (!isRecord(payload)) throw new Error('Invalid authoring service response.')
    const value = payload[operation === 'validate' ? 'validation' : operation]
    if (!isRecord(value)) throw new Error('Missing authoring service result.')
    results[operation] = value
  }
  expect(results.validate!.valid).toBe(true)
  return { diff: results.diff!, preview: results.preview! }
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
    return operation === 'commit'
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
  const button = page.getByRole('button', { name: buttonName, exact: true })
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
  await expect(page.getByRole('button', { name: 'Commit Now', exact: true })).toBeEnabled()
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
async function commitContent(page: Page): Promise<unknown> {
  return runMasterOperation(page, 'commit', 'Commit Now')
}
function immutableContentVersionsSql(contentKey: string, excludingVersion?: number): string {
  return `select coalesce(jsonb_agg(to_jsonb(v) || jsonb_build_object('attribution',to_jsonb(a)) order by v.id),'[]')
    from app_private.combat_content_versions v
    left join app_private.combat_content_attribution a on a.version_id=v.id
    where v.content_key='${escapeSqlLiteral(contentKey)}'
      ${excludingVersion === undefined ? '' : `and v.content_version <> ${excludingVersion}`};`
}

async function expectRetiredRestorationRejected(page: Page, sourceVersion: number): Promise<void> {
  for (const label of [
    'History',
    'Restore Previous',
    'Restore System original',
    'Text',
    'Parameters',
  ])
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Content history', exact: true })).toHaveCount(0)
  const before = await readContentRecord(page)
  if (typeof before.contentKey !== 'string' || !positiveInteger(before.revision))
    throw new Error('Missing current content identity/revision.')
  expect(before.history).toEqual([])
  expect(before).not.toHaveProperty('builtinRestoreVersion')
  const contentKey = before.contentKey
  const unchangedStateSql = `select jsonb_build_object(
    'record',(select to_jsonb(r) from app_private.combat_content_records r where r.content_key='${escapeSqlLiteral(contentKey)}'),
    'draft',(select to_jsonb(d) from app_private.combat_content_drafts d where d.content_key='${escapeSqlLiteral(contentKey)}'),
    'publication',(select to_jsonb(p) from app_private.combat_content_publications p where p.content_key='${escapeSqlLiteral(contentKey)}'),
    'versions',(${immutableContentVersionsSql(contentKey).replace(/;$/, '')}));`
  const unchangedState = queryLocalDatabase(unchangedStateSql)
  for (const data of [
    { operation: 'rollback', skillId: contentKey, targetVersion: sourceVersion },
    { operation: 'restore-basic-draft', skillId: contentKey },
    {
      operation: 'record',
      command: { action: 'restore', contentKey, expectedRevision: before.revision, sourceVersion },
    },
    {
      operation: 'record',
      command: {
        action: 'restore',
        contentKey,
        expectedRevision: before.revision,
        sourceVersion: 1,
        sourceKind: 'builtin',
      },
    },
  ]) {
    const response = await page.request.post('/api/master/combat-content', { data })
    expect(response.status()).toBe(400)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'INVALID_REQUEST',
        message: expect.stringMatching(/rollback is no longer available/),
      },
    })
    expect(queryLocalDatabase(unchangedStateSql)).toBe(unchangedState)
  }
  expect(await readContentRecord(page)).toEqual(before)
}

async function commitAuthoredBaseline(page: Page, baselinePublication: unknown): Promise<unknown> {
  const baseline = publishedSnapshot(baselinePublication)
  if (!isRecord(baseline.definition) || !positiveInteger(baseline.contentVersion))
    throw new Error('Missing copied baseline definition.')
  await expectRetiredRestorationRejected(page, baseline.contentVersion)
  const before = await readContentRecord(page)
  if (typeof before.contentKey !== 'string' || !positiveInteger(before.revision))
    throw new Error('Missing current content identity/revision.')
  const retainedVersions = queryLocalDatabase(immutableContentVersionsSql(before.contentKey))
  // This is an ordinary new authored commit of explicitly copied test settings,
  // not a rollback or a restored draft. The browser submits the real authorized API.
  const response = await page.request.post('/api/master/combat-content', {
    data: {
      operation: 'record',
      command: {
        action: 'commit',
        contentKey: before.contentKey,
        expectedRevision: before.revision,
        definition: structuredClone(baseline.definition),
      },
    },
  })
  expect(response.status()).toBe(200)
  const payload: unknown = await response.json()
  const current = publishedSnapshot(payload)
  const newVersion = publishedVersion(payload)
  expect(newVersion).toBeGreaterThan(publishedVersion({ record: before }))
  expect(current.definition).toEqual({ ...baseline.definition, contentVersion: newVersion })
  expect(current).toMatchObject({
    authoredBy: current.publishedBy,
    authoredAt: expect.any(String),
    restoredFrom: null,
    restoredBy: null,
  })
  expect(current.authoredBy).toMatch(/^[0-9a-f-]{36}$/)
  expect(current.authoredAt).not.toBe(baseline.authoredAt)
  expect(current.restoredSource ?? null).toBeNull()
  expect(queryLocalDatabase(immutableContentVersionsSql(before.contentKey, newVersion))).toBe(
    retainedVersions,
  )
  expect(
    queryLocalDatabase(
      `select count(*) from app_private.combat_content_versions where content_key='${escapeSqlLiteral(before.contentKey)}' and content_version=${newVersion};`,
    ),
  ).toBe('1')
  return payload
}

test('Master combat authoring publishes and pins versioned content, rejects retired restoration, and authors copied settings as new versions', async ({
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
    await expect(ownerRow.getByText('owner', { exact: true })).toBeVisible()
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
    const baselinePublication = await commitContent(page)

    const oldBattlePayload = await launchRecruitBattle(page)
    const oldBattle = battleIdentity(oldBattlePayload)
    const oldVersion = pinnedSkillVersion(oldBattlePayload, SKILL_ID)
    expect(oldVersion).toBe(publishedVersion(baselinePublication))

    await page.goto('/master/combat-content')
    await expect(page.getByRole('heading', { name: 'Game Content', exact: true })).toBeVisible()
    await selectAuthoringSkill(page)

    expect(await currentContentVersion(page)).toBe(oldVersion)

    await page.getByRole('tab', { name: 'Action Economy', exact: true }).click()
    const apInput = page.getByLabel('Action Economy (AP)')
    const originalAp = Number(await apInput.inputValue())
    expect(Number.isSafeInteger(originalAp)).toBe(true)
    const nextAp = originalAp === 100 ? 99 : originalAp + 1
    await apInput.fill(String(nextAp))

    await page.getByRole('button', { name: 'Skill Details', exact: true }).click()
    await page.getByRole('tab', { name: 'Media', exact: true }).click()
    await page.getByRole('button', { name: 'Restore default artwork', exact: true }).click()
    const artworkPreview = page.getByRole('img', { name: 'Current artwork', exact: true })
    await expect(artworkPreview).toHaveAttribute(
      'src',
      '/media/art/discipline-skills/vanguard-forceful-strike-v01.webp',
    )
    await expect
      .poll(() => artworkPreview.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)
    await page.getByLabel('Skill audio hook').selectOption('audio.skill-fx.v01.082')
    await expect(page.getByLabel('Battle audio preview')).toHaveAttribute(
      'src',
      /skill-fx-v01\/082-1\.mp3$/,
    )

    const publishPayload = await commitContent(page)
    const services = await verifyAuthoringServices(
      page,
      publishedSnapshot(baselinePublication).definition,
      publishedSnapshot(publishPayload).definition,
    )
    expect(services.diff.changedPaths).toEqual(
      expect.arrayContaining(['apCost', 'media.audioCueKey']),
    )
    expect(services.preview.legal).toBe(true)
    expect(services.preview.costs).toMatchObject({ actionEconomy: nextAp })
    const newVersion = publishedVersion(publishPayload)
    expect(newVersion).toBeGreaterThan(oldVersion)
    expect(publishedMediaHooks(publishPayload)).toEqual({
      iconKey: 'skill.vanguard.forceful-strike.icon',
      audioCueKey: 'audio.skill-fx.v01.082',
    })

    await expect.poll(() => currentContentVersion(page)).toBe(newVersion)

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
      '/media/art/discipline-skills/vanguard-forceful-strike-v01.webp',
    )
    await expect
      .poll(() => publishedSkillArtwork.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)

    await page.goto('/master/combat-content')
    await selectAuthoringSkill(page)
    await expect.poll(() => currentContentVersion(page)).toBe(newVersion)

    const reauthoredPublication = await commitAuthoredBaseline(page, baselinePublication)
    expect(publishedSnapshot(reauthoredPublication).definition).toEqual({
      ...(publishedSnapshot(baselinePublication).definition as Record<string, unknown>),
      contentVersion: publishedVersion(reauthoredPublication),
    })
    expect((await readContentRecord(page)).history).toEqual([])
    expect(
      queryLocalDatabase(
        `select count(*) from app_private.combat_content_versions where content_key='${escapeSqlLiteral(SKILL_ID)}' and content_version in (${newVersion},${oldVersion});`,
      ),
    ).toBe('2')

    const newBattleAfterReauthoring = await readBattle(page, newBattle.battleSessionId)
    expect(pinnedSkillVersion(newBattleAfterReauthoring, SKILL_ID)).toBe(newVersion)

    const newBattleAfterReauthoringIdentity = battleIdentity(newBattleAfterReauthoring)
    await surrenderBattle(
      page,
      newBattleAfterReauthoringIdentity.battleSessionId,
      newBattleAfterReauthoringIdentity.battleVersion,
    )

    // Real audited publication, reload and manual reauthoring; both responsive editor layouts.
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 768 })
      await page.goto('/master/combat-content')
      const selectGash = async () => {
        await selectContentRecord(page, 'ravager.gash')
        await expectSelectedContentHeading(page, 'Gash')
        await page.getByRole('tab', { name: 'Effects', exact: true }).click()
        const panel = page
          .getByLabel('Damage per tick (% of attack damage)', { exact: true })
          .locator('xpath=ancestor::details[@data-effect-collapsible]')
        if ((await panel.count()) && (await panel.getAttribute('open')) === null)
          await panel.locator(':scope > summary').click()
      }
      await selectGash()
      const gashBaseline = await commitContent(page)
      const oldGashVersion = publishedVersion(gashBaseline)
      const percentage = page.getByLabel('Damage per tick (% of attack damage)', { exact: true })
      const oldPercentage = await percentage.inputValue()
      await percentage.fill('12.34')
      const percentagePublication = await commitContent(page)
      const percentageServices = await verifyAuthoringServices(
        page,
        publishedSnapshot(gashBaseline).definition,
        publishedSnapshot(percentagePublication).definition,
      )
      expect(percentageServices.diff.changedPaths).toContain('effects')
      expect(publishedBleedBasisPoints(percentagePublication)).toBe(1234)
      const percentageVersion = publishedVersion(percentagePublication)
      expect(percentageVersion).toBeGreaterThan(oldGashVersion)
      await page.reload()
      await selectGash()
      expect(await currentContentVersion(page)).toBe(percentageVersion)
      await expect(percentage).toHaveValue('12.34')
      await percentage.scrollIntoViewIfNeeded()
      if (width === 390) {
        const fieldBox = await percentage.boundingBox()
        expect(fieldBox).not.toBeNull()
        await expect(
          page.getByRole('complementary', { name: 'Content previews', exact: true }),
        ).toHaveCount(0)
        expect(fieldBox!.x).toBeGreaterThanOrEqual(0)
        expect(fieldBox!.x + fieldBox!.width).toBeLessThanOrEqual(width)
      }
      await page.screenshot({ path: testInfo.outputPath(`master-percentage-${width}.png`) })
      const gashReauthored = await commitAuthoredBaseline(page, gashBaseline)
      expect(publishedSnapshot(gashReauthored).definition).toEqual({
        ...(publishedSnapshot(gashBaseline).definition as Record<string, unknown>),
        contentVersion: publishedVersion(gashReauthored),
      })
      await page.reload()
      await selectGash()
      await expect(percentage).toHaveValue(oldPercentage)
    }
    // Actual protected Ground and Burn-trigger publication, reload and manual reauthoring.
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
        await page.getByRole('tab', { name: 'Range & Area', exact: true }).click()
      }
      await selectFlame()
      const flameBaseline = await commitContent(page)
      const oldFlameVersion = publishedVersion(flameBaseline)
      const duration = page.getByLabel('Ground duration (rounds)', { exact: true })
      const preset = page.getByLabel('Ground animation', { exact: true })
      await expect(page.getByLabel('Ground activation', { exact: true })).toHaveCount(0)
      const backlash = page.getByLabel('Backlash (% of burning unit’s hostile damage)', {
        exact: true,
      })
      const showBurnParameters = async () => {
        await page.getByRole('tab', { name: 'Effects', exact: true }).click()
        const panel = backlash.locator('xpath=ancestor::details[@data-effect-collapsible]')
        if ((await panel.getAttribute('open')) === null)
          await panel.locator(':scope > summary').click()
        await expect(backlash).toBeVisible()
      }
      const original = {
        duration: await duration.inputValue(),
        preset: await preset.inputValue(),
        backlash: await backlash.inputValue(),
      }
      await duration.fill('4')
      await preset.selectOption('frost')
      await showBurnParameters()
      await backlash.fill('12.34')
      const publication = await commitContent(page)
      const groundServices = await verifyAuthoringServices(
        page,
        publishedSnapshot(flameBaseline).definition,
        publishedSnapshot(publication).definition,
      )
      expect(groundServices.diff.changedPaths).toEqual(
        expect.arrayContaining([
          'groundArea.durationRounds',
          'groundArea.visualPresetId',
          'effects',
        ]),
      )
      expect(groundServices.diff.changedPaths).not.toContain('groundArea.timing')
      expect(groundServices.preview.groundAreas).toEqual(
        expect.arrayContaining([expect.objectContaining({ visualPresetId: 'frost' })]),
      )
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
      expect(await currentContentVersion(page)).toBe(flameVersion)
      await expect(duration).toHaveValue('4')
      await expect(preset).toHaveValue('frost')
      await expect(page.getByLabel('Ground activation', { exact: true })).toHaveCount(0)
      await showBurnParameters()
      await expect(backlash).toHaveValue('12.34')
      await page.getByRole('tab', { name: 'Range & Area', exact: true }).click()
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
      const flameReauthored = await commitAuthoredBaseline(page, flameBaseline)
      expect(publishedSnapshot(flameReauthored).definition).toEqual({
        ...(publishedSnapshot(flameBaseline).definition as Record<string, unknown>),
        contentVersion: publishedVersion(flameReauthored),
      })
      await page.reload()
      await selectFlame()
      await expect(duration).toHaveValue(original.duration)
      await expect(preset).toHaveValue(original.preset)
      await expect(page.getByLabel('Ground activation', { exact: true })).toHaveCount(0)
      await showBurnParameters()
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
      const originalVersion = Number(
        queryLocalDatabase(
          'select max(version) from app_private.battlefield_elevation_policy_versions;',
        ),
      )
      expect(positiveInteger(originalVersion)).toBe(true)
      const submit = editor.getByRole('button', { name: 'Save Changes', exact: true })
      await fields[0].fill('0')
      await fields[1].fill('0')
      await fields[2].fill('99')
      await expect(submit).toBeEnabled()
      await expect(editor).not.toContainText('Total:')
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
            model: 'independent-highest',
            level1BasisPoints: 0,
            level2BasisPoints: 0,
            level3BasisPoints: 10000,
          },
        },
      })
      expect(stale.status()).toBe(409)
      expect(
        queryLocalDatabase(
          `select count(*) from app_private.battlefield_elevation_policy_versions where version = ${publishedBody.policy.version} and published_by = (select id from auth.users where email = '${escapeSqlLiteral(email)}');`,
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
        model: 'independent-highest',
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
    await selectContentRecord(page, 'unarmed.basic', 'basic')
    await page.getByRole('button', { name: 'Skill Details', exact: true }).click()
    await page.getByRole('tab', { name: 'Media', exact: true }).click()
    const panel = page.getByRole('group', { name: /^Artwork and sound/ })
    const input = panel.getByLabel('Upload content media')
    const builtin = panel.getByAltText('Current artwork')
    await expect(builtin).toHaveAttribute('src', '/media/skills/basic-attack-fist.webp')
    await expect
      .poll(() => builtin.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)
    await expect(page.locator('[data-ability-section="media"] legend')).toHaveCount(0)
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
      await panel.getByRole('button', { name: 'Upload file', exact: true }).click()
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
    await expect(builtin).toBeVisible()
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
    await expect(preview).toBeVisible()
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
    await page.getByRole('button', { name: 'Restore default artwork', exact: true }).click()
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

    // Discipline Artwork must route to the same image-only workflow, independent of Details.
    await selectContentRecord(page, 'aetherist', 'discipline')
    const baseline = await commitContent(page)
    try {
      await page.getByRole('button', { name: 'Artwork', exact: true }).click()
      const artwork = page.getByRole('group', { name: 'Artwork', exact: true })
      await expect(artwork).toBeVisible()
      await expect(page.getByRole('group', { name: 'Identity', exact: true })).toHaveCount(0)
      await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0)
      await expect(artwork.getByLabel('Upload content media')).toHaveAttribute(
        'accept',
        'image/png,image/jpeg,image/webp',
      )
      await page.getByRole('button', { name: 'Restore default artwork', exact: true }).click()
      const current = artwork.getByAltText('Current artwork')
      await expect(current).toHaveAttribute(
        'src',
        '/media/art/discipline-sigils/aetherist-sigil-v01.webp',
      )
      await expect
        .poll(() => current.evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBeGreaterThan(0)
      const before = await readContentRecord(page)
      await artwork.getByLabel('Upload content media').setInputFiles(file)
      await expect(artwork.getByLabel('Crop size')).toHaveValue('2')
      await expect(current).toBeVisible()
      await expect(artwork.getByLabel('Actual crop preview')).toBeVisible()
      expect(await readContentRecord(page)).toEqual(before)
      const pending = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/master/combat-content/media',
      )
      await artwork.getByRole('button', { name: 'Upload file', exact: true }).click()
      const finalized = await pending
      expect(finalized.status()).toBe(200)
      const image = (await finalized.json()).media as { id: string }
      const custom = artwork.getByAltText('Finalized artwork crop')
      await expect(custom).toHaveAttribute('src', `/api/master/combat-content/media/${image.id}`)
      await expect
        .poll(() => custom.evaluate((element: HTMLImageElement) => element.naturalWidth))
        .toBe(2)
      expect(await readContentRecord(page)).toEqual(before)
      const committed = publishedSnapshot(await commitContent(page))
      expect(committed.definition).toMatchObject({ media: { artwork: { id: image.id } } })
      await page.reload()
      await selectContentRecord(page, 'aetherist', 'discipline')
      await page.getByRole('button', { name: 'Artwork', exact: true }).click()
      await expect(custom).toHaveAttribute('src', `/api/master/combat-content/media/${image.id}`)
      await expect
        .poll(() => custom.evaluate((element: HTMLImageElement) => element.naturalWidth))
        .toBe(2)
    } finally {
      await commitAuthoredBaseline(page, baseline)
    }
  } finally {
    const escapedEmail = escapeSqlLiteral(email)
    queryLocalDatabase(
      `update app_private.master_panel_role_assignments set enabled=false, updated_at=clock_timestamp() where user_id=(select id from auth.users where email='${escapedEmail}') and role='game-owner'; update app_private.master_panel_access_versions set access_version=access_version+1 where user_id=(select id from auth.users where email='${escapedEmail}');`,
    )
  }
})

test('all five Basics reject retired restoration and retain manually authored versions with truthful provenance', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  // Enumerate all five canonical Basic identities using the executable-source fixture.
  // Playwright's test loader must not compile core's ESM package as CommonJS.
  const basics: BasicSkillDefinition[] = JSON.parse(
    execFileSync(process.execPath, [resolve('scripts/master-originals-fixture.mjs')], {
      encoding: 'utf8',
    }),
  )
  expect(basics).toHaveLength(5)
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
    for (const basic of basics) {
      await selectContentRecord(page, basic.id, 'basic')
      const baselinePublication = await commitContent(page)
      const baselineDefinition = publishedSnapshot(baselinePublication).definition
      if (!isRecord(baselineDefinition) || typeof baselineDefinition.name !== 'string')
        throw new Error('Missing current Basic definition/name.')
      await page.getByRole('button', { name: 'Skill Details', exact: true }).click()
      const name = page.getByRole('textbox', { name: 'Name', exact: true })
      const editedName = `${basic.name} integration ${crypto.randomUUID().slice(0, 8)}`
      await name.fill(editedName)
      const edited = await commitContent(page)
      const editedVersion = publishedVersion(edited)
      expect(editedVersion).toBeGreaterThan(publishedVersion(baselinePublication))
      expect(publishedSnapshot(edited).definition).toMatchObject({ name: editedName })

      const authored = await commitAuthoredBaseline(page, baselinePublication)
      const authoredVersion = publishedVersion(authored)
      expect(authoredVersion).toBeGreaterThan(editedVersion)
      await page.reload()
      await selectContentRecord(page, basic.id, 'basic')
      await expect(name).toHaveValue(baselineDefinition.name)
      await expect(page.getByRole('status', { name: 'Save status', exact: true })).toHaveText(
        'Saved',
      )
      const currentRecord = await readContentRecord(page, basic.id)
      expect(currentRecord.history).toEqual([])
      expect(currentRecord).not.toHaveProperty('builtinRestoreVersion')
      expect(currentRecord.current).toEqual(publishedSnapshot(authored))
      expect(
        queryLocalDatabase(
          `select count(*) from app_private.combat_content_versions where content_key='${escapeSqlLiteral(basic.id)}' and content_version=${editedVersion};`,
        ),
      ).toBe('1')
      await page.screenshot({
        path: testInfo.outputPath(`master-basic-authored-${basic.id}.png`),
        fullPage: true,
      })
    }
  } finally {
    queryLocalDatabase(
      `update app_private.master_panel_role_assignments set enabled=false where user_id=(select id from auth.users where email='${escapeSqlLiteral(email)}') and role='game-owner';`,
    )
  }
})
