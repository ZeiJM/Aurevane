import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { BasicContentEditor } from './basic-content-editor'
import { CombatContentAuthoringWorkspace } from './combat-content-authoring-workspace'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }))

const basics = defaultBasicSkills().map((definition) => ({
  id: definition.id,
  label: definition.name,
  definition,
  currentVersion: definition.contentVersion,
  baseVersion: definition.contentVersion,
  draftVersion: null,
  history: [
    {
      contentVersion: definition.contentVersion,
      source: 'static-baseline' as const,
      current: true,
      publishedAt: null,
    },
  ],
}))
beforeEach(() => vi.clearAllMocks())
it('displays the next Basic version above the server-projected shipped-history floor', () => {
  const markup = renderToStaticMarkup(
    createElement(BasicContentEditor, {
      basics: basics.map((row) => ({ ...row, versionFloor: 50 })),
    }),
  )
  expect(markup).toMatch(/Next publish<\/dt><dd>v51<\/dd>/)
})
it('provides every Basic and auxiliary option in the actual combat workspace', () => {
  const markup = renderToStaticMarkup(
    createElement(CombatContentAuthoringWorkspace, {
      skills: [],
      essences: [],
      resonances: [],
      basics,
      initialContentType: 'basics',
    }),
  )
  expect(markup.includes('<option value="basics" selected="">')).toBe(true)
  expect(markup.includes('aria-label="Basic Skill"')).toBe(true)
  for (const row of basics) expect(markup.includes(`<option value="${row.id}"`)).toBe(true)
  expect(markup.includes('aria-label="Move cost basis"')).toBe(true)
  expect(markup.includes('aria-label="Basic Skill name"')).toBe(true)
  expect(markup.includes('aria-label="Skill artwork hook"')).toBe(true)
  expect(markup.includes('>Save draft</button>')).toBe(true)
})

it.each(basics)(
  'renders $id through the shared editor with the actual Basic execution report',
  (option) => {
    const before = JSON.stringify(option)
    const markup = renderToStaticMarkup(
      createElement(BasicContentEditor, { basics, initialBasicId: option.id }),
    )
    expect(markup.includes('aria-label="Modular ability editor"')).toBe(true)
    expect(markup.includes('aria-label="AP cost"')).toBe(true)
    expect(markup.includes('aria-label="Basic Skill definition report"')).toBe(true)
    expect(markup.includes('Correct the definition')).toBe(false)
    const label =
      option.definition.execution.kind === 'basic-move'
        ? 'Move cost basis'
        : option.definition.execution.kind === 'basic-attack'
          ? 'Higher Power scaling (%)'
          : 'Recovery rounding'
    expect(markup.includes(`aria-label="${label}"`)).toBe(true)
    expect(JSON.stringify(option)).toBe(before)
  },
)
it('loads a saved auxiliary draft and names invalid Basic Attack costs without a misleading report', () => {
  const guard = basics.find((row) => row.id === 'basic.guard')!
  const initialDraft = { ...guard.definition, name: 'Saved auxiliary draft' }
  const markup = renderToStaticMarkup(
    createElement(BasicContentEditor, { basics: [{ ...guard, initialDraft }] }),
  )
  expect(markup.includes('value="Saved auxiliary draft"')).toBe(true)
  const attack = basics.find((row) => row.id === 'unarmed.basic')!
  const invalid = {
    ...attack.definition,
    ability: {
      ...attack.definition.ability,
      behaviors: attack.definition.ability.behaviors.map((group) => ({ ...group, costs: [] })),
    },
  }
  const invalidMarkup = renderToStaticMarkup(
    createElement(BasicContentEditor, { basics: [{ ...attack, initialDraft: invalid }] }),
  )
  expect(invalidMarkup.includes('Basic Attack requires a positive authored AP cost.')).toBe(true)
  expect(invalidMarkup.includes('Correct the definition')).toBe(true)
})
it('keeps plural Basic group reports identifiable instead of merging their mechanics', () => {
  const guard = basics.find((row) => row.id === 'basic.guard')!
  const group = guard.definition.ability.behaviors[0]!
  const initialDraft = {
    ...guard.definition,
    ability: { ...guard.definition.ability, behaviors: [group, { ...group, id: 'second' }] },
  }
  const markup = renderToStaticMarkup(
    createElement(BasicContentEditor, { basics: [{ ...guard, initialDraft }] }),
  )
  expect(markup.includes('aria-label="Manual Action 1"')).toBe(true)
  expect(markup.includes('aria-label="Manual Action 2"')).toBe(true)
})

it('provides real Basic validation, diff, selected preview and confirmed publication controls', () => {
  const markup = renderToStaticMarkup(createElement(BasicContentEditor, { basics }))
  expect(markup.includes('aria-label="Preview action group"')).toBe(true)
  for (const action of ['Validate', 'Save draft', 'Diff', 'Preview', 'Publish'])
    expect(markup.includes('>' + action + '</button>')).toBe(true)
  expect(markup.includes('Version history')).toBe(true)
  expect(markup.includes('>Rollback</button>')).toBe(false)
  expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Publish<\/button>/)
})
