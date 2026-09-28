import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('battle combat-content route wiring', () => {
  it.each([
    '../../app/api/battles/[battleSessionId]/commit/route.ts',
    '../../app/api/battles/[battleSessionId]/intents/route.ts',
  ])('injects the server combat-content resolver into %s', (relativePath) => {
    const source = readFileSync(join(here, relativePath), 'utf8')

    expect(source).toContain(
      "import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'",
    )
    expect(source).toContain('combatContentResolver: createServerCombatContentResolver()')
  })
})
