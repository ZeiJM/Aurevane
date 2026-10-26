import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

it('lets the server read and CAS-update music while browser roles cannot access it', async () => {
  const db = await PGlite.create()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`)
    const directory = resolve(process.cwd(), '../../supabase/migrations')
    for (const name of readdirSync(directory)
      .filter((name) => name.includes('_site_music_'))
      .sort())
      await db.exec(readFileSync(resolve(directory, name), 'utf8'))
    const before = (
      await db.query<Record<string, unknown>>('select * from public.site_music_configuration')
    ).rows
    await db.exec('set role service_role')
    expect((await db.query('select revision from public.site_music_configuration')).rows).toEqual([
      { revision: 1 },
    ])
    expect(
      (
        await db.query(`update public.site_music_configuration set enabled=false,revision=2
        where singleton_id=true and revision=1 returning revision,enabled`)
      ).rows,
    ).toEqual([{ revision: 2, enabled: false }])
    expect(
      (
        await db.query(`update public.site_music_configuration set enabled=true,revision=3
        where singleton_id=true and revision=1 returning revision`)
      ).rows,
    ).toEqual([])
    await expect(db.exec('delete from public.site_music_configuration')).rejects.toThrow(
      'permission denied',
    )
    await db.exec('reset role')
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await expect(db.query('select * from public.site_music_configuration')).rejects.toThrow(
        'permission denied',
      )
      await expect(
        db.exec('update public.site_music_configuration set enabled=true'),
      ).rejects.toThrow('permission denied')
      await db.exec('reset role')
    }
    const after = (await db.query('select * from public.site_music_configuration')).rows
    expect(after).toEqual(before.map((row) => ({ ...row, enabled: false, revision: 2 })))
    expect(
      (
        await db.query(
          `select relrowsecurity from pg_class where oid='public.site_music_configuration'::regclass`,
        )
      ).rows,
    ).toEqual([{ relrowsecurity: true }])
  } finally {
    await db.close()
  }
})

it('backfills every existing assigned song and stores unused songs under unchanged server-only CAS privileges', async () => {
  const db = await PGlite.create()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`)
    const directory = resolve(process.cwd(), '../../supabase/migrations')
    const migrations = readdirSync(directory)
      .filter((name) => name.includes('_site_music_'))
      .sort()
    for (const name of migrations.filter((name) => !name.includes('reusable_site_music_library')))
      await db.exec(readFileSync(resolve(directory, name), 'utf8'))
    const original = { label: 'Existing global', url: '/global.webm', source: 'url', loop: true }
    const page = { ...original, label: 'Existing page', url: '/page.webm' }
    await db.query(
      'update public.site_music_configuration set default_track=$1,route_overrides=$2',
      [
        original,
        [
          { id: 'world', label: 'World', pathPrefix: '/game/world', enabled: false, track: page },
          { id: 'other', label: 'Other', pathPrefix: '/other', enabled: true, track: page },
        ],
      ],
    )
    for (const name of migrations.filter((name) => name.includes('reusable_site_music_library')))
      await db.exec(readFileSync(resolve(directory, name), 'utf8'))
    expect(
      (await db.query('select song_library from public.site_music_configuration')).rows,
    ).toEqual([{ song_library: [original, page] }])
    const spare = { ...original, label: 'Saved for later', url: '/later.webm' }
    await db.exec('set role service_role')
    expect(
      (
        await db.query(
          'update public.site_music_configuration set song_library=$1,revision=revision+1 where revision=1 returning song_library,default_track',
          [[original, page, spare]],
        )
      ).rows,
    ).toEqual([{ song_library: [original, page, spare], default_track: original }])
    expect(
      (
        await db.query(
          'update public.site_music_configuration set song_library=$1 where revision=1 returning revision',
          [[]],
        )
      ).rows,
    ).toEqual([])
    await expect(
      db.query('update public.site_music_configuration set song_library=$1', [{}]),
    ).rejects.toThrow(/check constraint/)
    await db.exec('reset role')
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await expect(
        db.query('select song_library from public.site_music_configuration'),
      ).rejects.toThrow('permission denied')
      await expect(
        db.query('update public.site_music_configuration set song_library=$1', [[]]),
      ).rejects.toThrow('permission denied')
      await db.exec('reset role')
    }
  } finally {
    await db.close()
  }
})
