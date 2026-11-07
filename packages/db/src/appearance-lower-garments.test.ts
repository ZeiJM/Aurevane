import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

it('queues, activates and pins versions through the existing player and NPC appearance authority', async () => {
  const db = await createCombatContentTestDatabase()
  try {
    const sql = readFileSync(
      new URL('../../../supabase/tests/safe_character_appearance.sql', import.meta.url),
      'utf8',
    )
    await expect(db.exec(sql)).resolves.toBeDefined()
  } finally {
    await db.close()
  }
}, 30000)
