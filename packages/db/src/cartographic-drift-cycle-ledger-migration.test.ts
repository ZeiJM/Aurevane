import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { inspectMigrationSecurity } from './migration-policy'

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/20260925180000_cartographic_drift_cycle_ledger.sql',
)

describe('Cartographic Drift cycle-ledger migration', () => {
  it('creates one private immutable row per authored definition and cadence cycle', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('create table app_private.cartographic_drift_cycle_ledger')
    expect(sql).toContain('primary key (definition_id, cycle_key)')
    expect(sql).toContain('definition_content_version integer not null')
    expect(sql).toContain('generation_version integer not null')
    expect(sql).toContain('variant_content_version integer not null')
    expect(sql).toContain("resolution_id ~ '^sha256:[0-9a-f]{64}$'")
    expect(sql).toContain('resolved_at timestamptz not null')
  })

  it('never persists or accepts the private server seed', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).not.toMatch(/server[_ ]?seed/i)
    expect(sql).not.toContain('p_seed')
  })

  it('keeps the table server-only and exposes only the bounded service-role RPC', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain(
      'alter table app_private.cartographic_drift_cycle_ledger enable row level security',
    )
    expect(sql).toContain(
      'revoke all on table app_private.cartographic_drift_cycle_ledger\n  from public, anon, authenticated, service_role',
    )
    expect(sql).toContain(
      'grant select on table app_private.cartographic_drift_cycle_ledger to service_role',
    )
    expect(sql).toContain(
      'create or replace function public.record_cartographic_drift_cycle_resolution_v1',
    )
    expect(sql).toContain(
      ') from public, anon, authenticated;\ngrant execute on function public.record_cartographic_drift_cycle_resolution_v1',
    )
    expect(inspectMigrationSecurity(sql)).toEqual([])
  })

  it('prevents update/delete mutation and serializes competing definition-cycle inserts', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('prevent_cartographic_drift_cycle_ledger_mutation_v1')
    expect(sql).toMatch(
      /before update or delete on app_private\.cartographic_drift_cycle_ledger/i,
    )
    expect(sql).toContain('CARTOGRAPHIC_DRIFT_LEDGER_IMMUTABLE')
    expect(sql).toContain("pg_advisory_xact_lock(")
    expect(sql).toContain(
      "'aurevane:cartographic-drift:' || p_definition_id || ':' || p_cycle_key",
    )
  })

  it('returns the existing immutable row instead of mutating it on replay', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain(
      'where ledger.definition_id = p_definition_id\n    and ledger.cycle_key = p_cycle_key',
    )
    expect(sql).toContain('v_existing.resolved_at,\n      false;')
    expect(sql).toContain('returning * into v_existing')
    expect(sql).toContain('v_existing.resolved_at,\n    true;')
  })
})
