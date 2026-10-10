# Unified Engine Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Existing Owner approval authorizes execution; do not ask for design approval again.

**Goal:** Reconstruct and deliver the complete approved engine/content/presentation/Master overhaul, final creative balanced roster and verified live release from recoverable repository checkpoints.

**Architecture:** Extend the current immutable content/resolution/build services with one typed Ability model and historical adapters. Publish complete records atomically, project safe captured public DTOs, and build compact authoring/operations around those shared contracts. Operational recovery and roster changes use actual server authority, not presentation-only simulations.

**Tech Stack:** Existing TypeScript/Next.js/React, game-core, validation/db packages, Supabase Postgres/RPC/RLS, Vitest and repository browser harnesses. Node 24 and repository-pinned pnpm; no speculative new framework.

**Spec:** `docs/superpowers/specs/2026-10-10-unified-engine-recovery-design.md` and the exact approved `2026-10-10-unified-engine-recovery-owner-brief.md`.

**Owner clarification:** `docs/superpowers/specs/2026-10-10-auxiliary-skill-editor-owner-addendum.md` requires complete panel editing for every Skill behind Support Action slot3, including Guard, HP Recovery and MP Recovery, alongside editable Move/Basic Attack. Each option is editable regardless of the selected slot choice. This preserves the existing single Support Action and four selected Discipline Skills.

**Recovery status:** The prior local overhaul and evidence are unavailable. Task1 is reconstructed and independently accepted at949af25e877c7ff158bd8f885e1aa7a69d014306; later product tasks remain pending. Earlier conversation test counts are not evidence for reconstructed code. Baseline `ee5d49de449851c9b9aa61438735c4cd27ca6af4`; branch `agent/unified-engine-recovery-20261010`.

## Global Constraints

- Structured definitions determine mechanics; descriptions never create rules. Stable IDs, typed units and explicit effect order are mandatory.
- Build on `ee5d49de449851c9b9aa61438735c4cd27ca6af4` or newer main. Preserve elemental policy 2, Suppress percentages, all historical optional policies, captured effects and exact-version battle snapshots.
- Do not change unrelated damage formulas, progression, AP economy, movement limits or resource recovery. Preserve current roster balance through Tasks 1–13/3A; Tasks 14–15 design and implement the Owner-authorized final roster rebalance through new immutable versions. Current `armor`/`ward` mean Physical/Mystic Defense, not future equipment Armor.
- New HP costs leave at least 1 HP and do not emit damage events. AP/MP/HP costs commit together once per legal activation.
- Self and Ally are separate. New ordinary targeting permits up to the configured count of distinct legal selections. Line and caster-centered square-ring Circle retain existing geometry. New All bypasses Range while independently configured LoS/elevation remains; historical geometry v2 is preserved.
- Controlled first use primes the whole Manual action without ordinary payment, action consumption or cooldown; one prime per character/ability/battle. Legal release pays once and consumes the prime; invalid release retains it. Rewind captures its existing position anchor on prime. No arbitrary expiry, automatic release or refunds.
- Pierce power is 1–20; Armor Ignored is 0–100% of the recipient's explicit future equipment Armor contribution, separate from scaling and all other mitigation. Without equipment Armor, explain that configured bypass has no current advantage. Preserve legacy `piercing:true` semantics in historical definitions.
- Selecting Fire/Ice/Water/Storm damage inserts explicit required companion mechanics, locked in authoring and enforced by validation/execution. Preserve policy-2 application conditions, magnitudes, timing and expiry; no duplicates.
- Public field order is Type, Cost, Cooldown, Requirements, Effects, Range, Target, Method, Target Elevation, Line of Sight. Values use brackets; independent entries use a middle dot. Public API/RSC/preview payloads omit authoring accuracy fields.
- Save Draft is not Publish. Publish appends a complete atomic version with optimistic concurrency. Restore copies a complete prior snapshot into a draft, then publishes a new version. UI shows current plus two previous published versions; older referenced snapshots remain physically readable.
- Six primary destinations: Game Content, Combat Rules, Events & Live Ops, Players, Staff & Access, Site Music. Preserve the global character rail, header/account entry and footer; compact desktop layouts remain usable at mobile and 200% zoom.
- Staff grants belong only to the explicitly selected linked character and are checked for expiry/revocation on every protected server/RPC operation. Single Game Owner and nondelegable powers remain protected. Ambiguous legacy grants fail closed until explicitly bound.
- Administrative battle recovery is durable no contest/no rewards, never ordinary surrender/defeat; identify all affected participants before voiding a shared encounter. Late workers/retries cannot grant rewards or records. Do not invent resource refunds.
- Routine written reasons are removed from forms, relevant TS validation and SQL contracts without fabricated reasons; automatic actor/time/action audit remains.
- New migrations use `pnpm exec supabase migration new` after CLI help, preserve existing migration files and service-only grants/RLS, and are tested locally/PGlite. Never mutate hosted production during Tasks 1–16. The Owner-authorized final release applies only reviewed necessary hosted changes after acceptance, independent whole-branch review and current-state reconciliation. Preserve `apps/web/vercel.json` Git deployment lock.

## Review Focus

- A stale browser, alternate selected character or direct RPC must not bypass live expiry/revocation/CAS. Task8 exercises these actual authority paths; Task16 verifies them with the finished workspaces.
- Malformed nested/captured/pending/summon data must fail closed without leaking private accuracy or replacing old definitions with current content. Tasks1/5/7 exercise wrong types, recursive serialization and immutable capture.
- No input, free priming, repeated events and interrupted Move must not produce unbounded damage, duplicate payment, extra turns or attacks from an unreached tile. Tasks2/3A/4 and14–16 exercise those paths.
- Concurrent publication/build/claim/recovery/settlement must either commit a coherent result once or return a specific retry/no-contest outcome. Tasks5/6/9/12/16 test actual rollback, locks and late/repeated workers.
- Long names, missing historical metadata, mobile/native keyboard and 200% zoom must retain truthful mechanics and accessible primary controls. Tasks7–13/16 inspect actual components/screens and distinguish fixtures from hosted/human evidence.

