# Final UI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the two creation screens that were judged from the wrong subject references, integrate the cumulative verified UI stack with the authoritative combat branch, verify the combined SHA, then merge/release/deploy only after the combined build passes.

**Architecture:** Keep the cumulative UI branch as the source of verified presentation work and the shared combat branch as the source of current gameplay/combat authority. Correct Character Creation Discipline and Confirm on top of the cumulative UI head, then create a dedicated integration branch from the combat head and merge the corrected UI descendant into it. Resolve conflicts in favor of current combat/gameplay authority plus the verified UI presentation, never by replacing current combat code with the older UI-side snapshot.

**Tech Stack:** Next.js 16, React, TypeScript, CSS Modules, Playwright, GitHub Actions, Supabase, Vercel.

**Spec:** Project continuation handover plus exact recovered subject references for Character Creation Discipline and Confirm.

## Global Constraints

- Preserve mechanics, routes, APIs, authentication/session behavior, and server-authoritative gameplay state.
- Use one bounded correction ticket at a time and regression-first TDD.
- Do not invent mechanics or content from concept art.
- Current combat branch `agent/combat-effect-taxonomy-rework` remains gameplay authority during integration.
- Final release requires a fresh combined-SHA CI, Desktop Experience, UI Layout Review, and Browser Smoke pass.
- Production deployment happens only after the integrated release candidate passes.

---

### Task 1: Reconcile Character Creation Discipline

**Files:**
- Modify: `apps/web/e2e/creation-layout-regression.pw.ts`
- Modify: `apps/web/src/components/character/character-creation-experience.tsx`
- Modify: `apps/web/src/components/character/character-creation-experience.module.css`

- [ ] Write desktop/mobile assertions for the subject-specific Discipline composition and prove RED.
- [ ] Rework only the Discipline step into a subject-aligned three-column/two-row real Discipline gallery plus compact six-row stat allocator.
- [ ] Preserve all six real Disciplines, attribute math, focus behavior, validation, and actions.
- [ ] Run exact-head CI/UI/Desktop/Browser verification and inspect screenshots.

### Task 2: Reconcile Character Creation Confirm

**Files:**
- Modify: `apps/web/e2e/creation-layout-regression.pw.ts`
- Modify: `apps/web/src/components/character/character-creation-experience.tsx`
- Modify: `apps/web/src/components/character/character-creation-experience.module.css`

- [ ] Add subject-specific Confirm assertions and prove RED against the verified Discipline correction.
- [ ] Rework only Confirm into a cinematic selected-character panel plus restrained summary sheet, real Discipline sigil, and six compact attribute tiles.
- [ ] Keep pronouns absent, preserve submission/idempotency/error handling and Back behavior.
- [ ] Run exact-head CI/UI/Desktop/Browser verification and inspect screenshots.

### Task 3: Integrate cumulative UI with current combat authority

**Files:**
- Integration branch only; resolve only files reported by GitHub as conflicting.

- [ ] Snapshot the exact corrected UI head and exact combat head.
- [ ] Create a dedicated integration branch from the combat head.
- [ ] Merge the corrected cumulative UI descendant into the integration branch without force-updating either source branch.
- [ ] Resolve conflicts by preserving current combat/server authority and verified UI presentation.
- [ ] Compare the result against both parents for accidental loss.

### Task 4: Verify and release

- [ ] Run CI, Desktop Experience, UI Layout Review, Browser Smoke on one exact integrated SHA.
- [ ] Inspect final high-risk screenshots including Creation Discipline/Confirm and public Rules/Manual/News surfaces.
- [ ] Merge the verified integration PR into `main` only if all required checks are green.
- [ ] Deploy the exact merged release commit through the existing Vercel project workflow.
- [ ] Verify the live deployment health and key public/authenticated entry surfaces.
