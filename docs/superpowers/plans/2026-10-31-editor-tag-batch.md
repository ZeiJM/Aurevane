# Editor tags and combat behavior implementation plan

Status: **LIVE for Owner testing** through PR #1000 and Production `dpl_9vmqZ8Che4Nb2RHDpVZwKuVsgqbf`. All implementation, review and configured native gates are complete. The Owner explicitly authorized this release after readiness confirmation. Exact evidence and the separate pre-existing Git migration-history mismatch are recorded in `docs/verification/2026-10-31-editor-tag-standardization.md`.

> For agentic workers: implement independent mechanics in isolated worktrees, then integrate and review the complete branch.

**Goal:** Implement the Owner's collected editor changes and matching combat behavior without rewriting historical battles.

**Architecture:** Extend existing typed native effects, canonical payload adapters, capture and settlement helpers. Keep old omitted-field semantics; newly authored fields capture the new behavior. Shared readers and editor controls consume the same payloads.

**Tech Stack:** TypeScript, React, Vitest, Playwright, pnpm monorepo.

**Spec:** Owner instructions in this conversation, collected below. Source baseline: main b7a1e4290061815b0f1a8a7a9c9c84c47305b624, exact tree67a5223ab162a12df9a074cc2de8cbd8a849b9ad. Lost Git metadata recovered with a local baseline commit whose complete tree is identical.

## Global constraints

- Implementation and this one Production release were explicitly authorized October 31. Keep the Vercel Git deployment lock; later deployments need their own authorization.
- Preserve historical captured definitions, existing cooldown/timing, source provenance, multiplayer privacy and server authority.
- Current minimum target range starts at1 and may exceed1, e.g.3–6; retain internal self/area zero semantics where no selectable minimum applies.
- Remove Effects/Target/inner effect description help icons; retain New effect help. Improve bounded widths, alignment and popup padding.
- Merge Action Economy/Accuracy tabs into Execution Characteristics.
- Hide redundant status selectors for Taunt, Invisible and Rooted; hide stacks for Covert, Invisible, Marked, Rooted. Rename Taunted to Taunt.
- Hide fixed Resource and Applications for HP/MP Recovery, fixed direction for Pull/Push, MP ticks/resource for MP Drain. Preserve necessary internal values.
- Bleed/Burn remove Curse-copyable option. Poison potency remains editable and functional.
- Move/Summon picker names omit appended restriction prose; retain compatibility enforcement.
- All-selected status lists render All Buffs/All Debuffs consistently, partial selections show chosen names.

## Review focus

- Historical captures with absent new fields retain their original calculations and snapshot validity.
- Delayed and Controlled effects capture the intended recipient and values before settlement; no target swaps, duplicate activation or extra resources.
- Linked authoring removes only associated generated companions and preserves independently authored/shared Damage.
- Filtered removal/copy respects pinned polarity, copy eligibility, independent DoTs and provenance.
- Numeric changes affect actual combat, previews and readers; zero/over100/rounding bounds are explicit.

## Tasks

### 1. Editor layout and authoring dependencies (root)

Files: shared master/combat-content editors, ability-editor-sections.ts, combat-elemental-authoring.ts and new dependency helper; component/payload tests and browser fixture.

- [x] Add failing behavioral tests for merged execution tab, range3–6, no minimum0, removed controls, and linked Damage/Frozen Ground companions.
- [x] Implement compact labels/controls and unclipped popup scroll padding.
- [x] Attack-percentage DoTs require covering direct Damage: add generated editable Damage when needed; delete dependent DoTs when that Damage is removed; delete generated Damage when final dependent DoT removed; share compatible Damage, preserve standalone Damage.
- [x] Frozen Ground adds linked Chilled; removing either linked member removes the other.
- [x] Run focused editor tests and compile native browser fixture.
- [x] Execute native desktop/mobile browser fixture in CI (Chromium unavailable locally).

### 2. Cleanse, Dispel, Copy and MP (removal worktree)

Files: combat-cleanse.ts, combat-status-copy.ts, actions-legacy.ts, effect schema/registry/validation/adapters and shared readers.

- [x] Test full Cleanse removes every negative, not buffs; conditional removal and copy honor selected polarity and IDs including DoTs.
- [x] Add explicit all-debuff removal marker, optional copy statusIds, shared selectable status catalog and all-selected summary.
- [x] MP Drain new maximum-MP percentage basis; positive UI potency, negative engine effect, no resource transfer. Preserve old flat drains. Recovery hides resource/applications with same engine payload.
- [x] MP Restore stays: investigation confirms fixed amount differs from percent Recovery.
- [x] Implement checkbox UI and reader descriptions, scoped tests; commit.

### 3. Rewind target captures (rewind worktree)

