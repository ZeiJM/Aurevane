# Master Panel usability implementation plan

> For agentic workers: use superpowers:executing-plans for native task-by-task implementation. Do not start subagents or automations unless Nick requests them or a later applicable instruction requires a specific review.

Goal: deliver the complete Owner-requested Master Panel usability batch with one coherent ability editor, faithful engine controls and concise operational tools.

Architecture: extend existing canonical ability, content lifecycle, tag presentation and privileged-operation services. Use one shared aim per cast and one validated recipient path per effect. Reuse shared UI components across Discipline Skills, Essences and Resonances; retain compatible readers for real captured data instead of maintaining duplicate everyday editors.

Tech stack: existing pnpm 11.17.0 / Node 24 workspace, Next.js/React/TypeScript, game-core, Supabase Postgres, Vitest, native Playwright. No new frontend framework or speculative dependency.

Spec: [Master Panel usability design](../specs/2026-10-27-master-panel-usability-design.md).

Status: implementation in progress on High. Verified slices and remaining scope are recorded in docs/verification/2026-10-27-master-panel-usability.md and the local execution ledger. Nick selected one shared aim and delegated routine choices. No batch deployment has occurred.

## Global constraints

- Refresh main before diagnosis, before editing and before finalization. Work on the isolated task branch; preserve unrelated changes and the Git deployment lock.
- One shared aim per cast. No independent per-effect enemy/ally selection stages.
- Tabs: Details & Text, Media, Range & Area, Action Economy, Accuracy, Effects. All is a Target option, not Shape. Shape choices: Single, Circle, Line. Targetable Elevation is the label.
- Shared ordinary authoring across Discipline Skills, Essences and Resonances; actual activation/capability differences stay meaningful. Requirements and triggers remain editable where applicable.
- No generic Piercing/Vengeance/scaling/facing checkboxes or per-Skill accuracy modifier. No per-effect description override in the current editor. Actual mechanics must move with these controls.
- Full and short tag descriptions come from Combat Rules. Every effect exposes its target; current full readers omit the redundant Target row. Revise the information contract and consumers together.
- Retain actual immutable battle/audit dependencies; no user-facing history/rollback feature, hard purge or historical semantic rewrite.
- Ordinary text contrast at least 4.5:1. Check 320/390px mobile, 768px tablet, laptop/desktop and 200% zoom; visible focus and touch help.
- Mutation authorization, atomicity, expected revisions, idempotency and valuable data integrity remain server-owned. Do not silently respec characters to make deletion succeed.
- No production changes, CI launch or deployment during planning. Final deployment follows the existing source/READY and compatible host-plus-ID protected cutover requirements.

## Review focus

1. Switching records/tabs, following Used by links or finishing an upload during a save must not lose or overwrite another draft.
2. Mixed hostile/friendly/self/global effects must agree in previews, actual execution, AI and resumed captures; aim simplification must not broaden targets accidentally.
3. Level decreases and stat corrections must update the persisted allocation/reset state as well as displayed XP/Level and must not duplicate rewards.
4. Ban expiry/lifting/revocation during an active session must produce the right access result without a generic error, stale privilege or client-only authorization.
5. Deletion, default restoration and no-op edits must not resurrect built-ins, overwrite per-item defaults, remove shared records or mutate historical dependencies.

Each owning task below includes these cases. Focused development checks precede one broad final gate; no repeated full-suite loop.

## File and responsibility map