## File structure and interface ownership

| Owner | New responsibility | Existing integration |
| --- | --- | --- |
| T1 | `combat-definition.ts`, `combat-requirements.ts`, `combat-tag-registry.ts` | `mature-skills.ts`, `essence.ts`, `resonance.ts`, validation/package exports |
| T2 | `combat-behavior-runtime.ts`, `combat-behavior-capture.ts` | `actions.ts`, source/provenance kernel, pending/turn/AI services |
| T3/3A/4 | canonical selection, `combat-move-effect.ts`, `combat-basic-actions.ts`, `combat-controlled.ts` | targeting shapes, movement, timing, command schema/session/controller |
| T5/6 | complete content and Discipline/earned relationship authority | existing DB repository, resolver, authoring service/store/RPCs, character/build/trial services |
| T7 | `public-combat-presentation.ts`, shared Ability/Requirement/Tag readers | actual public/API/RSC/battle/spectator/Manual/log/preview boundaries |
| T8–12 | Staff/Players/Content/Rules/Music/Events finished workflows | existing Master services, capability helpers, routes, media and event/music runtimes |
| T13–16 | integration, roster design/application, final acceptance | real catalogue/kernel/AI/player operations, browser/SQL/full checks, durable release handoff |

Names in this table identify planned new modules, not existing implementation. Extend existing modules where the boundary already exists; ledger a naming change and propagate it through later handoffs instead of creating duplicate authority.

## Common task gate and durable evidence

Before implementation: read the applicable AGENTS/domain docs, refresh main, reconcile overlaps, record exact BASE, install frozen dependencies if needed, and establish the relevant fresh baseline. The prior 4,797-test run is historical, not this checkout's verification. Keep the deployment lock blob `b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f` unchanged.

Each task writes meaningful failing regressions first, observes the expected failure, implements, runs covering tests/types/lint/format, inspects the diff, refreshes main immediately before commit, and commits only intended files. Record exact command/cwd/completed exit/log path immediately in `verification.jsonl`, plus report, immutable interface handoff and reviewer verdict. Preserve diagnostic failures rather than replacing their logs. No package-wide or repeated passing suites without a new risk/change/failure.

Use one capable High implementer and one independent combined spec/quality task reviewer; no helpers or duplicate review seats. Follow the SDD scoped fix-loop contract. Only actual accepted commits unlock dependents. Root may write coordinating documents, not unreviewed product fixes. Keep root on High once this plan's reconstruction phase is complete; pause and prompt before later root work genuinely needs Extra High. Task14 creative design is a likely such point.

Push verified task commits and durable evidence summaries to this non-deploying feature branch before an interruption. Preserve full bulky local diagnostics until the next durable evidence checkpoint; store compact regression results/commands/rulings/visual selections in `docs/verification`, not only ignored scratch. Never push secrets, credentials or private player fixtures. No merge, hosted mutation or deployment until final acceptance/review.

### Task 1: Canonical definitions, units, Requirements and supported Tags

**Files:** Create `packages/game-core/src/combat/combat-definition.ts`, `combat-definition.test.ts`, `combat-requirements.ts`, `combat-requirements.test.ts`, `combat-tag-registry.ts`, `combat-tag-registry.test.ts`. Extend `mature-skills.ts`, `essence.ts`, `resonance.ts`, `combat-skill-accuracy.ts`, relevant validation and package exports.

**Interfaces:** Produce schemaVersion1 `AbilityDefinition`, `AbilityBehavior`, `AbilityEffect`, `AbilityTargeting`, `AbilitySelection`, `RequirementNode`, `AbilityRequirementContext`, `CombatAccuracyRule`, `AbilityDefinitionIssue`. Export `parseAbilityDefinition(value: unknown): AbilityDefinition`, `validateAbilityDefinition(value: unknown): readonly AbilityDefinitionIssue[]`, and `evaluateAbilityRequirements(requirement: RequirementNode | null, context: AbilityRequirementContext): boolean`. Each behavior has stable `id`, `activation`, `mode`, classification, costs, cooldown, requirements, applicable targeting, effects, and optional private accuracy. `AbilityEffect.payload` is an implemented registry effect with its permitted recipient; wrapper adds conditional Requirement/timing without conflicting duplicate recipient fields. Add optional `ability` to existing envelopes; a present malformed canonical payload cannot silently use legacy fields.

- [ ] Write RED tests `canonical_cost_units`, `fixed_accuracy_endpoints`, `requirement_tree_budget`, `event_subject_unavailable`, `canonical_legacy_conflict`, `elemental_companion_validation`, `future_armor_boundary`. Assert simultaneous AP11/MP2/HP1 remains three typed costs; Fixed0/10000 valid and -1/10001 invalid; Requirement depth8/node128 accepted and9/129 rejected; unavailable triggering subject false; unknown/duplicate keys and unsupported recipients/combinations rejected. Preserve damage1–20, percentage units, legacy piercing and policy2 companions.
- [ ] Run `pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-definition.test.ts src/combat/combat-requirements.test.ts src/combat/combat-tag-registry.test.ts`. Expected: named new-contract assertions fail before implementation, not dependency/import setup failure.
- [ ] Implement the exact model/parser/registry/requirements, reusing existing payload validation and typed effects. Publish private Fixed configuration only where a real hit check applies. Define finite group/effect array budgets in one named constant and document the selected bound; prose cannot enable handlers. Future equipment Armor is an explicit nonnegative separate contribution, never armor/ward.
- [ ] Run the same tests plus affected legacy accuracy/mature/Essence/Resonance tests and affected types/format. Expected: all covering tests/types/format pass; old absent-field definitions remain unchanged.
- [ ] Commit and write accepted-model handoff with parser errors, supported IDs/units/combinations/budgets and exact private/public boundary. Independent gate; checkpoint remotely.

