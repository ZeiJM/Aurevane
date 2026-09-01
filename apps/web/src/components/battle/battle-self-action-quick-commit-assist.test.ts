import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function source(): string {
  return readFileSync(join(here, 'battle-self-action-quick-commit-assist.tsx'), 'utf8')
}

describe('Guard and Recover double-press shortcuts', () => {
  it('commits through the unified footer after the selected action preview becomes legal', () => {
    const content = source()

    expect(content).toContain(
      `'footer[data-unified-battle-footer="true"] > div > button:nth-of-type(2)'`,
    )
    expect(content).toContain("action !== 'guard' && action !== 'recover'")
    expect(content).toContain('if (!confirm || confirm.disabled) return false')
    expect(content).toContain('confirm.click()')
    expect(content).toContain("window.addEventListener('keydown', handleKeyDown, true)")
  })
})