| Area              | Existing ownership / proposed focused additions                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared engine     | packages/game-core/src/combat/combat-definition.ts, combat-tag-registry.ts, combat-targeting-shapes.ts, combat-ability-command.ts, combat-behavior-runtime.ts; focused authoring-tag and recipient helpers alongside these   |
| Editor            | apps/web/src/components/master/combat-content/content-record-modal.tsx, content-definition-fields.tsx, ability-definition-editor.tsx, ability-effect-editor.tsx; shared ability-editor-tabs.tsx and effect-authoring helpers |
| Text/readers      | battle-narration.ts, gameplay-tags.ts, character/skill-effect-preview.ts, skill-detail-presentation.ts, skill-parameters.tsx, resonance-parameters.tsx, shared skill-information-contract.ts located by rg                   |
| Media             | skill-media-editor.tsx, finalized-media-editor.tsx, media hooks and server finalized-media validation; focused per-item baseline artwork resolver                                                                            |
| Content lifecycle | discipline-relationship-list.tsx, relationship-override-fields.tsx, combat-content-record-command.ts, supabase-combat-content-authoring-store.ts and existing lifecycle SQL                                                  |
| Players           | players-workspace.tsx, player-correction-form.tsx, players-service.ts, players-handler.ts; character/progression.ts and attribute-allocation.ts                                                                              |
| Operations        | master-panel-shell.tsx, lib/master-panel-pages.ts, staff-management.tsx, moderation-workspace.tsx, world-environment editor; corresponding server services                                                                   |
| Analytics         | master/usage-balance.ts, server/master/usage-balance.ts, usage-balance-panel.tsx and private reporting SQL                                                                                                                   |

New migrations are assigned unique UTC timestamps at implementation time. Extend the existing private/RPC paths, never edit an already-applied migration or use blanket db push. Test databases use the repository's existing disposable fixtures.

## Task 1: Pin field usage and content migration inventory

Files: read the map above, current domain docs and source; create docs/verification/2026-10-27-master-panel-usability.md as the single implementation receipt.

Produces: a field ledger in that receipt with each current control's producer, live consumer, decision (keep/merge/remove/conditional), and compatibility/publication consequence. Include a catalogue scan of affected nonzero accuracy modifiers, old damage flags, per-effect wording and current artwork references.

- [ ] Trace Description, Flavor Line, battleText and presentation public/compact/activation/result through actual consumers. Record why each remaining control exists; no field is removed merely because its screenshot is confusing.
- [ ] Enumerate authorable tags/status variants from registry and existing handlers. Compare both editor paths and published definitions; identify retired, requirement-only and unsupported cases explicitly.
- [ ] Record exact per-item artwork baseline references before any custom upload/default behavior changes. Use read-only catalogue export if needed, never invent a built-in mapping from a name.
- [ ] Write meaningful fixture cases for conversion: an ordinary Skill, Essence, automatic Resonance, Ground/Summon, Pierce and Vengeance. Assert opening/closing a record does not alter its serialized mechanics.
- [ ] Run the affected current tests once to establish this task's baseline, append commands/results, and commit the inventory with the relevant regression fixtures.

## Task 2: Complete effect vocabulary and shared-aim recipient semantics

Files: game-core combat-definition.ts, combat-tag-registry.ts, combat-targeting-shapes.ts, combat-ability-command.ts, combat-behavior-runtime.ts, gameplay-tags.ts, damage-modifiers.ts; new combat-effect-authoring.ts and combat-effect-recipients.ts beside them, with adjacent tests. Update package exports only for consumed helpers.

Consumes: Task 1 field/tag/conversion inventory. Produces: one AuthorableEffectTag descriptor list and one canonical recipient resolution path consumed by editing, validation, execution, AI and presentation. Descriptor IDs distinguish actual gameplay variants while mapping to existing payloads.

