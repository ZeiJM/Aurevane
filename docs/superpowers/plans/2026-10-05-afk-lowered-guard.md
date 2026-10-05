# AFK Lowered Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Lowered Guard on the first expired turn timer in current battles, while manual End Turn remains exempt.

**Architecture:** Reuse the authoritative timeout action and pinned effect-timing policy. Current AI encounters lose their old first-timeout grace period; historical snapshots without a timing policy preserve recorded behavior. No manual-end, clock, layout or persistence changes.

**Tech Stack:** TypeScript, shared game-core, Vitest, server Chronicle projection.

**Spec:** Owner clarification on 2026-10-05 and `docs/COMBAT.md`, “AFK Lowered Guard”.

## Global Constraints

- A timeout in round 3 queues the default effect for round 4 for one affected turn.
- Manually ending a turn never applies Lowered Guard.
- Preserve pinned Master timing overrides and historical rules.
- Keep deployment disabled during implementation and validation.

## Review Focus

- First AI timeout must no longer skip the debuff in current battles.
- Current PvP must retain its existing timeout behavior.
- Manual idle turns must remain exempt before and after a timeout.
- Final-actor timeout must activate correctly at the immediate round boundary.
- Legacy AI snapshots must keep the historical two-miss rule.

### Task 1: Timeout correction and behavioral evidence

**Files:** `packages/game-core/src/combat/pvp-quality.ts`, its test, `apps/web/src/server/battle/battle-idle-history.test.ts`, current combat authority and ledger.

**Interfaces:** Existing `timeoutAiTurn`, `timeoutPvpTurn` and `finishPv1fTurn`; no new public API.

- [x] Write real-engine AI/PvP regression tests for manual exemption, round-3 timeout, round-4 activation and one-turn expiry; observe AI failure and unchanged PvP success.
- [x] Write Chronicle integration test for pending round 4 and one-turn exposure; observe missing Lowered Guard failure.
- [x] Select every-timeout AI behavior only for timing-policy encounters, reusing existing status application.
- [x] Verify actual vulnerability and expiry, adjacent suites and full `pnpm check`.
- [ ] Obtain independent review, publish the exact verified tree, complete required CI and the standing authorized release.
