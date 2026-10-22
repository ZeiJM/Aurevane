import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

// Real local Supabase producers + application routes/UI. No route mocks or hosted URL.
test('shared Skill eligibility persists through the actual route and refresh, without earning testing access', async ({
  page,
}, testInfo) => {
  const containers = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
  expect(containers).toHaveLength(1)
  const container = containers[0]!
  const sql = (query: string) =>
    execFileSync(
      'docker',
      [
        'exec',
        container,
        'psql',
        '-X',
        '-qAt',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-c',
        query,
      ],
      { encoding: 'utf8' },
    ).trim()
  const token = Date.now()
    .toString()
    .split('')
    .map((n) => String.fromCharCode(65 + Number(n)))
    .join('')
  const { userId } = await provisionAccountAndEnterCharacter({
    page,
    email: `stage-b-${testInfo.project.name}-${Date.now()}@example.test`,
    password: 'Stage-B-native-browser-2026!',
    characterName: `Scholar ${token}`,
  })
  expect(['localhost', '127.0.0.1']).toContain(new URL(page.url()).hostname)
  const characterId = sql(`select id from public.characters where user_id='${userId}'`)
  expect(characterId).toMatch(/^[0-9a-f-]{36}$/)
  // Existing retained Skill and exact learned version; no publication or rebalance.
  const skill = JSON.parse(
    sql(
      "select row_to_json(s) from (select skill_id,content_version from app_private.phase4_skill_catalog where discipline_id='lifebinder' and skill_id='lifebinder.barrier') s",
    ),
  ) as { skill_id: string; content_version: number }
  sql(
    `select app_private.grant_discipline_skill_v1('${characterId}','${skill.skill_id}',${skill.content_version},'lifebinder','vanguard','support','discipline-testing-open:v1',false)`,
  )
  sql(
    `select * from public.record_character_discipline_mastery_v1('${characterId}','lifebinder','owner','native-shared-browser')`,
  )
  sql(
    `select app_private.grant_discipline_skill_v1('${characterId}','${skill.skill_id}',${skill.content_version},'lifebinder','lifebinder','gameplay','native-earned-source',true)`,
  )
  const version = sql(
    `select build_version from app_private.character_active_builds where character_id='${characterId}'`,
  )
  sql(
    `select * from public.change_character_disciplines_v3('${userId}','${characterId}',${version},false,null,true,'lifebinder',gen_random_uuid(),'native-shared-secondary')`,
  )
  await page.goto('/game/nexus')
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const picker = page.getByRole('combobox', {
    name: 'Eligible Discipline for Barrier',
    exact: true,
  })
  await expect(picker).toHaveCount(1)
  await picker.selectOption('vanguard')
  await expect(picker).toContainText('Available (unearned)')
  const saved = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/character/build/skills' && r.request().method() === 'PUT',
  )
  await page.getByRole('checkbox', { name: 'Select Barrier', exact: true }).check()
  const response = await saved
  expect(response.ok()).toBe(true)
  expect(response.request().postDataJSON().eligibilitySelections).toContainEqual({
    skillId: skill.skill_id,
    eligibilityDisciplineId: 'vanguard',
  })
  await page.reload()
  await expect(
    page.getByRole('combobox', { name: 'Eligible Discipline for Barrier', exact: true }),
  ).toHaveValue('vanguard')
  await expect(page.getByRole('checkbox', { name: 'Unselect Barrier', exact: true })).toBeChecked()
  const facts = JSON.parse(
    sql(`select public.get_character_committed_build_snapshot_v2('${userId}','${characterId}')`),
  )
  expect(facts.disciplineSkills).toContainEqual(
    expect.objectContaining({
      skillId: skill.skill_id,
      sourceDisciplineId: 'lifebinder',
      eligibilityDisciplineId: 'vanguard',
      earnedEligibility: false,
    }),
  )
  const changed = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/character/build/skills' && r.request().method() === 'PUT',
  )
  await page
    .getByRole('combobox', { name: 'Eligible Discipline for Barrier', exact: true })
    .selectOption('lifebinder')
  expect((await changed).ok()).toBe(true)
  await page.reload()
  await expect(
    page.getByRole('combobox', { name: 'Eligible Discipline for Barrier', exact: true }),
  ).toHaveValue('lifebinder')
  const selected = JSON.parse(
    sql(`select public.get_character_committed_build_snapshot_v2('${userId}','${characterId}')`),
  )
  expect(selected.disciplineSkills).toContainEqual(
    expect.objectContaining({
      skillId: skill.skill_id,
      eligibilityDisciplineId: 'lifebinder',
      earnedEligibility: true,
    }),
  )
  const restored = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/character/build/skills' && r.request().method() === 'PUT',
  )
  await page
    .getByRole('combobox', { name: 'Eligible Discipline for Barrier', exact: true })
    .selectOption('vanguard')
  expect((await restored).ok()).toBe(true)
  sql(
    `select app_private.grant_discipline_skill_v1('${characterId}','${skill.skill_id}',${skill.content_version},'lifebinder','vanguard','gameplay','native-earned-upgrade',true)`,
  )
  await page.reload()
  await expect(
    page.getByRole('combobox', { name: 'Eligible Discipline for Barrier', exact: true }),
  ).toContainText('Earned')
  await expect(page.getByRole('checkbox', { name: 'Unselect Barrier', exact: true })).toBeChecked()
})
