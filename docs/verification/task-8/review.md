# Task 8 — combined independent spec and quality review

## Spec compliance

**Issues found; implementation is substantially compliant, but the existing browser regression must be repaired and native acceptance remains unverified.** Reviewed BASE `16838f0cb1fb23ea791f3e5734b1f90c9fd64532` → HEAD `8e5e03a6146c489ca02922994b6af328831dcf5b`, against the task brief and expanded `NEXT_TASK_8_STAFF_ACCESS.md`. No concrete delegated-authority bypass was found in the inspected production composition, current SQL capability inventory, or legacy signatures.

The source implements selected-character delegation, live expiry/revocation, verified identity discovery, explicit legacy binding, canonical presets, Owner-only management, reason-free Staff assignment with audit attribution, and the compact directory/editor. See `apps/web/src/server/master/selected-character-rpc.ts:35`, `supabase/migrations/20261019003429_selected_character_staff_access.sql:22`, `:185`, `:197`, `:209`, and `apps/web/src/components/master/staff-management.tsx:175`. The required browser inspection is not satisfied by the unrun harness; it is an explicit remaining acceptance condition, not evidence that the rendered UI passed.

## Strengths

- **Server-derived selection and fresh authority:** `selected-character-rpc.ts:35` verifies the authenticated user matches the RPC actor, loads the selected owned character, and overwrites a supplied actor-character parameter. The real default dependency chain uses verified claims/active-session validation and the request cookie (`apps/web/src/server/auth/actor.ts:18`, `apps/web/src/server/character/selected-character.ts:16`); playable ownership is resolved through owned slots (`character-slot-service.ts:75`, `:102`). The grant itself is read live in SQL, independently of the request-scoped selection cache.
- **Fail-closed SQL boundary:** migration lines 22–49 require matching identity/character ownership, enabled access, strict future expiry and no pending deletion. Old access/operator/event helper signatures pass NULL selected context and thus cannot recover delegated account authority. The unchanged single-Owner root is explicit. Browser execution is revoked; predecessor service ACLs are retained rather than universally granting every copied executor (`:159`, `:179`, `:232`, `:242`).
- **Current operation coverage:** the actor overload inventory includes actual combat publication wrappers, version-floor implementation, Event publication/scheduling/cancellation, live operations and their nested helpers (`:129`, `:142`). Inline Event global scope is replaced with the selected grant check (`:173`). The real relationship witness is Resonance `disciplinePair`, with publication/CAS/history coverage (`packages/db/src/selected-character-staff-authority.test.ts:342`), rather than an invented standalone Discipline RPC.
- **Management invariants and attribution:** migration lines 214–227 reject self/Owner targets, unknown/root/duplicate powers, invalid days, unverified/unowned/deleting targets and stale revisions. A private before/after audit records actor, target character, action and time without a fabricated note. Retired legacy administration ACLs prevent restoring account-wide grants via the old service API (`:232`).
- **Meaningful regression evidence:** the DB fixture applies real predecessor Staff/content/Event functions (`selected-character-staff-authority.test.ts:12`); tests exercise 33 explicit-overload ACLs, 25 old protected signatures, 25 explicit alternate-character denials, exact expiry equality, actual publication and post-revoke immutable reads (`:155`, `:309`, `:342`, `:407`, `:469`). This is materially stronger than an always-authorized SQL stub. TS tests retain canonical role/root/self/invalid-input checks, fresh rereads and server actor injection under the replacement API.
- **Scope and rollout discipline:** no deployment-lock change is present; `apps/web/vercel.json` still has `deploymentEnabled: { "**": false }`. The migration/source coupling and deliberate fail-closed migration-first interval are stated in `docs/verification/task-8/actor-interface.md:33`. No browser/hosted success or source publication is falsely claimed.

## Issues

### Critical

None identified in this task-scoped review.

### Important

**I1 — Existing combat browser gate still asserts removed Owner copy.**

- **Location:** `apps/web/e2e/master-combat-content-authoring.pw.ts:424`; replacement rendering at `apps/web/src/components/master/staff-management.tsx:222` and `:233`.
- **Effect:** the existing end-to-end combat authoring test visits Staff and expects the exact text `WORLDWRIGHT · GAME OWNER`. The replacement directory renders `Game Owner` for the identity and role, plus `Global administration · protected Owner`; it never renders the expected text. Although the adjacent page-title expectation was updated, this assertion was not. The browser gate will stop at Staff before completing its remaining combat authoring checks. The passing Vitest/build gate does not run this native test, so it cannot resolve the mismatch.
- **Fix:** update the assertion to the new meaningful contract: identify the Owner row by its email and verify the protected Owner role/scope and noneditable state. Preserve the protection assertion rather than deleting it. Run that named existing native test once the browser/local Supabase environment is available. No test run is needed to establish the source mismatch itself.

