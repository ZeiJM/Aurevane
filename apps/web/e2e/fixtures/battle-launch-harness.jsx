import React from 'react'
import { createRoot } from 'react-dom/client'
import { BattleLaunch } from '@/components/battle/battle-launch'
import { CharacterSkillBuildPanel } from '@/components/character/character-skill-build-panel'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import './production-styles'

const skill = {
  ...resolveMatureSkillVersion('vanguard.forceful-strike'),
  flavorLine: '{actor} steadies {actor.possessive} blade for {ability}.',
}
createRoot(document.getElementById('root')).render(
  new URLSearchParams(location.search).get('screen') === 'skill' ? (
    <CharacterSkillBuildPanel
      characterId="geometry-fixture"
      initialBuildVersion={1}
      primaryDiscipline={{ id: 'vanguard', name: 'Vanguard' }}
      secondaryDiscipline={null}
      initialCapacity={4}
      initialLearnedSkills={[{ definition: skill, learnedAt: 'fixture', activeSource: true }]}
      initialEquippedSkills={[]}
      initialResonance={null}
      initialEssence={null}
    />
  ) : (
    <BattleLaunch characterId="geometry-fixture" characterName="Arin" />
  ),
)
