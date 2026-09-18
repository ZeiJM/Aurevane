import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { inspectMigrationSecurity } from './migration-policy'

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/20260917213000_combat_content_authoring.sql',
)

describe('combat content authoring migration', () => {
  it('creates private draft, immutable version, and current-publication tables', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('create table app_private.combat_content_drafts')
    expect(sql).toContain('create table app_private.combat_content_versions')
    expect(sql).toContain('create table app_private.combat_content_publications')
    expect(sql).toContain("content_kind in ('skill','status','effect-profile')")
    expect(sql).toContain('unique (content_key, content_version)')
  })

  it('keeps all combat authoring tables server-only and RLS-enabled', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('alter table app_private.combat_content_drafts enable row level security')
    expect(sql).toContain(
      'alter table app_private.combat_content_versions enable row level security',
    )
    expect(sql).toContain(
      'alter table app_private.combat_content_publications enable row level security',
    )
    expect(sql).toContain('from public, anon, authenticated')
    expect(inspectMigrationSecurity(sql)).toEqual([])
  })

  it('enforces immutable published versions at the database boundary', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('prevent_combat_content_version_mutation_v1')
    expect(sql).toMatch(/before update or delete\s+on app_private\.combat_content_versions/i)
  })

  it('uses optimistic draft versions and an exact current-publication reference', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('draft_version bigint not null default 1')
    expect(sql).toContain('foreign key (version_id, content_key, content_kind)')
  })

  it('allows a draft to base on a static fallback version before DB publication exists', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).not.toContain('foreign key (content_key, base_version)')
    expect(sql).toContain('base_version integer check (base_version is null or base_version > 0)')
  })
})
