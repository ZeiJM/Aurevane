# Ground Contact and Combat Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Independent domains may use the already selected parallel execution workflow. Do not commit or publish unverified shared source.

**Goal:** Implement the Owner's current Ground-contact rules and the Haste, MP Recovery, cost-preview and Blind follow-ups.

**Architecture:** Preserve raw captured definitions and introduce an optional current contact policy on new encounters/areas. Reuse existing turn-cycle claims and native effect execution. Share logical contact eligibility and public visual descriptors; keep actor/controller operations distinct from recipient effects.

**Tech Stack:** TypeScript, React/CSS modules, Vitest, PGlite/PostgreSQL and the existing native Chromium fixtures.

**Spec:** `docs/superpowers/specs/2026-11-01-ground-contact-followups.md`.

## Global Constraints

- Preserve the verified preceding checkpoint (14947 Vitest tests,7 Node tests and pnpm check); broader application deployment remains separate.
- New policy: `CombatEncounterState.groundContactPolicyVersion?:1`; new areas capture `contactPolicyVersion?:1`. Missing markers retain legacy behavior.
- Preserve effect IDs/ordinals/origins, raw source hashes, independent targets, HP/MP/AP authority and viewer privacy. No automatic catalogue republication.
- Ground field duration remains1–99 rounds and Circle radius1–15. Active contact is immediate; field activation remains authored.
- User withdrew Reckless/Fortified Buff reclassification; keep neutral/noncopyable behavior.

## Review Focus

- Duplicate contacts across casts/tiles must not create extra RNG draws or damage; next own-turn cycle must work again.
- DoT anchoring must use actual settled damage and aligned ordinals after packet filtering.
- Queued fields, own-turn stationary occupants, forced movement and displacement recursion must resolve once without double cast effects.
- Retained sources/legacy labels must not mutate saved definitions or leak private data through new visual/preview fields.
- AP0 movement and mixed AP/HP/MP proposals must preserve movement budgets, flat costs, Barrier and cancellation/stale boundaries.

### Task1: Current Ground execution (counter_trace)

**Files:** `combat-ground-areas.ts`, new `combat-ground-contact.ts`, `actions-legacy.ts`, current encounter factory/validation, Ground runtime tests; new server contact tests when required. Preserve unrelated Haste price and authoring/UI files.

**Interfaces:** Existing `executeCombatAction` and `resolveCombatGroundEntry` signatures remain. Export `combatGroundContactEffectKey(effect: CombatEffectDefinition): string|null` and `claimCombatGroundContactEffect(state, combatantId, key): {state,allowed}` using existing per-combatant turn cycles. Expand shared `isCombatGroundEntryEffect` for supported recipient operations. Visual projection consumes captured `entryEffects` plus area policy marker, not new executable public data.

The runtime bridge is `planCombatGroundContacts(action, contactPolicyVersion, timingPolicy)`, returning direct source ordinals, suppressed retired terrain ordinals and field plans whose packets retain `sourceEffectOrdinal`, native payload, origin, eligibility and logical key. Keep the original action array unchanged. New areas persist `entryEffectSourceOrdinals?:readonly number[]` alongside entry payloads. Plan before CSR so field Reveal cannot widen direct-cast visibility; expand contact Reveal only against its actual entrant, retaining its original ordinal. Pair retained Chilled by matching canonical owner namespace and the existing independent Ground origin; otherwise synthesize the established2turn Chilled default at the retired terrain slot. Contact chains are distinct per area/recipient cycle so repeated later turns cannot collide in effect lineage.

- [x] Red tests: current cast/activation/own-turn/contact apply immediately; same-type overlap/multiple tiles once; Damage+Slow both once; later cycle refresh; legacy per-cast unchanged; Airborne/Invisible/resistance/DoT/source-defeat/recursion cases.
- [x] Add the policy/capture and runtime normalization bridge while preserving original packet mapping. Retire Frozen AP packets only under current policy; route entry payloads solely through field lifecycle so they cannot also schedule ordinary duplicate packets.
- [x] Run focused Ground, provenance, resistance, DoT and actual server reload tests; types/lint. Report a frozen file list and any excluded boundary before review.

