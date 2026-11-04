import type { CombatContentKind } from '@aurevane/db/combat-content'

export interface ContentTextGuidance {
  readonly hint: string
  readonly help: string
}

/** Current display routes, shared by persistent field hints and their information dialogs. */
export const CONTENT_TEXT_GUIDANCE = {
  skillDescription: {
    hint: 'Shown in the full Skill information in Master preview.',
    help: 'Skill Manager shows the Flavor line below the selected Skill name. Battle Parameters and previews use mechanics and Tag explanations. Use In-battle text for Chronicle narration.',
  },
  essenceDescription: {
    hint: 'Shown in Master preview and on the Nexus Essence card when Flavor line is blank.',
    help: 'The Essence description also supplies its full Skill information. Battle Parameters and previews use mechanics and Tag explanations. Use In-battle text for Chronicle narration.',
  },
  resonanceDescription: {
    hint: 'Shown in Master preview and on the Nexus Resonance card when Flavor line is blank.',
    help: 'The current Resonance Parameters report uses mechanics and Tag explanations. Flavor line supplies card text and Chronicle narration when no activation text overrides it.',
  },
  itemDescription: {
    hint: 'Shown in inventory Item details and Master preview.',
    help: 'Battle Item information shows Parameters and remaining uses. Chronicle uses a generated Item action sentence.',
  },
  authoringDescription: {
    hint: 'Shown in Master preview.',
    help: 'This field describes the content. Its playable behavior comes from the saved mechanics.',
  },
  skillFlavor: {
    hint: 'Shown below the selected Skill name in Skill Manager.',
    help: 'Chronicle uses In-battle text or generated action narration. Battle Parameters and previews use mechanics and Tag explanations.',
  },
  essenceFlavor: {
    hint: 'Shown on the Nexus Essence card.',
    help: 'Chronicle uses In-battle text or generated action narration. Battle Parameters and previews use mechanics and Tag explanations.',
  },
  resonanceFlavor: {
    hint: 'Shown on the Nexus Resonance card and used for Chronicle narration when no activation text overrides it.',
    help: 'Chronicle resolves names and pronouns from the recorded battle. Battle Parameters and previews use mechanics and Tag explanations.',
  },
  battleText: {
    hint: 'Chronicle action narration when this ability is used.',
    help: 'Chronicle uses saved activation text first, then this field, then generated narration. Names and pronouns come from the recorded participants. Effects and calculated outcomes come from mechanics.',
  },
  tagFull: {
    hint: 'Shown below Effects in Skill Manager and full ability reports, including battle Parameters.',
    help: 'Repeated Effects with the same Tag share one explanation. Each ability keeps its saved values and Requirements. Linked Tag tooltips use Battle description.',
  },
  tagCompact: {
    hint: 'Shown in linked Tag tooltips, battle effect information and Chronicle effect tooltips.',
    help: 'This is the short explanation of the Tag rule. Effect values and recorded results still come from the ability and battle. The explanation below Effects uses Skill Manager description.',
  },
  summonDescription: {
    hint: 'Shown in the Summon ability information popup.',
    help: 'The popup combines this description with the ability’s Parameters and Tag explanations. Use In-battle text for its Chronicle action narration.',
  },
} as const satisfies Readonly<Record<string, ContentTextGuidance>>

export function contentDescriptionGuidance(kind: CombatContentKind): ContentTextGuidance {
  if (kind === 'skill') return CONTENT_TEXT_GUIDANCE.skillDescription
  if (kind === 'essence') return CONTENT_TEXT_GUIDANCE.essenceDescription
  if (kind === 'resonance') return CONTENT_TEXT_GUIDANCE.resonanceDescription
  if (kind === 'item') return CONTENT_TEXT_GUIDANCE.itemDescription
  if (kind === 'tag') return CONTENT_TEXT_GUIDANCE.tagCompact
  return CONTENT_TEXT_GUIDANCE.authoringDescription
}

export function contentFlavorGuidance(kind: CombatContentKind): ContentTextGuidance {
  if (kind === 'resonance') return CONTENT_TEXT_GUIDANCE.resonanceFlavor
  if (kind === 'essence') return CONTENT_TEXT_GUIDANCE.essenceFlavor
  return CONTENT_TEXT_GUIDANCE.skillFlavor
}
