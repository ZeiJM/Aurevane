import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { CombatContentReviewPanel } from './combat-content-review-panel'

const history = [
  {
    contentVersion: 3,
    source: 'static-baseline' as const,
    current: true,
    publishedAt: null,
  },
  {
    contentVersion: 4,
    source: 'published' as const,
    current: false,
    publishedAt: '2026-09-17T12:00:00.000Z',
  },
]

describe('Master Panel combat content review panel', () => {
  it('keeps Publish disabled before a current successful review exists', () => {
    const markup = renderToStaticMarkup(
      createElement(CombatContentReviewPanel, {
        contentKey: 'vanguard.forceful-strike',
        baseVersion: 3,
        nextVersion: 5,
        validation: null,
        diff: null,
        preview: null,
        history,
        busy: false,
        publishConfirmationOpen: false,
        rollbackTargetVersion: null,
        onValidate: vi.fn(),
        onDiff: vi.fn(),
        onPreview: vi.fn(),
        onRequestPublish: vi.fn(),
        onConfirmPublish: vi.fn(),
        onCancelPublish: vi.fn(),
        onRequestRollback: vi.fn(),
        onConfirmRollback: vi.fn(),
        onCancelRollback: vi.fn(),
      }),
    )

    expect(markup).toContain('>Publish</button>')
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('Not validated')
  })

  it('shows semantic diff and deterministic preview after review', () => {
    const markup = renderToStaticMarkup(
      createElement(CombatContentReviewPanel, {
        contentKey: 'vanguard.forceful-strike',
        baseVersion: 3,
        nextVersion: 5,
        validation: {
          valid: true,
          issues: [],
          derivedTags: ['Enemy', 'Single', 'Dmg'],
        },
        diff: { changedPaths: ['apCost', 'effects'] },
        preview: {
          legal: true,
          costs: { actionEconomy: 40, mp: 3 },
          targeting: { affectedCombatantIds: ['master-preview-enemy'] },
          accuracy: {
            projectionsAssumeHits: true,
            targetHitChances: [
              { targetCombatantId: 'master-preview-enemy', hitChanceBasisPoints: 7500 },
            ],
          },
          projections: { effects: [{ effectType: 'damage' }] },
        },
        history,
        busy: false,
        publishConfirmationOpen: false,
        rollbackTargetVersion: null,
        onValidate: vi.fn(),
        onDiff: vi.fn(),
        onPreview: vi.fn(),
        onRequestPublish: vi.fn(),
        onConfirmPublish: vi.fn(),
        onCancelPublish: vi.fn(),
        onRequestRollback: vi.fn(),
        onConfirmRollback: vi.fn(),
        onCancelRollback: vi.fn(),
      }),
    )

    expect(markup).toContain('Valid')
    expect(markup).toContain('apCost')
    expect(markup).toContain('effects')
    expect(markup).toContain('40 AP')
    expect(markup).toContain('3 MP')
    expect(markup).toContain('75%')
    expect(markup).toContain('damage')
  })

  it('shows explicit publish confirmation with content key, base, new version, validation, and diff', () => {
    const markup = renderToStaticMarkup(
      createElement(CombatContentReviewPanel, {
        contentKey: 'vanguard.forceful-strike',
        baseVersion: 3,
        nextVersion: 5,
        validation: {
          valid: true,
          issues: [],
          derivedTags: ['Enemy', 'Single', 'Dmg'],
        },
        diff: { changedPaths: ['apCost'] },
        preview: { legal: true },
        history,
        busy: false,
        publishConfirmationOpen: true,
        rollbackTargetVersion: null,
        onValidate: vi.fn(),
        onDiff: vi.fn(),
        onPreview: vi.fn(),
        onRequestPublish: vi.fn(),
        onConfirmPublish: vi.fn(),
        onCancelPublish: vi.fn(),
        onRequestRollback: vi.fn(),
        onConfirmRollback: vi.fn(),
        onCancelRollback: vi.fn(),
      }),
    )

    expect(markup).toContain('Confirm publication')
    expect(markup).toContain('vanguard.forceful-strike')
    expect(markup).toContain('Base v3')
    expect(markup).toContain('New v5')
    expect(markup).toContain('Validation passed')
    expect(markup).toContain('apCost')
    expect(markup).toContain('>Confirm publish</button>')
  })

  it('renders immutable version history and rollback confirmation without a delete action', () => {
    const markup = renderToStaticMarkup(
      createElement(CombatContentReviewPanel, {
        contentKey: 'vanguard.forceful-strike',
        baseVersion: 3,
        nextVersion: 5,
        validation: null,
        diff: null,
        preview: null,
        history,
        busy: false,
        publishConfirmationOpen: false,
        rollbackTargetVersion: 4,
        onValidate: vi.fn(),
        onDiff: vi.fn(),
        onPreview: vi.fn(),
        onRequestPublish: vi.fn(),
        onConfirmPublish: vi.fn(),
        onCancelPublish: vi.fn(),
        onRequestRollback: vi.fn(),
        onConfirmRollback: vi.fn(),
        onCancelRollback: vi.fn(),
      }),
    )

    expect(markup).toContain('Version history')
    expect(markup).toContain('v3')
    expect(markup).toContain('Static baseline')
    expect(markup).toContain('v4')
    expect(markup).toContain('Published')
    expect(markup).toContain('Confirm rollback to v4')
    expect(markup).toContain('History is preserved')
    expect(markup).not.toContain('Delete version')
  })
})