### Task2: Ground authoring and MP consolidation (copy_concealment)

**Files:** effect/ability dependency helpers, `combat-ground-entry-authoring.ts`, current tag authoring/corrector, Ground/target/Summon editors; relevant canonical/Summon schema/adapters; identities/factories and descriptions/manuals. Coordinate edits in shared identity/editor files with Blind; Haste owns its other reader files.

**Interfaces:** Reuse shared entry eligibility. List conversion returns an old-row→retained/new-row mapping so `entryEffectOrdinals` and canonical `entryEffectIds` survive. Add optional native Summon `groundArea` capture/plumbing using `CombatGroundAreaDefinition`. MP keeps raw historical `mp-restore` presentation lookup while current visible names/choices use MP Recovery.

- [x] Red native/canonical/Summon tests for paired/standalone Freeze conversion, independent Chilled preservation, IDs/requirements/timing/targets, no AP resurrection, logical Ground choices and Pierce.
- [x] Convert before old pair reconciliation; preserve Chilled's independent Ice-gating semantics until the new contact path supplies the equivalent. Add Ground configuration/capture for Summons.
- [x] Red MP tests distinguish flat20MP and20% recovery, preserve payload/capture wording and show one current picker choice. Remove the current duplicate and update visible flat field names without rebalancing values.
- [x] Run shared editor, corrector, capture/reload and reader tests, types/lint; freeze. Independent review approved after projected-ordinal remapping guard.

### Task3: Ground identity and pending visuals (reflect_presentation)

**Files:** `combat-ground-visuals.ts`, `battle-ground-area-layer.tsx`/CSS, new shared visual registry, preview projection/readers, existing native fixtures. Only map-section wiring in `battle-experience.tsx`; resource-preview task owns cost/card wiring.

**Interfaces:** Add `GroundEffectVisualId` and server-whitelisted `effectVisualIds?:readonly GroundEffectVisualId[]` to `PublicCombatGroundArea`. Derive from captured entry packets for current areas. Preserve preset fallback for legacy areas. Whitelist only tiles, IDs, activation/expiry and visual identities; keep executable source private.

- [x] Red tests for distinct identities including Damage/Pierce/statuses/recovery/removal, Chilled icy material, mixed fields, privacy and input immutability.
- [x] Render compact active identifiers/lifetimes and one small pending clock with actual activation round. Preserve elevation/portrait space, earlier mobile scaling and desktop sizing. Show current fields in proposed terrain summaries through safe projected descriptors.
- [ ] Extend native pending/active/expiry and mobile/desktop playable/spectator cases; compile and run CI evidence, with explicit fixture limitations. Source54 cases are compiled; native execution awaits final CI.

### Task4: Haste zero-cost Move (duration99_core)

**Files:** `pv1f-skills.ts`, `recruit-ai.ts`, `recruit-ai-build.ts`, `summon-ai.ts`, `battle-basic-actions.ts`, shared Haste readers and focused engine/server/geometry/AI tests. No `combat-walking.ts` edits are needed. Coordinate Haste's `status-content.ts` row with Blind; authoring task owns Haste's one description in `combat-effect-descriptions.ts`.

- [x] Red tests for authored/reloaded Haste at AP0, exact0 payment, physical Movement depletion, no AP credit, Slow/rough/terrain composition, finite paths/AI, flat Move costs retained and actual preview/commit.
- [x] Lower only the final movement floor to0, repair zero-cost AI and captured per-terrain UI gates, and update wording.
- [x] Run focused core/server/UI/AI tests, types/lint; freeze.

### Task5: Proposed resource spending (review_percentage_limits)

