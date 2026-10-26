import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { SUPPORT_ACTION_IDS } from '@aurevane/game-core/combat/support-actions'
import { EffectTagLabel } from '@/components/character/compact-skill-effect-summary'
import { ContentRecordPreview } from './content-record-preview'
import { CombatContentAuthoringWorkspace } from './combat-content-authoring-workspace'
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
import { COMBAT_CONTENT_CATEGORIES } from '@/server/combat/combat-content-categories'
it.each(SUPPORT_ACTION_IDS)(
  'mounts the complete-record editor for independent %s authoring',
  (id) => {
    const definition = defaultBasicSkills().find((row) => row.id === id)!
    const record = {
      contentKey: id,
      contentKind: 'skill' as const,
      lifecycle: 'active' as const,
      revision: 1,
      versionFloor: 1,
      createdBy: null,
      createdAt: null,
      builtin: { contentVersion: 1, name: definition.name },
      builtinDefinition: { ...definition },
      current: null,
      draft: null,
      history: [],
      links: [],
      usedBy: [],
    }
    const props = {
      initialRecord: record,
      categories: COMBAT_CONTENT_CATEGORIES.map((row) => row.editor),
      initialPage: {
        records: [
          {
            contentKey: id,
            contentKind: 'skill' as const,
            lifecycle: 'active' as const,
            revision: 1,
            name: definition.name,
          },
        ],
        nextCursor: null,
      },
    }
    const html = renderToStaticMarkup(<CombatContentAuthoringWorkspace {...props} />)
    expect(html).toContain('Commit Now')
    expect(html).not.toContain('Publish saved draft')
    expect(html).not.toContain('aria-label="Content previews"')
    expect(html).toContain('Parameters')
    expect(html).toContain('History')
    expect(html).toContain('Identity &amp; Relations')
    expect(html).toContain('New')
    expect(html).toContain(definition.name)
    expect(html).not.toContain('Confirm rollback')
  },
)

it.each(['basic.recover', 'basic.recover.mp'])(
  'uses the shared full reader and distinct actual %s message receipt shape',
  (id) => {
    const definition = defaultBasicSkills().find((row) => row.id === id)!
    const html = renderToStaticMarkup(
      <ContentRecordPreview kind="skill" working={{ ...definition }} saved={null} current={null} />,
    )
    const text = html.replace(/<[^>]+>/g, '')
    expect(html).toContain('data-testid="skill-details"')
    expect(text).toContain(id === 'basic.recover' ? '+37 HP' : '+37 MP')
    if (id === 'basic.recover.mp') expect(text).not.toContain('+37 HP')
    expect(text).not.toMatch(/Accuracy|chanceBasisPoints/)
    expect(text).toContain('does not simulate a battle')
  },
)

it('renders current catalogue Tag wording in raw authoring previews without modifying the saved definition', () => {
  const definition = structuredClone(
    defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!,
  )
  const original = structuredClone(definition)
  const tag = {
    contentKey: 'tag.damage',
    contentVersion: 8,
    tagId: 'damage',
    name: 'Impact',
    compact: 'Changed damage wording.',
    full: 'Snapshot published explanation.',
  }
  const html = renderToStaticMarkup(
    <ContentRecordPreview
      kind="skill"
      working={{ ...definition }}
      saved={null}
      current={null}
      tagPresentations={[tag]}
    />,
  )
  expect(html).toContain('Explain Impact')
  // The real popover mounts its body only when opened; inspect the shared label's actual body separately.
  expect(
    renderToStaticMarkup(EffectTagLabel({ label: 'Damage', tagPresentation: tag }).props.children),
  ).toContain('Snapshot published explanation.')
  expect(html).toContain('data-tag-version="8"')
  expect(definition).toEqual(original)
  expect(definition.ability).not.toHaveProperty('tagPresentation')
})

