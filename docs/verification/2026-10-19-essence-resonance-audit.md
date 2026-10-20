# Essence and Resonance source audit — 19 October 2026

Read-only baseline audit at `8624c49a3853493cbea5f6b4855330bf0cd99117`, on `agent/essence-resonance-identity-20261019`. No gameplay, ordinary136 Skills/five Basics, migration, hosted query, publication, push or deployment changes form part of this audit.

The complete machine-readable inventory is `/tmp/essence-resonance-audit-20261019.json`:153 exact definitions, canonical behaviors/effects/requirements/costs/targets, stable identities, versions and manifest line ranges; minimum-version original names/descriptions/sequence pitches; previous individual pair pitches, legal kits and counters;17 Discipline themes;19 effect handlers and22 event types. Compatibility trigger/Skill fields are explicitly separate from current canonical mechanics.

## Current authority and result

Use `docs/superpowers/specs/2026-10-18-modular-correction-cohort.json`, not only static `currentEssenceDefinitions()`/`currentResonanceDefinitions()`. Its stale candidate label conflicts with the later exact publication receipt: `AGENTS.md:3` and `docs/verification/2026-10-18-modular-correction-release-handoff.md:25–35` record294 exact published definitions,583 immutable history rows and global timing policy8. This audit does not independently refresh production.

| Scope | Records | Behavior groups | Manual groups | Automatic groups | Ongoing groups | Records with Damage/Pierce |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Essence |17|18|18|0|0|13|
| Resonance |136|138|131|5|2|64|

Every Essence has Manual activation.129 Resonance records have Manual activation, five have Automatic and two Ongoing; the131 Manual groups reflect two additional command choices. Resonance has135 action groups and three modifier groups.72 groups have no behavior prerequisite;66 do.64 records contain66 direct Damage/Pierce packets; only two packets have their own effect-level requirement. Behavior requirements can additionally gate an entire action.13 Resonances and one Essence already pay some HP; payment alone does not establish a meaningful drawback at current resource maxima.

The latest Owner brief supersedes the previous active/hybrid Resonance allowance. Essence remains the castable culmination of one Discipline; Resonance should express both equipped Disciplines through genuine conditional or exploited interactions, generally without independent damage. Harder real setup can justify stronger rewards; a weaker unconditional component is optional. HP costs and self-inflicted negative effects are permitted as genuine tradeoffs. The00:19 follow-up requires some mechanically memorable standouts. Audit all153, retain individually valid definitions and redo what is necessary; do not manufacture cosmetic versions.

`combat-content-resolver.ts:752–803` prefers published current definitions and resolves exact pinned versions before builtin fallback. The catalogue overlay is at515–570. `battle-build-authority.ts:527–572,696–825` preserves build identity, exact extension versions and pure/mixed restrictions, and captures canonical sources. `combat-behavior-capture.ts:24–89` validates/freezes those sources. Root `ability` is authoritative: current `trigger` and nested native `skill.effects` often describe different historical mechanics and must not be counted as extra outcomes. `essence.ts:701–706` promotes the root ability for combat.

Static history remains useful for provenance: Essence registry construction is `essence.ts:470–600`; Resonance construction is `resonance.ts:129–194`, selection294–342. Current published Essence versions are6–8; Resonance versions6–7. Future publication needs a fresh exact-current version/digest CAS inventory; this source artifact is the released baseline, not permission to overwrite a later editor change.

## Original identities worth preserving

Build authority: `GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md:250–324` defines the passive pair interaction and pure castable signature, including damage-versus-utility budget. `COMBAT.md:602–620` reiterates those identities. Historical8/6 selected-slot and repeat-falloff passages are superseded by current four selections and current cooldown authority (`AGENTS.md:88,191–213`).

| Discipline | Native theme | Current Essence |
| --- | --- | --- |
| Vanguard | Armed commitment and holding the front | Unbroken Strike |
| Farstrider | Firing lines, precision and awareness | Deadeye Barrage |
| Shadehand | Mobility, concealment and exploiting openings | Perfect Opening |
| Ironfist | Close martial combinations and disruption | Hundredfold Rush |
| Aetherist | Offensive magic and mana readiness | Aether Nova |
| Lifebinder | Triage, prevention and scheduled recovery | Verdant Rupture |
| Bastion | Ally protection and a defended position | Last Bastion |
| Ravager | Bleeding pressure and dangerous commitment | Red Tempest |
| Edgedancer | Precise melee, facing and openings | Sevenfold Cut |
| Wildwarden | A marked quarry, snares and attrition | Apex Hunt |
| Runeblade | Melee/mystic pressure and resource control | Runic Overdrive |
| Dawnshield | Guarding, cleansing and restoration | Dawn’s Oath |
| Cinderweaver | Burning targets and fire exposure | Phoenix Wake |
| Frostweaver | Movement restriction and shattering setup | Absolute Winter |
| Stormsinger | Lane control and resource disruption | Skybreak |
| Tidecaller | Cleansing/restoration with movement control | Tidal Crown |
| Chronist | Visible preparation, delayed tempo and footing | Borrowed Hour |

