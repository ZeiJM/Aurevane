# Shared editor and tag standardization — October 31, 2026

Status: implementation integrated locally; final repository, browser/CI and independent-review gates pending. Nothing in this receipt claims a live release or Owner acceptance.

The Owner authorized implementation after collecting the complete batch, then explicitly confirmed that the changes apply to Skills, Essences, Resonances and shared consumers. The later description audit is part of this batch. Deployment remains a separate Owner-controlled action; Git auto deployment stays disabled.

## Source and boundaries

Baseline remote main is `b7a1e4290061815b0f1a8a7a9c9c84c47305b624`, tree `67a5223ab162a12df9a074cc2de8cbd8a849b9ad`. The old linked worktree metadata had been pruned. Every tracked file was checked against the complete GitHub tree with zero missing files or hash mismatches; a local recovery commit records that identical tree. No source was reconstructed from screenshots.

New fields capture current rules. Historical battles with absent fields retain their recorded mechanics. The editor projects retained tags into current controls without changing data on open; Commit Now applies those current rules to that edited record and reports the changes. It also reconciles required linked tags. There is no automatic catalogue republication, progression reset or historical rewrite. Custom Owner tag wording remains intact; generated defaults and parameter-aware descriptions are updated.

MP Restore is a fixed amount and MP Recovery is a percentage of maximum MP. They are different effects, so neither is removed under the Owner's conditional consolidation instruction.

## Implemented behavior

| Area | Current behavior |
| --- | --- |
| Shared editor | Execution Characteristics combines costs, cooldowns, usage limits and accuracy. Bounded controls, checkbox groups and scroll padding keep borders/focus rings visible. Effects/Target/inner effect help is removed; New effect help remains. Move/Summon labels omit restriction prose while restrictions remain enforced. |
| Range | Selectable minimum starts at 1 and supports exclusions such as 3–6. Single reach uses the supported map limit rather than the old five-tile authoring cap. Self and area geometry retain their internal zero conventions. Reports show minimum–maximum when minimum exceeds 1. |
| Hidden redundant fields | Fixed direction for Push/Pull; resource/applications for HP/MP Recovery; status for Invisible/Rooted/Taunt; stacks for Covert/Invisible/Marked/Rooted; Curse-copyable control for Bleed/Burn. Hidden required internals remain saved. |
| Damage-over-time | Poison potency remains editable as a share of actual attack HP damage. Adding an attack-percentage DoT adds covering editable Damage when needed; compatible DoTs share it. Removing Damage removes dependent DoTs; removing the final DoT removes only generated Damage. Independent Damage stays. Generated links survive JSON persistence. |
| Cleanse | Explicit current full-Cleanse marker removes every removable pinned negative debuff, including separate DoT applications, while preserving buffs and neutral tradeoffs. Only Target is shown. |
| Conditional Cleanse / Dispel | Negative/positive checkbox sets respectively; no removal-mode selector. Actual resolution honors selected statuses. |
| Copy | Buff/debuff checkbox filters intersect existing copy eligibility, including independent DoT eligibility and provenance. No mode/empty-copy control. Full selections read All Buffs / All Debuffs consistently. |
| MP Drain | Positive editor percentage, negative engine effect based on recipient maximum MP; captured for delayed activation. Resource/ticks hidden. Historical flat drains remain flat in old battles. |
| Defenseless | Editable total damage taken (%), e.g. 150% means 50% extra. Retained authoring starts from its previous effective total rather than silently substituting a different value. |
| Drenched | Separate saved Initiative reduction and Storm damage increase. Initiative reductions add up to 100%; the strongest applicable Storm bonus is used. |
| Fortified | Saved percentage increases Physical/Mystic Defense and reduces outgoing damage by the same percentage. It remains a mixed neutral Effect; visible stat readers preserve that classification. |
| Haste / Slow | Saved movement AP reduction/increase, with existing movement allowance and AP floor rules preserved. |
| Frozen Ground | Saved extra Skill AP cost for eligible grounded enemies; no new movement surcharge. Paid Skill/Essence/Resonance and native Summon actions share the rule; Basic actions, maintained modifiers and free reactions remain exempt. Linked Chilled is added and either linked tag removes its partner. Chilled applies to cast occupants; entry repetition remains controlled by explicit persistent-ground settings. |
| Reveal | Can select Invisible/Covert. A successful hit against either removes both and applies saved-duration Revealed: incoming attacks have 100% accuracy and take the saved extra damage. New profiles do not use the old buff purge/Skill AP penalty. |
| Rewind | Self/Ally/Enemy/Anyone/All capture each legal recipient's own position before reactions. Delayed and Controlled activation retain that set; Controlled priming binds the selection. Each live landing is checked independently. No HP/MP/AP/facing/history rewind. |
| Counter | Replaces current Vengeance authoring. Physical/Mystical/Full type, percentage (including >100%) and duration. Uses actual hostile HP loss after defense/Barrier/overkill; Full also responds to sourced periodic damage. Reactive returns cannot recurse. Historical Vengeance remains readable and executable. |
| Descriptions | Generic tag help and Tag Library defaults share concise English definitions without factory percentages. Skill/status readers show actual saved values, with historical fallbacks. Manuals and Taunt naming are aligned. |

## Integration decisions and regressions

