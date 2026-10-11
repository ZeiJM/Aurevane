# Techniques and Support Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save one character Support Action and expose all Discipline Skills in two horizontal Techniques rows, with the saved action occupying battle slot 3.

**Architecture:** Add one constrained Support Action field to the existing versioned character build. Preserve legacy snapshots by treating an absent optional field as Guard without rewriting old fingerprint payloads. Reuse current server authorization, immutable battle build snapshots and the existing battle keyboard owner.

**Tech Stack:** TypeScript, React/Next.js, PostgreSQL/Supabase, Vitest, Playwright; existing pinned dependencies.

**Spec:** `docs/superpowers/specs/2026-10-01-techniques-support-action.md`

## Global Constraints

- Four Discipline Skills remain the existing capacity; Support Action is separate and required.
- Exactly basic.guard, basic.recover and basic.recover.mp are allowed; legacy default is basic.guard.
- Preserve published definitions, AP costs, recovery cooldown, resource requirements and combat authority.
- Preserve existing custom keybinds, snapshot fingerprints, immutable active battles and named loadouts.
- No direct browser writes to private build tables and no new dependencies.
- Base is the battle UI follow-up PR #790; refresh from its verified final tree before integration.

## Review Focus

- Foreign-character writes and arbitrary action IDs must fail at both service and database boundaries.
- Simultaneous Discipline and Support saves must not lose either selection; stale versions and idempotency conflicts fail clearly.
- Historic snapshots must parse and retain their original fingerprints; changed current builds must not alter active battles.
- Named-loadout activation must restore Support Action while leaving four-skill capacity intact.
- Full HP/MP, shared recovery cooldown, held keys, stale previews and open reading panels must not bypass server legality or double-cast.

## Task 1: Persistent character build and snapshots

**Owner:** backend worker; does not edit frontend battle/character components or the battle page.

**Files:** create `packages/game-core/src/combat/support-actions.ts` and tests; modify `character-build-service.ts`, `supabase-character-build-repository.ts`, `character-combat-build-snapshot.ts`, `character-saved-build-loadout-service.ts`, its repository and adjacent tests; modify `packages/game-core/src/combat/build-snapshot.ts` / `battle-authority-build-snapshot.ts` and tests; add `apps/web/src/app/api/character/build/support-action/route.ts`; generate the additive migration through the Supabase CLI; add database authority checks to the applicable disposable workflow.

**Interfaces:**
- Export `SupportActionId`, `SUPPORT_ACTION_IDS`, `DEFAULT_SUPPORT_ACTION_ID` and `parseSupportActionId(value: unknown): SupportActionId | null` from game-core/combat/support-actions.
- `CharacterActiveBuildRecord.supportActionId?: SupportActionId`; reads return the persisted value, absent old fixtures default to Guard at consumers.
- `CharacterCommittedBuildSnapshotRecord.supportActionId?: SupportActionId` and parsed battle build expose the optional field without injecting it into legacy fingerprint payloads.
- Support route accepts `{characterId, expectedBuildVersion, supportActionId, idempotencyKey}` and returns the same refreshed `context` structure as current Skill saves. The build context exposes the committed Support Action and new build version.

- [ ] Add failing service tests: all three valid choices, foreign owner, arbitrary ID, stale version, conflicting replay; selection does not change four Discipline slots.
- [ ] Run the focused service tests and confirm the new feature cases fail.
- [ ] Implement shared union/parser, authenticated route, repository save and additive service-role-only migration. Reuse row locks, expected versions, idempotency receipts and audit conventions. Preserve existing rows with Guard defaults.
- [ ] Add failing snapshot tests: explicit choices, absent legacy field, invalid explicit field, unchanged legacy fingerprint, current-build changes do not change pinned battle data.
- [ ] Update committed snapshots and saved loadouts so saves/activations retain Support Action; retain old payload compatibility.
- [ ] Run focused domain/service tests and disposable SQL authority checks. Confirm all positive/negative cases pass and existing snapshots/loadouts remain valid.

## Task 2: Battle slot 3 and existing inputs

**Owner:** battle worker; does not edit persistence/snapshot domain modules or character UI.

**Files:** `apps/web/src/app/game/battle/[battleSessionId]/page.tsx`, `battle-runtime.ts`, `battle-experience.tsx`, `battle-self-action-quick-commit-assist.tsx`, `battle-command-cockpit-polish.tsx`, related instruction/presentation helpers and focused tests/E2E. Preserve the final PR #790 preview/header CSS.

**Interfaces:** consume optional committed `supportActionId`, parsed via the shared helper with Guard default; runtime adds `supportActionId?: SupportActionId`. The existing slot/keybind identity remains guard internally, while its displayed action and executed ID follow the selected Support Action.

- [ ] Add failing tests for each Support Action in slot 3, legacy default Guard and retained customized binding.
- [ ] Run focused tests and confirm new recovery selection cases fail.
- [ ] Replace hardcoded Guard presentation/selection with the pinned action’s existing name, artwork, AP, cooldown and self-preview/commit mode. Keep legacy independent Recovery hotkey behavior available.
- [ ] Extend the existing single quick-commit keyboard owner; do not add a competing listener. Pin second-press, held-key, pending/late preview, dialogue and insufficient-resource protections.
- [ ] Run focused unit and real browser tests for AI/PvP, self selection, full HP/MP, shared cooldown and one commit per deliberate input.

## Task 3: Techniques rows and separate Nexus summary

**Owner:** frontend worker; does not edit persistence or battle components.

**Files:** `character-skill-build-panel.tsx`, its two CSS modules; `character-arsenal-shell.tsx`, its CSS/tests; `app/game/(roaming)/nexus/page.tsx`; relevant Nexus/Techniques E2E.

**Interfaces:** `initialSupportActionId?: SupportActionId` defaults to Guard; Support autosave calls Task 1’s route with the current build version. Serialize Support and Discipline writes and adopt the refreshed version/context after success; failed saves restore the committed choice.

- [ ] Add failing regression assertions for eight-card Primary and Secondary desktop rows, eight locked Secondary boxes, and a third three-choice row.
- [ ] Render Support choices from existing basic definitions/artwork. Selecting a Support Action previews it and saves one choice without consuming Discipline capacity. Clear Selections retains Support Action.
- [ ] Label Techniques/Nexus four-slot counts `Discipline Skills`; show `Support Action` and the saved icon/name separately.
- [ ] Verify autosave/reload, character isolation, failure rollback and saved-loadout activation in an authenticated browser.
- [ ] Verify 1440×900, 1366×768, short 1024×576, narrow 821×768 and mobile layouts; names and previews remain readable and desktop rows fit without page scrolling.

## Task 4: Integration, review and release

**Owner:** root; no direct main edits.

- [ ] Integrate the final tested PR #790 tree, refresh main, resolve any overlap and inspect only owned diffs.
- [ ] Run format, lint, typecheck, full tests, production builds and all required exact-head SQL/browser checks.
- [ ] Request independent whole-feature review, including ownership, fingerprints, saved-loadout and keyboard failure cases. Fix material findings and rerun affected checks.
- [ ] Record exact verified application/migration evidence in TASKS and the verification document; merge only the checked tree.
- [ ] Apply only the tested additive migration after final production schema preflight, verify its authority/default invariants, then perform the already authorized release. Verify deployment source/public smoke and relock deployment configuration.