- [ ] Add failing tests: authoring variants contain separate Copy Buffs/Copy Debuffs, Cleanse/Dispel, HP/MP recovery, Push/Pull, Pierce, Vengeance and every supported status; none is omitted by a static UI list. Each maps to an executable payload or a specific unsupported-combination reason.
- [ ] Add failing gameplay tests with caster A, ally B and enemy C: shared aim at C damages C and heals A; area hostile damage plus ally recovery filters recipients independently; global All retains arena scope; Self is not duplicated; Empty Tile rejects occupancy. Forecast does not mutate or consume RNG. Commit charges costs/cooldown once.
- [ ] Use current recipient roles where sufficient. For independent effect team/scope filtering, add a validated optional canonical recipient policy rather than a UI-only rule. Absent policy follows exactly the prior path; new policy is captured and validated at serialization and server admission. Do not put a second target selector at the behavior wrapper if it can disagree with the effect payload.
- [ ] Route applicable new recipient filtering through shared legality/preview/commit/AI code. Preserve stable source effect ordinals, packet ordering, pending effects, trigger bindings, private information and native special restrictions. Capture and restore tests must cover current and historical omitted-policy data.
- [ ] Add failing tests for Barrier removed before Pierce HP damage, existing Defense/equipment Armor behavior, bounded Vengeance history conversion and rejected Vengeance-plus-scaling. Expose the established conversion/min/max fields through the Vengeance descriptor; do not create a second resolver.
- [ ] Neutralize removed per-Skill accuracy modifiers for newly authored/current publications, with tests distinguishing global/status accuracy from the retired per-Skill modifier. Historical captures continue their saved rules.
- [ ] Run pnpm --filter @aurevane/game-core exec vitest run with the new recipient/authoring tests plus existing combat-definition, canonical-targeting, targeting-execution, ability-command, accuracy, Barrier and Vengeance tests selected by rg. Run game-core typecheck. Confirm actual tests pass and commit.

## Task 3: Shared editor shell, compact Effects and text cleanup

Files: content-record-modal.tsx, content-definition-fields.tsx, ability-definition-editor.tsx, ability-targeting-editor.tsx, ability-effect-editor.tsx, skill-targeting-editor.tsx, skill-economy-editor.tsx, skill-effect-editor.tsx, skill-effect-list-editor.tsx, ability-presentation-editor.tsx, battle-flavor-template-help.tsx and editor CSS. Create ability-editor-tabs.tsx for the shared six-tab shell; remove superseded everyday branches after parity is proven.

Consumes: Task 2 tag descriptors/recipient semantics and Task 1 usage ledger. Produces: the same six-tab editor for Skill, Essence and Resonance drafts without lossy schema conversion.

- [ ] Add interaction regressions for each ability kind: edits survive all six tab changes, selecting another record and return, validation focuses the correct field/tab, stale save/failure retains edits, and keyboard focus returns correctly after close.
- [ ] Build Details & Text, Media, Range & Area, Action Economy, Accuracy and Effects in that order. Preserve meaningful automatic/setup/requirements controls with conditional placement. Essence inherits parent Discipline; do not expose redundant Source Discipline there.
- [ ] Replace oversized effect forms with stable-ID expandable rows. Summary shows tag, target, magnitude and timing/duration; small reorder/remove buttons preserve exact execution order and settings. Add searchable tag picker with explanations for incompatible choices. Tests assert reorder/remove affect the intended row, including repeated identical tags.
- [ ] Implement Target in each effect, Single/Circle/Line shape choices, Targetable Elevation, paired min/max range, and existing Friendly Fire as On/Off. Remove Team Policy UI and four generic damage checkboxes. Conditional dimensions/help preserve alignment. No additional cast selection is introduced.
- [ ] Keep AP explicit; implement optional HP/MP resource rows, allowing combined costs. Show percentages as percentages, not basis points. Verify insufficient-resource and nonlethal HP boundaries through engine tests rather than only form snapshots.
- [ ] Rename Automatic Hit to Always Hit after verifying the applicable path bypasses the accuracy roll; retain other legality/effect rules. Remove Accuracy Modifier and current per-effect description controls entirely.
- [ ] Merge duplicate text authoring around the traced primary fields. Retain distinct live overrides in optional Wording Overrides with exact Shown in hints and one preview/token helper. No raw JSON or duplicated sample-pronoun forms in the default flow.
- [ ] Run focused web Vitest tests for affected editor/recovery/workflow components and game-core adjacent tests after behavior edits; then use native master-combat-content-authoring and representative Resonance/Essence cases against local fixtures. Check mobile/desktop visually, document meaningful results and commit.

## Task 4: Central tag wording, full readers and direct editor links

Files: combat-effect-timing-editor.tsx, app/master/combat-timing/page.tsx, tag presentation validation/publication path, combat-tag-registry.ts, skill-effect-preview.ts, compact-skill-effect-summary.tsx, skill-detail-presentation.ts, skill-parameters.tsx, resonance-parameters.tsx, content-record-preview.tsx and server battle log/live projection consumers; docs/SKILL_INFORMATION_CONTRACT.md.

