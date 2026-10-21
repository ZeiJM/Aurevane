import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/shell/authenticated-game-shell', () => ({
  AuthenticatedShellFrame: ({ children }: { children: React.ReactNode }) =>
    createElement('main', null, children),
}))
vi.mock('@/components/media/aurevane-image', () => ({
  AurevaneImage: () => createElement('img', { alt: '' }),
}))
import { MasterPanelShell } from './master-panel-shell'
import { StaffManagement } from './staff-management'
import shellStyles from './master-panel-shell.module.css'
import staffStyles from './staff-management.module.css'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const shell = source('./master-panel-shell.module.css')
const staff = source('./staff-management.module.css')
const modal = source('../character/character-select-shell.module.css')
const tokens = source('../../../../../packages/ui/src/tokens.css')
function declarations(css: string, selector: string): string {
  return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) =>
      match[1]!
        .trim()
        .split(/,\s*(?![^()]*\))/)
        .includes(selector),
    )
    .map((match) => match[2])
    .join(';')
}
function property(css: string, selector: string, name: string): string {
  const entries = [
    ...declarations(css, selector).matchAll(new RegExp(`(?:^|;)\\s*${name}:\\s*([^;]+)`, 'g')),
  ]
  const value = entries.at(-1)?.[1]
  if (!value) throw new Error(`Missing ${selector} ${name}`)
  return value.trim()
}
const variables = Object.fromEntries(
  [
    ...(tokens + declarations(shell, '.workspace') + declarations(staff, '.layout')).matchAll(
      /(--[\w-]+):\s*([^;]+);/g,
    ),
  ].map((match) => [match[1], match[2]]),
)
function resolve(value: string): string {
  return value.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g, (_, key: string, fallback: string) =>
    resolve(variables[key] ?? fallback),
  )
}
type RGB = readonly number[]
function colors(value: string): RGB[] {
  return [...resolve(value).matchAll(/#[\da-f]{6}\b|rgba?\([\d.,\s]+\)/gi)].map(([entry]) =>
    entry.startsWith('#')
      ? [1, 3, 5].map((offset) => parseInt(entry.slice(offset, offset + 2), 16)).concat(1)
      : entry
          .match(/[\d.]+/g)!
          .map(Number)
          .concat(entry.startsWith('rgba') ? [] : [1]),
  )
}
function over(foreground: RGB, background: RGB): RGB {
  return foreground
    .slice(0, 3)
    .map((channel, index) => channel * foreground[3]! + background[index]! * (1 - foreground[3]!))
    .concat(1)
}
function contrast(first: RGB, second: RGB): number {
  const luminance = (rgb: RGB) =>
    rgb
      .slice(0, 3)
      .map((channel) => channel / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index]!, 0)
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0]! + 0.05) / (values[1]! + 0.05)
}
const shellSurfaces = colors(property(shell, '.content', 'background'))
const cards = colors(property(staff, '.editor', 'background')).flatMap((surface) =>
  shellSurfaces.map((base) => over(surface, base)),
)
function expectReadable(text: string, surfaces: readonly RGB[], minimum = 4.5) {
  const foreground = colors(text)[0]!
  for (const background of surfaces)
    expect(
      contrast(foreground, background),
      `${resolve(text)} on ${background.slice(0, 3).join(',')}`,
    ).toBeGreaterThanOrEqual(minimum)
}
it('mounts the real Staff directory under the real stone-themed Master workspace', () => {
  const html = renderToStaticMarkup(
    <MasterPanelShell
      access={{
        userId: 'owner',
        characterId: 'selected',
        accessVersion: 1,
        roles: ['game-owner'],
        specialCapabilities: [],
        effectiveCapabilities: ['staff.manage'],
      }}
      activeSection="staff"
      title="Staff & Access"
      description="Manage selected-character access."
    >
      <StaffManagement staff={[]} roleOptions={[]} capabilityOptions={[]} />
    </MasterPanelShell>,
  )
  expect(html).toContain(`av-master ${shellStyles.workspace}`)
  expect(html.indexOf(shellStyles.content)).toBeLessThan(html.indexOf(staffStyles.layout))
  expect(html).toContain('aria-label="Staff directory"')
})
it('keeps headings, identities, labels, secondary copy, inputs and buttons readable against actual shell inheritance', () => {
  for (const selector of ['.layout h2', '.identity strong', '.layout label', '.layout p'])
    expectReadable(property(staff, selector, 'color'), cards)
  const inputSurfaces = colors(property(staff, '.layout select', 'background')).flatMap((surface) =>
    cards.map((card) => over(surface, card)),
  )
  expectReadable(property(staff, '.layout select', 'color'), inputSurfaces)
  const buttonSurfaces = colors(property(staff, '.layout button', 'background')).flatMap(
    (surface) => cards.map((card) => over(surface, card)),
  )
  expectReadable(property(staff, '.layout button', 'color'), buttonSurfaces)
  for (const selector of ['.layout .error', '.layout .notice'])
    expectReadable(property(staff, selector, 'color'), cards)
})
it('retains readable revoke-dialog text and contrasting focus on its inherited stone surfaces', () => {
  const dialogSurfaces = colors(property(modal, '.modal', 'background'))
  // Staff selectors also match the reused dialog subtree; check both color rules.
  for (const [css, selector] of [
    [staff, '.layout h2'],
    [staff, '.layout p'],
    [modal, '.modal h2'],
    [modal, '.modal p'],
  ] as const)
    expectReadable(property(css, selector, 'color'), dialogSurfaces)
  expectReadable(property(staff, '.layout button', 'color'), dialogSurfaces)
  const focus = property(staff, '.layout input:focus-visible', 'outline')
  expectReadable(focus, [...cards, ...dialogSurfaces], 3)
  // The more specific shell button-focus rule must also remain visible.
  expectReadable(
    property(shell, '.workspace :is(button, a):focus-visible', 'outline'),
    [...cards, ...dialogSurfaces],
    3,
  )
})