Files: effect target validators, actions.ts/actions-legacy.ts, committed execution/capture and Controlled paths, readers.

- [x] Test Self/Ally/Enemy/Anyone/All capture each legal recipient's own position; invalid range, dead/occupied/Rooted/elevation and delayed admission boundaries.
- [x] Extend typed per-recipient immutable anchors through authenticated command capture and delayed/Controlled scheduling; preserve historical scalar self anchors.
- [x] Update Rewind target options and position-only descriptions, scoped tests; commit.

### 4. Counter (counter worktree)

Files: new typed status profile helper, existing combat-reflect.ts, committed damage classification, schema/registry/adapters/readers.

- [x] Test Physical/Mystical/Full filters,150% reflection, actual settled hostile HP damage basis, Barrier, expiry, copy/restore, no recursive reflection and mutual defeat.
- [x] Retain historical Vengeance payload but replace current authoring choice with Counter; new effect grants captured type/percentage/duration status.
- [x] Reuse one-pass reflect settlement and trigger guards; no arbitrary100% ceiling on Counter.
- [x] Implement minimal controls Type, Counter potency (%), Duration, shared wording and scoped tests; commit.

### 5. Status tuning (potency worktree)

Files: gameplay metadata, status application/capture/composition, defense/initiative/movement and Reveal targeting/runtime helpers, schema and readers.

- [x] Test configurable Defenseless damage taken (150%=+50%), Drenched initiative reduction and Storm bonus separately, Fortified +Defense/−outgoing same%, Haste/Slow movement AP values.
- [x] Test Reveal can select Invisible/Covert; successful hit against either removes both, applies configured duration/damage vulnerability, incoming accuracy100%; no unrelated buff purge.
- [x] Preserve old absent-field semantics; capture new tuning across pending/copy/restore. Root adds UI from communicated interfaces unless agent owns it.
- [x] Scoped tests and commit.

### 6. Frozen Ground skill AP (terrain worktree)

Files: terrain overlays/ground capture, Skill cost authority/preview, schema validation and readers.

- [x] Test newly authored Frozen Ground has NO movement surcharge and increases Skill AP by saved value for eligible grounded enemies; Airborne exemption and historic movement surcharge stay authoritative.
- [x] Capture explicit Skill AP surcharge through area lifetime and Fire→Steam expiry, cost legality/previews/commit agree.
- [x] Expose editable Skill AP surcharge, scoped tests and commit. Root integrates linked Chilled authoring.

### 7. Integration and verification (root)

- [x] Reconcile independent commits, strict schemas and adapters; update domain specs, AGENTS, TASKS, ROADMAP and information contract.
- [x] Full pnpm check for broad shared impact; configured native browser checks and CI.
- [x] Fresh independent engine and editor/SQL review.
- [x] Verify all final material-review repairs and full integration gates.
- [x] Refresh remote main, reconcile overlap, publish reviewable PR with factual validation. The later Owner-authorized release is recorded in the verification receipt.

## Decisions and progress

- MP Restore is flat, MP Recovery percent: retain both under Owner's conditional consolidation request.
- Rewind state remains captured position; no HP/MP/AP refund was requested.
- Counter uses existing reflection basis: actual hostile HP loss after defense/Barrier/overkill; returned damage is reactive and never seeds another counter.
- MP Drain percentage uses recipient maximum MP, matching Recovery denominator. Historical flat captures stay unchanged.

- Owner added description audit: concise natural Standard English, current mechanics, no obsolete hard-coded configurable values. All changes apply across Skills, Essences, Resonances and shared systems.

## Integration ledger

- All implementation domains, final independent reviews and repository/native browser gates are complete. PR #1000 and the Owner-authorized live release are recorded in the verification receipt.
- Root current-authoring projection and Commit Now conversion apply new rules to explicitly edited records while keeping immutable battles untouched. Native Basic actions use content kind Skill.
- Resolved review findings: wrapper metadata/notes preservation, Ground/Enemy Damage coverage, attack classification, Ground-reference pruning/remapping, and blank Damage input safety. Each material dependency behavior has a regression.
- SQL current Cleanse classification fixed with a failing parity test followed by a passing PGlite suite. Counter migration remains unapplied.
- Reflection uses settled hostile HP loss; Full includes sourced periodic ticks, reactive returns excluded. Rewind remains position-only. Chilled on Frozen Ground is an added cast effect; explicit Ground entry settings govern repeats.

## Owner additions during implementation

### Summon editor and mechanics