Produces: centrally editable full/short descriptions and a shared current reader with explicit effect target brackets. Expose a stable editor route /master/combat-content?contentKey=<encoded stable key>&tab=effects and validated known tab IDs; route access remains server-checked.

- [ ] Add tests that tag full/short edits appear in the matching Skill Manager, battle tooltip/log and Master preview contexts; parameter substitution uses actual effect/captured values and rejects unsupported tokens. New wording must not reinterpret a completed historical result.
- [ ] Add Edit Description per gameplay tag in Combat Rules. Reuse existing versioned tag presentation records; extend keys for true gameplay variants and statuses as required. A no-op save does not republish all content.
- [ ] Remove inline removable-status lists from Dispel's concise label; retain that information in its full description. Render every applicable effect with [Target], using orange text with measured contrast; preserve distinct timing/magnitude styles.
- [ ] Remove the redundant current Target row and update contract/order assertions across all affected shared readers. Keep historical unavailable/retained metadata truthful and Basic actions complete; do not suppress necessary aim information in actual battle selection.
- [ ] Make Used by names direct links to the correct editor/Effects tab. Preserve originating filter, scroll, draft and return context; missing/archived/unauthorized content produces a useful state. Avoid stacked dialogs and raw internal names.
- [ ] Run affected presentation/unit and server projection tests plus native direct-link/draft-return cases. Update Manual/current authority wording with implementation status; commit.

## Task 5: Media, relationship workflow and per-item defaults

Files: skill-media-editor.tsx, finalized-media-editor.tsx, content-definition-fields.tsx, content-record-modal.tsx, discipline-relationship-list.tsx, relationship-override-fields.tsx, media hooks/validation and existing content record persistence. Add focused content-artwork-defaults.ts and tests at the relevant authoritative media boundary.

Consumes: Task 1 baseline references and Task 3 shared editor. Produces: one preview with custom/default artwork controls, image-only Discipline Artwork tab, and working Edit/Clear relationship rows.

- [ ] Add tests that custom upload cannot redefine the item's default, Restore Default resolves the captured baseline after refresh, new items with no default are explicit, and async upload completion does not overwrite another record's edits or discard sound.
- [ ] Consolidate duplicate media previews and nested boxes. Show current artwork, upload/crop preview and Restore Default; sound has its own compact choice/upload/playback section in ability Media. Discipline Artwork never offers sound.
- [ ] Integrate the supplied Skill FX audio through packages/audio registry/director and skill-media-hooks, using neutral stable group identities and picker labels. Import matching runtime MP3/OGG derivatives, retain WAV source provenance/hashes separately, preserve three variants and initial supplied assignments, and avoid loading all assets. Preview must resolve the same assigned group as battle playback. Test all 153 mappings, missing asset rejection, mute/volume, playback deduplication, explicit custom audio precedence and decoded representative assets in native browsers. Keep historical cue keys compatible and remove obsolete current assignments only after consumers switch. Random group assignment during future Skill creation remains future work; do not introduce random unrelated sounds per cast.
- [ ] Measure the corresponding in-game artwork consumer before changing preview dimensions. Reuse its size/ratio where different, with responsive containment; record the measured result.
- [ ] Add New Skill and a 0/8 count inside Discipline Skills. Start blank or Use existing Skill as template creates an independent child draft with fresh identity, correct parent/source and copied editable values only. Remove generic Duplicate/Archive Actions UI. Test empty new Discipline, template original unchanged, exact-eight acceptance, ninth rejection, canceled draft, retries and concurrent creates; enforce create-and-link capacity atomically at the database boundary (current publication validation allows up to 256 and must be tightened for new/current publications without rewriting saved captures). Essence/Resonance slots do not consume the eight.
- [ ] Replace Change power with Clear relationship. Clear removes only the selected association and related override selection, not shared power content. Empty Edit supports creating/configuring a valid relationship power. Preserve None (Essence), readable partner rows and override on/off semantics.
- [ ] Test clearing one of two relationships sharing a power, clearing the override supplier, toggling override off, editing an empty row and commit/refresh. Run affected media/lifecycle/relationship tests and native upload/preview/restore flow; commit.

