import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import { BattleSkillParameters } from './battle-skill-parameters'
import { SkillEffectTimingProvider } from '../character/skill-effect-timing-context'
import type { BattleSkillForecastPresentation } from './battle-runtime'

const rules: readonly { effect: MatureSkillEffectDefinition; current: string; legacy: string }[] = [
  {
    effect: { type: 'damage', recipient: 'primary-unit', amount: 20, shattersBarrier: true },
    current: 'Pierce cannot critically hit.',
    legacy: 'Skill power ranges from 1 to 20',
  },
  {
    effect: { type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 1000 },
    current: 'consumes',
    legacy: 'Increases Damage by 10%',
  },
  {
    effect: {
      type: 'reversal',
      recipient: 'actor',
      version: 1,
      family: 'physical',
      reflectionBasisPoints: 40000,
      attackerMaxHpCapBasisPoints: 4000,
      defenderMaxHpCapBasisPoints: 6000,
    },
    current: 'Remains armed until triggered or cancelled.',
    legacy: 'Expires at the next actual owner turn',
  },
]
it.each(rules)(
  'uses actual provider-captured current and legacy $effect.type rules in native Skill Parameters',
  ({ effect, current: currentText, legacy }) => {
    const original = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
    const definition = {
      ...original,
      ability: undefined,
      effects: [effect],
      effectDescriptions: [],
    }
    const skill: BattleSkillForecastPresentation = {
      definition,
      id: definition.id,
      name: definition.name ?? definition.id,
      apCost: definition.apCost,
      mpCost: definition.mpCost ?? 0,
      minimumRange: definition.target.minimumRange,
      maximumRange: definition.target.maximumRange,
      targetKind: definition.target.kind,
      targetTeamPolicy: definition.target.teamPolicy,
      tags: [],
      effectDescriptions: [],
      requirementDescriptions: [],
    }
    const before = JSON.stringify(skill)
    for (const current of [false, true]) {
      const html = renderToStaticMarkup(
        <SkillEffectTimingProvider
          policy={null}
          pierceCriticalPolicyVersion={current ? 1 : null}
          ruinPolicyVersion={current ? 1 : null}
          reversalPolicyVersion={current ? 1 : null}
        >
          <BattleSkillParameters skill={skill} />
        </SkillEffectTimingProvider>,
      )
      expect(html).toContain(current ? currentText : legacy)
      if (!current) expect(html).not.toContain(currentText)
      if (effect.type === 'reversal') expect(html.includes('Until next owner turn')).toBe(!current)
    }
    expect(JSON.stringify(skill)).toBe(before)
  },
)