### Minor

**M1 — Closing or successfully saving the focused editor does not restore keyboard focus.**

- **Location:** `apps/web/src/components/master/staff-management.tsx:161`, `:290`.
- **Effect:** lookup deliberately focuses the editor heading (`:132`), but Close editor and successful Save/Revoke remove the focused subtree without moving focus back to a surviving control. Keyboard users can lose their place in the directory, especially on narrow layouts. This is a concrete missing focus destination; physical browser behavior remains unobserved.
- **Fix:** retain the initiating directory control or a stable lookup/directory reference and restore focus after closing/success. Add this transition to the native keyboard acceptance checks.

**M2 — The reported gate contains a known native-config warning.**

- **Location:** `docs/verification/task-8/full-check-final.log:383` (durable counterpart `full-check-final.log.gz`); diagnostic names `apps/web/vitest.config.ts:1`.
- **Effect:** the test output is not pristine: Vite reports ESM syntax in a CommonJS-loaded config as incompatible with future native config loading. The implementer accurately discloses it; this is not a Task 8 authority failure or a reason to rerun the passing suite.
- **Disposition:** inherited/nonblocking; leave outside this task's repair scope. Address the module/config format in the existing tooling backlog, rather than suppressing or misreporting the diagnostic.

## Cannot verify / acceptance limits

- **Native visual and interaction acceptance:** no actual screenshots were inspected, and the new harness was not run (`apps/web/e2e/staff-selected-character-access.pw.ts:33`; implementer report lines 56–60). Desktop, narrow mobile, long identities, real pending/error behavior, keyboard continuity and physical 200% browser zoom remain unverified. CSS `zoom: 2` in the harness is expressly not physical browser UI zoom. Repair I1, then execute the named native checks in an environment with browser and disposable local Supabase; do not label this task fully accepted before that evidence exists.
- **Hosted adapter/ACL/migration state:** PGlite execution and source ACL assertions do not certify PostgREST overload resolution, the actual hosted schema/ACLs/advisors, migration application or a hosted signed-in session. Those remain later authorized rollout checks. No hosted mutation, login, upload, push or deployment was attempted by this review.
- **Actual cron operation in production:** the recovery SQL is unaffected and calls the persistent transition kernel rather than the modified Staff APIs (`supabase/migrations/20260919055000_phase4_event_recovery_cron.sql:219`, `:350`, `:363`, `:403`, `:472`). This establishes source separation, not that the hosted scheduler currently runs successfully.
- **Full future Players implementation:** the handoff forbids identity/ownership/role changes and requires gameplay-field allowlisting (`actor-interface.md:27`); this review cannot certify the not-yet-implemented Task 9 surface. Existing root-only operational routes retain `staff.manage`; this diff does not add a delegated Players identity-edit path.

## Focused checks and evidence inspected

- Read the task brief, expanded handover, implementer report, progress ledger and supplied review package. Reviewed the diff in sections. Where output was truncated, fetched only the missing diff sections; changed product files were not independently reread wholesale. No git commands, test reruns or product edits were performed. This report is the sole requested review artifact.
- **Named risk: trusted selected-cookie ownership/auth injection.** Checked unchanged `auth/actor.ts`, `lib/supabase/auth.ts`, `character/selected-character.ts` and the owned-slot lookup in `character-slot-service.ts`; checked the Staff service factory and page capability composition. Claims are cryptographically verified by the existing auth adapter; identity/selected ownership are server derived.
- **Named risk: an account-wide SQL helper or inline predicate bypasses the overload migration.** Searched migration references to the actual role/operator/capability tables and assertion helpers. The current delegated access points are the replaced access/operator/event helpers and the explicitly replaced live Event-list global predicate; retained administration is revoked. Owner assertions intentionally remain account-root.
- **Named risk: a production protected caller misses actor injection or an ordinary reader is accidentally gated.** Checked RPC call names in current Master stores/factories and root-only route capability references. The actual protected caller names match the wrapper set; current/pinned content reads remain outside it. DB tests also preserve immutable reads after revoke.
- **Named risk: scheduled workers inherit a browser-cookie requirement.** Located the actual recovery cron SQL after confirming the worker application is not the event cron executor; inspected its transition-kernel call sites. The modified inventory contains Staff authoring/operation wrappers, not those scheduled executors.
- **Named risk: replacing Staff markup invalidates still-applicable browser protection assertions.** Compared the supplied combat browser hunk with the replacement component; I1 follows directly. Other removed Staff tests were compared with replacement role/self/root/input/adapter/DB checks, without requiring obsolete account-grant/reason contracts to survive.
- Inspected the archived final gate's summaries: 10,252 Vitest tests in 605 files, seven Node tests, eight typecheck tasks and builds are reported successful. The one native-config warning is recorded above. The report separately records the final-source DB assertion and targeted source checks after the gate's earlier stages; this review does not conflate those stages into a fresh full-tree rerun.