**Files:** new `battle-proposed-cost.ts` and tests, cost/header/local-card sections of `battle-experience.tsx`, `battle-combatant-card.tsx`/CSS and captured preview/card interaction tests.

**Interfaces:** Pure payer-tagged proposal with numeric AP/HP/MP costs and matching context; exact quote takes priority, then existing captured descriptor when unambiguous. Pass proposed HP/MP only to the matching controlled acting card. Native quote HP omissions must be resolved from authoritative quoted/evaluated fields, not effect deltas.

- [x] Red mixed47AP/3MP/2HP interaction tests, Move-then-use, quote precedence, modifiers, cancel/stale/Inspect/nonlocal clearing and unaffordable bounds.
- [x] Add yellow spending segments to resource bars without moving actual values or including Barrier; retain AP header proposal and avoid adding embedded Move twice.
- [x] Run focused interaction/card tests and types/lint; freeze. Independent review approved;8 native cases added to the existing command-feedback fixture/script and compiled, execution awaits CI.

### Task6: Blind production registration (review_copy_lifetimes)

**Files:** `status-content.ts` Blind row, `combat-effect-authoring.ts` default, `skill-effect-editor.tsx` potency entry/label, `skill-effect-preview.ts` default; bounded removal selection validators; new additive tag-registration migration and PGlite/core/web tests. Coordinate shared hunks before editing.

- [x] Red real Blind application/capture/reload,80%-30%=50%, zero floor, Automatic Hit, Copy Debuffs, Cleanse,999%/99turn authoring and unique icon tests.
- [x] Register ordinary negative Blind using existing accuracy metadata/rules; do not change the kernel's legacy/current stacking contracts. Expand the three shared removal-selection caps consistently so Cleanse All includes the new seventeenth status while retaining validation.
- [x] Create additive registration with installed Supabase CLI, preserving current finite lists/ACL and publications. Test SQL; do not apply hosted changes until root review/verification.

### Task7: Integration, review and publication (root)

- [x] Review every spec requirement and cross-task file/interface ownership, including legacy Frozen normalization and MP captured template basis.
- [ ] Independent reviews after source freeze; repair findings and run meaningful affected tests. Run final `pnpm check`, native fixtures and configured CI on the same source.
- [ ] Checkpoint through a verified local/remote matching tree with real Git parent and compare-and-swap branch update. Rewrite PR1002 around the final scope; keep application deployment and catalogue mutation status explicit.

### Task8: Explicit All recipient parity (duration99_core)

- [x] Make explicit All include every living character/summon including caster, independently of inherited team/footprint masks; do not broaden sibling packets or old pending recipient masks.
- [x] Match preforecast highlights and actual server preview recipient union; hide a friendly-fire control when All is the only reason it would appear.
- [x] Verify native/canonical captures, summons, actual displacement, friendly/hostile accuracy boundaries, lethal Draw and reload.

### Task9: Displacement outcome wording (root)

- [x] Reproduce through actual log readers and clipboard with resolved distances1/3/5, requested maximum15 and both failure directions.
- [x] Show named actual-distance prose and simple undisplaced failure; preserve raw events. Four files/79 tests passed.

### Task10: Reveal semantic references (root)

- [x] Reproduce missing Reversal/Strain/Revealed nodes at the current canonical reader boundary.
- [x] Add semantic identities/shared generic help and existing popup references without prose or capture mutation;53 tests across4 reader files passed.

### Task11: Persistent immediate Reversal (duration99_core)

- [x] Capture `reversalPolicyVersion?:1` in current encounter factories and preserve absent-policy history.
- [x] Remove next-owner-turn expiry only under the current policy; validate the marker and preserve trigger/cancel/Reveal/defeat/terminal cleanup and the existing Strain clock.
- [x] Prove immediate same-turn interception through a real execution path, multiple own-turn/round advances, JSON reload, single qualifying trigger, nonqualifying hits and cancellation without refund.
- [x] Shorten saved-value descriptions and pinned public armed-state readers, with shared generic help and no embedded full Strain paragraph. Verify historical reader behavior and request independent review.