- Hide profile/portrait identifiers, raw tags, AI metadata and duplicate profile text, retaining internal values. Explicit save inherits nonempty parent description/flavor.
- Author Might, Finesse, Vitality, Agility, Intellect and Resolve through the shared pinned v5 derivation; preserve historical literal snapshots until explicit edit/save.
- Owner selected the summoner's noncritical Basic Attack against the same target as the damage-ceiling reference. A 40% summon cannot bypass its per-target attack budget with multiple Damage packets. Barrier absorption consumes that budget; preserve private provenance for delayed, periodic and Ground effects.
- Current summons use high tactical planning. Never moves anchors them to their summon tile; pass when no useful legal action exists. Historical missing markers preserve captured behavior.
- Summon Skills retain name, AP/MP costs, descriptions, battle text, artwork/audio and shared range/effects editors; add nonlethal HP cost. Rename AI utility to Action priority. Hide raw identifiers/tags and show Damage type as a normal choice.
- Pad Skill card contents and organize Effects, Range & Area and Artwork & sound into accessible disclosures. Show the existing media preview.

### Rail icons

- Replace current status-letter abbreviations with distinct intuitive native SVG glyphs through the shared character rail authority. Preserve button size, counters, pending/buff/debuff colors, accessible labels, popovers and viewer privacy. Applies to PvP/PvE, desktop/mobile and spectators.

### New attack tags

- Weak Point: programmable nonnegative debuff threshold; guarantees a critical result only when an enemy has strictly more distinct active negative statuses than the threshold. Does not guarantee a hit.
- Spike: doubles this Skill's critical damage; no effect on ordinary hits.
- Ruin: programmable percentage bonus per distinct active debuff on the recipient. Pending/primed statuses, duplicates and stacks do not inflate the count; active Burn/Bleed/Poison count.
- These are action annotations with a linked editable Damage dependency. Preserve ordinary RNG consumption, per-recipient committed captures, Ground entrant evaluation and private counts.

### Endure

- User-authorized tag with duration, damage-return percentage (can exceed100%), burst range and target teams.
- While active, block new deliberate damage-dealing actions, including Basic Attack and mixed damage/support Skills. Existing pending casts and automatic reactions retain their captured contracts.
- Track actual HP damage received privately; exclude Barrier absorption, overkill and HP costs. Natural expiry releases each target's full configured fraction as indirect damage, with Barrier protection and no second Defense reduction.
- Builder interpretation stated to Owner: burst is centered on caster's current tile at expiry. Teams Enemy/Ally/All and tile range are programmable. Removal/death does not trigger an early burst. Preserve one-pass reactive loop guards and strict capture/public-projection separation.

All additions remain in the same shared Skill/Essence/Resonance batch. Full gates and fresh independent review follow integration. No deployment or live migration is authorized by these implementation requests.

### Reversal (Owner-supplied specification)

Full supplied design and confirmed clarifications: `docs/superpowers/specs/2026-10-31-reversal-design.md`.

- [x] Add version1 Reversal payload, one Physical/Mystic family, reflection and two maximum-HP cap percentages; no Full/Both selection. Owner explicitly confirmed one trigger.
- [x] Specialize paid Controlled preparation: normal costs/cooldown once, no earlier offensive action that turn, visible normal narration and Covert rules. Preserve other Controlled abilities.
- [x] Arm until first qualifying direct front/side hit or next actual owner-turn start, surviving global round changes. Probe ordinary mitigation/Barrier without consuming Barrier on successful interception.
- [x] Prevent one packet plus its dependent hostile hit effects; preserve other packets/recipients/independent utility. Cap the noncritical, nonrecursive return; no reactive history/Endure bank credit.
- [x] Enforce armed offensive restrictions (including automatic attacks), cancellation/death cleanup, and nonremovable/noncopyable Strain for the next complete actual owner turn. Inherent Basic Attack remains during Strain.
- [x] Extend actual Reveal resolution to disarm Reversal even without Covert/Invisible. Respect hit/timing and current Revealed rules; active Revealed blocks preparation, pending does not.
- [x] Register identities with additive migration/manifest, shared concise readers/logs/rail icons, editor controls and desktop/mobile browser flow.
- [x] Cover the supplied32 acceptance cases plus interactions with new Endure, Counter and Summon cap. Independent review, complete checks and release gate remain required.

DoT dependency refinement: only attack-percentage Burn/Bleed/Poison require and link direct Damage. Retained flat DoTs remain independent; this follows the Owner’s “if and only if” condition without adding an unnecessary hit to a flat effect. Current palette DoTs use the percentage profile.

Final independent reviews are recorded in the verification receipt. Review repairs add persisted Dispel selection polarity, complete status-tuning privacy, native Summon Frozen Ground costs, delayed Reversal source-defeat propagation, annotated noncritical Basic reference damage, and safe native Summon reaction-defeat payment/cleanup. Final checks passed, source was merged through PR #1000, and the Owner-authorized Production release is verified in the receipt.
