# Master Panel workspace Implementation Plan

> **For agentic workers:** Use domain-specific parallel implementation with exclusive ownership, focused regression checks, and root integration/review. Do not start duplicate workers.

**Goal:** Deliver all October 27 Owner-requested panel changes as one verified batch.
**Architecture:** Extend existing UI, domain services, game-core and private Supabase RPCs. Preserve existing captures and durable game facts; new permissions/grants must be server-authoritative.
**Tech Stack:** Next 16, React 19, TypeScript, CSS modules, Supabase/Postgres, Vitest/PGlite, Playwright.
**Spec:** docs/superpowers/specs/2026-10-27-master-panel-workspace-design.md

## Global constraints
- Current-main freshness; isolate agent/master-panel-rework-20261027. No automatic Vercel previews.
- No duplicate implementation workers, destructive production writes, auth bypass or invented analytics.
- Root alone commits/integrates/publishes; workers do not reset/switch branches or edit another domain's files.
- Focused/adjacent checks during edits; final full applicable batch once stable. Preserve all configured gates.

## Review focus
- Permission revocation, selected-character drift and forged actor/recipient identifiers.
- Refresh restore racing a server commit or leaking drafts to another account.
- Concurrent class swap/level-up/correction with cap-saturated points and stale revisions.
- Override relationships in reversed pairs/two special disciplines and old battle captures.
- Small analytics samples, missing historic provenance and heavy query paths.

## Task 1: Content workspace and editor UX (root)
Files: components/master/combat-content/{combat-content-authoring-workspace,content-definition-fields,game-content-workspace.module,skill-media-editor,finalized-media-editor}; new content recovery/modal/relationship components; content route/service for disabled rollback if needed.
Interfaces: consume existing contentRecordCommand and CompleteCombatContentRecord; use new UsageBalancePanel supplied by task 6; engine extension from task 5.
- [x] Define regression assertions for continuous list, refresh recovery, modal edits/media and removed redundant controls.
- [x] Run failing focused web tests, implement compact sidebar/details/Skill/Resonance editors and persistence, run adjacent content tests.
- [x] Remove rollback entry points safely; document actual retention result and no false purge claim.

## Task 2: Page access and moderation (exclusive worker)
Files: staff access domain/store/route/UI, master navigation TSX, applicable Master page/API access gates; new moderation UI/service/RPC migration/tests. Do not edit shell CSS or content workspace.
Interfaces: export reusable page access checks; Owner management remains guarded. Provide visible navigation for authorized pages only. Own event navigation consolidation TSX.
- [x] Trace selected-character live authority and existing bans; add deny/revocation/expiry/Owner-protection tests before changes.
- [x] Implement page defaults and moderation using existing ban authority, transactional audit, readable validation.
- [x] Run focused/adjacent web/DB tests; report exact migration paths and integration contracts.

## Task 3: Player correction and allocation (exclusive worker)
Files: players workspace/form/service, character allocation UI/core and relevant DB migration/tests. Do not edit other Master modules or discipline grant service from task 5.
- [x] Reproduce right-column collapse and identify exact invalid correction producer; add expected legal/illegal correction tests.
- [x] Add cap-saturated/respec/level-up regressions; implement legal-spend gate without deleting points or bypassing server caps.
- [x] Run focused/adjacent core/web/DB tests and report evidence.

## Task 4: Music sources and compact editor (exclusive worker)
Files: music management CSS/TSX, audio/music validation/player source adapters and relevant tests/migrations if needed. Do not edit global shell.
- [x] Reproduce YouTube-as-audio acceptance and define clear supported-source behavior.
- [x] Implement actual supported source playback consistently or explicitly block unsupported provider URLs before save; preserve upload/direct-file playback, autoplay controls and no-op saves.
- [x] Compact desktop editor, native previews, mobile layout; run audio/web focused tests.

## Task 5: Authoritative discipline grants and relationship override (exclusive worker)
Files: game-core authored-content/discipline selection/build/battle boundaries; new grant server/API/RPC migration and UI component helpers. Root owns content-definition-fields and main workspace; coordinate exports/props rather than editing them.
Interfaces: provide standalone DisciplinePlayerGrants control and RelationshipOverrideFields helper or exact UI integration instructions. Grant recipients stored as verified stable account references, independent of earned mastery. Override source explicitly typed/captured; resolve both enabled case deterministically.
- [x] Add parser/eligibility/pure/mixed/reversed pair/old-capture/security tests before implementation.
- [x] Extend current engine and authority without changing normal builds; retain individual relationships under toggle.
- [x] Run game-core/web/DB focused checks and report schema/source integration.

## Task 6: Usage & Balance (exclusive worker)
Files: new usage-balance server/handler/API/UI/CSS/tests and generated CLI migration if required; do not edit content workspace or existing combat settlement files without coordinating.
Interfaces: export UsageBalancePanel({contentKey}) and bounded authorized endpoint. Root places panel in tab. Reuse page authorization from task 2 after coordination.
- [x] Inspect actual saved battle evidence, current roster and selected Skills; tests for completed/test/unknown-source windows, denominators and authorization.
- [x] Implement honest bounded weekly aggregates and current equip metrics; unavailable provenance explicit. Any collection producer coordinated, no guessed historic values.
- [x] Run focused real SQL/service/UI regressions and explain unavailable metrics.

## Task 7: Shared visual overhaul and combat rules (exclusive worker)
Files: master shell CSS; world/activity/events/staff CSS modules and minimal markup; combat-timing page and timing/elevation CSS. Exclude music, players, content workspace CSS and shell TSX (other owners).
- [x] Implement agreed visual design with compact coherent hierarchy; timing left/elevation right and full-height list.
- [x] Verify representative desktop/mobile/short viewports and focus; use source tests only where meaningful.

## Task 8: Integration, final evidence and release (root)
- [ ] Review all domain diffs, reconcile shared contracts and current main; update AGENTS/TASKS/ROADMAP/current Master docs.
- [ ] Run pnpm check and necessary DB/browser gates on stable integrated tree. Fix real regressions and rerun affected results; no repeated unnecessary full suites.
- [x] Fresh independent whole-branch review, resolve meaningful findings with regressions.
- [ ] Publish one reviewable PR, wait for actual required exact-head checks; final production only under scoped authorization, readiness/source/integrity smoke verified. Report partials honestly.