### Task12: Actual inherited Ground companion compatibility (counter_trace/copy_concealment)

- [x] Reproduce full-gate Chilling Mist@8 preview/reload failures and detached-editor duplicate Chilled from the actual published definition.
- [x] Preserve unambiguous inherited Ground delivery and original companion identity/metadata at runtime and draft conversion, without weakening validation or deduplicating independent unit effects.
- [x] Verify exact-one Chilled with original duration/ID/ordinal/notes, native/canonical/Summon paths and explicit Enemy/multiple-candidate exclusions; re-review before the final full gate.

Task11 return revision: use a coherent current Reversal policy for persistence plus uncapped percentage return. Remove current maximum-HP cap controls/readers while retaining historical payload compatibility. Prove400% of30 returns120 despite historical40%/60% HP caps, actual HP/Barrier settlement, exact huge overkill display, fractional final floor and legacy pinned behavior. No fake unlimited cap and no catalogue rewrite.

### Task13: Ruin consumption and same-line damage feedback

- [x] counter_trace owns current optional Ruin policy, exact private application capture, one boosted landed packet per target, partial canonical removal/DoT cleanup, active/unspent intersection for queued casts and legacy preservation.
- [x] reflect_presentation owns minimal exact public bonus metadata projection, same-line Chronicle/clipboard annotation, current/historical descriptions and actual capture-to-reader tests. Coordinate event contract with the engine owner; do not recalculate from later statuses.
- [x] Cover ordinary/DoT applications, prefix/suffix reapplication, protected/neutral exclusions, multiple targets/packets, misses, Barrier, Reversal, delayed duplicate spending, raw capture/provenance and privacy.
- [x] Independent review found and repaired stamped Suppress Copy identity reuse, suffix DoT provenance after native-order reset and Abort partial reconstruction. Fresh review reports no remaining Critical/Important findings; independent67 core/45 battle-service tests pass. Full core6662, root98 Copy/Ruin and77 battle-service tests pass before the later Summon/Chronicle additions. Final combined gate remains pending.

### Task14: Pierce cannot crit (duration99_core)

- [x] Add current optional per-packet critical policy and pin both new Pierce/Ruin policies in all current admission factories, including World and Master previews; preserve absent-policy history.
- [x] Exclude only Pierce ordinals from ordinary/guaranteed/forced critical application, including mixed skills, pending, Ground and Summons; preserve ordinary Damage critical behavior and Ruin bonuses.
- [x] Match forecast/commit/RNG and current-versus-historical help. Coordinate captured reader contexts with Ruin descriptions and avoid shared damage-path edit collisions.
- [x] Verify native/canonical/Weak Point/Spike/mixed packets, reload, actual execution and public labels, then independent review and final integration gate.


### Task15: Narrative strength receipts (chronicle_narrative)

- [x] Add minimal saved-value display receipts for ordinary/pending/copied statuses and available recovery/Endure values; do not change mechanical resolution.
- [x] Use effect-specific concise prose in Chronicle/clipboard and matching information help. Preserve exact existing damage/Ruin and authored flavor.
- [x] Test absent/malformed/hidden data, uniform/mixed Copy, correct round versus owner-turn lifetime and real receipt-to-reader output; review and integrate.

### Task16: Encounter-derived Summon potential (summon_scaling)

- [x] Add bounded deterministic offensive potential evaluator using existing scaling and captured templates, not full AI search/RNG.
- [x] Freeze exact geometric-mean authored-potency budget at spawn; share spending across all outgoing delivery each global round and retained source archives. Pin current optional policy at every admission; preserve legacy.
- [x] Remove proposed90% ceiling under latest Owner instruction; allow safely representable potency beyond999%, show omitted uncapped truthfully, keep private source data private.
- [x] Cover strongest Skill specialist versus Basic Attack, allies/defeated exclusions, max resource capacity, repeat restrictions, multi-target/multi-hit/DoT/Ground/reactions, reload/expiry, round reset and current/legacy readers.