## Task 6: Delete Discipline with authoritative dependency handling

Files: combat-content-record-command.ts, supabase-combat-content-authoring-store.ts, record workflow/actions in combat-content-authoring-workspace.tsx, existing lifecycle SQL/readers; add focused discipline-delete-plan.ts plus service/database/UI tests and a new timestamped migration only if the existing RPC cannot enforce the requirements.

Produces: a bounded deletion impact response listing named blockers and edit destinations, plus an expected-revision protected deletion command through existing lifecycle authority. Saved Discipline deletion uses a durable tombstone/current-record removal, not physical removal of executable history.

- [ ] Add database tests for unused custom and built-in deletion, reviewed exclusive-child cascade, active child source/pair metadata, no fallback resurrection, active character/loadout/grant references, shared powers, stale impact/revision and a concurrent newly added reference. Rejected deletion leaves all records unchanged.
- [ ] Add Delete Discipline under Actions and Discard for unsaved new content. Show counts and named dependency links before final deletion. Current external dependencies must be reassigned/removed explicitly; do not automatically change a character's Primary.
- [ ] Transactionally remove current visibility, reviewed exclusively owned children and contained/incoming associations only once no durable blocker remains. Source/pair metadata is part of the dependency check; do not leave active content pointing at a missing Discipline. Retain shared powers until explicitly repaired/reassigned and retain captured/audit facts. Clear local recovered drafts for successfully deleted records so reopening cannot recreate them.
- [ ] Verify default directories, current resolvers, new build choices and relationship lists respect deletion; saved battles still load. Run lifecycle/consumer/database tests and native delete/cancel/blocker-link cases, then commit.

## Task 7: Players workflow and coordinated stats/level corrections

Files: players-workspace.tsx/module.css, player-correction-form.tsx, master/players types, players-service.ts, players-handler.ts, character/progression.ts, attribute-allocation.ts and player-correction SQL. Add player-correction-progression.ts for the pure proposal using actual curve/profile inputs; do not duplicate XP formulas in the UI.

Produces: one correction draft and preview containing consistent stats, XP, derived Level and personal allocation/reset results. Level selection sets XP to that level's threshold; XP entry derives Level; Fit Level to Stats finds the lowest valid level at or above the proposed level, up to 100.

- [ ] Add tests for normal increase, Fit Level, direct XP change, de-level with excess points, accepted redistribution, pinned nondefault curve/profile, cap overflow, stale revision/replay and active battle. A successful correction must not trigger mandatory reallocation on next entry or duplicate level rewards.
- [ ] Add the saved-Discipline-base regression: publish Might 15/Vitality 12/other bases 1, then open the same character allocation view without manually changing Discipline. Current bases must refresh through server authority, personal points/attunement stay intact, changed caps get explicit reconciliation and active saved battles remain pinned. Reuse the proven same-identity Core conversion; do not merely swap display labels.
- [ ] Make Level and all Core Stats directly editable. Use minimum legal base/cap validation and exact point-budget feedback. A de-level with excess allocation remains an editable draft until the Owner accepts adjusted stats; a proportional-to-personal-points redistribution preview uses largest remainders, stable attribute order and real caps.
- [ ] Save all authoritative progression/allocation/reset fields atomically and recalculate dependent values through existing services. Preserve cycle, identity, unrelated loadout data and audit facts.
- [ ] Replace Correction group dropdown with compact sections, improve identity/summary/action placement, resolve actual Resonance/Essence names and remove Linked Sequence/technical version suffixes from current displays. Remove the exact encounter/wallet explanatory paragraph requested by Nick.
- [ ] Run progression/allocation and player service/database tests, then native master-players-recovery cases for correction, refresh/reentry and mobile layout; commit.

## Task 8: Moderation active list, direct lifting and banned-player experience

