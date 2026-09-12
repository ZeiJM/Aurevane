# Phase 4 Combat Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task.

**Goal:** Complete missing Phase 4 tag mechanics and targeting, verify the existing Atlas within Discipline Management, and release the reconciled implementation for testing.
**Architecture:** Extend the existing deterministic combat grammar, shared battlefield, versioned content and Atlas projection. No parallel combat engine or new state authority.
**Tech Stack:** TypeScript, Next.js, Vitest, Supabase migrations, GitHub Actions, Vercel.
**Spec:** docs/superpowers/specs/2026-09-12-phase4-combat-completeness.md

## Global Constraints

- Work only in /workspace/scratch/f3df8ca815de/aurevane-phase4-implementation on agent/phase4-combat-completeness. Do not reset other worktrees or switch branches.
- Server owns gameplay and rewards; preserve four selected Skills, AP/MP/Movement caps, repeat-use effectiveness, existing save data and historical content versions.
- Preserve 17 published Disciplines and 36 Atlas identities; planned identities are not playable libraries.
- Shared PvE/PvP/spectator behavior and responsive accessibility are required.
- No deployment configuration changes until final authorized release. No external publication by task workers.
- No subagents inside task workers. Commit only the assigned coherent files and report exact tests and limitations.

### Task 1: Typed tags and deterministic terrain/interaction runtime

Read the spec's missing runtime contract as requirements. Extend packages/game-core/src/combat/actions.ts, status-content.ts, damage-modifiers.ts, pv1f-action-economy.ts and related combat wrappers/types as needed; create focused gameplay-tags/terrain modules and tests rather than a second engine. Implement typed tag aliases/requirements, the specified elemental/status interactions, bounded Frozen→Steam overlays with expiry and movement/LoS effects, and legal one-tile displacement. Use optional additive fields/effects for backward compatibility; historical actions without new metadata keep their behavior. All new data must validate at persistence/content boundaries. Wire preview and execution identically and preserve overlays through movement/end turn/surrender/PvP quality/serialization. Extend AI target enumeration/evaluation if necessary for empty ground actions. Export only actual integration interfaces needed by subsequent tasks. Update exhaustive effect/event consumers enough that repository types compile; detailed authored UI follows Task 3. Do not alter published Skill definitions or add migrations yet.

- [ ] Read existing rules and add meaningful regression cases before implementation.
- [ ] Implement engine and integration types with bounded immutable state.
- [ ] Test multi-command preview/commit, same-team terrain, expiry, invalid pushes, hidden direct vs area targets, consumptions, JSON reload and terminal boundaries; run game-core tests and repo typecheck.
- [ ] Commit and write a concise report explaining exact new public interfaces and test evidence.

### Task 2: Versioned roster content and publication

Consume Task 1's actual interfaces. Extend authored content in advanced-discipline-content.ts, foundation-trio-skills.ts and ironfist-content.ts only where existing identities need the approved interactions. Maintain historical definitions and append new versions, choosing representative existing water/storm/frost/fire, martial, nature and shadow Skills. Keep budgets and existing libraries coherent. Add producer/consumer tests using real builds/actions, all 136 pair reachability checks and actual Recruit AI selection where new mechanics affect utility. Add a focused migration updating future Skill catalog/build provisioning to current versions without rewriting stored battles. Verify all referenced versions and database security; use the Supabase skill for migration work. Do not fabricate production authoring/balance acceptance.

- [ ] Inspect Task 1 report and repository publication/snapshot resolution.
- [ ] Publish changed definitions as new versions, migration, and content/compatibility tests.
- [ ] Run focused game-core/server and database validation and report results.
- [ ] Commit and document exact IDs/versions and migration/deploy ordering.

### Task 3: Shared targeting, effect presentation and Profile Atlas

Consume runtime/content interfaces from Tasks 1–2. Fix apps/web/src/components/battle/battle-experience.tsx so ground/empty-tile Skills submit tile targets before unit-only guards; retain correct self/ally/enemy handling. Use existing battlefield/forecast/inspection/log components for temporary terrain, typed status/effect interactions and duration, including spectator parity and accessible keyboard/mobile interactions. Extend skill-detail-presentation.ts and related shared details. Audit discipline-mastery-panel.tsx and its Profile popup integration against the spec; fix concrete gaps while retaining existing acquisition/testing distinction. Add focused regressions and authenticated E2E for targeting plus Atlas location/eligibility and public Manual. No speculative UI rebuild.

- [ ] Read scoped battle AGENTS.md and current shared component contracts.
- [ ] Implement intent routing and complete readable forecast/terrain/status presentation.
- [ ] Verify Atlas inside Discipline Management and fix concrete functional/accessibility gaps.
- [ ] Run relevant component/server tests, typecheck, and CI-ready browser scenarios; commit report.

### Task 4: Completeness ledger, integrated review and production release

Controller owns docs/PHASE_4_COMPLETENESS_AUDIT.md, PHASE_4_TICKETS.md, ROADMAP.md, ROADMAP_DISCIPLINE_ATLAS_MASTERY.md, AGENTS.md and TASKS.md reconciliation. Map every active Phase 4 requirement to current code, tests and release evidence. Resolve real remaining implementation findings rather than relabeling them complete. Keep human acceptance separate. Refresh main, reconcile overlaps, run pnpm check and the required final CI/database/browser gates. Obtain final whole-branch review and fix blocking findings. Publish via GitHub on the task branch, merge only verified code, apply committed additive migration through existing integration, temporarily enable the authorized production release, verify READY and live flows, then restore deployment lock. Record actual SHAs, deployment, database and test evidence; do not claim unrun checks.

- [ ] Reconcile requirement ledger and inherited system evidence.
- [ ] Run repository checks, final review and fresh-main reconciliation.
- [ ] Publish PR, pass required CI/database and merge verified head.
- [ ] Release, verify live Atlas/targeting/combat and restore deployment lock.
