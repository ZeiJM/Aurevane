import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { inspectMigrationSecurity } from './migration-policy'

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/20260917220000_master_panel_combat_authoring.sql',
)

describe('Master Panel combat authoring migration', () => {
  it('creates an explicit private operator allowlist with bounded roles', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('create table app_private.master_panel_operators')
    expect(sql).toContain("role in ('owner','content-staff')")
    expect(sql).toContain('enabled boolean not null default true')
    expect(sql).toContain(
      'alter table app_private.master_panel_operators enable row level security',
    )
    expect(sql).toContain('from public, anon, authenticated')
  })

  it('keeps all read/write authoring RPCs service-role-only and security-definer', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    for (const name of [
      'read_master_panel_operator_v1',
      'read_combat_content_draft_v1',
      'list_combat_content_versions_v1',
      'save_combat_content_draft_v1',
      'publish_combat_content_v1',
      'set_combat_content_publication_v1',
    ]) {
      expect(sql).toContain(`public.${name}`)
    }
    expect(sql.match(/security definer/gi)?.length).toBeGreaterThanOrEqual(6)
    expect(sql).toContain('to service_role')
    expect(inspectMigrationSecurity(sql)).toEqual([])
  })

  it('serializes publish by content key and rejects stale DB bases', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain('COMBAT_CONTENT_BASE_VERSION_CONFLICT')
    expect(sql).toContain('greatest(v_highest_version, coalesce(p_expected_base_version, 0)) + 1')
    expect(sql).toContain("jsonb_set(p_definition, '{contentVersion}'")
  })

  it('uses an unambiguous publication upsert conflict target', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(
      sql.match(/on conflict on constraint combat_content_publications_pkey do update/gi),
    ).toHaveLength(2)
    expect(sql).not.toContain('on conflict (content_key) do update')
  })

  it('rolls back by pointer only and can clear the DB pointer to restore static fallback', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('delete from app_private.combat_content_publications')
    expect(sql).toContain('p_target_version is null')
    expect(sql).not.toMatch(/delete from app_private\.combat_content_versions/i)
    expect(sql).not.toMatch(/update app_private\.combat_content_versions/i)
  })

  it('requires an enabled operator inside every mutation RPC', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('app_private.assert_master_panel_operator_v1')
    expect(
      sql.match(/perform app_private\.assert_master_panel_operator_v1\(p_actor_user_id\)/gi)
        ?.length,
    ).toBeGreaterThanOrEqual(3)
  })
})
