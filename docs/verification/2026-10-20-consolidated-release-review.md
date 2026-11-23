# Consolidated Staff + Players release review

**Reviewed candidate:** `f3c26f6ff5e18787139f48e46924340a433ad4b7`, tree `10012db06b34cc9c04735215a3c1f62683ebfc13`.
**Comparison:** fresh-main `4793b77c607b98bc8a8ccf783da56d69f429f0fe`; accepted Players `59b6372826df3805e22a9d383a9d4d0d4fb74f50`; canonical Staff PR945.
**Review date:** 2026-10-21. Single independent combined spec/quality review seat. Read-only on product, index, HEAD and branch state; no helpers, publication, deployment or suite reruns. This report is the only reviewer-written file.

**Spec verdict: approved for the bounded first Staff + Players testing release.** No concrete release-blocking divergence identified. This does not accept the unfinished full Master overhaul.

**Quality verdict: approved to proceed to the frozen candidate's final native gates.** No Critical or Important source findings. Merge readiness is conditional on those gates and fresh-main reconciliation; hosted readiness additionally requires the coordinated migration/application rollout and actual hosted verification. Historical native passes are not final-candidate passes.

## Scope and evidence

Reviewed the supplied cumulative package in passes, using focused source reads for the production actor/store/service composition, both new migrations, Players correction/recovery and admission producers, shared client recovery, Staff/Players UI, native harness and workflow integration, and the factory characterization test. Read root/scoped battle AGENTS guidance, MASTER_PANEL, ENGINEERING_EXECUTION_STANDARD, concurrency guidance, Owner Override, the Task9 reconstruction contract, consolidated implementation report, actor-interface and historical review/native receipts. Applied the independent reviewer template and Supabase security/concurrency review guidance. No current platform behavior was assumed to establish a finding; this is source/evidence review, not a hosted audit.

The final Task9 `backend-handoff.md`, `review.md`, scoped repair reviews and `native-completion-status.md` were supplied separately under `/workspace/scratch/e5db2ba73c1a/handover/master/verification/task-9-reconstruction/`. The repository contains earlier Task9 checkpoint evidence; see Minor M4 about locating the final receipts.

Direct checks confirmed:

- HEAD/tree equal the requested frozen candidate. No source mutation occurred during review.
- Relative to accepted Players59, production source differences are the imported current-main character readers; those reader files and the imported canonical editor assertion match fresh main exactly. The only additional executable file is `selected-staff-factory.test.ts`. Staff/Players authority, recovery, migrations and workflows have not been opportunistically replaced.
- Relative to fresh main, only the two canonical Staff/Players migrations are added; existing migration files are unchanged. The incompatible PR957 migration is absent.
- `apps/web/vercel.json` is unchanged at blob `b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f`, with `**: false`.
- Product/test/workflow/migration `git diff --check` is clean. The unrestricted historical diff reports trailing whitespace only in retained diagnostic `.log` transcripts. This is evidence preservation, not product formatting failure; do not rewrite original failed/passing logs merely to make that broad command green.
- Inspected actual retained combined baseline logs: 61 Web tests in 10 files; 58 actual-chain DB tests in two files. Factory initial log: 8/8; covering log: 26 tests in four files; type log: Next route generation/tsc success. The implementation report records successful targeted ESLint/format. None was rerun here.
- Staff `native-checkpoint-f6ba4876.json` records all eight workflows, full Chromium358, focused73, Edge10 and retained layout captures. Final Task9 receipts record exact43ff/59 quality11957 Vitest +7 Node, full migration/Staff37/physical Players races/Event/catalogue chain, UI layout, full Chromium360, focused73 and Edge10. These remain historical source-specific results.

## Strengths

1. **Selected-character authority is installed at actual production factories.** `apps/web/src/server/master/selected-character-rpc.ts:37` verifies the current user against the protected RPC's expected actor, derives selection through the existing verified owned-character loader and overwrites the actor parameter. Combat, Event authoring and Event operations production stores install that wrapper. The inventory deliberately leaves ordinary catalogue/current/pinned readers actorless. No browser-supplied actor character is trusted.

2. **SQL remains the live grant authority.** `supabase/migrations/20261019003429_selected_character_staff_access.sql:22` joins the bound grant to current ownership, excludes deletion-pending characters, requires enabled state and strictly future expiry. The one-argument legacy reader delegates to null selection, preserving only Owner bootstrap. The helper and derived protected overloads recheck real capability; old account grants cannot authorize delegation. `:210` validates Owner-only changes, protected/self targets, permitted roles/capabilities, verified linkage, exact days and expected revision; advisory plus row locking provides actual CAS. Automatic before/after audit remains when routine Staff reason input is removed.

3. **The migration preserves existing publication semantics and permissions.** Staff migration `:122` derives selected overloads from real predecessor bodies, updates nested protected calls and explicitly retains predecessor service EXECUTE permissions. The shared native SQL ` .github/scripts/verify-master-panel-staff-authority.sql:115` independently checks original33 plus Players4, browser/private denial, Owner nondelegability and retired management APIs. The actual DB publication test at `packages/db/src/selected-character-staff-authority.test.ts:363` covers selected publication, stale catalogue token, immutable versions and ordinary pinned reads after revoke. No Content41/retired-publisher contract has leaked into this release.

