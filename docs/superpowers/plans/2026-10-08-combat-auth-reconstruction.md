# October 8 combat/auth reconstruction implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. The Owner requested continued implementation; preserve the approved design rather than restarting approval.

**Goal:** Complete the October 8 combat and password-reset corrections while retaining released behavior and saved-battle compatibility.
**Architecture:** Shared deterministic engine with versioned encounter semantics; immutable content revisions and server-owned captured values. Existing shared readers and Master publication are extended in place. Password recovery uses an explicit token-hash POST after a non-consuming GET.
**Tech Stack:** Node 24, pnpm 11.17.0, TypeScript, Next.js, Supabase, Vitest and Playwright.
**Spec:** ../specs/2026-10-08-combat-auth-reconstruction-design.md

## Global constraints
- Preserve saved battle formulas, RNG, content and omitted-policy behavior.
- Normal / Instant / Delayed is one selector per tag, with offsets 1/0/2 global rounds.
- Costs, cooldowns and command reactions occur once; repeated applications resolve independently where applicable.
- Recovery is 1–100% of each recipient maximum, captured once, with 1–4 identical scheduled amounts; cap actual gains and never revive.
- No unrelated world/Phase 5 work or deployment implied by implementation.
- Current Main was freshly confirmed at f49b99f23dc16419c94ede9589e9ebeb662bdfe0, tree b2fbb852611cadc3ead3b7b363ddb6cd0e7c4ff4. Refresh before integration.

## Review focus
- Link scanning, cross-browser recovery, expiry/replay and absence of gameplay claim.
- Outgoing DoT receipts after initiative changes, concealed source provenance and historical events.
- Partial packet misses/criticals/resistance, original effect ordinals and queued/reloaded outcomes.
- Independent recipient maxima, Hex once, full scheduled lifetime, defeat and no extra self tick.
- Delayed Rewind anchors, occupied/rooted/impassable destinations and terminal cleanup.

### Task 1: Password recovery
Files: apps/web/src/app/auth/recovery/page.tsx; apps/web/src/app/api/account/recovery/route.ts; apps/web/src/components/account/password-recovery-link-panel.tsx; apps/web/src/lib/auth/password-recovery.ts; apps/web/next.config.ts; supabase/config.toml; supabase/templates/recovery.html; apps/web/e2e/password-reset.pw.ts.
- [x] Reproduce missing explicit recovery redirect and add route/identity regression expectations.
- [x] Implement non-consuming GET and same-origin recovery-only verification POST with verified session marker.
- [x] Prepare on-site email template and disposable local origin configuration.
- [x] Extend captured-email browser acceptance for scanner GET, fresh browser context and replay.
- [ ] Run disposable Auth/email acceptance and prepare hosted configuration delta; do not claim configuration applied without evidence.

### Task 2: DoT narration and reader grouping
Files: packages/game-core/src/combat/actions-legacy.ts; apps/web/src/server/battle/battle-log-service.ts; shared Chronicle and Skill/Essence/Resonance readers.
- [x] Prove eight same-Skill Bleed stacks independently retain captured damage, reload and expiry (existing engine is correct).
- [x] Reproduce outgoing-round context and missing extra-trigger narration; correct source attribution without changing later commands.
- [x] Preserve damageTrigger as a finite public cause and distinguish scheduled ticks from Burn backlash/Poison movement.
- [x] Reproduce repeated readers and group by complete canonical effect plus trimmed custom description; authored effects remain intact.
- [x] Run final shared renderer/browser checks and privacy regressions.

### Task 3: Independent packets and Sevenfold scaling
Files: damage-scaling.ts; actions.ts; actions-legacy.ts; combat-skill-accuracy.ts; combat-critical.ts; combat-status-resistance.ts; pv1f-action-economy.ts; encounter factories.
- [x] Add skillPacketPolicyVersion?: 1, strict validation and pins only for new encounters.
- [x] Add standardSkillDamageScaling(source) with coefficientBasisPoints 2500 per ordinary damage application, preserving explicit scaling/Vengeance and historical formulas.
- [x] Add regressions comparing current Power 8 vs Sevenfold Power 9, partial seven-packet hits/criticals, repeated ordinary debuff resistance and command costs once.
- [x] Resolve repeated tags independently using original effect ordinals; filter instant and queued recipients and preserve committed RNG through reload.
- [x] Cover Resonance, summons, lethal early packets, dependent DoT basis and historical snapshots.

### Task 4: Shared visual corrections
Files: battle-facing-indicator.tsx/.module.css; playable/spectator tile renderers; Ground animation CSS; battle-targeting helpers; existing production browser regression script.
- [x] Move facing badges to occupied tile top-left, preserving portraits/meters/identity/directions.
- [x] Preserve union of legal cardinal Line reach while selected footprint remains directional.
- [x] Make Embers/Arcane loops periodic and preserve reduced-motion static styling.
- [x] Verify desktop/mobile PvE/PvP/spectators, edges and complete existing 72-case production matrix.

### Task 5: Captured percentage recovery, Delayed and Rewind
Files: canonical effects/validation; pending/ongoing state; mature Skill/Essence/Resonance definitions; Master editor/publication; timing policy; protected timing RPC migration.
- [x] Implement percentage-recovery {resource,percent,ticks?} with per-recipient persisted {maximumAtCast,amountPerApplication}; Hex is captured once for HP.
- [x] Enumerate current recovery content and prepare concrete replacement percentages. Missing prior 37/55/1-row mapping must not be claimed recovered.
- [x] Append immutable content versions and preserve old definitions.
- [x] Extend timing enum to instant/next-round/delayed through TS, authoring, SQL/RPC and shared readers, with one Master selector.
- [x] Capture returnAnchor on successful cast-position Rewind; allow before movement; activate cast R2 at R4 and retain legal return/no-op/failure rules.
- [x] Verify self/multi-recipient duration, reload/max changes, manual turn boundaries, blocked anchors and terminal cleanup. Full timeout/AI suites pass; remote persistence/browser acceptance remains a release gate.

### Task 6: Final acceptance and release evidence
- [x] Run scoped regressions and core/web suites, then pnpm check on the final source.
- [x] Refresh Main; reconcile overlaps and rerun relevant checks.
- [x] Perform complete fresh whole-branch review and verify all important remediations.
- [ ] Run exact-head CI/disposable DB/email acceptance after publishing authorization.
- [x] Record exact source/check evidence and the complete Owner TEST-CHECKLIST.md.
- [x] Prepare concrete release/config/migration deltas.
- [ ] Obtain publishing authorization and exact-head CI; apply actual Owner release authorization before Production actions.

## Fresh evidence
- Baseline: 2,478 core tests; 1,694 web tests + seven Node checks.
- Recovery: 45 focused tests; landing/route subset 16 tests; web typecheck passed at that checkpoint.
- DoT: 28 core regressions and 129 shared log/Chronicle tests passed.
- Readers: 56 focused tests passed after updating the superseded duplicate-explanation contract.
- Final local implementation `c3dc83bb91c51c02e33badb9e9ede0c1d6f320cb`, tree `25dab9412f09f324719ca0b8e91e5dfe042d4215`: `pnpm check` passed (4,401 Vitest + seven Node checks; format/lint/eight-package types/build).
- Production dependency audit: no known vulnerabilities. Protected timing migration: 2 integration tests passed. Browser matrix: 72 production-component cases passed.
- Full delivered-email/disposable Auth and exact-head CI remain pending publishing authorization. See the verification report and complete Owner checklist; no new batch has been merged or deployed.
