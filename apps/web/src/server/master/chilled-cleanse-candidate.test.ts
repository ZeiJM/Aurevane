import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import type { CombatContentVersionRecord } from '@aurevane/db/combat-content'
import {
  validatePublishedSkill,
  validatePublishedEssence,
} from '../combat/combat-content-published-validation'

const candidate = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/verification/release-assets/2026-10-29-chilled-cleanse-candidate.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  records: {
    id: string
    kind: 'skill' | 'essence'
    before: Record<string, unknown>
    after: Record<string, unknown>
  }[]
}

it.each(candidate.records)(
  'admits the converted $id through the actual published definition validator',
  (row) => {
    for (const definition of [row.before, row.after]) {
      const record = {
        id: 'candidate',
        contentKey: row.id,
        contentKind: row.kind,
        contentVersion: definition.contentVersion,
        definition,
        publishedBy: 'owner',
        publishedAt: '2026-10-29T00:00:00Z',
      } as CombatContentVersionRecord
      const read = row.kind === 'skill' ? validatePublishedSkill : validatePublishedEssence
      expect(read(record, row.id, record.contentVersion)).toEqual(definition)
    }
  },
)