4. **Players writes have narrow gameplay scope and real preparation coherence.** `players-handler.ts:34` allowlists request fields, confirmation, identifiers and recovery participant limits. `players-service.ts:34` validates correction groups and projects a bounded public result. SQL `20261020181057_master_players_recovery.sql:158` checks Owner, locks actual character/build state, enforces deletion/live-battle restrictions, request hash/idempotency and a current fact fingerprint, then reuses authoritative build commands and Core/XP constraints. Every correction increments build generation. SQL `:61` requires exact private sourceHash and numeric current buildVersion for corrected-character admission under account/row locks. Actual PvE, both PvP producers and World preparation call the shared source coherence assertion, while public projection recursively strips the hash.

5. **Recovery is a durable terminal transition, not a client disappearance.** Players migration `:244` checks the exact whole participant set and head version, preserves already-terminal results, validates the server-produced terminal snapshot, writes marker/receipt/head/snapshot/event/audit before cleanup in one transaction, and preserves resources and unrelated progress. `:217`/`:314` protect old commit/replay paths; trial claims lock the same head. Hash-only markers survive actual deletion, while identifying payload/audit cascades are tested. Current recovery keeps pinned definitions/policies and removes executable queues, summons, statuses, primes and maintenance. The client reuses bounded polling/in-flight/version guards and canonical World return; transient spectator errors stay retryable.

6. **Earlier accepted repairs remain effective.** `player-discipline-correction.ts:4` emits only changed fields, and review rendering at `player-correction-form.tsx:236` preserves omitted values; actual SQL tests cover Secondary add/remove and both Primary-only cases. Native Players setup at `.github/scripts/verify-master-players-recovery.py:31` reuses the disposable Staff Owner without taking ownership of that fixture, and browser fixture cleanup only removes its own acquired grant. Existing single-Owner constraints are not weakened.

7. **The new test targets the real integration risk.** `selected-staff-factory.test.ts:1` mocks only external transport and verified request identity/selection; factories, wrapper, stores and services stay real, and unexpected transport fails. Tests cover selection changes, substituted actors, ordinary unauthenticated-context reads, real catalogue/publication/pointer composition, Event workspace/schedule composition and null-selection Owner composition. The report correctly calls its initially green result characterization coverage; it does not claim a fictitious canonical RED or SQL authorization proof from mocked transport.

## Issues

### Critical

None found within the reviewed release scope.

### Important

None found within the reviewed release scope. Final candidate CI/native and coordinated hosted rollout are required release conditions, not waived by this verdict.

### Minor / retained nonblocking findings

**M1 — Keyboard focus restoration remains incomplete.** `apps/web/src/components/master/staff-management.tsx:162` removes the editor after Save/Revoke, and `:290` removes it on Close without restoring focus to a surviving useful control. Initial opening is correctly handled by the post-commit effect at `:79`. `players-workspace.tsx:345` similarly removes the review on Cancel without explicit return focus. Keyboard users can lose their position after these operations. Retain the common-shell follow-up: save the initiating control or a stable lookup/directory heading and focus it after the resulting commit. No authorization defect or demonstrated first-release inability to complete an action follows from this; do not conflate it with the repaired initial-focus failure.

**M2 — Staff directory hides special-permission identities.** `staff-management.tsx:41`/`:239` reduces extra permissions to a count. The editor gives actual labels at `:348`, so the powers are inspectable and confirmation remains available, but the directory is less useful for an operational audit. Carry forward readable selected capability labels in the summary, as already documented for common-shell work.

**M3 — Secondary eligibility copy still overclaims mastery.** `apps/web/src/components/master/player-correction-form.tsx:166` says choices use existing mastery, while the accepted current catalogue also retains published-Discipline testing eligibility. Change the wording to current Secondary eligibility, without altering the accepted gameplay policy. This is the prior nonblocking wording finding, not a reopened command-validity issue.

**M4 — Final historical receipt location needs clarification.** `docs/verification/2026-10-20-consolidated-staff-players.md:21` says accepted review/native receipts remain under the repository Task9 directory, but the complete final native completion and repair-review handoff supplied to this reviewer is external to this frozen checkout. The exact final results are consistent with the coordinator's supplied handover; this is discoverability/reproducibility debt, not contradictory source evidence. Preserve/link the final sanitized receipt set in the eventual release record, or explicitly identify its durable archive. A documentation-only update does not require restarting accepted product work; attach final native evidence to its actual head/tree. The coordinator has now specified an eight-path carry-forward of exact existing final Task9 backend-handoff/review/native-completion-status/native-completion-artifacts and four native-fix5 success transcripts, with hashes identical to the accepted archive. That receipt-only follow-up is within this approval qualification and does not reopen source review, provided product/tests/workflows/migrations remain unchanged; the final gate must name the resulting final head.

