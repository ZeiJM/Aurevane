import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from 'vitest'
import { latestEnabledMatureSkills } from '../../game-core/src/combat/mature-skills'
import { currentEssenceDefinitions } from '../../game-core/src/combat/essence'
const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const character = '00000000-0000-4000-8000-000000000011'
let db: PGlite
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()),('${other}','other@example.test',now());
    insert into app_private.master_panel_role_assignments(user_id,role) values('${owner}','game-owner');
    insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
    values('${character}','${other}',0,1,'Test Player','test-player','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
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
// Canonical 1-frame PCM16 WAV; actual byte checks and persistence execute in SQL.
const wav = Buffer.from(
  '524946462600000057415645666d7420100000000100010044ac0000885801000200100064617461020000000000',
  'hex',
)
const descriptor = {
  kind: 'audio',
  contentType: 'audio/wav',
  byteLength: wav.length,
  checksum: 'unused',
  durationMs: 1000 / 44100,
  channels: 1,
  sampleRate: 44100,
}
async function finalize(user = owner, overrides: Record<string, unknown> = {}) {
  return (
    await db.query<{ media: Record<string, unknown> }>(
      'select public.finalize_combat_content_media_v1($1,null,$2,$3) media',
      [user, wav, { ...descriptor, ...overrides }],
    )
  ).rows[0]!.media
}
it('finalizes actual bytes with server checksum and rejects forged type/size/ownership', async () => {
  const media = await finalize()
  expect(media).toMatchObject({ kind: 'audio', byteLength: 46, contentType: 'audio/wav' })
  expect(media.checksum).toMatch(/^[a-f0-9]{64}$/)
  expect(media.checksum).not.toBe('unused')
})
it('has no browser or direct service-role write shortcut', async () => {
  const acl = (
    await db.query<{ browser: boolean; direct: boolean; rls: boolean }>(`select
    has_function_privilege('authenticated','public.finalize_combat_content_media_v1(uuid,uuid,bytea,jsonb)','execute') browser,
    has_table_privilege('service_role','app_private.combat_content_media','insert,update,delete') direct,
    (select relrowsecurity from pg_class where oid='app_private.combat_content_media'::regclass) rls`)
  ).rows[0]!
  expect(acl).toEqual({ browser: false, direct: false, rls: true })
})
it('rejects unprivileged finalization at actual capability boundary', async () => {
  await expect(finalize(other)).rejects.toThrow(/MASTER_PANEL|FORBIDDEN|CAPABILITY/)
})
it('rejects false image metadata for WAV bytes', async () => {
  await expect(finalize(owner, { kind: 'image', contentType: 'image/png' })).rejects.toThrow(
    /MEDIA/,
  )
})
it('does not expose finalized but unpublished bytes', async () => {
  const media = await finalize()
  const result = (
    await db.query<{ media: unknown }>(
      'select public.read_published_combat_content_media_v1($1) media',
      [media.id],
    )
  ).rows[0]!
  expect(result.media).toBeNull()
})
it.each(['skill', 'essence'] as const)(
  'commits finalized image bytes on an existing canonical %s and reloads its exact media',
  async (kind) => {
    const key = `${kind}.media-commit-regression`
    const skill = structuredClone(latestEnabledMatureSkills()[0]!)
    const essence = structuredClone(currentEssenceDefinitions()[0]!)
    const definition =
      kind === 'skill'
        ? { ...skill, id: key }
        : { ...essence, essenceId: key, skill: { ...essence.skill, id: key } }
    let record = await writeMedia(key, {
      action: 'create',
      requestId: crypto.randomUUID(),
      contentKind: kind,
      definition,
    })
    record = await publishMedia(key, record)
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWNg+A+FMAYAQ84H+QDi4rkAAAAASUVORK5CYII=',
      'base64',
    )
    const artwork = (
      await db.query<{ media: Record<string, unknown> }>(
        'select public.finalize_combat_content_media_v1($1,null,$2,$3) media',
        [
          owner,
          png,
          {
            kind: 'image',
            contentType: 'image/png',
            width: 2,
            height: 2,
            sourceWidth: 4,
            sourceHeight: 2,
            crop: { x: 1, y: 0, size: 2 },
          },
        ],
      )
    ).rows[0]!.media
    const withImage =
      kind === 'skill'
        ? { ...definition, media: { ...skill.media, artwork } }
        : {
            ...definition,
            skill: { ...essence.skill, id: key, media: { ...essence.skill.media, artwork } },
          }
    const token = (
      await db.query<{ token: string }>(
        'select public.read_combat_content_catalogue_token_v1() token',
      )
    ).rows[0]!.token
    await db.query('select public.commit_combat_content_record_v1($1,null,$2,$3,$4,$5,1)', [
      owner,
      key,
      record.revision,
      withImage,
      token,
    ])
    const reloaded = (
      await db.query<{
        value: {
          draft: unknown
          current: { definition: { media?: unknown; skill?: { media: unknown } } }
        }
      }>('select public.read_combat_content_record_v1($1,null,$2) value', [owner, key])
    ).rows[0]!.value
    expect(reloaded.draft).toBeNull()
    expect(
      kind === 'skill'
        ? reloaded.current.definition.media
        : reloaded.current.definition.skill?.media,
    ).toMatchObject({ artwork })
    const published = (
      await db.query<{ media: { descriptor: unknown; bytes: string } }>(
        'select public.read_published_combat_content_media_v1($1) media',
        [artwork.id],
      )
    ).rows[0]!.media
    expect(published.descriptor).toEqual(artwork)
    expect(Buffer.from(published.bytes, 'base64')).toEqual(png)
  },
)
interface Saved {
  revision: number
  draft: { draftVersion: number; baseVersion: number | null }
  current: { contentVersion: number }
  history: { contentVersion: number }[]
}
async function writeMedia(key: string, command: Record<string, unknown>) {
  return (
    await db.query<{ value: Saved }>(
      'select public.write_combat_content_record_v1($1,null,$2,$3) value',
      [owner, key, command],
    )
  ).rows[0]!.value
}
async function publishMedia(key: string, saved: Saved) {
  const token = (
    await db.query<{ token: string }>(
      "select public.read_combat_content_catalogue_v1()->>'token' token",
    )
  ).rows[0]!.token
  return (
    await db.query<{ value: Saved }>(
      'select public.publish_saved_combat_content_v1($1,null,$2,$3,$4,$5,null) value',
      [owner, key, saved.draft.draftVersion, saved.draft.baseVersion, token],
    )
  ).rows[0]!.value
}
it('real finalize → save → publish → exact reader retains media deeper than display history after replacement/removal', async () => {
  const media = await finalize()
  expect(
    (
      await db.query<{ equal: boolean }>(
        'select descriptor=$1::jsonb equal from app_private.combat_content_media where id=$2',
        [media, media.id],
      )
    ).rows[0]!.equal,
  ).toBe(true)
  const key = 'content.media-test'
  const definition = {
    id: key,
    contentVersion: 1,
    sourceDisciplineId: 'vanguard',
    name: 'Media test',
    description: 'Test',
    media: { audio: media },
  }
  let saved = await writeMedia(key, {
    action: 'create',
    requestId: '00000000-0000-4000-8000-000000000070',
    contentKind: 'skill',
    definition,
  })
  expect(
    (
      await db.query<{ media: unknown }>(
        'select public.read_published_combat_content_media_v1($1) media',
        [media.id],
      )
    ).rows[0]!.media,
  ).toBeNull()
  saved = await publishMedia(key, saved)
  const firstVersion = saved.current.contentVersion
  for (let i = 0; i < 4; i++) {
    const replacement = i === 0 ? await finalize() : null
    saved = await writeMedia(key, {
      action: 'save',
      expectedRevision: saved.revision,
      definition: { ...definition, media: replacement ? { audio: replacement } : {} },
    })
    saved = await publishMedia(key, saved)
  }
  expect(saved.history.some((v) => v.contentVersion === firstVersion)).toBe(false)
  const exact = (
    await db.query<{ value: { definition: typeof definition } }>(
      "select row_to_json(v) value from public.read_combat_content_version_v1($1,'skill',$2) v",
      [key, firstVersion],
    )
  ).rows[0]!.value
  expect(exact.definition.media.audio).toEqual(media)
  const retained = (
    await db.query<{ media: { descriptor: unknown; bytes: string } }>(
      'select public.read_published_combat_content_media_v1($1) media',
      [media.id],
    )
  ).rows[0]!.media
  expect(retained.descriptor).toEqual(media)
  expect(Buffer.from(retained.bytes, 'base64')).toEqual(wav)
  await expect(
    db.query('delete from app_private.combat_content_media where id=$1', [media.id]),
  ).rejects.toThrow(/IMMUTABLE/)
})
it('real saved-record write rejects forged finalized descriptors atomically', async () => {
  const media = await finalize()
  await expect(
    writeMedia('content.forged-media', {
      action: 'create',
      requestId: '00000000-0000-4000-8000-000000000071',
      contentKind: 'skill',
      definition: {
        id: 'content.forged-media',
        contentVersion: 1,
        sourceDisciplineId: 'vanguard',
        media: { audio: { ...media, checksum: 'f'.repeat(64) } },
      },
    }),
  ).rejects.toThrow(/MEDIA_REFERENCE_INVALID/)
})
it('publishes canonical Tag wording and retains exact Skill publication snapshots after Tag changes', async () => {
  const tag = {
    schemaVersion: 1,
    id: 'tag.damage',
    contentVersion: 1,
    tagId: 'damage',
    name: 'Impact',
    description: 'Relative power.',
    explanation: 'Damage uses power, not exact HP.',
    sortOrder: 0,
    enabled: true,
    media: {},
  }
  const existing = (
    await db.query<{ value: Saved }>(
      'select public.read_combat_content_record_v1($1,null,$2) value',
      [owner, tag.id],
    )
  ).rows[0]!.value
  let tagSaved = await writeMedia(tag.id, {
    action: 'save',
    expectedRevision: existing.revision,
    definition: tag,
  })
  tagSaved = await publishMedia(tag.id, tagSaved)
  const skill = {
    id: 'content.tag-test',
    contentVersion: 1,
    sourceDisciplineId: 'vanguard',
    media: {},
    ability: {
      schemaVersion: 1,
      behaviors: [{ effects: [{ payload: { type: 'damage', amount: 10 } }] }],
    },
  }
  let saved = await writeMedia(skill.id, {
    action: 'create',
    requestId: '00000000-0000-4000-8000-000000000081',
    contentKind: 'skill',
    definition: skill,
  })
  saved = await publishMedia(skill.id, saved)
  const exact = async () =>
    (
      await db.query<{ definition: { ability: { tagPresentation: unknown[] } } }>(
        "select definition from public.read_combat_content_version_v1($1,'skill',$2)",
        [skill.id, saved.current.contentVersion],
      )
    ).rows[0]!.definition
  const first = await exact()
  expect(first.ability.tagPresentation).toEqual([
    {
      contentKey: 'tag.damage',
      contentVersion: tagSaved.current.contentVersion,
      tagId: 'damage',
      name: 'Impact',
      compact: 'Relative power.',
      full: 'Damage uses power, not exact HP.',
    },
  ])
  const beforeTagToken = (
    await db.query<{ token: string }>(
      "select public.read_combat_content_catalogue_v1()->>'token' token",
    )
  ).rows[0]!.token
  tagSaved = await writeMedia(tag.id, {
    action: 'save',
    expectedRevision: tagSaved.revision,
    definition: { ...tag, name: 'Force' },
  })
  await publishMedia(tag.id, tagSaved)
  expect(await exact()).toEqual(first)
  const afterTagToken = (
    await db.query<{ token: string }>(
      "select public.read_combat_content_catalogue_v1()->>'token' token",
    )
  ).rows[0]!.token
  expect(afterTagToken).not.toBe(beforeTagToken)
  await db.exec('savepoint forged_tag')
  await expect(
    writeMedia('content.tag-forged', {
      action: 'create',
      requestId: '00000000-0000-4000-8000-000000000083',
      contentKind: 'skill',
      definition: {
        ...skill,
        id: 'content.tag-forged',
        ability: {
          ...skill.ability,
          tagPresentation: [
            {
              ...(first.ability.tagPresentation[0] as Record<string, unknown>),
              name: 'Forged wording',
            },
          ],
        },
      },
    }),
  ).rejects.toThrow(/TAG/)
  await db.exec('rollback to savepoint forged_tag')
  const unchanged = await writeMedia(skill.id, {
    action: 'save',
    expectedRevision: saved.revision,
    definition: first,
  })
  await expect(
    db.query('select public.publish_saved_combat_content_v1($1,null,$2,$3,$4,$5,null)', [
      owner,
      skill.id,
      unchanged.draft.draftVersion,
      unchanged.draft.baseVersion,
      beforeTagToken,
    ]),
  ).rejects.toThrow(/CATALOGUE/)
})
it('rejects unsupported Tag handlers at actual writes', async () => {
  const tag = {
    schemaVersion: 1,
    id: 'tag.invented',
    contentVersion: 1,
    tagId: 'invented',
    name: 'Invented',
    description: 'No handler.',
    explanation: 'No handler.',
    sortOrder: 0,
    enabled: true,
    media: {},
  }
  await expect(
    writeMedia(tag.id, {
      action: 'create',
      requestId: '00000000-0000-4000-8000-000000000082',
      contentKind: 'tag',
      definition: tag,
    }),
  ).rejects.toThrow(/TAG/)
})

