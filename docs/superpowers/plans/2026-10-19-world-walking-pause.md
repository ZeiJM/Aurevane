# World walking pause implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline. Steps use checkbox syntax.

**Goal:** Reduce intermittent walk approval stalls caused by repeatedly saving large exploration histories.

**Architecture:** Change only the World state's per-column TOAST compression policy to LZ4. Preserve the complete state, authority functions, movement clocks and existing 600ms preview bound. Existing rows convert naturally when a command creates a new state value; no bulk rewrite.

**Tech stack:** PostgreSQL17 / Supabase, existing pgTAP and native World checks.

**Spec:** Owner's October18 23:45 Trinidad residual walking-pause report; `docs/verification/2026-10-19-world-walking-pause.md` records diagnosis.

## Global constraints

- Preserve complete exploration history, canonical collision/discovery, ownership, deletion, stale-version/idempotency and blocking checks.
- Preserve the authored speed, private presence rules and 600ms unconfirmed visual limit.
- Keep Git auto deployments locked and preserve the independent Account #943 release.

## Review focus

Large existing histories must survive the next write; small states must remain valid; old compressed values must still be readable; replay must not rewrite an acknowledged command; stale/foreign commands must remain denied. Pin these in the existing disposable World SQL suite.

## Task1: Faster World state persistence

**Files:** CLI-generated `supabase/migrations/20261019035553_world_state_fast_compression.sql`; `supabase/tests/world_live_presence.sql`; verification record below. The existing CI database job already runs this SQL suite.

**Interface:** Existing `commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)` and stored JSON remain unchanged.

- [ ] Extend pgTAP with a large exploration fixture, a real approved walk, physical LZ4 storage, exact history retention, idempotent replay, stop and stale/foreign denial.
- [ ] Observe the physical-compression assertion fail with current PGLZ, before filling the migration.
- [ ] Set compression only for `app_private.character_world_state.state`; no function or data rewrite.
- [ ] Verify the large-history benchmark, complete existing SQL suite, full quality and exact-head CI/Atlas/browser checks; review the complete patch independently.
- [ ] Fresh-main reconcile, apply the verified migration and release the exact verified current source under standing live-for-testing authorization. Verify preserved state/ACL/RLS, canonical deployment and health, and initial logs.
