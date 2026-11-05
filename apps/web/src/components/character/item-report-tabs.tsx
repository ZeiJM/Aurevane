'use client'
import { useId, useState } from 'react'
import type { ItemPresentation } from '@/lib/items/item-presentation'
import { AbilityParameters } from './ability-parameters'
import { AbilityEffectExplanations } from './ability-effect-explanations'
import reportStyles from './item-details.module.css'
import styles from './item-report-tabs.module.css'

type Reports = ItemPresentation['reports']
function ItemReports({ reports }: { reports: Reports }) {
  return (
    <>
      <div className={reportStyles.reports}>
        {reports.map((report) => (
          <section key={report.behaviorId}>
            <h4>{report.name}</h4>
            <AbilityParameters
              report={report}
              characteristicsClassName={reportStyles.characteristics}
              showEffectExplanations={false}
              showMaintenance={false}
            />
          </section>
        ))}
      </div>
      <AbilityEffectExplanations reports={reports} className={reportStyles.explanations} />
    </>
  )
}

/** The caller supplies a Support identity only for a weapon with an available technique. */
export function ItemReportTabs({
  itemId,
  reports,
  supportBehaviorId,
}: {
  itemId: string
  reports: Reports
  supportBehaviorId?: string
}) {
  const id = useId()
  const technique = reports.find((report) => report.behaviorId === supportBehaviorId)
  const identity = JSON.stringify([itemId, technique?.behaviorId ?? null])
  const [selection, setSelection] = useState({ identity, index: 0 })
  if (selection.identity !== identity) setSelection({ identity, index: 0 })
  const active = selection.identity === identity ? selection.index : 0
  if (!technique) return <ItemReports reports={reports} />
  const sections = [
    {
      label: 'Item Details',
      reports: reports.filter((report) => report.behaviorId !== technique.behaviorId),
    },
    { label: 'Imbued Technique', reports: [technique] },
  ]
  return (
    <>
      <div role="tablist" aria-label="Item information" className={styles.tabs}>
        {sections.map((section, index) => (
          <button
            key={section.label}
            type="button"
            role="tab"
            id={`${id}-${index}-tab`}
            aria-controls={`${id}-${index}-panel`}
            aria-selected={active === index}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setSelection({ identity, index })}
            onKeyDown={(event) => {
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? 1
                    : event.key === 'ArrowRight' || event.key === 'ArrowLeft'
                      ? 1 - index
                      : null
              if (next === null) return
              event.preventDefault()
              setSelection({ identity, index: next })
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [next]?.focus()
            }}
          >
            {section.label}
          </button>
        ))}
      </div>
      {sections.map((section, index) => (
        <div
          key={section.label}
          role="tabpanel"
          id={`${id}-${index}-panel`}
          aria-labelledby={`${id}-${index}-tab`}
          hidden={active !== index}
        >
          <ItemReports reports={section.reports} />
        </div>
      ))}
    </>
  )
}