### Task17: Native Summon dependency linking (summon_dependencies)

- [x] Reproduce Ice selection missing Chilled at actual native editor update boundary.
- [x] Reuse ordinary elemental/dependency management with stable generated-link identity and preserve independent authoring metadata and Ground references.
- [x] Test element/recipient changes, deletion, no duplicates and captured execution; coordinate AI wiring separately from potency/portrait editor fields.

### Task18: Summon save compatibility and numeric authoring (summon_validation)

- [x] Reproduce canonical Summon payload.target, nested categories/maximumSelections and Circle radius rejection through real draft admission.
- [x] Align strict supported-key allowlists and shape limits with current runtime; retain unknown-key rejection and auto-managed internal fields.
- [x] Remove arbitrary Summon balancing ceilings where technically supported, including potency beyond999%, without weakening unrelated tag/player bounds or safe arithmetic. Coordinate potency controls with Task16.
- [x] Verify real save/capture/reload, malformed data and meaningful large values.

### Task19: Summon portrait (summon_portrait)

- [x] Reuse existing media field/validation to author a Summon portrait.
- [x] Preserve profile portrait through canonical/native save, capture, spawn and public battle rendering, retaining old fallback.
- [x] Test actual editor-to-battle path and invalid input; coordinate schema allowlists with Task18.


Task15 review: repaired missing-rate Wet/Conductive help defaults, pending neutral Fortified/Reckless strength loss, and unpinned legacy Blindside activation claims. Fresh independent166web/130core tests pass; owner206web focused tests pass, no remaining Critical/Important findings.

Task18/19 independent review:44core/211web/17SQL tests pass; no Critical/Important findings. Native and canonical metadata, strict unknown-key guards, large values, affordability and finalized portrait-to-battle routes reviewed. No portrait migration required.


Task16 review: repaired genuine default Basic Move capture handling, disabled Basic eligibility, once-per-action repeats, captured timing normalization and missing/stripped current budget rows. Fresh independent69core/19web checks pass. Latest owner222focusedcore tests pass; full6707core tests passed before these final review fixes. Both new policy and historical/uncapped readers are reviewed. Retained native definitions without a captured template conservatively use native Basic potential; no live catalogue lookup.

Task17 review: strict save originally rejected the new elemental authoringLink namespace. A dependency-free finite generated-link guard is now shared by both real validator boundaries; actual editor-to-native/canonical-save-to-immutable-capture regressions prove all four elemental dependencies. Fresh independent64tests pass; owner93web/70core, web types/lint/format pass. No remaining Critical/Important findings.


Final local checkpoint: `pnpm check` passes formatting/lint/types,15372Vitest/7Node tests and production build. Defenseless’s real full-round label is now asserted correctly; generated Turbopack cache recovery required no source change. Native CI and exact-tree PR checkpoint evidence remain the final integration tasks.


Native integration follow-ups: Source0740 passes19/20configured workflows; remaining Browser smoke assertion waits for an unavailable default retry target after correctly clearing stale selection. A real valid Line pointer gesture now proves recovery locally (76cases). Grouped Ground preview/marker54cases, canonical14cases, canonical Move38cases, palette/editor browser checks and Suppress14+12Chronicle cases pass locally using ChromeHeadless151. Resource8cases exposed mobile AP proposal text hidden by the compact header; show a bounded compact numeric cue and retain the yellow bar. Chronicle contrast8.37:1 passes; update its stale separate-recipient-span assumption. Legal long names also exposed desktop waiting title growth;16rem preserves the44pxrow and board in24cases. Current-policy retained Ground full reports must remove the obsolete AP terrain prose using the shared execution mapping while preserving history. Freeze and verify these final integration repairs together.
