# Owner resource, duel, facing and Items follow-up — 2026-10-05

Scope: the current conversation authorizes the new HP/MP endpoints, ordinary-equipped-Skill twelve-round duel standard, positional hit chance and locked Items placeholder. This extends the authorized combined release; no migration, authored ability rewrite or hosted account/content/Auth mutation.

## Resource math

Preserve mathematical80HP/16MP intercepts. HP=floor((160+21×min(Vitality,40)+15×max(Vitality−40,0))/2). MP=floor((80+48×min(Intellect,40)+25×max(Intellect−40,0))/5). At40:500HP/400MP; at60:650HP/500MP. Base characterCore remains positive; caps, allocation, equipment and every otherV4 derived rule remain. DefaultV5 includes the Primary Core base and continues retiring legacy Primary Adventure offsets/caps. ExplicitV4/older calculation and already-pinned encounter state remain historical.

## Duel calibration

Use canonical command execution, four current selected Skills, normal AP/MP, cooldowns and Basic Attack remainder. Flat adjacent front-facing mirror combatants start at full resources. No guard/recovery/stalling rotation is assumed. Both Level100 reference allocations spend135effective points, including the fixed31Primary base and104personal points:

| Primary | Might | Finesse | Vitality | Agility | Intellect | Resolve |
|---|---:|---:|---:|---:|---:|---:|
| Vanguard |40|15|40|13|3|24|
| Aetherist |2|15|40|13|40|25|

Vanguard priority: Guard Break, Forceful Strike, Cleave, Sweeping Strike. Aetherist: Mana Burst, Chain Spark, Overchannel, Arc Bolt. Consider each selected Skill in priority order if legal and affordable; fill remaining AP with Basic Attack. Master default tag timing is pinned. Seeds100001+i×7919, i=0…99. Record battle round on first defeat. Current no-multiplier damage with new pools/front penalty averages16.16/17.56rounds;140% post-defense multiplier averages11.52/12.68 (pooled12.10). Physical ranges10–14; Mystic10–16. Per-packet integer flooring, criticals and misses remain real. Balanced and Core60 offensive mirrors may finish faster; defensive/DoT/setup/recovery builds can differ. These two direct-pressure references are a repeatable balance standard, not a complete17-Discipline balance proof or a universal twelve-round guarantee.

## Versioning and scope

New factory pins duelBalancePolicyVersion1 alongside existing statBalancePolicyVersion1 and bridge4. Derived provenance becomes5; bridge4 remains. Multiply hostile direct packets by140% after matching Defense and before Critical/Level/facing/status/conditional/Barrier. Basic Attack, Skills, special families, summons and Vengeance share the direct stage. Periodic ticks, self/friendly damage, healing, MP and other resource formulas retain their own paths. Reflect derives from the resulting committed damage and does not apply the multiplier again. Authored potency limits remain pre-modifier values. All creation paths opt in; saved encounters without the new policy are not upgraded.

Facing adds −500/+500/+1000basis points for front/side/rear using committed target facing/source position and the existing directional classifier. Add to Accuracy−Evasion and existing modifiers, then clamp once. Do not change Evasion/provenance, consume forecastRNG or add anotherroll. Basic and per-targetSkill commits/AI/previews share the helper. Automatic, friendly/self effects retain their eligibility.

## Items and verification

Shared playable cockpit: locked Items before Inspect, defaultP, existing square/frame/information/hotkey format and unchanged art-size variables. Five evenly spaced inherent commands plus unchanged selected-Skill/special/EndTurn groups. Mobile retains its responsive composition. No item mechanics, API, consumption or inventory are introduced. Preserve every custom old binding; ifP is occupied, use a nonconflicting placeholder alternative. No command/preview issues onP. Spectators retain their mode-specific read-only controls.

Tests cover new resource anchors/breakpoints, historicalV4 values, Primary preview/current provenance, real seeded commands, direct-damage forecast/commit consistency, front/side/rear and clamping, old policy behavior, pinning/persistence, lockedslot and custombindings. Browser fixtures verify shared PvE/PvP at desktop/tablet/mobile, unchanged square art, no overflow, ordering and inertP. Fullpnpmcheck and exact-headCI precede merge/release. Factual evidence is recorded separately from desired outcomes.