Files: moderation-workspace.tsx/module.css, master/moderation types, moderation-service.ts, moderation-handler.ts, moderation SQL, account/active-game-session.ts, shared authenticated entry/actor denial surfaces and their route consumers. Add a reusable account-ban-notice.tsx and an authenticated self-only ban-status response at the existing account boundary.

Produces: bounded Active Bans listing and direct Lift Ban intent with expectedRevision; self-only ban notice exposes reason, expiry/permanent and authoritative status without allowing gameplay access.

- [ ] Add failing tests for active/expired/permanent/lifted filtering, same-account multiple characters, unauthorized listing/lift, stale revision, double click/replay, and ban/lift during a verified active session.
- [ ] Fix search label/input/button containment and focus overlap; show the Active Bans list initially. One-click Lift Ban supplies a deliberate structured intent and generated audit reason; preserve authorization/CAS and pending state without the old selection/reason/confirmation detour.
- [ ] Convert account-ban denials at login/return/gameplay boundaries into a deliberate notice showing actual reason and countdown/Permanent. Allow safe sign-out and server recheck. Countdown zero alone never enables access; successful expiry/lift verification does.
- [ ] Verify no generic server error, private moderation history leak, infinite redirect or rapid polling loop. Reuse existing invalidation/session failure handling for active-session bans and a bounded retry/recheck path.
- [ ] Run auth/actor/moderation service and disposable SQL tests plus native temporary/permanent/expiry/lift cases on desktop/mobile, then commit.

## Task 9: One navigation order, active staff and weather controls

Files: master-panel-shell.tsx/module.css, lib/master-panel-pages.ts, staff-management.tsx/service/store, world-environment/world-environment-editor.tsx, matching server store tests; new Owner-only persisted Master navigation preference through existing settings authority and a timestamped migration if required.

Produces: shared ordered page metadata consumed by nav/access lists; normalized saved order shared across Master users and editable by the Owner.

- [ ] Test that nav and access choices have the same relative order; permission filtering never grants a hidden page, unknown/duplicate IDs normalize, reset works and refresh keeps saved ordering. Staff & Access remains protected.
- [ ] Add gear beside Activity Log with accessible Move Up/Down, Save and Reset. Use common metadata and preserve default visible order; remove duplicate order arrays after callers switch.
- [ ] Filter revoked staff from the active list immediately after successful revocation and after server refresh. Test actual authority denial, not only row disappearance. Audit facts remain available in Activity Log.
- [ ] Enable Forced weather duration editing independently of selection. Preserve keep/force/clear semantics and distinct roll cadence; display chosen override expiry. Test 37-minute force, invalid duration, changed duration while Keep Current and expired override behavior.
- [ ] Run affected shell/staff/world unit/SQL and native staff-selected-character-access/master-world-environment-cadence checks, then commit.

## Task 10: Chart-first Usage & Balance

Files: usage-balance-panel.tsx/module.css, master/usage-balance.ts, server/master/usage-balance.ts and handler, existing private usage collection/reporting SQL and tests. Use existing UI/chart capabilities or small accessible SVG/HTML charts; add no library merely for simple bars.

Produces: chart-ready current adoption/Skill usage, source-separated weekly outcomes, pair and matchup data; week selection uses actual collected buckets, not reconstructed legacy history.

- [ ] Add tests for source-separated denominators, draws, distinct players versus characters, equipped versus cast, unavailable versus zero, empty/partial week, repeated collection and tester/unfinished exclusions. Existing collector authority is preserved.
- [ ] Implement compact adoption bars, Skill equipment/use comparison, separate PvP/AI outcome bars, pair chart and matchup comparison with sample counts. Put methodology behind help and partial-sample badges; retain accessible values/tables.
- [ ] Extend the bounded reporting API to select real weekly buckets from collection start. Do not present the current snapshot as a past adoption trend. Empty/new collection shows No data yet, without a fabricated zero-percent win rate.
- [ ] Run report/parser/database tests and rendered dashboard cases at mobile/desktop widths, then commit.

## Task 11: Integrate, verify and prepare a reviewable release candidate