### Task 2: Captured execution, modifiers, Automatic and Ongoing behavior

**Current architecture clarification:** use `docs/superpowers/specs/2026-10-10-manual-modifier-command-design.md` and its Task2 continuation plan `docs/superpowers/plans/2026-10-10-manual-modifier-command.md` (Ruling10). Explicit references and one atomic canonical/native command resolve the Manual modifier integration gap; all original task gates/BASE remain.

**Files:** New `combat-behavior-runtime.ts`/tests and `combat-behavior-capture.ts`/tests; extend `actions.ts`, `combat-action-source.ts`, `combat-kernel-types.ts`, actual encounter creation/pending/turn/AI service paths.

**Interfaces:** Consume T1. Produce immutable `CapturedCombatAbilitySource`, `CombatAbilityActivationInput`, `evaluateCombatAbility(input: CombatAbilityActivationInput): CombatActionEvaluation`, `activateCombatAbility(input: CombatAbilityActivationInput): CombatResolutionTransition`, and source-owned reconciliation/event processing functions used by actual services. Input includes state, actor ID, captured source, behavior ID, selection, catalogue and command provenance; never a client-supplied execution definition.

- [ ] RED `atomic_multicost_nonlethal`, `modifier_before_damage`, `automatic_crossing_once`, `once_limit_epoch`, `source_owned_maintenance`, `prepaid_pending_before_automatic`, `capture_cannot_change_in_place`, `historical_absent_canonical`. Assert HP payment leaves1 and emits no damage event; illegal/duplicate commands spend0; one legal activation pays each cost once across multiple recipients; fixed miss preserves paid legal attempt but hit-dependent effects skip; modifier composes before settlement; source A removal preserves B; repeated unchanged threshold/event does not reproc.
- [ ] Run `pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-behavior-runtime.test.ts src/combat/combat-behavior-capture.test.ts`. Expected: concrete missing runtime assertions fail.
- [ ] Implement canonical-before-legacy routing, private immutable capture and existing-kernel composition. Preserve depth8/budget32/duplicate guard, source-owner turn limits, global round limits and whole-action limits. Initial Ongoing support is compatible source-owned maintained damage bonus; unsupported continuous damage/recovery/statuses receive specific errors.
- [ ] Run covering core and actual session/service tests plus affected types/lint/format. Expected: real create/preview/commit/turn paths pass, old private JSON/costs/policies remain stable, no mocked-only authority claim.
- [ ] Commit, report actual producers/consumers and pending/maintenance contracts, independent gate and durable checkpoint.

### Task 3: Canonical plural targeting, recipients and geometry

**Files:** Extend `combat-targeting-shapes.ts`, `combat-authoring-validation.ts`, action/selection validation, actual preview/commit/AI target adapters; new canonical targeting tests.

**Interfaces:** Consume T1/T2 `AbilityTargeting`/`AbilitySelection`; produce one canonical target resolver consumed by evaluate/activate and one safe geometry adapter consumed by the controller. Selection has distinct unit/tile IDs plus supported direction, Ground destination and Move path where relevant. Cardinal Line and caster-centered Chebyshev Circle retain geometry2 behavior; new independent All constraints require a new explicit geometry marker.

- [ ] RED `up_to_three_distinct_targets`, `self_is_not_ally`, `mixed_effect_recipients`, `line_all_eligible`, `circle_inner_rings`, `all_range_only_bypass`, `maximum_supported_map_range`, `historical_geometry2`. Assert counts1..3 legal and duplicate/fourth selection rejected; Circle1 eight and Circle2 twenty-four surrounding tiles; actor included only by explicit Self; All ignores Range but obeys authored LoS/elevation; old All keeps its captured semantics.
- [ ] Run targeted targeting/geometry tests. Expected: new plural/independent constraint assertions fail; unchanged old tests establish baseline.
- [ ] Implement one legality/footprint path. Derive range ceiling from actual largest supported arena/map distance metric; report the inspected bound, not an invented constant. Migrate authored Terrain target aliases to Ground without removing map terrain/entry rules. Effect recipient resolution cannot pay per recipient or fabricate a primary unit for Ground.
- [ ] Run core geometry, actual server preview/commit and AI target tests/types. Expected: footprint and selected outcome agree across paths; legacy serialization remains valid.
- [ ] Commit/handoff/gate/checkpoint; list the exact geometry marker and largest-map evidence.

### Task 3A: Registered Move and editable Basic actions

**Files:** New `combat-move-effect.ts`/tests and `combat-basic-actions.ts`/tests; actual movement/Poison step execution, command validator/session/AI/controller, Basic definition resolver/capture.

**Interfaces:** Consume T1–3. Produce registry Move payload with `apPerTraversalPoint`10–100/default20 and `maximumTiles`1–20, first/once-only Manual walking compatibility; Basic Move/Attack definitions captured into T2 sources. Basic identity `unarmed.basic` stays separate from command identity; read the current Basic Move identity rather than renaming it.

- [ ] Extend the same editable Basic resolver/capture to every actual Support Action in `SUPPORT_ACTION_IDS`: Guard, HP Recovery and MP Recovery. Cover edited authored values in new battles, immutable old captures and the preserved single saved slot3 choice; carry exact identities and cooldown-sharing/conversion restrictions into T5/7/10. See the auxiliary Skill editor Owner addendum.

