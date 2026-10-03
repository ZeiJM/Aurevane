import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { BattleSkillParameters } from '../battle/battle-skill-parameters'
import { BasicActionEffectSummary } from './basic-action-effect-details'
import { CompactSkillEffectSummary } from './compact-skill-effect-summary'
import { ResonanceParameters } from './resonance-parameters'
import { SkillDetails } from './skill-details'
import { SkillEffectTimingProvider } from './skill-effect-timing-context'

const timingMarks = (markup: string) => markup.match(/data-compact-effect-timing="true"/g) ?? []

it('shows configured Instant tags across current Skill, Support and Resonance reports without mutating definitions', () => {
  const definition = resolveMatureSkillVersion('wildwarden.snare')!
  const resonance = resolveResonanceForPair('wildwarden', 'edgedancer')!
  const before = JSON.stringify({ definition, resonance })
  const policy = {
    version: 2,
    modes: { root: 'instant' as const, 'mp-recovery': 'next-round' as const },
  }
  const markup = renderToStaticMarkup(
    <SkillEffectTimingProvider policy={policy}>
      <SkillDetails skill={definition} expanded />
      <BattleSkillParameters
        skill={{
          definition,
          id: definition.id,
          name: 'Snare',
          apCost: definition.apCost,
          mpCost: definition.mpCost ?? 0,
          targetKind: 'unit',
          targetTeamPolicy: 'enemy',
          minimumRange: 0,
          maximumRange: 6,
          tags: definition.tags,
          effectDescriptions: [],
          requirementDescriptions: [],
        }}
      />
      <BasicActionEffectSummary id="basic.guard" />
      <BasicActionEffectSummary id="basic.recover" />
      <BasicActionEffectSummary id="basic.recover.mp" />
      <ResonanceParameters definition={resonance} />
    </SkillEffectTimingProvider>,
  )
  expect(markup).toContain('Root [1 Turn] [Instant]')
  expect(timingMarks(markup)).toHaveLength(2) // Snare and HP Recovery; MP recovery is configured delayed.
  expect(JSON.stringify({ definition, resonance })).toBe(before)
})

it('uses a battle’s pinned policy rather than newer Master timing, including legacy snapshots', () => {
  const root = {
    type: 'apply-status' as const,
    recipient: 'actor' as const,
    statusId: 'root',
    stacks: 1,
    durationTurns: 1,
  }
  const damage = { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 9 }
  const markup = renderToStaticMarkup(
    <SkillEffectTimingProvider policy={{ version: 3, modes: { root: 'instant' } }}>
      <section id="current">
        <CompactSkillEffectSummary effect={root} />
      </section>
      <SkillEffectTimingProvider policy={{ version: 1, modes: {} }}>
        <section id="pinned">
          <CompactSkillEffectSummary effect={root} />
        </section>
      </SkillEffectTimingProvider>
      <SkillEffectTimingProvider policy={null}>
        <section id="legacy">
          <CompactSkillEffectSummary effect={root} />
          <CompactSkillEffectSummary effect={damage} />
        </section>
      </SkillEffectTimingProvider>
    </SkillEffectTimingProvider>,
  )
  const section = (id: string) =>
    markup.match(new RegExp(`<section id="${id}">(.*?)</section>`))![1]!
  expect(timingMarks(section('current'))).toHaveLength(1)
  expect(timingMarks(section('pinned'))).toHaveLength(0)
  expect(timingMarks(section('legacy'))).toHaveLength(1)
})

it('keeps the Copy report aligned with the battle’s pinned mechanic', () => {
  const effect = { type: 'copy' as const, recipient: 'primary-unit' as const }
  const markup = renderToStaticMarkup(
    <>
      <section id="current-copy">
        <CompactSkillEffectSummary effect={effect} />
      </section>
      <SkillEffectTimingProvider policy={null} copyPolicyVersion={null}>
        <section id="historical-copy">
          <CompactSkillEffectSummary effect={effect} />
        </section>
      </SkillEffectTimingProvider>
    </>,
  )
  expect(markup).toContain('>Copy</span>')
  expect(markup).toContain('>Skill Copy</span>')
})

it('ignores obsolete authored Copy claims for the current policy but preserves historical wording', () => {
  const base = resolveMatureSkillVersion('wildwarden.snare')!
  const skill = {
    ...base,
    effects: [{ type: 'copy' as const, recipient: 'primary-unit' as const }],
    effectDescriptions: ['Grants an enemy Skill at half AP.'],
  }
  const current = renderToStaticMarkup(<SkillDetails skill={skill} expanded />)
  expect(current).toContain('beneficial effect tags')
  expect(current).not.toContain('half AP')
  const historical = renderToStaticMarkup(
    <SkillEffectTimingProvider policy={null} copyPolicyVersion={null}>
      <SkillDetails skill={skill} expanded />
    </SkillEffectTimingProvider>,
  )
  expect(historical).toContain('Grants an enemy Skill at half AP.')
})
