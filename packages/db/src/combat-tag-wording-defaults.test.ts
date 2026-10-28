import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import { defaultCombatTagDefinitions } from '../../game-core/src/combat/combat-tag-wording'
import {
  COMBAT_PRESENTATION_TAG_IDS,
  SUPPORTED_COMBAT_STATUS_IDS,
  combatEffectPresentationId,
} from '../../game-core/src/combat/combat-effect-identities'
import {
  createAuthorableEffectPayload,
  AUTHORABLE_EFFECT_TAGS,
} from '../../game-core/src/combat/combat-effect-authoring'
import { resolveMatureSkillVersion } from '../../game-core/src/combat/mature-skills'
import { defaultBasicSkills } from '../../game-core/src/combat/combat-basic-actions'

const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const migration = '20261028060810_master_effect_tag_wording_defaults.sql'
const preserved = {
  ...defaultCombatTagDefinitions().find((row) => row.tagId === 'damage')!,
  contentVersion: 5,
  description: 'Existing battle wording.',
  explanation: 'Existing full wording.',
}
let db: PGlite
let previousVersionCount: number
beforeAll(async () => {
  db = await createCombatContentTestDatabase(async (database, name) => {
    if (name !== migration) return
    await database.exec(`insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()),('${other}','other@example.test',now());
      insert into app_private.combat_content_records(content_key,content_kind,lifecycle,revision,version_floor)
      values('tag.damage','tag','active',7,5);`)
    await database.query(
      `insert into app_private.combat_content_versions(id,content_key,content_kind,content_version,definition,published_by)
      values('00000000-0000-4000-8000-000000000099','tag.damage','tag',5,$1::jsonb,$2)`,
      [JSON.stringify(preserved), owner],
    )
    await database.query(
      `insert into app_private.combat_content_publications(content_key,content_kind,version_id,updated_by)
      values('tag.damage','tag','00000000-0000-4000-8000-000000000099',$1)`,
      [owner],
    )
    previousVersionCount = (
      await database.query<{ n: number }>(
        'select count(*)::integer n from app_private.combat_content_versions',
      )
    ).rows[0]!.n
  })
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [owner],
  )
}, 60000)
afterAll(async () => {
  await db?.close()
})
beforeEach(async () => {
  await db.exec('begin')
})
afterEach(async () => {
  await db.exec('rollback')
})

async function read(key: string, user = owner) {
  return (
    await db.query<{
      value: {
        revision: number
        builtin: { contentVersion: number }
        current: { contentVersion: number; definition: unknown } | null
        history: unknown[]
      }
    }>('select public.read_combat_content_record_v1($1,null,$2) value', [user, key])
  ).rows[0]!.value
}
async function commit(key: string, revision: number, definition: unknown) {
  const token = (
    await db.query<{ token: string }>(
      "select public.read_combat_content_catalogue_v1()->>'token' token",
    )
  ).rows[0]!.token
  return (
    await db.query<{ value: { revision: number; current: { contentVersion: number } } }>(
      'select public.commit_combat_content_record_v1($1,null,$2,$3,$4::jsonb,$5,1) value',
      [owner, key, revision, JSON.stringify(definition), token],
    )
  ).rows[0]!.value
}

it('seeds only tag metadata and preserves an existing publication, floor and revision', async () => {
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::integer n from app_private.combat_content_records where content_kind='tag' and builtin_version=1",
      )
    ).rows[0]!.n,
  ).toBe(defaultCombatTagDefinitions().length)
  expect(
    (
      await db.query<{ n: number }>(
        'select count(*)::integer n from app_private.combat_content_versions',
      )
    ).rows[0]!.n,
  ).toBe(previousVersionCount)
  const original = await read('tag.damage')
  expect(original.revision).toBe(7)
  expect(original.current?.contentVersion).toBe(5)
  expect(original.current?.definition).toEqual(preserved)
})

it('opens generated tag defaults without creating a draft or immutable version', async () => {
  const result = await read('tag.copy-buffs')
  expect(result.builtin.contentVersion).toBe(1)
  expect(result.current).toBeNull()
  expect(result.history).toEqual([])
})

it('uses existing atomic publication and no-op/revision protection for individual wording', async () => {
  const definition = {
    ...defaultCombatTagDefinitions().find((row) => row.tagId === 'copy-buffs')!,
    description: 'Copy positive effects.',
    explanation: 'Copy eligible positive effects from the selected unit.',
  }
  const saved = await commit(definition.id, 1, definition)
  expect(saved.current.contentVersion).toBe(2)
  const repeated = await commit(definition.id, saved.revision, definition)
  expect(repeated).toEqual(saved)
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::integer n from app_private.combat_content_versions where content_key='tag.copy-buffs'",
      )
    ).rows[0]!.n,
  ).toBe(1)
  await expect(
    commit(definition.id, 1, { ...definition, description: 'Stale text.' }),
  ).rejects.toMatchObject({ code: 'PT409' })
})

it('retains private RPC authorization for tag metadata', async () => {
  await expect(read('tag.copy-buffs', other)).rejects.toMatchObject({ code: '42501' })
})

