import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { inspectMigrationSecurity } from './migration-policy'

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/20260923002000_navigation_performance_helpers.sql',
)

describe('navigation performance helper migration', () => {
  it('adds a service-only batch resolver for current combat content', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('read_current_combat_content_many_v1')
    expect(sql).toContain('any(coalesce(p_content_keys, array[]::text[]))')
    expect(sql).toContain('grant execute on function public.read_current_combat_content_many_v1')
  })

  it('adds a scalar online count without exposing private directory data', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('count_online_characters_v1')
    expect(sql).toContain("presence.last_seen_at >= now() - interval '10 minutes'")
    expect(sql).toContain('from public, anon, authenticated')
    expect(inspectMigrationSecurity(sql)).toEqual([])
  })
})