Files: active authority docs (AGENTS.md, TASKS.md, docs/MASTER_PANEL.md, docs/COMBAT.md, docs/SKILL_INFORMATION_CONTRACT.md and applicable Manual), the single verification receipt, actual migration/content publication manifest and release checklist.

- [ ] Refresh main, inspect overlap and reconcile before final verification. Review the final diff for unrelated churn, leftover duplicate editors, stale terminology, hidden removed mechanics and missing scope. Build a requirement-to-evidence checklist from every design section.
- [ ] Run pnpm check on the stable broad candidate, plus the applicable native browser/authority/desktop/mobile/Edge checks and new end-to-end cases. Focused runs during tasks are not a substitute for configured final checks. Do not repeat unchanged checks without a source/environment reason.
- [ ] Manually inspect the real local pages at 320/390/768px, laptop and desktop, 200% zoom, keyboard-only operation and long-content/error/empty states. Validate contrasting tags in light and dark themes, one principal editor scroll and stable save controls. Record automated versus human/physical-device limitations honestly.
- [ ] Prepare additive migrations and any current-content conversion with exact affected records and preservation checks. Existing stored forms open losslessly; publication is explicit and idempotent; old captures remain readable. Inventory the actual current deployment retirement rules before planning promotion.
- [ ] Prepare a focused PR description and one final CI candidate. Record actual SHA/tree, workflows, individual checks, completed browser cases and configured skips separately. No continuous polling or duplicate dispatch; resume inspection when an actual result is available or Nick requests it.
- [ ] Stop with the complete reviewable candidate if current work-item deployment authorization is absent. Before any approved live claim, execute the documented protected cutover, verify actual production source and READY, migration/content readback, public/account entry and relevant runtime errors. Do not claim Owner hands-on acceptance from automated checks.

## Verification exclusions during planning and focused development

This document/design change needs prose, link/path and diff checks only. No application tests, production queries or workflow dispatch are justified solely by writing the plan.

During an isolated editor/media task, unrelated World movement, multiplayer and commerce suites are excluded from the development loop because their authority is unchanged. Broaden immediately if a shared shell, session, combat/persistence boundary or uncertain dependency changes. The complete batch touches those shared boundaries, so all configured final required checks remain in the release gate.

## Handoff

Design choices are fixed sufficiently for High implementation: shared aim, shared editor, explicit per-effect recipients, central tag wording, shared Owner-controlled tab order, truthful chart data, dependency-aware deletion and atomic progression corrections. Implementation may settle small internal helper signatures against actual source; it must not reopen product scope or invent mechanics. Escalate only a concrete contradiction affecting behavior, recording the finding and the proposed resolution.

## October28 completion extension — same patch

1. Add RED tests in combat-effect-target-authoring.test.ts and combat-effect-recipients.test.ts: one Ground+Enemy cast, Airborne immunity only for Ground, selected unit/tile and area delivery, costs once, forecast purity, deferred snapshot restoration and repeated packets. Replace the provisional mixed-delivery rejection with valid shared geometry. Implement a focused combat-effect-delivery.ts classifier, use it for accuracy eligibility and per-effect execution/pending capture, then verify existing historical Airborne/targeting/capture/automatic/AI suites. Do not remove the restriction before runtime tests pass.
2. Inventory disabled tag/target reasons and document/fix missing authoring support against real handlers, including Summon configuration and inherited/multiple-selection conversion. Add meaningful regression cases for any fix; retain explicit established legality rather than silently changing game rules.
3. Add RED audio tests requiring only the153new groups, all shared cues in the new pool, and zero old runtime assets/build regeneration. Remove legacy registry/fallback assets and build generator hooks; update native persisted/preview expectations. Run audio/director, media/server privacy, runtime hash/codec and build checks.
4. Refresh the candidate inventory and authority docs, rerun affected and full quality serially without telemetry, compile native fixtures, then publish the exact new tree via the connected GitHub app and open the authorized draft PR. Shell push lacks credentials;31sound blobs were verified before publication paused. No branch/PR/CI/deployment exists yet. Browser socket denial and independent physical/listening/concurrency gates remain truthful.
