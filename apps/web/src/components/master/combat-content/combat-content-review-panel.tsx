'use client'

import styles from './combat-content-editor.module.css'
import {
  canPublishCombatContent,
  type CombatContentPreviewSummary,
  type CombatContentSemanticDiff,
  type CombatContentValidationResult,
  type CombatContentVersionHistoryEntry,
} from './combat-content-workflow'

export interface CombatContentReviewPanelProps {
  readonly contentKey: string
  readonly baseVersion: number
  readonly nextVersion: number
  readonly validation: CombatContentValidationResult | null
  readonly diff: CombatContentSemanticDiff | null
  readonly preview: CombatContentPreviewSummary | null
  readonly history: readonly CombatContentVersionHistoryEntry[]
  readonly busy: boolean
  readonly publishConfirmationOpen: boolean
  readonly rollbackTargetVersion: number | null
  readonly errorMessage?: string | null
  readonly noticeMessage?: string | null
  readonly onValidate: () => void
  readonly onDiff: () => void
  readonly onPreview: () => void
  readonly onRequestPublish: () => void
  readonly onConfirmPublish: () => void
  readonly onCancelPublish: () => void
  readonly onRequestRollback: (version: number) => void
  readonly onConfirmRollback: () => void
  readonly onCancelRollback: () => void
}

function percent(basisPoints: number): string {
  return `${Math.round(basisPoints / 100)}%`
}

