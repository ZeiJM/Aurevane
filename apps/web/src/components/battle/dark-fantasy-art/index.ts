export const DARK_FANTASY_COMBAT_ARTWORK = {
  'aetherist.arc-bolt': '/media/skills/dark-fantasy/aetherist-arc-bolt.webp',
  'aetherist.arcane-field': '/media/skills/dark-fantasy/aetherist-arcane-field.webp',
  'aetherist.chain-spark': '/media/skills/dark-fantasy/aetherist-chain-spark.webp',
  'aetherist.channel': '/media/skills/dark-fantasy/aetherist-channel.webp',
  'aetherist.mana-burst': '/media/skills/dark-fantasy/aetherist-mana-burst.webp',
  'aetherist.mana-shield': '/media/skills/dark-fantasy/aetherist-mana-shield.webp',
  'aetherist.overchannel': '/media/skills/dark-fantasy/aetherist-overchannel.webp',
  'aetherist.ward-pierce': '/media/skills/dark-fantasy/aetherist-ward-pierce.webp',
  'essence.aetherist.aether-nova': '/media/skills/dark-fantasy/essence-aetherist-aether-nova.webp',
  'essence.farstrider.deadeye-barrage':
    '/media/skills/dark-fantasy/essence-farstrider-deadeye-barrage.webp',
  'essence.lifebinder.verdant-rupture':
    '/media/skills/dark-fantasy/essence-lifebinder-verdant-rupture.webp',
  'essence.shadehand.perfect-opening':
    '/media/skills/dark-fantasy/essence-shadehand-perfect-opening.webp',
  'farstrider.aimed-shot': '/media/skills/dark-fantasy/farstrider-aimed-shot.webp',
  'farstrider.fieldcraft': '/media/skills/dark-fantasy/farstrider-fieldcraft.webp',
  'farstrider.keen-focus': '/media/skills/dark-fantasy/farstrider-keen-focus.webp',
  'farstrider.longshot': '/media/skills/dark-fantasy/farstrider-longshot.webp',
  'farstrider.piercing-barrage': '/media/skills/dark-fantasy/farstrider-piercing-barrage.webp',
  'farstrider.pinning-shot': '/media/skills/dark-fantasy/farstrider-pinning-shot.webp',
  'farstrider.scouts-mark': '/media/skills/dark-fantasy/farstrider-scouts-mark.webp',
  'farstrider.volley': '/media/skills/dark-fantasy/farstrider-volley.webp',
  'lifebinder.searing-bloom': '/media/skills/dark-fantasy/lifebinder-searing-bloom.webp',
  'lifebinder.vital-sever': '/media/skills/dark-fantasy/lifebinder-vital-sever.webp',
  'resonance.aetherist-farstrider.arcane-hunt':
    '/media/skills/dark-fantasy/resonance-aetherist-farstrider-arcane-hunt.webp',
  'resonance.aetherist-lifebinder.vital-circuit':
    '/media/skills/dark-fantasy/resonance-aetherist-lifebinder-vital-circuit.webp',
  'resonance.aetherist-shadehand.veiled-conduit':
    '/media/skills/dark-fantasy/resonance-aetherist-shadehand-veiled-conduit.webp',
  'resonance.aetherist-vanguard.spellsteel-rhythm':
    '/media/skills/dark-fantasy/resonance-aetherist-vanguard-spellsteel-rhythm.webp',
  'resonance.farstrider-lifebinder.guided-renewal':
    '/media/skills/dark-fantasy/resonance-farstrider-lifebinder-guided-renewal.webp',
  'resonance.farstrider-shadehand.marked-opening':
    '/media/skills/dark-fantasy/resonance-farstrider-shadehand-marked-opening.webp',
  'resonance.farstrider-vanguard.covering-break':
    '/media/skills/dark-fantasy/resonance-farstrider-vanguard-covering-break.webp',
  'resonance.lifebinder-shadehand.mercy-in-shadow':
    '/media/skills/dark-fantasy/resonance-lifebinder-shadehand-mercy-in-shadow.webp',
  'resonance.shadehand-vanguard.broken-line':
    '/media/skills/dark-fantasy/resonance-shadehand-vanguard-broken-line.webp',
  'shadehand.backstab': '/media/skills/dark-fantasy/shadehand-backstab.webp',
  'shadehand.crippling-cut': '/media/skills/dark-fantasy/shadehand-crippling-cut.webp',
  'shadehand.execution-cut': '/media/skills/dark-fantasy/shadehand-execution-cut.webp',
  'shadehand.exploit-opening': '/media/skills/dark-fantasy/shadehand-exploit-opening.webp',
  'shadehand.fan-of-knives': '/media/skills/dark-fantasy/shadehand-fan-of-knives.webp',
  'shadehand.feint': '/media/skills/dark-fantasy/shadehand-feint.webp',
  'shadehand.quick-hands': '/media/skills/dark-fantasy/shadehand-quick-hands.webp',
  'shadehand.smoke-vial': '/media/skills/dark-fantasy/shadehand-smoke-vial.webp',
} as const

export function darkFantasyCombatArtwork(artworkId: string): string | null {
  return DARK_FANTASY_COMBAT_ARTWORK[artworkId as keyof typeof DARK_FANTASY_COMBAT_ARTWORK] ?? null
}