- [ ] RED `move_then_enemy_followup`, `reached_not_planned_origin`, `move_interruption_poison_root_death`, `authored_cost_plus_traversal`, `movement_cap_independent`, `zero_ap_basic_offense_once`, `positive_ap_repeat`, `basic_attack_stat_family`, `edited_basic_old_new_capture`. Use AP100 and Move AP11/MP2/rate35/cap2; one terrain point leaves54AP; interruption before destination uses reached tile. Miss consumes zero-AP offensive attempt; prime/invalid do not; pure walk remains ordinary. Physical ties win, damage remains stat-derived, AP0 Basic Attack publication rejected.
- [ ] Run new core Move/Basic tests and actual server preview/commit covering tests. Expected: missing registration/capture/follow-up assertions fail.
- [ ] Implement through the real orthogonal traversal/step helper, preserving Haste/Slow/min10AP/occupancy/Jump/Poison and remaining Movement. Commit authored costs once and walking AP per legal entered tile. No Automatic/Ongoing Move or new human summon command. Save divergent old-to-new drafts truthfully; convert/publish only a complete mechanically equivalent saved version or explain the exact incompatibility.
- [ ] Run actual PvE/PvP desktop/native-keyboard/mobile controller cases, interruption service tests and types/format. Expected: actual command destination then follow-up, cancellation/stale cleanup and old/current Basic captures agree; no force-click or synthetic keyboard claim.
- [ ] Commit/handoff/gate/checkpoint. Record every preserved conversion restriction and actual browser fixture limit.

### Task 4: Controlled prime/release, cancellation and Rewind

**Files:** New `combat-controlled.ts`/tests; timing parser/policy, command validation, capture/state/session/AI and shared PvE/PvP controller/readiness.

**Interfaces:** Consume T1–3A. Produce immutable prime identity/source/version/group/anchor, explicit prime/release/cancel intent and authoritative ready/blocked state. Controller uses selected Manual group; public DTO implementation follows T7.

- [ ] RED `free_prime_whole_group`, `release_pays_once`, `invalid_release_retains`, `reconnect_prime`, `duplicate_release`, `multiple_manual_choice`, `cancel_source_maintenance`, `rewind_prime_anchor`, `no_input_no_auto_release`, `defeat_terminal_cleanup`. Assert no AP/MP/HP/action/cooldown on prime; no other group effects; legal release pays once/consumes, invalid retains, cancel removes only source-owned state, no timer expires/releases it. Rewind anchor is prime position, not release or current-turn origin, with legal landing and no refunds/history rewind.
- [ ] Run Controlled/timing/session tests. Expected: missing persisted prime and exact payment/anchor assertions fail.
- [ ] Add Controlled to stored/new timing compatibility and actual prime/release/cancel service path. Reject unsupported Automatic/Ongoing Controlled and destination locking combinations. Rewind changes through an idempotent one-time migration/version, preserving later Owner edits. AI uses a bounded legal prepare/release/cancel policy and cannot busy-loop on blocked primes.
- [ ] Run real native Tab/Shift+Tab/hotkey/pointer matrices, stale/reconnect/duplicate server tests, affected types/format. Expected: both modes/breakpoints pass through production controller with no nested tooltip or extra action authority.
- [ ] Commit/report/gate/checkpoint; capture producer contract and private/public state distinction.

### Task 5: Complete content creation/publication/history/dependencies

**Files:** Extend existing `packages/db/src/combat-content.ts`, authoring service/store/handler, resolver, validation, editor workflow/client; additive CLI migration and new real `packages/db/src/unified-content-publication.test.ts`.

**Interfaces:** Consume accepted engine/Basics. Expand `CombatContentKind` with Basic/Discipline/Tag/Item/Ascension/Severence while retaining legitimate existing kinds. Produce full-record create/duplicate/saveDraft/publish/restoreToDraft/archive/Used-by services and current/exact-version catalogue reads. All current publication choices use CAS; actual RPC/caller signatures are reported and carried into T6/T8/T10.

- [ ] Include every auxiliary Support Action definition in the complete Basic/inherent record workflow; edits are independent of the selected slot3 option and use real full-record CAS, history, exact capture and dependency authority.

- [ ] RED `complete_record_atomic_cas`, `create_duplicate_stable_ids`, `restore_full_hidden_media`, `current_plus_two_retained_older`, `archive_used_by_basic_guard`, `no_seed_resurrection`, `future_saved_but_unsupported_runtime`, `real_predecessor_authority`. Assert stale draft/publication writes mutate nothing; every field/version/history/projection/audit rolls back on a failed step; old referenced versions readable; restore becomes draft then a new version; retired current lookup never resurrects a seed; unsupported future activation is blocked specifically.
- [ ] Run repository/service/handler and real local/PGlite migration tests. Expected: new complete/cross-kind transactional assertions fail, actual predecessor authorization remains exercised.
- [ ] Extend the real spine, strict envelope/identity validation and indexed reverse references. Preserve schema history/grants/RLS, and finalize uploaded media before referencing durable IDs. Version Skill source immutably, validate canonical and legacy agreement, preserve Basic publish/conversion rules. Never backfill by overwriting actual Owner publications.
- [ ] Run covering content/DB/security/rollback/restore/reader tests, SQL typed wrong-type/Unicode cases, types/lint/format. Expected: coherent success and total rollback on every tested failure; legitimate current/pinned runtime service access unchanged.
- [ ] Commit/report/handoff/gate/checkpoint. Inventory all protected complete-content entry points for T8 and all finished editor consumers for T10.

### Task 6: Real Discipline/Core/relationship/earned eligibility authority

**Files:** Full typed Discipline schema/core profile; existing Atlas/build/creation/allocation/saved-loadout/mastery services/stores/RPCs; resolver and publication relationship fields; additive migrations and actual DB tests.

**Interfaces:** Consume T5. Produce full current/exact pinned Discipline resolver, atomic Core/Atlas publication, explicit E/R effective relationship CAS, earned Skill eligibility grants, `eligibilityDisciplineId` in immutable build references, actual Core-aware creation/build/allocation/trial RPCs and named bounded admission retry errors. Intrinsic Skill source never changes.

