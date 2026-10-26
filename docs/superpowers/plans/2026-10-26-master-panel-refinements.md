# Master Panel Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make the requested Master controls reliable, understandable and compact, matching the actual game engine.

**Architecture:** Retain typed engine definitions and the selected-character RPC boundary. Add one server-owned commit operation, persist missing configuration, and reorganize the existing React editors into bounded workspaces. Keep historical captures intact.

**Tech Stack:** TypeScript, React 19, Next 16, Supabase/Postgres, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-master-panel-refinements-design.md`

## Global Constraints

- Preserve selected-character authority, live expiry/revocation, protected Owner and immutable captures.
- Current/Previous are visible labels; no destructive history purge.
- No deployment configuration changes, previews, automatic deployment or unrelated roadmap work.
- Existing engine schemas and service validation are authoritative; never accept arbitrary scripts.
- No publication success without authoritative readback; stale writes retain local edits.

## Review Focus

- Edits made during an in-flight commit must survive its response.
- A disabled currently selected Discipline must not break private-state entry or erase player facts.
- Delegated staff cannot alter their own role defaults or acquire Owner-only authority.
- Removing/replacing media or deleting music must not leave active assignments broken or invalidate historical media references.
- Desktop fitting must not clip long names, real 200% zoom, short viewports or mobile controls.

## Task 1: Publication, gameplay readers and interruption investigation

Files: `apps/web/src/server/master/combat-content-record-command.ts`, `supabase-combat-content-authoring-store.ts`, the complete-record SQL functions; `apps/web/src/server/character/character-build-service.ts`, `supabase-character-build-repository.ts`, relevant producer/consumer migrations and tests.

Interfaces: add complete-record command `{action:'commit',contentKey,expectedRevision,definition}` returning `{record}` through the existing selected actor boundary. Preserve `CompleteCombatContentRecord` read shape and older low-level save/publish APIs for compatible callers.

- [x] Trace actual publication, disabled-content reads and Nexus failure stage; collect sanitized timings/errors and identify root cause.
- [ ] Add focused failing regressions for the demonstrated failures, stale/concurrent changes and selected disabled-content loading; observe RED.
- [x] Implement a validated atomic commit using existing SQL publication authority and verified gameplay read paths; preserve exact historical definitions.
- [ ] Run affected web/DB authority regressions to GREEN and record findings/limitations.
- [ ] Commit the coherent functional repair.

## Task 2: Game Content workspace and media

Files: `combat-content-authoring-workspace.tsx`, `content-definition-fields.tsx`, `finalized-media-editor.tsx`, `game-content-workspace.module.css`, focused helper/component files and tests in the same directory.

Interfaces: consume Task 1 commit command; expand `ContentEditorTab` for focused Skills/Resonances and Identity & Relations. Resolve relationship display through `ContentReference` names. Keep typed engine editor callbacks lossless.

- [ ] Add failing interaction checks for one-step commit, retained in-flight edits, current/previous history details, dedicated tabs and current media preview.
- [x] Remove preview column and floating save bar; render compact sections, readable history and related content navigation.
- [x] Move image/audio controls beside their content; support existing built-in assets and replacement previews; simplify asset reuse and unavailable controls.
- [ ] Verify mechanics/text/media through actual component interactions plus adjacent engine editor tests; check desktop/mobile/zoom visually.
- [ ] Commit the reorganized editor.

## Task 3: Shared layout, Staff and Players

Files: `master-panel-shell.module.css`, `staff-management.module.css`, `players-workspace.module.css`, corresponding TSX and rendered checks.

Interfaces: existing workspace components remain; add local layout wrappers only where needed, without global style leakage.

- [ ] Reproduce short viewport/long content overflow in the actual mounted screens.
- [x] Implement fixed shell/navigation and bounded scroll regions, shared density/alignment, consistent Staff columns and compact player search/editor.
- [ ] Check desktop/mobile/short viewport/real zoom focus, action access and long names.
- [ ] Commit layout repair.

## Task 4: Game Owner role defaults

Files: `apps/web/src/server/master/staff-access.ts`, `supabase-staff-access-store.ts`, handler/server, `apps/web/src/lib/master-panel-access.ts`, `staff-management.tsx`, generated migration and physical DB tests.

Interfaces: existing `effectiveCapabilities` reflects persisted role defaults. Introduce Owner-only revision-checked read/save role-default operations; selected delegated grants retain expiry/revocation.

- [ ] Add failing authority tests: Owner edits defaults, delegated/no selected actor denied, stale save rejected, defaults apply immediately to existing role holders, protected Owner remains unrestricted.
- [x] Implement persisted defaults and enforce through actual SQL authority plus app access; UI shows them only for Owner.
- [ ] Run physical DB privilege/revocation/concurrency tests and actual UI interaction checks.
- [ ] Commit role-default management.

## Task 5: World Environment and independent elevations

Files: `apps/web/src/world/environment.ts`, world settings parser/admin store/editor, related SQL; elevation editor/store/core map generator/policy and tests.

Interfaces: add optional historical-compatible `weatherRollMinutes` to World settings, strict bounded integer validation and revision-checked persistence. Independent elevation chances use explicit current policy semantics; old captures remain unchanged.

- [ ] Add failing cadence/persistence/authority tests and elevation non-100-total generation tests; exercise 0/100 boundaries.
- [x] Implement random-roll cadence and readable override status, compact layout and independent elevation model/validation.
- [x] Add accessible scrollable rule-definition dialog with names; test focus/Escape/outside dismissal.
- [ ] Run relevant core/SQL/editor/browser checks and commit.

## Task 6: Reusable music library

Files: `apps/web/src/components/master/music/site-music-management.tsx`, CSS/tests, `apps/web/src/server/music/site-music-store.ts`, route/upload helpers and generated migration as required.

Interfaces: persist a named track library separately from global/page assignments while parsing historical settings; save and delete under current Owner authority and CAS version. Existing assigned tracks remain selectable.

- [ ] Add failing tests for unassigned saved song, reload, reassignment, deletion/in-use handling and denied caller.
- [x] Implement upload/save/preview/delete library plus clear global/page assignment choices.
- [x] Fix list-row overlap, selected state and bounded internal scrolling; verify actual audio preview and long lists.
- [ ] Run adjacent music/upload/security tests and commit.

## Task 7: Integration, review and handoff

- [ ] Audit all 33 requirements and remove stale jargon, dead controls and redundant first-tab content.
- [ ] Verify commit→authoritative read→new gameplay for text, disabled availability, effects and media; preserve pre-existing captures and player facts.
- [ ] Run `pnpm check`, affected rendered desktop/mobile/zoom and physical database authority checks. Expected: all pass, with exact counts and documented unavailable checks.
- [ ] Refresh current main, reconcile overlaps and rerun affected checks.
- [ ] Run independent whole-branch review; address Critical/Important findings with failing regression first.
- [ ] Publish the verified branch/PR with evidence if authorized; report exact completion, outstanding gates and production status. Do not silently deploy a later release.

## Later Owner additions and integration constraints

- Compact circled-i help with dismissible dialogs; remove redundant subtitles.
- Unchanged commits are no-ops; retain history referenced by captured gameplay and preserve restore provenance.
- Owner-only activity feed clears weekly without deleting immutable source audits.
- Remove player Skill Eligible/source dropdown UI; preserve deterministic valid grant selection and server authority.
- Add publication-failure rollback, restored-draft attribution, failed-create recovery, in-flight revert and legacy-music-save retention guards from independent review.

Release sequencing: the narrow catalogue-read and World stale-code repairs are backward compatible and already applied separately. New independent-elevation policy adds a strict-parser field and must follow compatible app deployment. Broad domain-conflict SQLSTATE repair requires the five dual-code app adapters live, older executions drained, and its role-default/commit predecessor migrations present. Do not indiscriminately push all unapplied migrations before deploying compatible app code. No database reset, player-fact rewrite or blanket history deletion is authorized by this plan.