Theme sources are `character/foundation-disciplines.ts:13–144`, `character/advanced-disciplines.ts:31–149`, and the defining-cycle table in `2026-10-10-roster-rebalance.md`. The archive includes source prototypes and prior reviewed pitches, not evidence that every numeric recipe was individually approved under the latest brief.

The original15 Foundation pairs are explicit (`resonance.ts:129–156`, `foundation-trio-resonances.ts:17–206`, `ironfist-content.ts`);121 later pairs were generated by eleven identity families (`advanced-resonances.ts:13–159`). Those templates are historical intent clues, not a creative target. Their original setup tags include defense, bleed, expose, mark, drain, heal, burn, control and tempo; original results include Guard, recovery, Slow, Vulnerable, cleansing, additional damage and Haste. Current per-pair names/roles/counterplay are retained in the inventory for comparison with each actual equipped kit.

## Repetition evidence and limits

The prior pair audit reports136 unique signatures while preserving selection count. A deliberately broader normalization here removes numeric tuning including selection count, names/IDs, source Discipline/tags, and status/element/defense/scaling identities. It finds two near-collision groups: Field Triage/Two Hands of Mercy and Chosen Confluence/Forecasted Thunder. These are not proven identical: the former differs in ally count and beneficial versus harmful status, and the latter in selection count and preparation status. Both remain useful review prompts.

Coarse ordered effect recipes repeat more broadly: Damage→Status in eight pairs; Status→Status in eight; Damage→Displace in five; Damage→Status→Status in five. Essence has three two-record recipe families: Damage→Recovery, Damage→Damage and Damage→Status. These counts do not establish bad design by themselves. The review must distinguish the actual decision, causal setup, recipient, timing, sacrifice and counter; a new name or swapped status is insufficient, while a shared primitive can support distinct play. The JSON records exact membership and normalization.

## Supported grammar and native safeguards

`combat-requirements.ts:3–49,263–405` supports All/Any, AP/MP/HP state (absolute or percent), real resource-threshold crossing, status/prime presence or absence, event type+phase, and action classification/family/intrinsic source Discipline/required tags. Subjects are owner, selected, affected and triggering. Selected predicates apply to every explicit selection; absent Ground subjects fail closed. Crossing requires immutable before/after mutation evidence. Trees have depth8/node128 budgets. State filters do not independently pulse on every read; Automatic uses entered truth and real event/mutation witnesses.

At this baseline there is no identity/team relation, distance, facing, tile/terrain, stack count, prior-action sequence, event amount, critical/hit result or arbitrary expression predicate. These are proven omissions from the closed validated union, not proof that the underlying engine lacks those facts. Prime presence observes a real Controlled prime; it is not arbitrary combo memory.

| Execution form | Proven current support | Boundary |
| --- | --- | --- |
| Manual action | All19 registered handlers in their legal combinations | Essence can use varied paid movement, Copy, terrain, summon, recovery and attacks |
| Automatic action | Damage/Pierce, healing, percentage recovery, MP change, statuses/removal, Poison/Burn/Bleed, Barrier | Must resolve causal native target and ordinary affordability/cooldown/limits |
| Automatic modifier | Damage/Pierce, Apply Status, Remove Status before an eligible owner Attack | Requires unit Attack root, no persistent Ground, correct explicit recipient; no typed Bleed/Burn/Poison modifier |
| Ongoing modifier | Unpaid source-owned outgoing Damage Bonus | Only owner-state context; no maintained generic Barrier/recovery/status aura |
| Manual-only primitives | Move, displacement, Copy, Sensory, Summon, Rewind, create terrain | Cannot gain passive support by flipping activation |

Exact registration/combinations: `combat-tag-registry.ts:75–275`; structural/automatic/ongoing validation: `combat-definition.ts:288–438,480–560`; modifier composition/compatibility: `combat-modifier-composition.ts:73–339` and `combat-modifier-compatibility.ts:14–81`; maintained contribution: `combat-behavior-runtime.ts:382–405`.

All22 event types are declared in `combat-ability-events.ts:28–52`: combat_action_used(before/after); combat_action_interrupted; damage_applied; healing_applied; resource_changed; ap_spent/mp_spent/hp_spent; status_applied/status_removed/status_expired; persistent_effect_applied; barrier_changed/barrier_absorbed; combatant_displaced/combatant_rewound; movement_spent/action_spent; battle_started/round_started/turn_started/turn_ended. All except action-used support after only. Actual mutation observation is `combat-ability-command.ts:361–391,832–940,980–995,1060–1068,1180–1269`, with native hooks in `combat-native-mutations.ts:17–54`. Receipt producers include `battle-state.ts:229,259,282,373–483`, native turn boundaries `actions-legacy.ts:2303–2366`, damage/Barrier5219–5272, status5397, displacement7025–7050 and scheduled recovery7488–7514. Declared support still requires the event's real producer and correct causal facts on the particular selected path.