it('keeps the SQL presentation identity vocabulary equal to the engine variants and retained removals', async () => {
  const ids = (
    await db.query<{ ids: string[] }>('select app_private.content_presentation_tag_ids_v1() ids')
  ).rows[0]!.ids
  expect([...ids].sort()).toEqual([...COMBAT_PRESENTATION_TAG_IDS].sort())
  const payloads = AUTHORABLE_EFFECT_TAGS.flatMap((tag) => {
    const payload = createAuthorableEffectPayload(tag.id)
    return payload ? [payload] : []
  })
  for (const statusId of SUPPORTED_COMBAT_STATUS_IDS)
    for (const specified of [true, false])
      payloads.push({
        type: 'remove-status',
        recipient: 'actor',
        statusIds: [statusId],
        ...(specified ? { removalMode: 'specified' as const } : {}),
      })
  const rows = await db.query<{ id: string }>(
    `select app_private.content_effect_presentation_id_v1(value) id
    from jsonb_array_elements($1::jsonb)`,
    [JSON.stringify(payloads)],
  )
  expect(rows.rows.map((row) => row.id)).toEqual(payloads.map(combatEffectPresentationId))
})

it('rejects unregistered placeholders through the database publication boundary', async () => {
  const definition = {
    ...defaultCombatTagDefinitions().find((row) => row.tagId === 'copy-buffs')!,
    explanation: 'Run {unknown}.',
  }
  await expect(commit(definition.id, 1, definition)).rejects.toMatchObject({ code: '22023' })
})

it.each([true, false])(
  'captures exact gameplay descriptions in a real Skill publication (canonical %s) and retains them after tag edits',
  async (canonical) => {
    const tag = defaultCombatTagDefinitions().find((row) => row.tagId === 'copy-buffs')!
    const firstWords = {
      ...tag,
      description: 'Original short text.',
      explanation: 'Original full text.',
    }
    const publishedTag = await commit(tag.id, 1, firstWords)
    const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability
      .behaviors[0]!
    const definition = {
      ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
      id: 'skill.00000000-0000-4000-8000-000000000099',
      contentVersion: 1,
      ...(canonical
        ? {
            ability: {
              schemaVersion: 1,
              behaviors: [
                {
                  ...base,
                  effects: [
                    {
                      id: 'copy',
                      payload: {
                        type: 'copy-statuses',
                        recipient: 'primary-unit',
                        mode: 'amplify',
                      },
                    },
                  ],
                },
              ],
            },
          }
        : { effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' }] }),
    }
    const created = (
      await db.query<{ value: { revision: number } }>(
        'select public.write_combat_content_record_v1($1,null,$2,$3::jsonb) value',
        [
          owner,
          definition.id,
          JSON.stringify({
            action: 'create',
            requestId: '00000000-0000-4000-8000-000000000098',
            contentKind: 'skill',
            definition,
          }),
        ],
      )
    ).rows[0]!.value
    const publishedSkill = await commit(definition.id, created.revision, definition)
    const exact = async () =>
      (
        await db.query<{
          definition: {
            ability?: { tagPresentation: { tagId: string; full: string }[] }
            tagPresentation?: { tagId: string; full: string }[]
          }
        }>("select definition from public.read_combat_content_version_v1($1,'skill',$2)", [
          definition.id,
          publishedSkill.current.contentVersion,
        ])
      ).rows[0]!.definition
    const first = await exact()
    expect(canonical ? first.ability!.tagPresentation : first.tagPresentation).toEqual([
      expect.objectContaining({ tagId: 'copy-buffs', full: 'Original full text.' }),
    ])
    await commit(tag.id, publishedTag.revision, {
      ...firstWords,
      explanation: 'Updated full text.',
    })
    expect(await exact()).toEqual(first)
  },
)

it('binds the same immutable tag snapshot through native Essence and both Resonance packet shapes', async () => {
  const tag = defaultCombatTagDefinitions().find((row) => row.tagId === 'barrier')!
  await commit(tag.id, 1, { ...tag, explanation: 'Captured Barrier.' })
  const effects = [{ type: 'barrier-change', recipient: 'actor', amount: 5 }]
  const nested = {
    essence: {
      id: 'native.essence',
      contentVersion: 1,
      skill: { id: 'native.essence', contentVersion: 1, effects },
    },
    resonance: { id: 'native.resonance', contentVersion: 2, trigger: { resultEffects: effects } },
    oldResonance: {
      id: 'native.resonance',
      contentVersion: 1,
      trigger: { payoffEffects: effects },
    },
  }
  const { rows } = await db.query<{
    value: {
      essence: { skill: { tagPresentation?: unknown[] } }
      resonance: { tagPresentation?: unknown[] }
      oldResonance: { tagPresentation?: unknown[] }
    }
  }>('select app_private.bind_content_tag_presentation_v1($1::jsonb,true,0) value', [
    JSON.stringify(nested),
  ])
  for (const row of [
    rows[0]!.value.essence.skill,
    rows[0]!.value.resonance,
    rows[0]!.value.oldResonance,
  ])
    expect(row.tagPresentation).toEqual([
      expect.objectContaining({ tagId: 'barrier', full: 'Captured Barrier.' }),
    ])
})