- Generated companion metadata is nonmechanical and validated. Canonical wrapper IDs, conditions, timing, notes and Ground references remain on their original rows; native Ground ordinals are remapped after insertions/removals. Removed references are pruned only when their known effect was removed.
- A temporary blank Damage input no longer becomes zero and deletes attached DoTs.
- Ground/Enemy hostile packets with matching coverage share Damage. All remains distinct from a local footprint.
- Missing source/copy permission is never bypassed by selecting a checkbox. Existing immunity/resistance and independent application provenance remain authoritative.
- Counter eligibility/rate is captured at the hit, so later status changes in the same command do not rewrite earned returns. Periodic counter settlement preserves turn preparation/expiry and mutual defeat handling.
- New SQL helper classification checks the explicit all-debuffs marker before retained Chilled-only/list classification. The registration migration adds Counter and a finite vocabulary entry without changing publications/drafts/history or exposing private helpers.

## Migration candidate

`supabase/migrations/20261031081044_counter_tag_identity.sql` was generated through the CLI and remains unapplied remotely. It registers one Tag identity and extends the private presentation classifier/allowlist. No new table, public RPC, privilege grant or authentication change is introduced. The standalone PGlite tag/publication suite passes 10 tests, including SQL/engine classification parity.

## Verification ledger

Focused RED/GREEN evidence exists for the new mechanics and authoring dependencies. The integrated component run passed 659 tests before the final small factory/prose refinements. Core worktrees independently exercised their focused/adjacent/full suites; those counts do not replace the final integrated gate. Final command results will be recorded below.

Native Chromium is absent in this local environment. The browser fixture can be bundled locally, but that is not evidence of browser execution. Configured native CI/browser authority gates remain mandatory. No human device, multiplayer, listening or sustained-load acceptance is claimed.

Before any later release: refresh main, reconcile overlap, run exact-source gates, apply only the reviewed migration through the authorized release procedure, preserve retirement rules and verify source/alias/data readbacks. This batch does not close Phase 5 or the separate World timing acceptance work.

## Scope added during implementation

The Owner expanded the batch with a compact Core-stat Summon editor, Basic Attack-relative summon damage ceilings, nonlethal summon Skill HP costs, highest-profile current tactical planning and an anchored Never moves option. The Basic Attack reference was explicitly selected by the Owner. Profile descriptions/flavor inherit the parent Details & Text on explicit save. Existing identifiers and metadata remain internal.

Character-rail status glyphs replace letter abbreviations through the shared PvP/PvE authority without changing button size, state colors, counters, mechanics or privacy.

Weak Point, Spike and Ruin add conditional critical/direct-damage modifiers using distinct active debuffs. Endure blocks deliberate damaging actions while accumulating private actual received HP damage, then emits a configured percentage burst at natural expiry. Their exact decisions and verification work are tracked in the implementation plan above. These additions are integrated locally; final verification remains pending.

The Owner also supplied a full Reversal design and explicitly confirmed one trigger per preparation. The preserved specification is `docs/superpowers/specs/2026-10-31-reversal-design.md`. Reversal is separate from Counter, uses paid Controlled preparation and pre-damage interception, and adds facing counterplay, Reveal disruption and Reversal Strain. Its implementation is integrated locally; acceptance and release checks remain pending. Current Reveal behavior is preserved; the historical AP surcharge is not restored.

DoT dependency refinement: only attack-percentage Burn/Bleed/Poison require and link direct Damage. Retained flat DoTs remain independent; this follows the Owner’s “if and only if” condition without adding an unnecessary hit to a flat effect. Current palette DoTs use the percentage profile.

## Integration review repairs

The first independent review found missing percentage-DoT cast provenance, ignored annotation conditions, percentage MP Drain being scaled as flat power, and missing runtime family tags for Summon attacks. Each has a focused failing reproduction followed by a repair and passing regression. Percentage MP Drain now accepts1–100% through native Skill/Essence validation while flat MP limits remain unchanged.

The terrain-defense marker also incorrectly included Fortified's defense adjustment. It now uses a pure terrain value. Fortified is a mixed neutral Effect and already remains visible under Covert; this repair is terrain presentation correctness, not a claim that hidden Fortified was proven to leak.

A further integration regression separates explicit Frozen Ground Chilled from Ice's positive-HP gate. `applicationOrigin: 'frozen-ground'` owns that behavior; `authoringLink` remains editor metadata. Ordinary Ice companions keep their damage gate, and each separately authored application keeps its own eligibility and timing. Linked Chilled's fixed Ground/status controls are hidden so its association cannot be broken through redundant selectors.

Current local integration evidence includes188 focused core cases,649 shared editor cases,49 terrain/viewer cases and the new Origin reader/dependency tests. These are intermediate checks, not the final repository/browser/CI gate. Reversal is integrated; its protected active Strain counts once in Weak Point/Ruin, verified through genuine arm/cancel state.

## Final independent review repairs

The final engine and editor reviews found no Critical issue and identified concrete integration defects before release. Each repair has a regression: clearing Dispel retains explicit selection polarity; partially concealed stacked statuses rebuild their public tuning from visible applications; native Summon Skills quote and pay Frozen Ground AP once; delayed attacks stop their own remaining packets when Reversal defeats the source; Basic Attack-relative Summon ceilings include eligible Ruin while remaining noncritical; and native Summon reaction defeat no longer performs bookkeeping after removing its combatant.

Counter registration is additive and replay-safe, preserving installed identities, classifier branches and higher versions. Endure migration snapshots compare the immediate migration boundary while replay checks preserve the complete later catalogue. The October10 immutable roster tests explicitly list the five October31 effects outside that historical roster; their dedicated executable suites cover current mechanics. Cleanse's all-status fixture now creates Endure through genuine runtime authority rather than forging an invalid status.

Historical-policy Reversal pending casts use a dedicated private cast identity where the normal packet policy is absent; this does not enable modern packet settlement in an old capture. All private Reversal state and counters are omitted from public envelopes. Reversal still requires Manual Action and one Controlled preparation; unsupported extra Controlled companions are rejected. Existing reactive Counter/Reflect and Endure expiry retain their system-return behavior.
