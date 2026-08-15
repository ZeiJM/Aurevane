import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { inspectMigrationSecurity } from './migration-policy'

describe('migration security policy', () => {
  it('rejects a public table without RLS', () => {
    const violations = inspectMigrationSecurity(`
      create table public.characters (
        id uuid primary key
      );
    `)

    expect(violations).toContainEqual(
      expect.objectContaining({
        code: 'PUBLIC_TABLE_WITHOUT_RLS',
        table: 'characters',
      }),
    )
  })

  it('treats an unqualified application table as public for RLS enforcement', () => {
    const violations = inspectMigrationSecurity(`
      create table characters (
        id uuid primary key
      );
    `)

    expect(violations).toContainEqual(
      expect.objectContaining({
        code: 'PUBLIC_TABLE_WITHOUT_RLS',
        table: 'characters',
      }),
    )
  })

  it('accepts a public table when RLS is enabled in the same migration', () => {
    const violations = inspectMigrationSecurity(`
      create table public.characters (
        id uuid primary key
      );

      alter table public.characters enable row level security;
    `)

    expect(violations).toEqual([])
  })

  it('accepts an unqualified table when RLS is enabled in the same migration', () => {
    const violations = inspectMigrationSecurity(`
      create table characters (
        id uuid primary key
      );

      alter table characters enable row level security;
    `)

    expect(violations).toEqual([])
  })

  it('does not require browser RLS policy for an explicitly private schema table', () => {
    const violations = inspectMigrationSecurity(`
      create table app_private.audit_entries (
        id uuid primary key
      );
    `)

    expect(violations).toEqual([])
  })

  it('rejects disabling RLS', () => {
    expect(
      inspectMigrationSecurity('alter table public.characters disable row level security;'),
    ).toContainEqual(expect.objectContaining({ code: 'RLS_DISABLED' }))
  })

  it('rejects broad grants to browser-facing roles', () => {
    expect(
      inspectMigrationSecurity('grant all on table public.characters to authenticated;'),
    ).toContainEqual(expect.objectContaining({ code: 'BROAD_PUBLIC_GRANT' }))
  })

  it('keeps every committed migration inside the security policy', () => {
    const migrationsDirectory = resolve(process.cwd(), '../../supabase/migrations')
    const migrationFiles = readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith('.sql'))
      .sort()

    expect(migrationFiles.length).toBeGreaterThan(0)

    for (const file of migrationFiles) {
      const sql = readFileSync(resolve(migrationsDirectory, file), 'utf8')
      expect(inspectMigrationSecurity(sql), file).toEqual([])
    }
  })
})
