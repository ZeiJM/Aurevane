'use client'
import { useId, useState } from 'react'
import type { ItemPresentation } from '@/lib/items/item-presentation'
import { AbilityParameters } from './ability-parameters'
import { AbilityEffectExplanations } from './ability-effect-explanations'
import reportStyles from './item-details.module.css'
import styles from './item-report-tabs.module.css'
import { itemClassLabel } from '@/lib/items/item-class-label'
import { SkillCharacteristicRows } from './skill-characteristic-rows'
import type { SkillCharacteristic } from './skill-information-contract'

type Reports = ItemPresentation['reports']
type ItemCharacteristics = Pick<ItemPresentation, 'itemClass' | 'qualityPoints' | 'actions'>
function ItemReports({ reports, item }: { reports: Reports; item?: ItemCharacteristics }) {
  return (
    <>
      <div className={reportStyles.reports}>
        {!reports.length && item ? (
          <dl className={reportStyles.characteristics}>
            <SkillCharacteristicRows
              rows={[
                ['Item Type', itemClassLabel(item.itemClass)],
                ['Cost', `${item.qualityPoints} QP`],
              ]}
            />
          </dl>
        ) : null}
        {reports.map((report) => (
          <section key={report.behaviorId}>
            <h4>{report.name}</h4>
            <AbilityParameters
              report={report}
              rows={
                item
                  ? report.rows.flatMap<SkillCharacteristic>(([label, value]) =>
                      label === 'Skill Type'
                        ? [['Item Type', itemClassLabel(item.itemClass)]]
                        : label === 'Cost'
                          ? [
                              ['Cost', `${item.qualityPoints} QP`],
                              ...(Object.values(item.actions).some(
                                (action) => action.behaviorId === report.behaviorId,
                              )
                                ? [['Use Cost', value] as const]
                                : []),
                            ]
                          : [[label, value]],
                    )
                  : undefined
              }
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
  itemCharacteristics,
}: {
  itemId: string
  reports: Reports
  supportBehaviorId?: string
  itemCharacteristics?: ItemCharacteristics
}) {
  const id = useId()
  const technique = reports.find((report) => report.behaviorId === supportBehaviorId)
  const identity = JSON.stringify([itemId, technique?.behaviorId ?? null])
  const [selection, setSelection] = useState({ identity, index: 0 })
  if (selection.identity !== identity) setSelection({ identity, index: 0 })
  const active = selection.identity === identity ? selection.index : 0
  if (!technique) return <ItemReports reports={reports} item={itemCharacteristics} />
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
          <ItemReports
            reports={section.reports}
            item={index === 0 ? itemCharacteristics : undefined}
          />
        </div>
      ))}
    </>
  )
}
