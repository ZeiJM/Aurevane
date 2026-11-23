# Master Elevation Chances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Native implementation is the Owner's selected execution method.

**Goal:** Let the Owner change raised tile height probabilities in Master for new battles.
**Architecture:** Extend the existing battlefield generator with a validated versioned probability value; use a dedicated append-only Owner settings store and the existing combat settings page.
**Tech Stack:** TypeScript, Vitest, Next.js, Supabase/Postgres, Playwright.
**Spec:** docs/superpowers/specs/2026-10-07-master-elevation-chances-design.md

## Global Constraints
- Defaults 6000/3000/1000 basis points; each 0..10000; sum exactly 10000.
- Existing snapshots never reroll; one independent seeded draw per raised tile.
- Owner-only publication, reason 1..240 characters, expected version and append-only audit.
- No unrelated Living World changes or dependency additions.

## Review Focus
- Extreme 0/100% settings must affect generated and authored-map raised tiles while leaving flat tiles intact (Task 1).
- Invalid persisted configuration must fail closed, while an absent migration reads defaults (Task 2).
- Two Owner tabs publishing from one version must reject the stale tab (Task 2).
- New Battle Hall and both PvP creation paths must consume the saved configuration (Task 3).
- Reloading a pre-publication battle must preserve its tiles and pinned policy (Task 3).

### Task 1: Validated seeded elevation policy
**Files:** packages/game-core/src/combat/standard-battlefield.ts and its test.
**Interfaces:** Export BattlefieldElevationPolicy, defaultBattlefieldElevationPolicy(): BattlefieldElevationPolicy, parseBattlefieldElevationPolicy(unknown): BattlefieldElevationPolicy; generator input elevationPolicy?, authored randomizer third argument policy?.
- [ ] Write tests for valid fractional/default/0/100 policies, malformed objects and generator extremes.
- [ ] Run focused Vitest and observe missing policy behavior.
- [ ] Implement strict basis-point validation and seeded cumulative thresholds.
- [ ] Run focused checks and commit.

### Task 2: Owner persistence and editor
**Files:** server/master/battlefield-elevation-policy-store.ts (+test), api/master/combat-elevation/route.ts (+test), components/master/combat-content/battlefield-elevation-editor.tsx (+test/css), master/combat-timing/page.tsx, dedicated Supabase migration.
**Interfaces:** readBattlefieldElevationPolicy(): Promise<BattlefieldElevationPolicy>; publishBattlefieldElevationPolicy({actorUserId,policy,reason}): Promise<BattlefieldElevationPolicy>; editor initialPolicy.
- [ ] Test defaults/malformed persistence, validation before RPC, forbidden and stale publication, editor labels and invalid totals.
- [ ] Observe focused failures; implement using existing timing-store, authentication and Owner publication patterns.
- [ ] Verify SQL constraints/permissions and actual local Master browser publish/reload/restore.
- [ ] Commit after focused checks pass.

### Task 3: New encounter pinning and release
**Files:** actions-legacy.ts optional encounter policy; battle-session-service.ts (+test), api/battles/route.ts, pvp-lobby-service.ts, pvp-lobby-quality-service.ts (+test), world/world-battle.ts (+test), Master/Combat docs, authenticated Master browser test.
**Interfaces:** session dependencies readElevationPolicy?, PvP encounter optional elevationPolicy default; generated encounter pins battlefieldElevationPolicy.
- [ ] Test custom all-level-3 new battles, pinned policy and saved reload retaining old tiles without querying current policy.
- [ ] Observe failure; wire all creation paths, including the world encounter caller of the shared PvP constructor before map generation and validate pinned values.
- [ ] Run repository quality gate and exact-head browser/DB CI; inspect screenshots.
- [ ] Obtain one fresh review scoped to elevation changes; correct Important/Critical findings in one pass.
- [ ] Merge verified candidate, apply necessary additive migration and deploy exact merge under standing Owner authorization; record release evidence and full test checklist.