- [ ] RED `core31_six_positive_focus_caps`, `new_discipline_real_player_use`, `explicit_relationship_selection`, `learned_shared_grant_not_access`, `unlink_retains_earned`, `selected_eligibility_loadout`, `initial_pin_trial_credit_once`, `malformed_pin_fail_closed`, `publication_claim_lock_order`, `typed_text_atomic_rollback`. Assert Core31, 2–3 unique focus attributes, 60/40 caps and5 personal creation choices; only real earned provenance creates a grant; removal stops new grants but retains owned/equipped facts; shared selected battle-pinned Primary gets one credit; current unlink cannot rewrite old use.
- [ ] Run focused core/build/creation/mastery/DB publication tests. Expected: actual static-only/missing-grant/CAS/admission assertions fail.
- [ ] Implement actual coherent projections/consumers, not a catalogue-only editor. Retain trial XP/two-distinct-three-use/eight-distinct Master/testing rules. Historical omitted eligibility defaults intrinsic/native; present malformed pins reject. SQL strict mirrors match reader type/trim/length. Avoid publication/build/claim lock cycles through shared order or bounded NOWAIT admission; preserve idempotent prior receipts and specific409 refresh/retry translation.
- [ ] Run real local rollback/all-state/security checks and covering player/create/build/claim tests. Add an optional strictly loopback test-only physical two-session schedule; reject host/query/hostaddr/environment routing overrides before spawning. Expected: tested actual rollback/concurrency boundaries; honestly report physical execution versus skipped single-session simulation.
- [ ] Commit/report/handoff/gate/checkpoint. No learned/mastery/current-player/old-battle rewrite implied by catalogue publication.

### Task 7: Every actual public reader and recursive privacy boundary

**Files:** New core `public-combat-presentation.ts`, shared Ability/Requirement/Tag readers; all actual Skill/Nexus/build/Basic/Resonance/summon/status/Manual/log/preview/API/RSC/live/spectator consumers; rendered and serialization/browser tests.

**Interfaces:** Consume accepted captures/current/pinned content. Produce `PublicCombat<T>`, `PublicAbilityDefinition`, safe Basic/build/Controlled/live maintained DTOs, versioned Tag context and shared full/compact/live/Chronicle adapters. Final composed envelopes are projected recursively, preserving numeric combat Accuracy/Evasion, independent proc chance and authorized forecasts/results.

- [ ] Include all edited auxiliary definitions in the actual current/pinned availability, forecast, cockpit, Manual and recorded outcome readers; require the auxiliary addendum's registry-driven coverage and historical privacy checks.

- [ ] RED `recursive_private_accuracy_omitted`, `pinned_current_basic_rendered`, `safe_controlled_build_capture`, `maintained_exact_source_lifetime`, `ten_ordered_rows_multicost`, `conditional_recipients_geometry`, `versioned_tag_actual_lookup`, `typed_template_plain_text_plural_miss`, `copy_same_recorded_log`, `one_accessible_popup`. Assert raw authoring aliases/objects/materialized actions absent from serialized API/RSC/capture/pending/Ground/summon envelopes; private inputs unchanged; old/current Basics show actual AP/rate/cap/range; maintained12.5% says while Requirements, not expiry; actual MISS does not claim a hit.
- [ ] Run rendered reader and actual boundary tests. Expected: missing migration/leak/wording failures, not mocked DTO-only success.
- [ ] Migrate an explicit twelve-row reader audit map. Prefer safe exact capture, then exact pinned reference only for legitimate historical gaps. Do not current-fill history. Versioned editable Tag text uses typed refs; registry owns mechanics, recorded instance values remain actual. Templates validate unknown refs, interpolate once as text, keep missing actors unavailable and distinguish use/flavor/result. In existing popovers expand notes inline; do not parse DOM/prose for identity.
- [ ] Run covering web/core tests, actual fresh-capture public JSON browser readers at1366×768/390×844, real Basic/Controlled/SkillMove controller matrices, types/lint/format. Expected: complete actual migration map, one dialog and native keyboard/touch policy, no art resizing; explicit fixture versus execution/hosted distinctions.
- [ ] Commit/report/gate/checkpoint. A skipped public consumer is a task blocker; finished generic authoring workspace remains T10.

### Task 8: Selected-character Staff authority and Staff & Access

**Files:** Existing `staff-access*`, Supabase store, protected auth/page/service factories/callers and all SQL account-grant assertions; Staff page/API/component/CSS; additive migration/security tests.

**Interfaces:** Consume actual complete-content/Discipline authoring RPC inventory. Produce server-derived current selected-character actor context and live capability assertion for every protected operation, verified identity→all linked characters lookup, selected-only grant/edit/revoke, positive-day UTC expiry/no-expiry, explicit legacy binding and role presets. Canonical role slugs stay unchanged.

- [ ] RED `selected_only_grant`, `alternate_character_denied`, `expired_revoked_open_session`, `switch_recalculates`, `direct_rpc_capability`, `owner_single_non_delegable`, `self_elevation_denied`, `legacy_needs_binding`, `utc_expiry_boundary`, `reason_free_attribution`. Test actual new content/relationship as well as older operations and real predecessor grants, not an always-authorized SQL stub.
- [ ] Run Staff/store/handler/DB authority tests. Expected: account-wide/stale-session authority assertions expose actual missing enforcement.
- [ ] Migrate actual TS/RPC signatures together; check current identity→ownership→selected character→capability→live expiry/revocation each time. Protect Owner/bootstrap/nondelegable powers and Players escalation paths. Preserve ordinary character/battle current/pinned service reads. Compact directory/verified focused assignment with readable scopes/Edit/Revoke/no raw permission wall; remove routine reasons without fake audit values.
- [ ] Run covering protected handlers/SQL denial/allow/expiry tests and inspected desktop/mobile/200% zoom/focus Staff page. Expected: actual finished UI and server/RPC parity; state fixture claims separated from hosted sessions.
- [ ] Commit/report/gate/checkpoint and exact capability/actor handoffs for all later operational pages.