it('denies browser and direct service invocation of every private Tag helper', async () => {
  const { rows } = await db.query<{
    name: string
    service: boolean
    browser: boolean
    anon: boolean
  }>(
    `select p.proname name, has_function_privilege('service_role',p.oid,'execute') service, has_function_privilege('authenticated',p.oid,'execute') browser, has_function_privilege('anon',p.oid,'execute') anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname=any(array['content_tag_snapshot_v1','bind_content_tag_presentation_v1','validate_content_tag_presentation_v1'])`,
  )
  expect(rows).toHaveLength(3)
  for (const row of rows) expect(row).toMatchObject({ service: false, browser: false, anon: false })
})

it.each([
  ['tag.damage', 'x'.repeat(4000)],
  ['tag.00000000-0000-4000-8000-000000000093', 'Relative power.'],
])(
  'retains the original Tag draft envelope at %s but rejects noncanonical SQL publication',
  async (id, description) => {
    const existing = (
      await db.query<{ value: Saved | null }>(
        'select public.read_combat_content_record_v1($1,null,$2) value',
        [owner, id],
      )
    ).rows[0]!.value
    const saved = await writeMedia(id, {
      ...(existing
        ? { action: 'save', expectedRevision: existing.revision }
        : {
            action: 'create',
            requestId: '00000000-0000-4000-8000-000000000093',
            contentKind: 'tag',
          }),
      definition: {
        schemaVersion: 1,
        id,
        contentVersion: 1,
        tagId: 'damage',
        name: 'Impact',
        description,
        explanation: 'Damage uses relative power.',
        sortOrder: 0,
        enabled: true,
        media: {},
      },
    })
    expect(saved.revision).toBe(existing ? existing.revision + 1 : 1)
    await expect(publishMedia(id, saved)).rejects.toThrow(/CONTENT_TAG_(ID|TEXT)_INVALID/u)
  },
)
it('canonical Tag trigger boundaries retain their private ACLs on drafts and immutable versions', async () => {
  expect(
    (
      await db.query(
        `select has_function_privilege('authenticated','app_private.validate_content_tag_presentation_v1()','execute') browser, has_function_privilege('service_role','app_private.validate_content_tag_presentation_v1()','execute') service`,
      )
    ).rows,
  ).toEqual([{ browser: false, service: false }])
  expect(
    (
      await db.query(
        "select tgname from pg_trigger where tgname in ('combat_content_draft_tag_presentation','combat_content_version_tag_presentation') order by tgname",
      )
    ).rows,
  ).toEqual([
    { tgname: 'combat_content_draft_tag_presentation' },
    { tgname: 'combat_content_version_tag_presentation' },
  ])
})
