import { createElement } from 'react'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => undefined }),
}))

import { CombatContentEditor, type CombatContentEditorSkillOption } from './combat-content-editor'

const skills: readonly CombatContentEditorSkillOption[] = [
  {
    id: 'vanguard.forceful-strike',
    sourceDisciplineId: 'vanguard',
    label: 'Forceful Strike',
    currentVersion: 3,
    baseVersion: 3,
    draftVersion: 2,
    derivedTags: ['Enemy', 'Single', 'Dmg'],
  },
  {
    id: 'vanguard.cleave',
    sourceDisciplineId: 'vanguard',
    label: 'Cleave',
    currentVersion: 1,
    baseVersion: 1,
    draftVersion: null,
    derivedTags: ['Enemy', 'Area', 'Dmg'],
  },
  {
    id: 'lifebinder.mending-pulse',
    sourceDisciplineId: 'lifebinder',
    label: 'Mending Pulse',
    currentVersion: 1,
    baseVersion: 1,
    draftVersion: null,
    derivedTags: ['Ally', 'Single', 'Heal'],
  },
]

describe('Master Panel combat content editor shell', () => {
  it('renders real Discipline and Skill selectors with stable ids', () => {
    const markup = renderToStaticMarkup(
      createElement(CombatContentEditor, {
        skills,
        initialSkillId: 'vanguard.forceful-strike',
      }),
    )

    expect(markup).toContain('aria-label="Discipline"')
    expect(markup).toContain('<option value="vanguard" selected="">Vanguard</option>')
    expect(markup).toContain('<option value="lifebinder">Lifebinder</option>')
    expect(markup).toContain('aria-label="Skill"')
    expect(markup).toContain(
      '<option value="vanguard.forceful-strike" selected="">Forceful Strike</option>',
    )
    expect(markup).toContain('<option value="vanguard.cleave">Cleave</option>')
    expect(markup).not.toContain('Mending Pulse</option></select>')
  })

  it('shows current, draft, and base versions plus an explicit validation state', () => {
    const markup = renderToStaticMarkup(
      createElement(CombatContentEditor, {
        skills,
        initialSkillId: 'vanguard.forceful-strike',
      }),
    )

    expect(markup).toContain('Current version')
    expect(markup).toContain('v3')
    expect(markup).toContain('Draft version')
    expect(markup).toContain('d2')
    expect(markup).toContain('Base version')
    expect(markup).toContain('v3')
    expect(markup).toContain('Not validated')
  })

  it('renders the approved workflow controls without pretending they have already run', () => {
    const markup = renderToStaticMarkup(
      createElement(CombatContentEditor, {
        skills,
        initialSkillId: 'vanguard.forceful-strike',
      }),
    )

    for (const label of ['Validate', 'Diff', 'Preview', 'Publish', 'Rollback']) {
      expect(markup).toContain(`>${label}</button>`)
    }
    expect(markup).toContain('>Publish</button>')
    expect(markup).toContain('disabled=""')
  })

  it('mounts the typed media editor for a loaded Skill definition', () => {
    const definition = resolveMatureSkillVersion('vanguard.forceful-strike', 2)
    if (!definition) throw new Error('Expected Vanguard Forceful Strike.')
    const markup = renderToStaticMarkup(
      createElement(CombatContentEditor, {
        skills: [{ ...skills[0]!, definition }],
        initialSkillId: definition.id,
      }),
    )

    expect(markup).toContain('<legend>Media</legend>')
    expect(markup).toContain('aria-label="Skill artwork hook"')
    expect(markup).toContain('aria-label="Skill audio hook"')
    expect(markup).toContain('data-media-hook-readonly="vfx"')
  })

  it('renders derived tags as read-only output rather than an editable gameplay-tag field', () => {
    const markup = renderToStaticMarkup(
      createElement(CombatContentEditor, {
        skills,
        initialSkillId: 'vanguard.forceful-strike',
      }),
    )

    expect(markup).toContain('Derived tags')
    expect(markup).toContain('Enemy')
    expect(markup).toContain('Single')
    expect(markup).toContain('Dmg')
    expect(markup).toContain('data-derived-tags="readonly"')
    expect(markup).not.toContain('name="tags"')
  })
})