Automatic target roles bind owner/triggering/selected/affected; live geometry, teams, range, occupancy and maximum selections remain authoritative (`combat-ability-events.ts:100–175`). Affected requirement context exists only for exactly one affected unit (`:361–414`); do not invent a victim for an ambiguous frame. Self targeting alone ignores the triggering identity and does not prove an owner event. Current five self-payoff Automatic definitions use unit Self targeting plus triggering binding to enforce that ownership. Global same-Discipline attacks by another actor can otherwise satisfy action qualifiers.

Damage-zero native receipts are excluded from damage_applied event dispatch (`combat-ability-command.ts:375–379`), so full Barrier absorption is distinct from a confirmed hit. After-action events include misses. Existing legacy confirmed-hit Resonance preserves priming on miss and counts Barrier-absorbed hits, but that does not automatically describe a new Automatic event recipe. Automatic modifiers can add a qualified damage/status rider through the root hit path. Actual DoT basis, global timing and recipient resistance need native outcome verification.

Payment is atomic (`combat-ability-command.ts:329–358,656–715`): HP costs leave1HP, emit hp_spent and are not damage. New self-debuffs obey global timing and actual cleansing; their effect must occur before the claimed exposure ends. Preserve current one-stack statuses, percent-max-HP Barrier/Pierce, rare elevation exceptions and timing policy8; do not insert per-record timing overrides. Current cooldown use is unlimited; duplicate/per-action/per-turn/per-round and reaction guard safety remain. Event sessions reject foreign/fabricated frames; dispatch sorts sources deterministically, deduplicates each frame/source/behavior, checks living owners and terminal state, and enforces shared depth/reaction limits (`combat-ability-events.ts:194–268,308–357,420–502`; `combat-kernel-types.ts`; `COMBAT.md:682–686`).

## Smallest reusable extension and authoring partition

Selected by the controller design: add only `subject-relation { subject, otherSubject, relation: same-unit|ally|enemy }`, deriving native identity/team, with missing/ambiguous false and ally excluding self. It closes causal owner/source and team filtering using already captured roles, without adding arbitrary expressions or pair-specific handlers. Treat it as a state filter with a supported event/action/crossing anchor for nonowner Automatic branches. Integrate validation/evaluation, native subject/frame capture, reports and Master editing. Extend existing `combat-requirements.test.ts`, `combat-ability-events.test.ts` and native Automatic outcome tests for unrelated actors, restore, ambiguous affected lists and teams, plus shared-reader/editor tests. No new sequence-memory or DoT-modifier engine extension is selected.

Existing automatic targets already provide event-recipient selection. Use that before proposing another target abstraction. Existing before-action owner modifiers are suitable for qualified damage/status riders; event actions handle finite recovery/resource/Barrier/status conversions. If a genuinely memorable recipe needs a new fact, identify the exact missing fact and redesign or separately review the smallest reusable addition. Do not add a broad speculative predicate framework.

A legacy shortcut is unsafe: canonical ordinary Skills return through prepare/commit before legacy sequence forecasting (`pv1f-action-economy.ts:984–1009`); legacy `committedResonanceForecast` resolves only builtin history (`:1855–1915`). Removing root ability does not make a newly published compatibility sequence work against the current canonical roster.

Partition authorship by unique identities, not mechanical templates. Give the15 Foundation-only pairs one lane; assign each later Discipline its pairs against earlier entries in the fixed order Bastion, Ravager, Edgedancer, Wildwarden, Runeblade, Dawnshield, Cinderweaver, Frostweaver, Stormsinger, Tidecaller, Chronist. Those eleven lanes contain6 through16 pairs, totaling121; together136 exactly. Review17 Essences separately. Every row states why both traditions matter, an actual normal turn choice, real sacrifice/setup, payoff recipient, counter and supported execution form. Cross-review repeated recipes across lanes, especially passive recovery/Barrier loops and same-Discipline event leakage. Retain valid distinct rows without version churn.

## Verification performed

Source extraction used Node24 strip-types with a temporary extension resolver; no dependencies were installed. Every153 current definition passes the real Essence/Resonance validators, and156 behavior groups resolve through actual global timing policy8 without error. The inventory has17 unique single-Discipline identities and136 unique unordered pairs. This is schema/source audit evidence, not combat balance, new native gameplay acceptance, fresh hosted verification or a release claim. No broad quality/build/browser gate was run for this audit.