## Behaviors considered but not treated as defects

- **Owner account-root access without selection:** intentional protected bootstrap exception in the accepted requirements; not silent delegated inheritance.
- **Current/pinned catalogue and gameplay reads remaining service-readable after revoke:** required preservation, not a Staff bypass; protected draft/history administration still uses selected authority.
- **Service-only explicit actor parameters:** the trusted server supplies and SQL rechecks them; browser roles cannot execute these RPCs. SQL does not independently read an HTTP cookie, nor should it need to in this architecture.
- **Request-scoped selection caching and a stale browser navigation link:** neither caches grants across protected operations. SQL is authoritative on the next request. Same-render memoization is not treated as cross-session authority retention.
- **Retained legacy records and retired old API signatures:** deliberate fail-closed migration evidence and rollout compatibility, not an obligation to keep the old editor working after the migration. Explicit new assignment is the binding action.
- **Remaining Event operational reasons:** those belong to unchanged Event operation/audit contracts; this task coherently removes routine reasons from Staff assignment across UI, TS and SQL. I did not broaden the task into a rewrite of later operational-page policy.
- **Expiry reset on an explicit edit/save:** the editor says “Expiry on save,” previews the new UTC estimate, and requires confirmation. The requirement does not mandate preserving the old absolute expiry during edits; I did not invent that requirement. Exact server expiry uses 24-hour intervals.
- **Declining assignment/revoke of a deleting or no-longer-owned character:** existing access already fails closed. A separate administrative cleanup affordance is not required to prove live authority enforcement.
- **New helper/allowlist maintenance and dense SQL formatting:** the bounded operation inventories are explicit and backed by actual-predecessor execution/ACL checks. No speculative refactor is required for this task; future protected operations must follow the documented handoff.
- **Standalone Discipline metadata authoring, future support/Players powers, broader reason removal, inherited combat Minors, independent Blindside and release #939:** outside this Task 8 diff. No additional review seat or opportunistic inherited-product audit was used.

## Assessment

**Task quality: Needs fixes (I1), with native/hosted acceptance explicitly pending.** The server/SQL authority model is coherent and the local security regression evidence is substantial. A deterministic stale browser assertion blocks the existing native gate; the unavailable browser acceptance must remain open after that repair. Minor focus continuity can be improved without changing authority scope. Per the controller's latest sequencing instruction, hold implementation repairs and all Master publication until the independent Blindside release is complete.

## Scoped I1 repair confirmation — 2026-10-19

**I1: resolved in source. Scoped quality verdict: approved for this repair; no remaining Important/Critical finding from this review.**

Inspected only `git diff 8e5e03a6 -- apps/web/e2e/master-combat-content-authoring.pw.ts`, using the already-reviewed Owner directory rendering contract. The repair at lines 420–434 identifies exactly one Owner article by exact email, asserts the current `Game Owner` role, protected global scope and `Protected` text, and asserts absence of Edit, Revoke and Bind character buttons. These assertions match `staff-management.tsx:222`, `:233` and the Owner-only Protected branch. They remove the obsolete-copy mismatch while retaining and strengthening meaningful Owner protection coverage.

No product edits, additional review seats or test reruns were performed. M1 focus continuity and M2 inherited config warning remain explicitly deferred. Native browser, physical zoom and hosted acceptance remain unrun; this source confirmation does not certify them. The parent must verify the implementer's final combined gate result and exact head separately. The earlier Blindside sequencing hold is superseded by the controller's confirmation that Blindside is verified live; this scoped review grants no publication or deployment authorization.
