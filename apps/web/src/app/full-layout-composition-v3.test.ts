import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

const compositionContracts = [
  {
    component: '../components/character/character-profile-shell.tsx',
    stylesheet: '../components/character/character-profile-shell.module.css',
    markers: [
      'data-profile-workspace',
      'data-profile-sheet="true"',
      'aria-label="Current Path"',
      '<CharacterSupernaturalPath',
    ],
  },
  {
    component: '../components/character/character-arsenal-shell.tsx',
    stylesheet: '../components/character/character-arsenal-shell.module.css',
    markers: ['data-arsenal-workspace', 'data-arsenal-media="true"'],
  },
  {
    component: '../components/battle/battle-launch.tsx',
    stylesheet: '../components/battle/battle-launch.module.css',
    markers: ['data-hall-mode-rail="true"', 'data-hall-active-workspace="true"'],
  },
  {
    component: '../components/wayfarers-practice/offline-training-shell.tsx',
    stylesheet: '../components/wayfarers-practice/offline-training-shell.module.css',
    markers: ['data-training-scene="true"', 'data-training-workspace="true"'],
  },
  {
    component: './game/(roaming)/online/page.tsx',
    stylesheet: './game/(roaming)/online/online-users.module.css',
    markers: ['data-directory-stage="true"'],
  },
  {
    component: '../components/character/character-select-shell.tsx',
    stylesheet: '../components/character/character-select-shell.module.css',
    markers: ['data-roster-stage="true"', 'data-character-slot-board="true"'],
  },
] as const

describe('full layout composition v3', () => {
  it.each(compositionContracts)(
    'gives $component an explicit composition that also owns narrow/mobile layout',
    ({ component, stylesheet, markers }) => {
      const componentSource = source(component)
      const stylesheetSource = source(stylesheet)

      for (const marker of markers) expect(componentSource).toContain(marker)
      expect(stylesheetSource).toContain('@media (max-width: 760px)')
      expect(stylesheetSource).toContain('composition-v3')
    },
  )

  it('makes the shared mobile shell a true bottom primary navigation dock', () => {
    const railSource = source('../components/shell/game-rail.tsx')
    const shellStyles = source('../components/shell/authenticated-game-shell.module.css')

    expect(railSource).toContain('data-av-primary-dock="true"')
    expect(shellStyles).toContain('position: fixed')
    expect(shellStyles).toContain('bottom: 0')
    expect(shellStyles).toContain('padding-bottom: calc(')
  })
})
