import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { ManualArticle } from '@/components/public-information/manual-article'
import { createTechniquesManualArticle } from '@/content/techniques-manual'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
const basic = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!
const root = basic.ability.behaviors[0]!
const skill = {
  ...resolveMatureSkillVersion('cinderweaver.cinder-bolt')!,
  name: 'Literal <script> & Skill',
  ability: parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...root,
        id: 'fire',
        requirements: {
          kind: 'status-presence',
          subject: 'selected',
          statusId: 'wet',
          present: true,
        },
        effects: [
          {
            id: 'hit',
            timing: 'instant',
            requirements: {
              kind: 'status-presence',
              subject: 'selected',
              statusId: 'burn',
              present: true,
            },
            payload: { type: 'damage', recipient: 'primary-unit', amount: 13, element: 'fire' },
          },
          {
            id: 'element-fire',
            timing: 'instant',
            payload: { type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] },
          },
        ],
        activationLimits: ['once-per-battle'],
      },
      {
        ...root,
        id: 'aura',
        activation: 'ongoing',
        mode: 'modifier',
        classification: 'utility',
        attackFamily: undefined,
        costs: [],
        cooldown: null,
        targeting: null,
        requirements: null,
        effects: [
          {
            id: 'boost',
            payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11250 },
          },
        ],
      },
    ],
  }),
}
function article() {
  return createTechniquesManualArticle({
    skills: [skill],
    basics: defaultBasicSkills().map((row, index) =>
      index === 0 ? { ...row, name: 'Literal <script> & Basic' } : row,
    ),
    timingPolicy: defaultCombatEffectTimingPolicy(),
  })
}
function render(value = article()) {
  return renderToStaticMarkup(<ManualArticle {...value} />)
}
it('documents the current global timing, enemy Blindside and temporary-HP Barrier rules', () => {
  const text = JSON.stringify(
    article().body.filter((block) =>
      ['read-preview', 'damage-order', 'effect-families'].includes(block.id),
    ),
  )
  expect(text).toContain('Attack, Utility or Heal')
  expect(text).toContain('Blindside is a one-turn debuff')
  expect(text).toContain('Pierce destroys the Barrier')
  expect(text).toContain('Master controls timing globally')
})
it('carries actual typed prerequisites and conditions into the public Manual', () => {
  const html = render()
  expect(html).toContain('data-combat-tag-reference="wet"')
  expect(html).toContain('data-combat-tag-reference="burn"')
  expect(html).toContain('aria-label="Explain Drenched"')
  expect(html).toContain('aria-label="Explain Burn"')
  expect(html).not.toContain('must have')
})
it('retains the actual Frozen Ground conditional Fire references through the generated explanation', () => {
  const records = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ).records
  const proposed = records.find(
    (row: { id: string }) => row.id === 'frostweaver.chilling-mist',
  ).after
  const html = render(
    createTechniquesManualArticle({
      skills: [
        {
          ...resolveMatureSkillVersion('frostweaver.chilling-mist')!,
          ability: parseAbilityDefinition(proposed.ability),
        },
      ],
      basics: [],
      timingPolicy: defaultCombatEffectTimingPolicy(),
    }),
  )
  expect(html).toContain('data-combat-tag-reference="frozen-ground"')
  expect(html).toContain('data-combat-tag-reference="steam"')
  expect(html).toContain('blocks sight')
})
it('uses shared effect-name and value markup for separate Manual and Ongoing groups', () => {
  const html = render()
  expect(html).toContain('Manual Action 1')
  expect(html).toContain('Ongoing Modifier 2')
  expect(html).toContain('data-compact-effect-label="true"')
  expect(html).toContain('data-compact-effect-magnitude="true"')
  expect(html).toContain('[13]')
  expect(html).toContain('[12.5%]')
  expect(html).toContain('Once per battle')
  expect(html).toContain('Active while Requirements are met')
})
it('renders all five generated Basics with actual structured effects', () => {
  const value = article()
  const block = value.body.find((block) => block.id === 'basic-skills')!
  const html = render({ ...value, body: [block] })
  expect(block.disclosures).toHaveLength(5)
  expect(html.match(/data-compact-skill-effect="true"/g)).toHaveLength(5)
  expect(html).toContain('per traversal point')
  expect(html).toContain('30 AP')
  expect(html).toContain('50 AP')
})
it('keeps actual article text escaped and does not mutate definitions while adding links', () => {
  const before = structuredClone(skill)
  const html = render()
  expect(html).toContain('Literal &lt;script&gt; &amp; Basic')
  expect(html).not.toContain('<script>')
  expect(skill).toEqual(before)
})
const reference = {
  kind: 'references',
  parts: [{ tag: 'burn', label: 'Burn', explanation: 'Recorded Burn explanation <unsafe>' }],
} as const
function body(bullet: string, parts?: unknown) {
  return [
    {
      id: 'fixture',
      paragraphs: [],
      disclosures: [
        {
          title: 'Fixture',
          bullets: [bullet],
          ...(parts === undefined ? {} : { bulletParts: [parts] }),
        },
      ],
    },
  ] as unknown as Parameters<typeof ManualArticle>[0]['body']
}
it('rejects malformed timing metadata even when coercion would match the plain sentence', () => {
  const html = renderToStaticMarkup(
    <ManualArticle
      {...article()}
      body={body('Dmg [1] [Instant]', [
        {
          kind: 'effect',
          parts: { label: 'Dmg', magnitude: '1', duration: null, timing: ['Instant'] },
        },
      ])}
    />,
  )
  expect(html).toContain('Dmg [1] [Instant]')
  expect(html).not.toContain('data-compact-effect-label')
})
it('renders matching optional metadata through the actual article and escapes its explanation data', () => {
  const value = { ...article(), body: body('Burn', [reference]) }
  const html = renderToStaticMarkup(<ManualArticle {...value} />)
  expect(html).toContain('data-combat-tag-reference="burn"')
  expect(html).not.toContain('<unsafe>')
})
it.each([
  undefined,
  null,
  [],
  ['different'],
  [null],
  [{ kind: 'other', parts: [] }],
  [{ kind: 'references', parts: [{ tag: 'unknown', label: 'Burn', explanation: 'Wrong' }] }],
  [{ kind: 'effect', parts: { label: 'Dmg', magnitude: '99', duration: null } }],
])('falls back to the exact plain bullet for missing/stale/unsupported metadata %#', (parts) => {
  const html = renderToStaticMarkup(
    <ManualArticle {...article()} body={body('Burn <literal> &', parts)} />,
  )
  expect(html).toContain('Burn &lt;literal&gt; &amp;')
  expect(html).not.toContain('data-combat-tag-reference')
  expect(html).not.toContain('data-compact-effect-label')
})
it('does not infer links from ordinary prose containing supported tag words', () => {
  const html = renderToStaticMarkup(
    <ManualArticle {...article()} body={body('Burn Fire Steam Drenched')} />,
  )
  expect(html).toContain('Burn Fire Steam Drenched')
  expect(html).not.toContain('data-combat-tag-reference')
})
