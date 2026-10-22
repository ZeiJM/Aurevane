import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from 'vitest'
const root = resolve(process.cwd(), '../../supabase/migrations')
const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const character = '00000000-0000-4000-8000-000000000011'
let db: PGlite
beforeAll(async () => {
  db = await PGlite.create()
  // Only Supabase's platform identity and unavailable scheduler are fixtures.
  // Every Aurevane table, authorization function, producer and finalizer is real migration SQL.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,created_at timestamptz default now());
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create schema realtime; create table realtime.messages(extension text,topic text,payload jsonb);
    create function realtime.topic() returns text language sql as $$ select null::text $$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$ insert into realtime.messages values($2,$3,$1) $$;
    create schema cron; create table cron.job(jobid bigint generated always as identity,jobname text);
    create function cron.schedule(text,text,text) returns bigint language sql as $$ insert into cron.job(jobname) values($1) returning jobid $$;
    create function cron.unschedule(bigint) returns boolean language sql as $$ delete from cron.job where jobid=$1 returning true $$;`)
  for (const name of readdirSync(root)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    // PGlite has no LZ4 codec; this storage-only setting does not alter authority.
    const sql = readFileSync(resolve(root, name), 'utf8')
      .replace(/create extension if not exists pg_cron(?: with schema pg_catalog)?;/gi, '')
      .replace(/set compression lz4/gi, 'set compression pglz')
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(`Migration ${name}: ${String(error)}`, { cause: error })
    }
  }
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
  let tagSaved = await writeMedia(tag.id, {
    action: 'create',
    requestId: '00000000-0000-4000-8000-000000000080',
    contentKind: 'tag',
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
  tagSaved = await writeMedia(tag.id, {
    action: 'save',
    expectedRevision: tagSaved.revision,
    definition: { ...tag, name: 'Force' },
  })
  await publishMedia(tag.id, tagSaved)
  expect(await exact()).toEqual(first)
})
it('rejects unsupported Tag handlers and forged exact Tag snapshot metadata at actual writes', async () => {
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