### Task 9: Players and durable no-reward battle recovery

**Files:** New Players route/workspace/reader/validated edit service; actual battle lifecycle/store/RPC/reward/worker/lock/queue/client refetch paths and tests.

**Interfaces:** Consume T8 authority and T6 coherent build rules. Produce bounded neutral selected-player reads, protected gameplay edit commands with fingerprints/CAS, recovery preview naming all affected participants, and one idempotent authoritative no-contest/eject operation.

- [ ] RED `neutral_reader_no_world_mutation`, `caps_derived_preserved`, `no_identity_role_edit`, `live_battle_edit_block`, `shared_recovery_names_all`, `late_completion_claim_no_rewards`, `repeat_recovery`, `normal_completion_race`, `queue_prime_lock_cleanup`, `no_refund_or_unrelated_reward_loss`. Assert real rewards/records/XP/currency/loot remain zero after no-contest, actual late worker/claim retries reject, existing legitimate completed outcome is not rewritten.
- [ ] Run service/handler/lifecycle/DB tests. Expected: missing actual guards/cleanup/validated operation assertions fail.
- [ ] Implement bounded reads, real source-stat/resource/progression/build edits and truthful calculated/protected/future fields. Whole-encounter void only where selected-only removal is unsafe, with explicit participant confirmation. Persist terminal no-contest before cleanup; settle actual queues/participation locks/maintenance/primes and guard every reward/record consumer in the same authoritative lifecycle. Preserve unrelated progress and established resource rules.
- [ ] Run actual race/late-worker/claim rollback tests, protected handlers and inspected desktop/mobile/zoom workspace. Expected: coherent terminal state/refetch and zero benefits, no raw DB editor or fabricated inventory/runtime.
- [ ] Commit/report/gate/checkpoint, carrying actual no-contest guards into Events/final acceptance.

### Task 10: Finished Game Content, shared editor, references and media

**Files:** Master shell/nav plus existing combat-content editor/workflow/client, shared category/Discipline/Tag/editor panels, media upload/finalize/crop/audio services, routes/handlers and rendered/browser tests.

**Interfaces:** Consume T5/6/7/8. Produce complete manual create/edit/duplicate/link/search/filter/publish/archive/restore for every requested kind, explicit E/R current selection, contextual Parameters/Text/Media/History and actual shared previews. Preserve server CAS/capture/privacy; no parallel mechanics.

- [ ] Expose and fully edit every Skill available behind Support Action slot3, including unselected Guard/HP Recovery/MP Recovery. Cover Parameters/Text/Media/History, Draft/Publish/Restore and real shared previews for each; prove the complete editor-to-new-battle outcome chain at T13/16. The auxiliary Skill editor Owner addendum defines this acceptance scope.

- [ ] RED `manual_new_kind_complete_save`, `create_skill_within_discipline_retry`, `link_existing_no_duplicate`, `source_tags_registry_compatibility`, `basic_saved_version_publish`, `insert_reference_values`, `media_finalize_crop_audio_history`, `draft_published_compare`, `archive_dependencies`, `future_capability_truth`. Assert exact saved canonical definitions reach publication/real execution/readers; Illustrative preview does not claim equipped Resonance matching or simulation.
- [ ] Run existing editor/workflow/server and new category/reference/media tests. Expected: missing genuine workflows fail.
- [ ] Finish compact unified list/workspace, categories and progressive disclosure; retain global rail/header/footer and accessible Save/Publish/dirty state. Use actual resolver data, linked pickers/Used-by and typed reference insertion. Upload from PC and retain current/history media. Show only applicable fields and specific incompatibility blockers, including Basic conversion limits and unsupported future runtime.
- [ ] Inspect1366×768/1440×900/390×844/200% zoom, long names/list/error/dirty states and actual editor→save→publish→preview browser chains; run affected lint/types/format. Expected: no overflow/scroll trap, actual professional UI, real crop/audio controls and exact full/compact/live/message samples.
- [ ] Commit/report/gate/checkpoint; no mockup bitmap masquerading as product implementation.

### Task 11: Combat Rules and Site Music

**Files:** Existing timing/elevation policy editor/store/service and site-music settings/media/player/route coverage components/tests; compact Rules/Music workspaces.

**Interfaces:** Consume T8/T10 capability/shell and shared timing/Tag registry. Produce one actual timing/elevation authority, Used-by compatibility checks, Global/page music selector `Use Global | Custom Track | No Music`, slash-boundary longest-route coverage and single continuous looping player.

- [ ] RED `timing_order_not_execution_order`, `controlled_compatibility_usedby`, `reason_free_policy_save`, `page_silence_over_global`, `global_silence_custom_page`, `slash_boundary_longest_match`, `same_track_continuous`, `loop_user_intent_autoplay_error`, `pc_music_upload_retained`. Assert explicit silence never falls back to Global, route prefix does not match an unrelated sibling, same effective track does not restart/overlap, stop/replace occurs on effective selection change.
- [ ] Run policy/store/editor/music resolver/player/upload tests. Expected: actual missing behavior/copy/workspace assertions fail.
- [ ] Implement compact searchable/sortable timing/elevation sections and music page list/preview/reset/upload/direct URL. Display Instant/Normal/Delayed/Controlled intentionally; preserve captured old timing. Hide user-managed policy numbers/reason bureaucracy while retaining internal CAS and attributed history. Preserve mute/volume/player intent and actual route coverage; expose understandable upload/playback failures.
- [ ] Run real reader/editor/player tests and desktop/mobile/zoom/cross-page browser checks. Expected: continuous looping/silence and authoritative rules work; no skill-audio coupling or fabricated playback success.
- [ ] Commit/report/gate/checkpoint; carry actual supported media limits/coverage into final handoff.

