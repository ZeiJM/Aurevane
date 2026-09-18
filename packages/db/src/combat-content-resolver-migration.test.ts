import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/20260917214500_combat_content_resolver.sql',
)

describe('combat content resolver migration', () => {
  it('exposes current and pinned reads only through service-role RPCs', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('public.read_current_combat_content_v1')
    expect(sql).toContain('public.read_combat_content_version_v1')
    expect(sql.match(/security definer/gi)).toHaveLength(2)
    expect(sql).toContain('from public, anon, authenticated')
    expect(sql).toContain('to service_role')
  })

  it('reads only immutable version rows through the current publication pointer', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('app_private.combat_content_publications')
    expect(sql).toContain('app_private.combat_content_versions')
    expect(sql).toContain('publication.version_id = version.id')
    expect(sql).toContain('version.content_version = p_content_version')
  })
})
