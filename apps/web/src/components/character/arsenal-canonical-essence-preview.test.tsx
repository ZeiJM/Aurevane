import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { resolveEssenceForBuild, type EssenceDefinition } from '@aurevane/game-core/combat/essence'
import { EssenceHoverPreview } from './character-arsenal-shell'

// Expose the actual reader body during SSR; opening/hover/touch still needs the native matrix.
vi.mock('../battle/battle-info-popover', () => ({
  BattleInfoPopover: ({
    label,
    trigger,
    children,
  }: {
    label: string
    trigger: ReactNode
    children: ReactNode
  }) => (
    <section aria-label={label}>
      {trigger}
      {children}
    </section>
  ),
}))
const manifest = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  records: { kind: string; id: string; beforeVersion: number; after: EssenceDefinition }[]
}
const rows = manifest.records.filter((row) => row.kind === 'essence')

describe('actual Arsenal Essence hover reads canonical root mechanics', () => {
  it.each(rows)(
    '$id uses its current and public canonical groups rather than the nested legacy envelope',
    (row) => {
      expect(rows).toHaveLength(17)
      const before = JSON.stringify(row.after)
      expect(row.after.ability).toBeDefined()
      expect(row.after.skill.ability).toBeUndefined()
      const groupIds = row.after.ability!.behaviors.map((group) => group.id)
      for (const definition of [row.after, projectPublicCombat(row.after)]) {
        const html = renderToStaticMarkup(<EssenceHoverPreview essence={definition} />)
        expect([...html.matchAll(/data-ability-behavior="([^"]+)"/g)].map((m) => m[1])).toEqual(
          groupIds,
        )
        expect(html.match(/<dt>Skill Type<\/dt>/g)).toHaveLength(groupIds.length)
        expect(html.match(/<dt>Target Method<\/dt>/g)).toHaveLength(groupIds.length)
        expect(html).toContain('data-compact-effect-label="true"')
        expect(html).toContain('width="160" height="160"')
        expect(html).not.toMatch(/chanceBasisPoints|sourceInstanceId|accuracyModifierBasisPoints/)
      }
      expect(JSON.stringify(row.after)).toBe(before)
    },
  )
  it('retains an actual pinned historical Essence without canonical root metadata', () => {
    const row = rows.find((r) => r.after.sourceDisciplineId === 'vanguard')!
    const historical = resolveEssenceForBuild('vanguard', null, row.beforeVersion)!
    expect(historical).not.toBeNull()
    expect(historical.ability).toBeUndefined()
    const before = JSON.stringify(historical)
    const html = renderToStaticMarkup(<EssenceHoverPreview essence={historical} />)
    expect(html).toContain('Preview Essence:')
    expect(html).toContain('<dt>Skill Type</dt>')
    expect(html).not.toContain('data-ability-definition-parameters="true"')
    expect(JSON.stringify(historical)).toBe(before)
  })
})