### Task 12: Coherent Events & Live Ops and real lifecycle safety

**Files:** Existing event authoring/operations server/service/store/handlers and event builder/operations clients; actual scheduling/clock/jobs/settlement/reward RPCs and tests.

**Interfaces:** Consume T8 authority/T9 terminal guards/T10 shell/reference pickers. Produce combined compact workspace over existing supported event types/executors, audience/timezone/schedule/fingerprint, safe publish/pause/resume/stop and idempotent settlement where actually supported.

- [ ] RED `reference_capability_reject`, `selected_vs_global_emergency_authority`, `draft_live_concurrency`, `paused_clock_excludes_elapsed`, `stop_late_job_settlement`, `repeat_receipt_no_reward_replay`, `unrelated_progress_preserved`. Unsupported domain work must block specifically; acknowledgement-only job status cannot count as gameplay execution; no invented event battle join.
- [ ] Run actual event handler/service/clock/job/reward/SQL tests. Expected: missing clock/settlement authority assertions fail.
- [ ] Retain useful actual Event Builder/Live Ops functionality in focused list/setup/live views with readable references and explicit audience/timezone. Pause real clocks/queued work coherently, stop actual in-flight/late settlement safely, preserve prior successful receipts and unrelated facts. Expose only supported irreversible actions and clear concise confirmation; remove routine reasons without losing attribution.
- [ ] Run late-job/retry/concurrency/authority tests plus inspected desktop/mobile/zoom actual workspace. Expected: real domain consequences and no duplicate outcomes, no decorative unsupported controls.
- [ ] Commit/report/gate/checkpoint with precise supported action/undo/executor limits.

### Task 13: Original integration and operational acceptance checkpoint

**Files:** Integration tests/scripts, local migration/security/rollback tests, screenshot/evidence selections and `docs/verification/2026-10-10-unified-engine-integration.md`.

**Interfaces:** Consume all accepted1–12/3A handoffs. Produce twenty-section plus Move requirement coverage, real editor→publication→execution→reader integration evidence and exact remaining pre-roster limits. This is not final roster acceptance/release.

- [ ] Add failing integrated guards for every real gap found in the trace: complete new-content chain, old/new Basic/Controlled captures, earned shared Discipline/mastery, protected direct RPC, no-contest late claims, music precedence and event settlement. Existing passing tests are reused rather than mirrored.
- [ ] Run real local migration/security checks, supported physical two-session schedule, actual mounted production browser flows, native keys/touch,200% browser zoom and inspected screenshots. Expected: every requirement mapped to actual implementation/check; any skipped physical/hosted/human evidence named precisely.
- [ ] Run `pnpm check` once after focused checks are green. Expected: formatting/lint/all-package types/tests/build pass; warnings diagnosed and tracked without blindly suppressing output. No repeat absent a changed source/failure/unresolved risk.
- [ ] Commit verification and necessary independently gated fixes; checkpoint actual commands/results/versions/rulings/screens. Only then unlock roster design.

### Task 14: Complete creative balanced roster design

**Files:** Read actual current repository and permitted read-only published override inventory; produce `docs/superpowers/specs/2026-10-10-roster-rebalance.md` and machine-readable full per-record design manifest.

**Interfaces:** Consume accepted engine/registry/publication/build/AI behavior and real inventory. Produce reviewed proposed new immutable versions for every current Skill/Essence/Resonance/Basic considered, Discipline identities/play cycles, actual cost/power/cooldown/Requirements/recipient choices and counterplay/interaction cases. Stable IDs/intrinsic source/earned eligibility remain coherent. Include the Owner tag-coverage addendum below.

- [ ] Pause root and prompt for Extra High if creative balance judgment requires it; do not silently spend higher-effort worker credits. Inventory actual overrides and records; do not assume only seeded counts or rewrite Owner edits without reconciliation.
- [ ] Inventory every currently implemented gameplay tag from the actual accepted registries/handlers. Map each to at least one meaningful, obtainable playable Skill/Essence/Resonance/Basic definition in the final roster. Include supported Requirement tags and newly implemented effects. Distinguish historical-only aliases and future authoring entries from executable tags; no invented handler or decorative tag counts as runtime coverage. Preserve creative playstyles and balance rather than stuffing unrelated effects together.
- [ ] Design distinct choices across Disciplines and each actual pair Resonance: setup/spend, movement/position, tempo, conditional risk, protective/support, resource and counterplay cycles using supported effects. Include variable power, free primes/maintained aura/no-input, finite chains, AI and PvE/PvP. No blanket percentage reskin or universally best zero-cost loop.
- [ ] For an enemy positional-return candidate or any wider Basic/Move extension, define a bounded typed recipient/anchor/refresh/clock/landing/visibility/counterplay contract and exact new tests before inclusion; mark it provisional until T15 real handler/capture/editor/readers/AI pass. Preserve existing self-Rewind history.
- [ ] Validate complete inventory coverage, legality/cost/chain budgets, distinct cycle rationale and before/after cases. Expected: no orphan/missing/reclassified record or unsupported mechanic sold as implemented.
- [ ] Commit design/manifest, independent spec+quality design gate and checkpoint. T15 consumes exact accepted manifest, not a fresh reinterpretation.

### Task 15: Apply all accepted new roster versions and required real extensions

**Files:** Actual roster/version pipeline/resolver/seed-publication preparation, any reviewed bounded kernel/schema/editor/reader/AI extension, full roster tests and before/after manifest.

**Interfaces:** Consume exact accepted14 manifest. Produce complete new immutable roster definitions and reviewed publication/backfill procedure preserving current Owner edits/history/relationship selections/earned facts. Implement all selected new mechanics before their definitions may publish.

