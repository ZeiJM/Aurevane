'use client'
import type { CombatContentPreviewSummary } from './combat-content-workflow'
import { HistoricalResonanceSample } from './historical-resonance-sample'
import styles from './combat-content-editor.module.css'
function percent(basisPoints: number) {
  return `${Math.round(basisPoints / 100)}%`
}
/** Shared native receipt display. No lifecycle mutation or publication precondition. */
export function CombatContentPreviewReport({
  preview,
  requireLegalPreview = false,
}: {
  preview: CombatContentPreviewSummary | null
  requireLegalPreview?: boolean
}) {
  const hitChance = preview?.accuracy?.targetHitChances?.[0]
  const effectTypes =
    preview?.projections?.effects
      ?.map((effect) => effect.effectType)
      .filter((type): type is string => typeof type === 'string' && type.length > 0) ?? []
  return (
    <>
      {preview?.historicalSample ? (
        <HistoricalResonanceSample
          sample={preview.historicalSample}
          simulation={preview.simulation}
        />
      ) : preview ? (
        <section className={styles.reviewBlock} aria-label="Deterministic preview">
          {!requireLegalPreview && preview.legal === false ? (
            <>
              <p role="status">
                Unavailable in this sample battle. Validated changes can still be published.
              </p>
              {preview.issues?.length ? (
                <ul aria-label="Preview issues">
                  {preview.issues.map((issue, index) => (
                    <li key={`${issue.code}:${index}`}>{issue.message}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
          <div className={styles.dockHeading}>
            <h3>Deterministic preview</h3>
            <span>{preview.legal === false ? 'Illegal' : 'Legal'}</span>
          </div>
          {preview.simulation?.preparation === 'free-controlled-prime' ? (
            <p>
              Free Controlled prime prepared in this fixture. Costs and outcomes below describe its
              release.
            </p>
          ) : null}
          {preview.referenceAction ? (
            <p>
              Combined command with reference action {preview.referenceAction.id} v
              {preview.referenceAction.contentVersion}
              {preview.referenceAction.behaviorId
                ? `, group ${preview.referenceAction.behaviorId}`
                : ''}
              .{' '}
              {preview.eventSample
                ? 'The forecast and costs describe the reference action. The local event sample below includes reaction payments and actual outcomes.'
                : preview.modifier?.activation === 'ongoing'
                  ? 'Native Requirements determine which Ongoing bonuses apply to this reference command. There is no separate modifier activation cost.'
                  : 'Costs and projections include the root and selected modifier.'}
            </p>
          ) : null}
          <dl className={styles.previewFacts}>
            {preview.behaviorId ? (
              <div>
                <dt>Action group</dt>
                <dd>{preview.behaviorId}</dd>
              </div>
            ) : null}
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
            {preview.costs?.hp !== undefined ? (
              <div>
                <dt>HP</dt>
                <dd>{preview.costs.hp} HP</dd>
              </div>
            ) : null}
            {preview.movement ? (
              <div>
                <dt>Move</dt>
                <dd>
                  {Math.max(0, preview.movement.path.length - 1)}{' '}
                  {preview.movement.path.length === 2 ? 'tile' : 'tiles'}
                </dd>
              </div>
            ) : null}
            {hitChance ? (
              <div>
                <dt>First target hit chance</dt>
                <dd>{percent(hitChance.hitChanceBasisPoints)}</dd>
              </div>
            ) : null}
            {preview.groundAreas?.map((area) => (
              <div key={area.id}>
                <dt>Ground area</dt>
                <dd>
                  {area.tiles.length} tiles · {area.expiresAtRound - area.activationRound} rounds ·{' '}
                  {area.visualPresetId}
                </dd>
              </div>
            ))}
            {effectTypes.length > 0 ? (
              <div>
                <dt>Projected effects</dt>
                <dd>{effectTypes.join(', ')}</dd>
              </div>
            ) : null}
          </dl>
          {preview.eventSample ? (
            <div aria-label="Local event sample">
              <h3>Local event sample</h3>
              <p role="status">
                {!preview.eventSample.ran
                  ? 'Reference command unavailable; no sample ran.'
                  : preview.eventSample.activated
                    ? 'Activated in this sample'
                    : 'Not activated in this sample'}
              </p>
              <p>
                This seeded local sample executes one reference command. Its hits and reactions are
                separate from the forecast above; no real battle is changed.
              </p>
              <dl className={styles.previewFacts}>
                <div>
                  <dt>Owner HP</dt>
                  <dd>
                    {preview.eventSample.owner.hpBefore} → {preview.eventSample.owner.hpAfter} /{' '}
                    {preview.eventSample.owner.maxHp}
                  </dd>
                </div>
                <div>
                  <dt>Owner MP</dt>
                  <dd>
                    {preview.eventSample.owner.mpBefore} → {preview.eventSample.owner.mpAfter} /{' '}
                    {preview.eventSample.owner.maxMp}
                  </dd>
                </div>
                <div>
                  <dt>Owner AP</dt>
                  <dd>
                    {preview.eventSample.owner.apBefore} → {preview.eventSample.owner.apAfter}
                  </dd>
                </div>
                <div>
                  <dt>Owner Barrier</dt>
                  <dd>
                    {preview.eventSample.owner.barrierBefore} →{' '}
                    {preview.eventSample.owner.barrierAfter}
                  </dd>
                </div>
                {preview.eventSample.ownerStatusChanges.length ? (
                  <div>
                    <dt>Owner status changes</dt>
                    <dd>
                      {preview.eventSample.ownerStatusChanges
                        .map((row) => `${row.name} ${row.kind}`)
                        .join(' · ')}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  )
}
