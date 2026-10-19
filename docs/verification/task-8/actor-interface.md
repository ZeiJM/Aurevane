# Task 8 selected-character authority contract

Base: 16838f0cb1fb23ea791f3e5734b1f90c9fd64532, refreshed origin/main 2026-10-19. Deployment lock remains `**: false`; no hosted mutation or source publication authorized.

Behavioral delta: delegated Master authority belongs to one explicitly bound, currently owned playable selected character and expires/revokes on every protected request/RPC.

Production RPC composition resolves verified auth and the selected cookie through `loadSelectedCharacter` each request. It never takes an actor character claim from request JSON. The trusted actor is `{ userId, characterId: string | null }`. Protected RPCs receive `p_actor_character_id` explicitly; SQL rechecks ownership and pending deletion, live grant enabled state, `expires_at > statement_timestamp()`, and required capability. No session-cached permissions are accepted. The single protected Game Owner remains an account-root/bootstrap exception, including when no character is selected. Owner powers are never delegated.

An additive private `master_panel_character_access` record holds canonical delegated roles, approved special capabilities, positive-day UTC expiry or NULL (No Expiry), enabled state and monotonic revision. It references a character and identity; assignments cannot change identity. Staff management is Owner-only, rejects self-account elevation and checks optimistic revision. Existing account-role/capability rows are retained as evidence and shown as Needs binding; they do not authorize delegated requests, including retained old RPC signatures. Explicit assignment to a verified linked character binds powers; no automatic email inheritance.

## Consumer inventory

- `staff-access*`, Staff API/page, Master access API and `master-panel-page-access`: fresh access reader and Owner-only directory/discovery/mutation.
- `supabase-combat-content-authoring-store` / service / handler / page: read operator, read/save draft, list history, publish v1/v2/v3 and set-current v1/v2. These cover actual basic/skill/essence/resonance/status/effect-profile authoring. Resonance disciplinePair is the current authored relationship boundary. No standalone Discipline metadata/relationship authoring RPC exists at this BASE; its finished UI remains Task 10 scope. Publication CAS/catalogue tokens/version floors stay intact.
- Event authoring store/service/handler: draft/history, publish v1/v2, schedule v1/v2, cancel v1/v2; scope and special publication checks.
- Event operations store/service/handler: list runs, dashboard, operate, advance phase, complete cleanup; global scope/emergency-stop checks.
- Owner-only timing/elevation/World Environment retain root SQL assertions and CAS. Site Music remains `staff.manage` (Owner) under current model; no invented Administrator slug or undelegated support/settings permissions.
- Ordinary catalogue/current/pinned version reads, resolver, character/build/battle reads retain existing service-only/runtime paths and receive no Master requirement.

SQL helper inventory: `assert_game_owner_v1`, `assert_master_panel_operator_v1`, `assert_event_staff_author_v1`, `assert_event_production_publish_v1`, `assert_event_operational_scope_v1`, `assert_event_emergency_stop_v1`, access/operator readers and the inline event run global-scope predicate. New explicit actor overloads preserve old Owner bootstrap access; old delegated signatures fail closed.

## Execution and later handoff

1. RED actual predecessor account grants against access and protected content/relationship consumers; add expiry/revoke/switch/ownership and Owner/self/legacy/audit assertions.
2. Implement additive DB actor/grant contract and migrate the production TS composition together; verify normal reads unchanged.
3. Compact Staff directory and focused verified linked-character editor with presets, readable scope, Edit/Revoke, No Expiry/days/UTC, no routine reason.
4. Focused gates, actual native responsive/zoom/focus checks, freeze, `pnpm check` once, fresh-main reconciliation and local checkpoint. Parent supplies one combined review.

Tasks 9–12 must consume this actor composition and live assertion, never account roles. Players mutations must explicitly allowlist gameplay fields; no identity, ownership, canonical role, capability or bootstrap edits. Actor/time/action and before/after state remain private durable attribution. No expiry sweeper is needed for enforcement.

Scheduled/recovery/system event workers call the existing persistent kernel/transition executors, not staff RPC overloads or a browser cookie. Those bodies and callers are unchanged. Only user-protected authoring/live-operation RPC signatures carry selected actor context.

## Release/rollback contract

Source and the additive migration are one reviewed release unit. New source requires the actor overloads/new Staff RPCs. Applying the migration before source deliberately removes ambiguous delegated authority and retires the old account-management API, so the old Staff editor cannot administer grants during that interval. Coordinate the authorized migration/source rollout; do not restore an account-wide compatibility fallback. Owner/bootstrap and ordinary current/pinned gameplay readers retain their existing paths. A source-only rollback continues to fail closed for delegated Staff; it is not permission to revive legacy account grants. No hosted rollout was performed here.

## Current-main reconciliation and review handoff

Task 8 checkpoint `8e5e03a6146c489ca02922994b6af328831dcf5b` is reconciled with current main `8624c49a3853493cbea5f6b4855330bf0cd99117` (World #940/#942, verified-live Blindside #941 and receipt #944). No actor/capability/SQL interface changed during the review repair. All three Blindside product/test blobs and the imported World source/test blobs match current main exactly; the Git deployment lock is unchanged. See `review-reconciliation.json`. The sole Important review repair updates only the existing browser assertion to the current protected Owner directory contract. The same reviewer approves I1 in source; M1 focus continuity and M2 inherited tooling warning stay deferred. Native/physical zoom/hosted adapter acceptance and the distinct Staff publication authorization remain open.

Final verification: fresh main remains `8624c49a3853493cbea5f6b4855330bf0cd99117`. Format/lint/types and 10,278 Vitest + seven Node tests passed; the full check exited 1 only at generated Turbopack cache initialization. Cache-only quarantine followed by unchanged-source `pnpm build` exited 0. No interface/source edits followed the freeze. Native/hosted acceptance and publication remain open; see `verification-summary.json` for exact qualification.

## Native verification caller handoff

Nick authorized source publication; controller PR #945 published the reviewed tree at `199f4718239d85fae7ed29c468a192c7ad286216`. Initial native CI failed on the retired account API. The bounded verification-only repair migrates Staff authority, Event Builder and live Event-operation shell fixtures to selected-character grants and actor overloads; shared native SQL is exercised against real predecessor functions by PGlite (15 tests pass). No actor/product API changed. Remaining legacy signatures are deliberate Owner/bootstrap or persisted service-only lifecycle paths. See `native-verification-repair.md`; real native orchestration/browser/hosted acceptance remains open and Tasks 9–12 must retain this interface boundary. Earlier source-publication hold is superseded; hosted rollout remains separate.
