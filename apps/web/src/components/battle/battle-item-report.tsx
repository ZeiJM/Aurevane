import type { BattleItemPresentation } from '@/lib/battle/battle-item-presentation'
import { AbilityParameters } from '../character/ability-parameters'
import { AbilityEffectExplanations } from '../character/ability-effect-explanations'

/** The cockpit and picker read the same captured Item mechanics, without inventory headers. */
export function BattleItemReport({ item }: { item: BattleItemPresentation }) {
  const reports = item.behaviors.map((report) => ({
    ...report,
    limits: report.limits.filter(
      (limit) => limit !== `${item.maximumUsesPerBattle} uses per battle`,
    ),
  }))
  return (
    <article data-battle-item-report="true">
      <strong>Parameters</strong>
      {reports.map((report) => (
        <section key={report.behaviorId}>
          <AbilityParameters
            report={report}
            showEffectExplanations={false}
            showMaintenance={false}
          />
        </section>
      ))}
      <AbilityEffectExplanations reports={reports} />
    </article>
  )
}