**M5 — Timing and diagnostics remain honest carry-forwards.** `apps/web/src/server/master/modular-correction-publication.test.ts:138` exercises real AI simulation under an unchanged30000ms limit. Task9 fix5 report `:17`/`:21` records real prior timeout and profiling cost in candidate simulation/validation; final native receipt records25935/28271ms passes. This is an inherited gate-reliability/performance concern, with little margin, not proof that the new factory test or Staff/Players changes break combat. Keep N4 open; the final combined native gate must actually pass, and any recurrence must retain its failure and diagnosis rather than receive a blanket timeout/assertion waiver. Vite ESM/native-config, NO_COLOR and three historical destination-stream-close diagnostics likewise preclude a warning/error-free claim. Their retained evidence does not establish a user-visible regression by itself.

## Behaviors considered and declined to judge as release blockers

- Full Content A/B authority, complete-record publisher APIs and Content41 inventory: deliberately excluded from this bounded drop; importing them would break the accepted editor contract.
- Full Rules/Music/Environment/Events/navigation/UI overhaul: documented subsequent scope, not implied by releasing Staff and Players.
- PR957's alternative SQL/tables/argument order/CAS: incompatible reconstruction, explicitly excluded; preservation of its eight unpublished files is coordinator-owned archive work, not a second source to merge.
- Owner with null/no selected character and retained Owner-only legacy overloads: intentional canonical root/bootstrap exception, not delegated access leakage.
- Ordinary current/catalogue/pinned Combat/Event readers after Staff revocation or without a Master session: required preserved gameplay/runtime behavior, not protected administration.
- Service-role explicit user/character arguments and private helper invocation: trusted server contract with browser EXECUTE denied, not a requirement for SQL to read HTTP cookies. No direct-table privilege expansion was found in these migrations.
- Request-scoped React selection memoization and an already-rendered stale navigation link: they do not replace live SQL authorization on the next protected operation; not a persistent grant cache.
- Old Staff editor incompatibility during migration/source mismatch: intentionally fail-closed and documented; requires coordinated rollout rather than restoring account-wide delegation.
- Expiry reset on an explicit edit/save and denial for unavailable/deleting grant targets: accepted visible expiry-on-save/current-ownership semantics; no new expiry-preservation or cleanup API requirement was invented.
- Unavailable inventory/wallet/equipment/ranking and broad exceptional Owner acquisition overrides: not implemented domains in this approved Players correction slice; UI identifies unavailable scope rather than inventing authority.
- Recovery declining structurally invalid historical snapshots: preserves integrity; this is not an arbitrary raw-state repair console.
- Completed battle results, prior trial receipts and unrelated XP remaining untouched: required behavior; no compensation/reset feature is implied.
- Actor/audit payload deletion versus retention of a one-way terminal marker: intentional privacy/lifecycle contract, exercised by actual finalizers; no raw-identity retention requirement was invented.
- Site Music SQL CAS/direct-table revocation and Owner-protected World history hardening: known later Task11 work. No new first-release reachable bypass is demonstrated by this diff; not silently accepted as complete.
- Physical browser zoom/touch, human acceptance, production signed-in/multiplayer/load acceptance, cross-tab selection/expiry browser scenarios and full-shell computed contrast: historical CSS/layout and source evidence cannot certify them. They remain explicit continuation/hosted acceptance work.
- New independent audit of existing World movement, PR933 timing, unrelated combat mechanics or the preserved live reader changes: outside this bounded review; imported main source was checked for preservation, not declared newly performance-certified.
- Large-scale database/polling capacity or query plans: bounded search20/recent-actions20 and existing2s PvE polling support the current slice; no load data was supplied, and no speculative scaling rewrite is required for this testing release.
- Wholesale cleanup of retained historical failed logs, warnings and obsolete-at-that-checkpoint status text: evidence must retain source-specific chronology; clarify final disposition rather than rewriting history.

## Final gate and rollout conditions

1. Run the existing full native/CI gates on the frozen final candidate: quality/builds, complete database migration sequence and Staff33+Players4/physical Players races/subsequent Event/catalogue gates, full browser plus early repeated Staff/Players flows, and applicable existing UI/World gates. Inspect retained screenshots and actual failure diagnostics; do not substitute the prior43ff/f6 results or the 8 factory tests.
2. Refresh main before integration. If product source changes, review the concrete new delta and run affected/final gates; if only receipts change, preserve the tested executable tree relationship explicitly. Keep the Git deployment lock unchanged.
3. Ship only the canonical Staff and Players source plus their two original migrations as a coordinated release. Verify hosted predecessor bodies/ACLs and applied migration identities, service/browser denial and ordinary readers after rollout. A source-only rollback must remain fail-closed for delegated Staff; do not restore old account grants.
4. Record exact tested head/tree, merged tree, applied migrations, deployment and bounded hosted observations in the final release receipt. Preserve the Minors/backlog and clearly distinguish LIVE for testing from human/full-overhaul acceptance.

**Ready for final native gates: Yes. Ready to merge: conditional on those gates and fresh-main preservation. Ready to declare deployed: No; rollout and hosted evidence are coordinator-owned outstanding work.** No product fix is requested by this review before starting the final native gate.
