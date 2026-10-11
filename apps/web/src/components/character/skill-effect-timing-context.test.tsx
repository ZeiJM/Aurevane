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
  expect(markup).toContain('Rooted [1 Turn] [Instant]')
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

it('uses saved elemental policy across full reports and retains policy 1 and absent history', () => {
  const base = resolveMatureSkillVersion('tidecaller.water-lance')!
  const water = {
    ...base,
    effects: [
      {
        type: 'damage' as const,
        recipient: 'affected-units' as const,
        amount: 10,
        element: 'water' as const,
      },
      {
        type: 'apply-status' as const,
        recipient: 'primary-unit' as const,
        statusId: 'wet',
        stacks: 1,
        durationTurns: 4,
        potencyBasisPoints: 4200,
      },
    ],
    effectDescriptions: [],
  }
  const fire = {
    ...water,
    effects: [
      {
        type: 'damage' as const,
        recipient: 'primary-unit' as const,
        amount: 10,
        element: 'fire' as const,
      },
    ],
  }
  const markup = (version: 1 | 2 | null) =>
    renderToStaticMarkup(
      <SkillEffectTimingProvider
        policy={{ version: 8, modes: { wet: 'delayed' } }}
        elementalDamagePolicyVersion={version}
      >
        <SkillDetails skill={water} expanded />
        <SkillDetails skill={fire} expanded />
      </SkillEffectTimingProvider>,
    )
  const current = markup(2)
  expect(current).toContain('42% Storm damage')
  expect(current).toContain(
    '4 full rounds starting two round boundaries after damage settles (Delayed)',
  )
  expect(current).toContain('10%, capped at 100%')
  expect(current).not.toContain('Otherwise:')
  expect(current).not.toContain('removes Drenched and Chilled')
  expect(current).toContain('Enemy / Ground')
  const oldModern = markup(1)
  expect(oldModern).toContain('Otherwise:')
  expect(oldModern).toContain('removes Drenched and Chilled')
  expect(oldModern).toContain('Initiative by 10% once')
  const legacy = markup(null)
  expect(legacy).toContain('removes Wet and Frozen')
  expect(legacy).not.toContain('Enemy / Ground')
})

it('shows default Instant only on elemental tags that overlap typed damage across reports', () => {
  const base = resolveMatureSkillVersion('tidecaller.water-lance')!
  const wet = {
    type: 'apply-status' as const,
    recipient: 'primary-unit' as const,
    statusId: 'wet',
    stacks: 1,
    durationTurns: 2,
    potencyBasisPoints: 3500,
  }
  const skill = {
    ...base,
    effects: [
      {
        type: 'damage' as const,
        recipient: 'primary-unit' as const,
        amount: 10,
        element: 'water' as const,
      },
      wet,
      { ...wet, recipient: 'actor' as const },
    ],
    effectDescriptions: [],
  }
  const markup = renderToStaticMarkup(
    <SkillEffectTimingProvider policy={{ version: 7, modes: {} }}>
      <SkillDetails skill={skill} expanded />
      <BattleSkillParameters
        skill={{
          definition: skill,
          id: skill.id,
          name: 'Water Lance',
          apCost: skill.apCost,
          mpCost: skill.mpCost ?? 0,
          targetKind: 'unit',
          targetTeamPolicy: 'enemy',
          minimumRange: 0,
          maximumRange: 6,
          tags: skill.tags,
          effectDescriptions: [],
          requirementDescriptions: [],
        }}
      />
    </SkillEffectTimingProvider>,
  )
  expect(markup).toContain('Drenched [35%] [2 Turns] [Instant]')
  expect(timingMarks(markup)).toHaveLength(1) // Battle’s overlapping tag; its actor tag remains Normal.
  expect(markup).toContain('2 affected turns starting when damage settles (Instant)')
  expect(markup).toContain('2 full rounds starting next round after the effect activates')
})

it('qualifies Flame Burst persistence as Ground casts only in current dual-intent reports', () => {
  const definition = resolveMatureSkillVersion('cinderweaver.flame-burst')!
  const report = (version: 1 | 2 | null) =>
    renderToStaticMarkup(
      <SkillEffectTimingProvider
        policy={{ version: 7, modes: { 'ground-area': 'next-round' } }}
        elementalDamagePolicyVersion={version}
      >
        <SkillDetails skill={definition} expanded />
        <BattleSkillParameters
          skill={{
            definition,
            id: definition.id,
            name: 'Flame Burst',
            apCost: definition.apCost,
            mpCost: definition.mpCost ?? 0,
            targetKind: definition.target.kind,
            targetTeamPolicy: definition.target.teamPolicy,
            minimumRange: definition.target.minimumRange,
            maximumRange: definition.target.maximumRange,
            tags: definition.tags,
            effectDescriptions: [],
            requirementDescriptions: [],
          }}
        />
      </SkillEffectTimingProvider>,
    )
  const current = report(2)
  expect(current.match(/Ground casts: /g)).toHaveLength(2)
  expect(current).toContain('3 rounds · starting next round')
  expect(report(1)).not.toContain('Ground casts:')
  expect(report(null)).not.toContain('Ground casts:')
  expect(report(1)).toContain('3 rounds · starting next round')
  expect(report(null)).toContain('3 rounds · starting next round')
})
