import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { SkillEffectListEditor } from './skill-effect-list-editor'
import { AbilityDefinitionEditor } from './ability-definition-editor'
it.each(['native', 'canonical'])(
  'exposes individual supported tag choices with search in the %s editor',
  (kind) => {
    const html = renderToStaticMarkup(
      kind === 'native' ? (
        <SkillEffectListEditor value={[]} onChange={() => {}} />
      ) : (
        <AbilityDefinitionEditor
          value={defaultBasicSkills().find((s) => s.id === 'unarmed.basic')!.ability}
          onChange={() => {}}
        />
      ),
    )
    for (const tag of [
      'Copy Buffs',
      'Copy Debuffs',
      'HP Recovery',
      'MP Recovery',
      'Pierce',
      'Counter',
      'Dispel',
      'Suppress',
    ])
      expect(html).toContain(`>${tag}</option>`)
    expect(html).not.toContain('>Vengeance</option>')
    expect(html).toContain('aria-label="Search effect tags"')
    expect(html).not.toContain('Copy Buffs / Copy Debuffs</option>')
    for (const retired of [
      'Revealed is applied by Reveal',
      'HP Recovery (fixed amount)',
      'Damage Bonus',
      'Blindside (debuff)',
    ])
      expect(html).not.toContain(retired)
  },
)
it.each(['native', 'canonical'])(
  'keeps %s effects compact and removes per-skill effect wording',
  (kind) => {
    const html = renderToStaticMarkup(
      kind === 'native' ? (
        <SkillEffectListEditor
          value={[
            { type: 'damage', recipient: 'primary-unit', amount: 8 },
            { type: 'damage', recipient: 'actor', amount: 4 },
          ]}
          onChange={() => {}}
        />
      ) : (
        <AbilityDefinitionEditor
          value={defaultBasicSkills().find((s) => s.id === 'unarmed.basic')!.ability}
          onChange={() => {}}
        />
      ),
    )
    expect(html).not.toContain('Player-facing effect description')
    expect(html).toContain('data-effect-collapsible="true"')
  },
)