- [ ] RED each selected new mechanic's finite/counterplay/capture/history/no-input cases, whole actual roster parser/handler coverage and stable source/eligibility/version comparisons. Add a registry-driven completeness check that fails for any implemented gameplay tag lacking a playable roster case, and authoritative outcome tests for the documented tag cases; mere presence in JSON or a description is insufficient. Retain individual representative PvE/PvP and real AI cases for each distinct cycle.
- [ ] Implement exact14 definitions and complete any extension through parser→handler→capture→editor→public reader→AI. Append versions; never mutate old snapshots or restore obsolete hidden formulas/retired statuses. Recalculate actual budgets and interaction cases rather than assuming labels prove uniqueness/balance.
- [ ] Run covering complete roster and new-extension tests, actual editor/service/AI/serialization/browser cases and affected checks. Expected: all records supported and each promised mechanic executable/legible; no unsupported placeholder or infinite/free dominance case.
- [ ] Commit complete applied manifest/evidence, independent gate and durable checkpoint. Carry all exact changed records and test instructions to16/release.

### Task 16: Final full acceptance and exhaustive change/test handoff

**Files:** Final integrated regressions/scripts and `docs/verification/2026-10-10-unified-engine-final.md`, complete per-record before/after/test manifest, durable current rulings and release runbook.

**Interfaces:** Consume every accepted gate and final roster. Produce verified finished system, every twenty-section/Move/roster requirement mapping, all real SQL/authority/concurrency/no-contest/event/music/editor/reader evidence, exhaustive user-test list and honest physical/hosted/human limits.

- [ ] Verify actual final editor→validation→publication→authoritative execution→reader chains for every category/mechanic; real protected RPCs/selected character/expiry/revocation, full rollback/physical schedule, old/new captures, no-input and late settlement paths. Resolve real gaps with covering failing tests and independent task gate.
- [ ] Inspect final1366×768/1440×900/390×844/200% zoom workflows with native keyboard/touch, long text/empty/error/history and real current/pinned data. Preserve representative screenshots and report console/runtime results. Local headless is not hosted authentication or human gameplay acceptance.
- [ ] Run final `pnpm check` after all focused final changes pass. Expected: complete gate green on exact accepted head, all warnings/limits accounted for and no untested changed source.
- [ ] Deliver the complete tag-to-content test checklist: stable tag ID/display name, Discipline and playable content ID/version, parameters/conditions, activation steps and expected observable outcome, with actual execution evidence. Every currently implemented gameplay tag must have a meaningful final-roster use and test case; no untested or silently omitted tag.
- [ ] Commit durable exhaustive changed-records/testing/rulings/evidence handoff; one independent task16 gate, then one most-capable available whole-branch review over actual merge-base..head, carrying deferred/parked/declined items. One combined final fix wave and scoped follow-up per SDD; no duplicate broad review or unreviewed load-bearing residual.
- [ ] Final authorized release: refresh/reconcile main and exact-head CI; inspect actual hosted migrations/publications/Owner edits, apply only reviewed necessary changes with CAS/history/security preserved; merge/push intended result and explicitly deploy exact intended SHA with Git deployment lock retained. Verify Ready state/canonical URL/logs/public and available authenticated smoke. Expected: exact release receipts, truthful smoke/human limits, exhaustive change/test list and all current ledger rulings in order. Never infer live success from build/tests alone.

## Requirement-to-task coverage

| Approved brief section | Delivering tasks |
| --- | --- |
| 1 Integrated scope | 1–16 and this design/plan |
| 2 Shared engine | 1–4/3A,13,15–16 |
| 3 Tags/typed settings | 1–2,5,7,10–11 |
| 4 Fields/units/costs/clocks | 1–4,7,10–11 |
| 5 Target/recipient/Ground | 3/3A,7,10,13,15–16 |
| 6 Requirements/events | 1–2,4,7,10,14–16 |
| 7 Controlled/Rewind | 4,7,10–11,13–16 |
| 8 Pierce/future Armor | 1–2,5,7,10,14–16 |
| 9 Elemental preservation | 1–5,7,10,13,15–16 |
| 10 Public/compact/live/messages | 7,10,13,15–16 |
| 11 Compact six-destination panel | 8–12,13,16 |
| 12 Manual content/Discipline creation | 5–6,10,13,16 |
| 13 Text/media/private accuracy | 1–2,5,7,10,13,16 |
| 14 Actual preview/publish/history | 5–7,10,13,16 |
| 15 Rules/timing/elevation/reasons | 4,8–12,16 |
| 16 Music | 11,13,16 |
| 17 Staff | 8 and actual protected consumers9–12/16 |
| 18 Players/recovery | 9,12–13,16 |
| 19 Events/lifecycle/rewards | 12–13,16 |
| 20 Migration/whole-chain/verification | Every task gate,13,16 and final release |
| Conversation: Move/editable Basics | 3A,4–5,7,10,13–16 |
| Conversation: complete creative balanced roster | 14–16 before release |
| Conversation: every programmed gameplay tag used/testable in roster | 14 inventory/design,15 definitions/outcomes,16 exhaustive player checklist |
| Conversation: low credits/effort pause | Common gate and14; High after reconstruction, prompt before Extra High |

## Self-review and execution handoff

This plan retains approved behavior and stable interfaces while explicitly re-verifying missing implementation. All twenty sections and later Move/roster instructions have delivering tasks. Capture/runtime precedes publication/readers; Staff authority precedes privileged operational consumers; complete integration precedes creative roster design/application; final whole-branch review precedes hosted changes/release. Any concrete discrepancy in the recovered summary resolves against the actual approved brief/current domain authority and is ledgered before changing an interface. No prior completed task is falsely marked restored.
