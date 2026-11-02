import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { cloneElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { skillPreviewEffects } from './skill-effect-preview'
import { SkillDetails } from './skill-details'
import { SkillGroundAreaDetails } from './skill-ground-area-details'
import { SkillEffectTimingProvider } from './skill-effect-timing-context'
import { currentGroundBehaviorPresentation } from '@/lib/combat-ground-presentation'
import { previewEffectWithTag } from './skill-effect-preview'
import { BattleSkillParameters } from '../battle/battle-skill-parameters'
import { SummonAbilityList, SummonAbilityReader } from '../battle/summon-ability-list'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import { createTechniquesManualArticle } from '@/content/techniques-manual'

function mist(id = 'frostweaver.chilling-mist') {
  const proposals = JSON.parse(
    readFileSync(
      new URL(
        '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { records: { id: string; after: MatureSkillDefinition }[] }
  return proposals.records.find((row) => row.id === id)!.after
}
const current = {
  groundContactPolicyVersion: 1 as const,
  legacyFrozenGround: false,
  legacyElemental: false,
  explicitElemental: true,
}
const timingPolicy = { version: 1 as const, modes: {} }
function nativeMist(): MatureSkillDefinition {
  const source = mist()
  const { ability: _canonical, ...native } = source
  void _canonical
  return native
}

it('describes the current native retained Mist as one Slow and one Chilled field without cached AP prose', () => {
  const source = nativeMist()
  const skill = {
    ...source,
    effects: source.effects.map((effect) =>
      effect.type === 'create-terrain' ? { ...effect, skillApSurcharge: 100 } : effect,
    ),
    effectDescriptions: [
      'Frozen Ground adds 100 AP per Skill.',
      'Keep this independent Slow note.',
      null,
    ],
    tagPresentation: [
      {
        contentKey: 'tag.create-terrain',
        contentVersion: 1,
        tagId: 'create-terrain',
        name: 'Frozen Ground',
        full: 'Frozen Ground adds 100 AP per Skill.',
        compact: '+100 Skill AP',
      },
      {
        contentKey: 'tag.frozen',
        contentVersion: 1,
        tagId: 'frozen',
        name: 'Chilled',
        full: 'Cannot change final facing.',
        compact: 'Cannot change final facing.',
      },
    ] as const,
  }
  const bytes = JSON.stringify(skill)
  const hash = createHash('sha256').update(bytes).digest('hex')
  const effects = skillPreviewEffects(skill, current)
  expect(effects.map((effect) => effect.label)).toEqual(['Slow Ground', 'Chilled Ground'])
  expect(JSON.stringify(effects)).not.toMatch(/Frozen Ground|100.*AP|surcharge/)
  expect(JSON.stringify(effects)).toContain('Keep this independent Slow note.')
  expect(JSON.stringify(skill)).toBe(bytes)
  expect(createHash('sha256').update(JSON.stringify(skill)).digest('hex')).toBe(hash)
})

it('does not claim Fire converts current contact fields to Steam, while preserving captured historical help', () => {
  const source = mist('cinderweaver.flame-burst')
  const behavior = source.ability!.behaviors[0]!
  const bytes = JSON.stringify(source)
  const present = abilityBehaviorInformation(behavior, { timingPolicy, effectContext: current })
  expect(JSON.stringify(present)).not.toContain('Fire converts affected Frozen Ground to Steam')
  const history = abilityBehaviorInformation(behavior, {
    timingPolicy,
    effectContext: { ...current, groundContactPolicyVersion: null },
  })
  expect(JSON.stringify(history)).toContain('Fire converts affected Frozen Ground to Steam')
  expect(JSON.stringify(source)).toBe(bytes)
})

it('uses the same current mapping for the canonical retained source and preserves conditional wrapper identity', () => {
  const source = mist()
  const behavior = source.ability!.behaviors[0]!
  const conditional = {
    ...behavior,
    effects: behavior.effects.map((effect) =>
      effect.id === 'entry-2'
        ? {
            ...effect,
            requirements: {
              kind: 'status-presence' as const,
              subject: 'owner' as const,
              statusId: 'inspired',
              present: true,
            },
          }
        : effect,
    ),
  }
  const bytes = JSON.stringify(conditional)
  const hash = createHash('sha256').update(bytes).digest('hex')
  const report = abilityBehaviorInformation(conditional, { timingPolicy, effectContext: current })
  expect(report.effects.map((effect) => effect.parts.label)).toEqual([
    'Slow Ground',
    'Chilled Ground',
  ])
  expect(JSON.stringify(report)).not.toMatch(/Frozen Ground|surcharge|AP per entered tile/)
  expect(report.effects[1]!.condition).toContain('Damage Up')
  expect(report.targetMethodExplanation).toContain('once per logical effect type')
  expect(JSON.stringify(conditional)).toBe(bytes)
  expect(createHash('sha256').update(JSON.stringify(conditional)).digest('hex')).toBe(hash)
  const view = currentGroundBehaviorPresentation(conditional, 1, timingPolicy).view
  expect(view.effects.map((effect) => effect.id)).toEqual(['entry-1', 'entry-2'])
  expect(view.effects[1]!.requirements).toBe(conditional.effects[2]!.requirements)
  expect(view.effects[1]!.timing).toBe(conditional.effects[2]!.timing)
})

it.each([false, true])(
  'renders the actual full retained report with current encounter policy (canonical=%s)',
  (canonical) => {
    const source = canonical ? mist() : nativeMist()
    const bytes = JSON.stringify(source)
    const html = renderToStaticMarkup(
      <SkillEffectTimingProvider policy={timingPolicy} groundContactPolicyVersion={1}>
        <SkillDetails skill={source} expanded />
      </SkillEffectTimingProvider>,
    )
    expect(html).toContain('Chilled Ground')
    expect(html).toContain('Slow Ground')
    expect(html).not.toMatch(/Frozen Ground|surcharge|extra movement AP|AP per entered tile/)
    expect(html).toContain('once per')
    expect(JSON.stringify(source)).toBe(bytes)
  },
)

it.each(['battle', 'summon'] as const)(
  'normalizes the full %s Effects summary once and preserves the historical summary',
  (reader) => {
    const source = nativeMist()
    const skill = {
      definition: source,
      id: source.id,
      name: 'Chilling Mist',
      apCost: source.apCost,
      mpCost: source.mpCost ?? 0,
      minimumRange: source.target.minimumRange,
      maximumRange: source.target.maximumRange,
      targetKind: source.target.kind,
      targetTeamPolicy: source.target.teamPolicy,
      tags: source.tags,
      effectDescriptions: [],
      requirementDescriptions: [],
    }
    const summon = {
      ...resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!.abilities[0]!,
      target: source.target,
      effects: source.effects as readonly CombatEffectDefinition[],
      groundArea: source.groundArea,
    }
    const render = (policy: 1 | null) =>
      renderToStaticMarkup(
        <SkillEffectTimingProvider policy={timingPolicy} groundContactPolicyVersion={policy}>
          {reader === 'battle' ? (
            <BattleSkillParameters skill={skill} />
          ) : (
            <SummonAbilityReader ability={summon} />
          )}
        </SkillEffectTimingProvider>,
      )
    const labels = (html: string) =>
      (html.match(/data-compact-effect-label="true"[^>]*>[\s\S]*?<\/strong>/gu) ?? []).map((part) =>
        part.replace(/<[^>]*>/gu, '').replace(/^data-compact-effect-label="true"[^>]*>/u, ''),
      )
    expect(labels(render(1))).toEqual(['Slow Ground', 'Chilled Ground'])
    expect(labels(render(null))).toEqual(['Frozen Ground', 'Slow', 'Chilled'])
  },
)

it('keeps current native and canonical catalogue Manual summaries consistent with current battles', () => {
  for (const source of [mist(), nativeMist()]) {
    const article = createTechniquesManualArticle({ skills: [source], basics: [], timingPolicy })
    const text = JSON.stringify(article)
    expect(text).toContain('Chilled Ground')
    expect(text).toContain('Slow Ground')
    const summaries = text.match(/Chilling Mist[^"]*/gu) ?? []
    expect(summaries.length).toBeGreaterThan(0)
    for (const summary of summaries) expect(summary).not.toContain('Frozen Ground')
    expect(text).not.toContain('+10 AP/tile')
  }
})

it.each([1, null] as const)(
  'passes the captured Summon Ground policy to the opened reader (%s)',
  (policy) => {
    const source = nativeMist()
    const summon = {
      ...resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!.abilities[0]!,
      target: source.target,
      effects: source.effects as readonly CombatEffectDefinition[],
      groundArea: source.groundArea,
    }
    const list = SummonAbilityList({
      abilities: [summon],
      policies: { ...(policy === 1 ? { groundContactPolicyVersion: 1 as const } : {}) },
    })
    const html = renderToStaticMarkup(
      cloneElement(list, undefined, <SummonAbilityReader ability={summon} />),
    )
    if (policy === 1) {
      expect(html).toContain('Chilled Ground')
      expect(html).not.toContain('Frozen Ground')
    } else expect(html).toContain('Frozen Ground')
  },
)

it('keeps absent-policy native and canonical captures literal', () => {
  const source = nativeMist()
  const native = skillPreviewEffects(source, { ...current, groundContactPolicyVersion: null })
  expect(native[0]).toMatchObject({ label: 'Frozen Ground', magnitude: '+10 AP/tile' })
  const report = abilityBehaviorInformation(mist().ability!.behaviors[0]!, {
    timingPolicy,
    effectContext: { ...current, groundContactPolicyVersion: null },
  })
  expect(report.effects).toHaveLength(3)
  expect(report.effectDescriptions[0]).toContain('raises movement AP costs')
})

it('synthesizes Chilled only when runtime has no eligible companion and preserves independent Chilled', () => {
  const source = nativeMist()
  const chilled = source.effects[2]!
  if (chilled.type !== 'apply-status') throw new Error('Expected retained Chilled.')
  const independent = { ...chilled, target: 'enemy' as const, durationTurns: 7 }
  const skill = { ...source, effects: [source.effects[0]!, independent], groundArea: undefined }
  const effects = skillPreviewEffects(skill, current)
  expect(effects.map((effect) => effect.label)).toEqual(['Chilled Ground', 'Chilled'])
  expect(skill.effects[1]).toEqual(independent)
})

it('prevents saved canonical terrain wording from restoring the retired surcharge and aligns independent notes', () => {
  const source = mist()
  const behavior = source.ability!.behaviors[0]!
  const effects = behavior.effects.map((effect) =>
    effect.payload.type === 'create-terrain'
      ? { ...effect, payload: { ...effect.payload, skillApSurcharge: 100 } }
      : effect,
  )
  const saved = [
    {
      contentKey: 'tag.create-terrain',
      contentVersion: 1,
      tagId: 'create-terrain',
      name: 'Frozen Ground',
      full: 'Frozen Ground adds 100 AP per Skill.',
      compact: '+100 Skill AP',
    },
  ] as const
  const report = abilityBehaviorInformation(
    { ...behavior, effects },
    { timingPolicy, effectContext: current, tagPresentation: saved },
  )
  expect(JSON.stringify(report)).not.toMatch(/Frozen Ground|100.*AP|surcharge/)
  const rendered = {
    ...source,
    ability: { ...source.ability!, behaviors: [{ ...behavior, effects }] },
    effectDescriptions: [
      'Frozen Ground adds 100 AP per Skill.',
      'Keep independent Slow notes.',
      'Keep independent Chilled notes.',
    ],
  }
  const html = renderToStaticMarkup(
    <SkillEffectTimingProvider policy={timingPolicy} groundContactPolicyVersion={1}>
      <SkillDetails skill={rendered} expanded />
    </SkillEffectTimingProvider>,
  )
  expect(html).toContain('Keep independent Slow notes.')
  expect(html).toContain('Keep independent Chilled notes.')
  expect(html).not.toMatch(/Frozen Ground|100.*AP|surcharge/)
  const terrain = effects[0]!.payload
  if (terrain.type !== 'create-terrain') throw new Error('Expected terrain.')
  expect(previewEffectWithTag(terrain, saved, current).label).toBe('Chilled Ground')
  expect(
    previewEffectWithTag(terrain, saved, { ...current, groundContactPolicyVersion: null })
      .explanation,
  ).toBe('Frozen Ground adds 100 AP per Skill.')
})

it.each([false, true])(
  'keeps stale Chilled tag caches out of current reports while preserving historical wording (canonical=%s)',
  (canonical) => {
    const stale = {
      contentKey: 'tag.frozen',
      contentVersion: 1,
      tagId: 'frozen',
      name: 'Chilled',
      full: 'Frozen Ground adds 100 AP per Skill.',
      compact: '+100 Skill AP',
    } as const
    const base = canonical ? mist() : nativeMist()
    const source = {
      ...base,
      tagPresentation: [stale],
      ...(base.ability ? { ability: { ...base.ability, tagPresentation: [stale] } } : {}),
      effectDescriptions: [
        null,
        'Slow adds 20 movement AP per entered tile.',
        'Frozen Ground adds 100 AP per Skill.',
      ],
    }
    const bytes = JSON.stringify(source)
    const render = (groundContactPolicyVersion: 1 | null) =>
      renderToStaticMarkup(
        <SkillEffectTimingProvider
          policy={timingPolicy}
          groundContactPolicyVersion={groundContactPolicyVersion}
        >
          <SkillDetails skill={source} expanded />
        </SkillEffectTimingProvider>,
      )
    expect(render(1)).not.toMatch(/Frozen Ground|100.*AP|surcharge/)
    expect(render(1)).toContain('Slow adds 20 movement AP per entered tile.')
    expect(render(null)).toContain('Frozen Ground adds 100 AP per Skill.')
    expect(JSON.stringify(source)).toBe(bytes)
  },
)

it('reports captured current field placement and team scope without borrowing the global Ground delay', () => {
  const source = mist()
  const original = source.ability!.behaviors[0]!
  const behavior = {
    ...original,
    groundArea: {
      ...original.groundArea!,
      timing: undefined,
      placementTimingVersion: 1 as const,
      targetTeams: 'allies' as const,
    },
  }
  const before = JSON.stringify(behavior)
  const report = abilityBehaviorInformation(behavior, {
    timingPolicy: { version: 1, tagAuthority: 'global', modes: { 'ground-area': 'next-round' } },
  })
  expect(report.targetMethodExplanation).toContain('starting immediately')
  expect(report.targetMethodExplanation).toContain('Affects allies, including the caster')
  expect(report.targetMethodExplanation).not.toContain('starting next round')
  expect(JSON.stringify(behavior)).toBe(before)
  const html = renderToStaticMarkup(
    <SkillEffectTimingProvider
      policy={{ version: 1, modes: { 'ground-area': 'next-round' } }}
      groundContactPolicyVersion={1}
    >
      <SkillGroundAreaDetails
        skill={{
          ...source,
          groundArea: {
            ...source.groundArea!,
            placementTimingVersion: 1,
            timing: undefined,
            targetTeams: 'allies',
          },
        }}
      />
    </SkillEffectTimingProvider>,
  )
  expect(html.replace(/<[^>]*>/gu, '')).toContain('starting immediately')
  expect(html).not.toContain('starting next round')
})
