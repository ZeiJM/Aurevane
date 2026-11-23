import React from 'react'
import { createRoot } from 'react-dom/client'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { ItemDetails } from '@/components/character/item-details'
import { AbilityParameters } from '@/components/character/ability-parameters'
import { abilityBehaviorInformation } from '@/components/character/ability-detail-presentation'
import { CompactEffectSummary } from '@/components/character/compact-skill-effect-summary'
import { SkillDetails } from '@/components/character/skill-details'
import { BattleSkillParameters } from '@/components/battle/battle-skill-parameters'
import { BattleInfoPopover } from '@/components/battle/battle-info-popover'
import { presentItem } from '@/lib/items/item-presentation'
import itemStyles from '@/components/character/item-details.module.css'
import './production-styles'

// Read-only production readers, with authored values long enough to exceed a narrow value column.
const weapon = starterItemDefinitions().find((item) => item.itemClass === 'weapon')
const types = ['pierce', 'fire', 'water', 'ice', 'storm']
const scopes = Array.from({ length: 32 }, (_, mask) =>
  mask ? types.filter((_, index) => mask & (1 << index)) : undefined,
)
const effects = [
  { type: 'damage', recipient: 'primary-unit', amount: 99999, element: 'fire' },
  {
    type: 'remove-status',
    recipient: 'actor',
    removalMode: 'specified',
    statusIds: ['frozen'],
  },
  ...scopes.map((damageTypes) => ({
    type: 'apply-status',
    recipient: 'actor',
    statusId: 'inspired',
    stacks: 1,
    durationTurns: 99,
    potencyBasisPoints: 99900,
    ...(damageTypes ? { damageTypes } : {}),
  })),
]
const behavior = {
  ...weapon.ability.behaviors[0],
  effects: effects.map((payload, index) => ({ id: `effect-${index}`, payload })),
}
const report = abilityBehaviorInformation(behavior)
const item = presentItem({
  ...weapon,
  name: 'Effect fit reference',
  ability: { ...weapon.ability, behaviors: [behavior] },
})
const skill = {
  ...resolveMatureSkillVersion('farstrider.volley'),
  name: 'Effect fit reference',
  ability: undefined,
  effectDescriptions: undefined,
  effects,
}
function Card({ name, children }) {
  return (
    <section data-fit-reader={name} className="reader">
      <h2>{name}</h2>
      {children}
    </section>
  )
}
createRoot(document.getElementById('root')).render(
  <main>
    <style>{`
      body { margin: 0; }
      main { padding: 16px; font: 13px/1.4 sans-serif; }
      .readers { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,340px),1fr)); gap: 16px; }
      .reader { min-width: 0; padding: 12px; border: 1px solid #75613d66; }
      .reader h2 { margin: 0 0 12px; font-size: 16px; }
      .short { max-width: 300px; }
    `}</style>
    <h1>Effect summary fit</h1>
    <div className="short" data-short-reference>
      <CompactEffectSummary
        parts={{
          label: 'Dmg',
          magnitude: '20',
          duration: null,
          timing: 'Instant',
          target: 'Enemy',
        }}
        tagPresentation={{
          contentKey: 'tag.damage',
          contentVersion: 1,
          tagId: 'damage',
          name: 'Dmg',
          full: '{details}',
          compact: 'Read the complete captured damage parameters.',
        }}
      />
    </div>
    <BattleInfoPopover label="Open battle effects" title="Battle effects" panelWidth={480}>
      <BattleSkillParameters skill={{}} capturedReport={report} />
    </BattleInfoPopover>
    <div className="readers">
      <Card name="ItemDetails">
        <ItemDetails item={item} />
      </Card>
      <Card name="AbilityParameters">
        <AbilityParameters report={report} characteristicsClassName={itemStyles.characteristics} />
      </Card>
      <Card name="SkillDetails">
        <SkillDetails skill={skill} expanded />
      </Card>
      <Card name="BattleSkillParameters">
        <BattleSkillParameters skill={{ definition: skill }} />
      </Card>
    </div>
  </main>,
)