it.each([
  ['unarmed.basic', { kind: 'basic-attack', scalingBasisPoints: 4225 }, '42.25%'],
  ['basic.move', { kind: 'basic-move', costBasis: 'per-terrain-point' }, 'per traversal point'],
  ['basic.move', { kind: 'basic-move', costBasis: 'flat' }, '20 AP'],
  [
    'basic.recover',
    { kind: 'basic-action', recoveryRounding: 'nearest' },
    'nearest whole resource amount',
  ],
  ['basic.recover.mp', { kind: 'basic-action', recoveryRounding: 'floor' }, 'resource amount down'],
] as const)(
  'retains %s native execution metadata in both actual reports (%j)',
  (id, execution, expected) => {
    const original = defaultBasicSkills().find((row) => row.id === id)!
    const html = renderToStaticMarkup(
      <ContentRecordPreview
        kind="skill"
        working={{ ...original, execution }}
        saved={null}
        current={null}
      />,
    )
    const reports = html
      .split('<summary>')
      .slice(1)
      .filter(
        (part) =>
          part.startsWith('Compact information') || part.startsWith('Full Skill information'),
      )
    expect(reports).toHaveLength(2)
    for (const report of reports) {
      expect(report.replace(/<[^>]+>/g, '')).toContain(expected)
      if (execution.kind === 'basic-move' && execution.costBasis === 'flat')
        expect(report).not.toContain('per traversal point')
    }
    expect(html).toContain('Illustrative character')
    expect(html).not.toMatch(/Accuracy|chanceBasisPoints/)
  },
)
it.each(['skill', 'essence'] as const)(
  'renders authored %s compact and activation before legacy fallback',
  (kind) => {
    const basic = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!
    const body = {
      ...basic,
      battleText: 'LEGACY narration {actor}.',
      presentation: {
        compact: 'DISTINCT compact {ability} costs {value.0.power}.',
        activation: 'DISTINCT activation {actor} spends {value.0.power} on {target}.',
      },
    }
    const definition =
      kind === 'essence' ? { id: 'essence.sample', name: 'Sample Essence', skill: body } : body
    const html = renderToStaticMarkup(
      <ContentRecordPreview kind={kind} working={definition} saved={null} current={null} />,
    )
    const text = html.replace(/<[^>]+>/g, '')
    expect(text).toContain(`DISTINCT compact ${basic.name} costs 6.`)
    expect(text).toContain('DISTINCT activation Sample author spends 6 on Sample target.')
    expect(text).not.toContain('LEGACY narration')
    const fallbackBody = { ...body, presentation: { compact: body.presentation.compact } }
    const fallback = kind === 'essence' ? { ...definition, skill: fallbackBody } : fallbackBody
    expect(
      renderToStaticMarkup(
        <ContentRecordPreview kind={kind} working={fallback} saved={null} current={null} />,
      ),
    ).toContain('LEGACY narration')
  },
)
it('uses protected finalized media URLs in the actual authoring preview', () => {
  const basic = defaultBasicSkills()[0]!
  const id = '11111111-1111-4111-8111-111111111111'
  const definition = {
    ...basic,
    media: {
      ...basic.media,
      artwork: {
        id,
        kind: 'image',
        contentType: 'image/png',
        checksum: 'a'.repeat(64),
        byteLength: 100,
        width: 64,
        height: 64,
        sourceWidth: 64,
        sourceHeight: 64,
        crop: { x: 0, y: 0, size: 64 },
      },
      audio: {
        id,
        kind: 'audio',
        contentType: 'audio/wav',
        checksum: 'b'.repeat(64),
        byteLength: 100,
        durationMs: 1000,
        channels: 1,
        sampleRate: 44100,
      },
    },
  }
  const html = renderToStaticMarkup(
    <ContentRecordPreview
      kind="skill"
      working={definition}
      saved={definition}
      current={definition}
    />,
  )
  expect(html).toContain(`src="/api/master/combat-content/media/${id}"`)
  expect(html).not.toContain(`src="/api/content-media/${id}"`)
})