export function CombatContentReviewPanel({
  contentKey,
  baseVersion,
  nextVersion,
  validation,
  diff,
  preview,
  history,
  busy,
  publishConfirmationOpen,
  rollbackTargetVersion,
  errorMessage = null,
  noticeMessage = null,
  onValidate,
  onDiff,
  onPreview,
  onRequestPublish,
  onConfirmPublish,
  onCancelPublish,
  onRequestRollback,
  onConfirmRollback,
  onCancelRollback,
}: CombatContentReviewPanelProps) {
  const review = { validation, diff, preview }
  const canPublish =
    canPublishCombatContent(review) && (diff?.changedPaths.length ?? 0) > 0 && !busy
  const canDiff = validation?.valid === true && !busy
  const canPreview = validation?.valid === true && diff !== null && !busy
  const hitChance = preview?.accuracy?.targetHitChances?.[0]
  const effectTypes =
    preview?.projections?.effects
      ?.map((effect) => effect.effectType)
      .filter((type): type is string => typeof type === 'string' && type.length > 0) ?? []
  const defaultRollback = [...history]
    .filter((entry) => !entry.current)
    .sort((left, right) => right.contentVersion - left.contentVersion)[0]

  return (
    <section
      className={styles.reviewPanel}
      id="combat-review"
      aria-labelledby="combat-review-heading"
    >
      <section className={styles.publicationCard}>
        <div className={styles.reviewHeader}>
          <div>
            <p className={styles.sectionLabel}>Publication status</p>
            <h2 id="combat-review-heading">Authoritative review</h2>
          </div>
          <span className={styles.publicationPill}>
            {history.find((entry) => entry.current) ? `v${baseVersion}` : 'Static'}
          </span>
        </div>
        <dl className={styles.publicationFacts}>
          <div>
            <dt>Current</dt>
            <dd>v{baseVersion}</dd>
          </div>
          <div>
            <dt>Next publish</dt>
            <dd>v{nextVersion}</dd>
          </div>
          <div>
            <dt>History</dt>
            <dd>{history.length} versions</dd>
          </div>
        </dl>
      </section>

      {errorMessage ? (
        <p className={styles.workflowError} role="alert">
          {errorMessage}
        </p>
      ) : null}
      {noticeMessage ? (
        <p className={styles.workflowNotice} role="status">
          {noticeMessage}
        </p>
      ) : null}

      <section className={styles.validationCard}>
        <div className={styles.dockHeading}>
          <div>
            <p className={styles.sectionLabel}>Validation</p>
            <strong>
              {validation === null ? 'Not validated' : validation.valid ? 'Valid' : 'Invalid'}
            </strong>
          </div>
          <div
            className={styles.reviewState}
            data-review-state={
              validation === null ? 'not-validated' : validation.valid ? 'valid' : 'invalid'
            }
          >
            <span>{validation?.valid ? '✓' : validation === null ? '○' : '!'}</span>
          </div>
        </div>

        <div className={styles.reviewActions}>
          <button type="button" disabled={busy} onClick={onValidate}>
            Validate
          </button>
          <button type="button" disabled={!canDiff} onClick={onDiff}>
            Diff
          </button>
          <button type="button" disabled={!canPreview} onClick={onPreview}>
            Preview
          </button>
          <button type="button" disabled={!canPublish} onClick={onRequestPublish}>
            Publish
          </button>
          <button
            type="button"
            disabled={busy || !defaultRollback}
            onClick={() => defaultRollback && onRequestRollback(defaultRollback.contentVersion)}
          >
            Rollback
          </button>
        </div>

        {validation && !validation.valid ? (
          <section className={styles.reviewBlock} aria-label="Validation issues">
            <h3>Validation issues</h3>
            <ul>
              {validation.issues.map((issue, index) => (
                <li key={`${issue.path}:${issue.code}:${index}`}>
                  <code>{issue.path}</code> — {issue.message}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>

      {diff ? (
        <section className={styles.reviewBlock} aria-label="Semantic diff">
          <div className={styles.dockHeading}>
            <h3>Semantic diff</h3>
            <span>{diff.changedPaths.length}</span>
          </div>
          {diff.changedPaths.length > 0 ? (
            <ul>
              {diff.changedPaths.map((path) => (
                <li key={path}>
                  <code>{path}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p>No semantic changes.</p>
          )}
        </section>
      ) : null}

      {preview ? (
        <section className={styles.reviewBlock} aria-label="Deterministic preview">
          <div className={styles.dockHeading}>
            <h3>Deterministic preview</h3>
            <span>{preview.legal === false ? 'Illegal' : 'Legal'}</span>
          </div>
          <dl className={styles.previewFacts}>
            <div>
              <dt>Legality</dt>
              <dd>{preview.legal === false ? 'Illegal in fixture' : 'Legal in fixture'}</dd>
            </div>
            {preview.costs?.actionEconomy !== undefined ? (
              <div>
                <dt>Action Economy</dt>
                <dd>{preview.costs.actionEconomy} AP</dd>
              </div>
            ) : null}
            {preview.costs?.mp !== undefined ? (
              <div>
                <dt>MP</dt>
                <dd>{preview.costs.mp} MP</dd>
              </div>
            ) : null}
            {hitChance ? (
              <div>
                <dt>First target hit chance</dt>
                <dd>{percent(hitChance.hitChanceBasisPoints)}</dd>
              </div>
            ) : null}
            {effectTypes.length > 0 ? (
              <div>
                <dt>Projected effects</dt>
                <dd>{effectTypes.join(', ')}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {publishConfirmationOpen ? (
        <section className={styles.confirmation} aria-label="Confirm publication">
          <p className={styles.sectionLabel}>Confirm publication</p>
          <h3>{contentKey}</h3>
          <div className={styles.confirmationFacts}>
            <span>Base v{baseVersion}</span>
            <span>New v{nextVersion}</span>
            <span>{validation?.valid ? 'Validation passed' : 'Validation missing'}</span>
          </div>
          <div className={styles.confirmationDiff}>
            <strong>Semantic changes</strong>
            <p>{diff?.changedPaths.join(', ') || 'None'}</p>
          </div>
          <div className={styles.confirmationActions}>
            <button type="button" disabled={busy} onClick={onCancelPublish}>
              Cancel
            </button>
            <button type="button" disabled={!canPublish} onClick={onConfirmPublish}>
              Confirm publish
            </button>
          </div>
        </section>
      ) : null}

      <section
        className={styles.history}
        aria-labelledby="version-history-heading"
        id="combat-history"
      >
        <div className={styles.dockHeading}>
          <div>
            <p className={styles.sectionLabel}>Recent history</p>
            <h3 id="version-history-heading">Version history</h3>
          </div>
          <span>{history.length}</span>
        </div>
        <div className={styles.historyList}>
          {[...history]
            .sort((left, right) => right.contentVersion - left.contentVersion)
            .map((entry) => (
              <div className={styles.historyRow} key={entry.contentVersion}>
                <div>
                  <strong>v{entry.contentVersion}</strong>
                  <span>
                    {entry.source === 'static-baseline' ? 'Static baseline' : 'Published'}
                    {entry.current ? ' · Current' : ''}
                  </span>
                </div>
                {entry.current ? (
                  <span className={styles.currentPill}>Current</span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRequestRollback(entry.contentVersion)}
                  >
                    Rollback
                  </button>
                )}
              </div>
            ))}
        </div>
      </section>

      {rollbackTargetVersion !== null ? (
        <section className={styles.confirmation} aria-label="Confirm rollback">
          <p className={styles.sectionLabel}>Confirm rollback to v{rollbackTargetVersion}</p>
          <h3>Repoint current publication</h3>
          <p>
            History is preserved. New battles and current-definition reads will resolve the selected
            version after the server accepts the rollback.
          </p>
          <div className={styles.confirmationActions}>
            <button type="button" disabled={busy} onClick={onCancelRollback}>
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={onConfirmRollback}>
              Confirm rollback
            </button>
          </div>
        </section>
      ) : null}
    </section>
  )}
