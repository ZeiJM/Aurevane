# CSR-4 Presentation / Acceptance Implementation Plan

> Execute with `superpowers:executing-plans` and `superpowers:test-driven-development`. Preserve the shared PvP/PvE presentation authority in `apps/web/src/components/battle/AGENTS.md`.

**Goal:** Close the remaining player-facing battle presentation/acceptance gaps after CSR-3 without moving combat rules into React or altering server-authoritative mechanics.

**Base:** `agent/final-ui-combat-integration-20260917` after verified CSR-3 merge `b368a59880c32d0590fb541de65282a49203335e`.

## Constraints

- No combat-mechanic redesign.
- No new client-side combat authority.
- Reuse authoritative preview/event/history projections.
- PvP is the canonical shared presentation reference; applicable changes must remain shared with PvE.
- Covert/Sensory/Revealed history privacy must hold for participant reconnect and spectator Battle Log presentation.
- Existing `copy-statuses` formatter is authoritative presentation code; do not duplicate it.
- If acceptance tests already prove behavior, keep the ticket test-only for that slice rather than manufacturing production changes.
- No `main` merge, Production DB mutation, Production deployment, or release in this ticket.

## Task 1 — Fix PvP Battle Log privacy bypass

**Files:**
- Modify `apps/web/src/server/battle/pvp-battle-communication-service.test.ts`
- Modify `apps/web/src/server/battle/pvp-battle-communication-service.ts`

1. RED: change the PvP communication history contract so `getPvpBattleLog()` must use CSR-3 viewer-safe history authority rather than raw `list_pvp_battle_events_v2` presentation.
2. Assert a hidden action for a spectator/opponent becomes the generic hidden-action Battle Log entry and does not expose its `actionId` or private child events.
3. GREEN: reuse `createSupabaseBattleSessionRepository()` + `createViewerSafeBattleLogService()`; do not reimplement privacy logic.
4. Preserve chat, spectator presence and legacy event helper behavior outside `getPvpBattleLog()`.
5. Run focused Vitest for PvP communication + battle-log privacy.

## Task 2 — Prove copied-status forecasts reach the real Action Preview component

**Files:**
- Modify `apps/web/src/components/battle/battle-action-preview.test.tsx`
- Only modify `battle-action-preview.tsx` / `battle-preview-content.ts` if the acceptance test exposes a real gap.

1. Add component-level acceptance for authoritative `copy-statuses` projections through `BattleActionPreview`, covering ordinary status plus Poison/Burn/Bleed and mixed copy + damage/heal/resource projections.
2. Assert machine encodings never appear in rendered player text.
3. Assert blocked previews remain blocked and do not advertise copied outcomes.
4. If these tests pass immediately, record that as verified existing behavior; no production change is required.

## Task 3 — Reconnect/spectator browser acceptance

**Files:**
- Extend existing PvP browser coverage (prefer `apps/web/e2e/pvp-battle-log-footer-parity.pw.ts` or create one focused CSR-4 file only if clearer).

1. Prove a playable PvP Battle Log reopens after reload without changing battlefield geometry.
2. Prove a spectator can open Battle Log through the same shared communication surface.
3. Where a deterministic private-history fixture is practical in existing local-test infrastructure, assert hidden identity stays generic across reload/spectator presentation; otherwise rely on Task 1 server integration plus browser proof that both views consume the same endpoint.
4. Keep test data local/disposable only.

## Task 4 — Full verification and integration

1. Focused Vitest for changed server/component tests.
2. `pnpm --filter @aurevane/web typecheck`, lint/build or repository `pnpm check` through CI.
3. Focused Playwright for CSR-4/PvP shared presentation.
4. Full required CI, Battle Session DB, Representative Buildcraft, Browser Smoke and relevant layout/presentation workflows.
5. Review browser evidence for PvE/PvP/spectator presentation regressions.
6. Merge only into `agent/final-ui-combat-integration-20260917` after exact-head verification.
7. After CSR-4 is integrated and fully green, create a **Vercel preview/testing deployment** of that exact state. Do not target Production.

## Completion criteria

CSR-4 is complete when:
- PvP chat/log presentation cannot bypass CSR-3 history privacy;
- shared Action Preview visibly renders authoritative copied-status forecasts without raw encodings;
- participant reconnect and spectator Battle Log acceptance are covered;
- shared PvP/PvE presentation contracts remain intact;
- all required exact-head verification is green;
- the verified CSR-4 state is live on a testing/preview URL, not Production.
