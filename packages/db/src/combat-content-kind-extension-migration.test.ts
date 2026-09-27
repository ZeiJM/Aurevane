import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/20260927203000_combat_content_essence_resonance_kinds.sql',
)

describe('combat content Essence and Resonance kind migration', () => {
  it('extends every immutable content lineage with Essence and Resonance kinds', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain(
      "content_kind in ('skill','essence','resonance','status','effect-profile')",
    )
    expect(sql).toContain('combat_content_versions_content_kind_check')
    expect(sql).toContain('combat_content_drafts_content_kind_check')
    expect(sql).toContain('combat_content_publications_content_kind_check')
  })

  it('does not weaken the existing server-only or immutable table policy', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).not.toMatch(/disable row level security/i)
    expect(sql).not.toMatch(/grant\s+.+\s+to\s+(?:public|anon|authenticated)/i)
    expect(sql).not.toMatch(/drop trigger/i)
    expect(sql).not.toMatch(/drop function/i)
  })
})
