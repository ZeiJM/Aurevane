# Combat v5.1 UI & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Nexus/Discipline/Technique presentation cleanup and remove avoidable Discipline Management rerender/blur cost without changing combat rules.

**Architecture:** Keep mechanics untouched. Add one structured compact-effect presentation model that existing Technique and later Resonance UI can reuse, then make targeted CSS/layout changes and gate the Discipline countdown timer on visibility/nonzero cooldowns. Browser geometry checks protect the requested alignment.

**Tech Stack:** React 19, Next.js 16 App Router, TypeScript, CSS Modules, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-28-combat-v5-1-targeting-summons-resonance-design.md`

## Global Constraints

- Historical combat content and existing battle snapshots are immutable.
- No direct browser writes to private combat tables.
- Compact effect rows show one effect per visual line on supported desktop widths.
- Compact percentage statuses omit explanatory units such as `pp Accuracy`, `incoming`, and `healing`.
- `Slow` compact magnitude is `[+10 AP]`; detailed meaning remains in the explanation list.
- Magnitude and duration brackets use distinct presentation accents.
- Desktop Essence/Resonance hover details prefer the right side of the artwork; mobile retains an above/stacked fallback.
- Do not merge or deploy as part of this plan.

## Review Focus

- Native select option centering must not break keyboard selection or labels.
- Zero cooldowns must not trigger a one-second React update loop.
- Locked Technique geometry must remain aligned when labels wrap or a Discipline is absent.
- Compact effect lines must not overflow the detail rail at supported desktop widths.
- Tooltip right-placement must stay visible near the viewport edge and preserve keyboard focus behavior.

---

### Task 1: Structured compact effect summaries

**Files:**
- Modify: `apps/web/src/components/character/skill-effect-preview.ts`
- Modify: `apps/web/src/components/character/skill-detail-presentation.ts`
- Modify: `apps/web/src/components/character/skill-effect-preview.test.ts`
- Modify: `apps/web/src/components/character/skill-detail-presentation.test.ts`
- Create: `apps/web/src/components/character/compact-skill-effect-summary.tsx`

**Interfaces:**
- Produces: `CompactSkillEffectSummaryParts` with `label: string`, `magnitude: string | null`, `duration: string | null`.
- Produces: `compactSkillEffectSummaryParts(effect: CombatEffectDefinition): CompactSkillEffectSummaryParts`.
- Produces: `<CompactSkillEffectSummary effect={...} />`, rendering semantic spans for label, magnitude, and duration.
- Existing explanation functions remain the source of full prose semantics.

- [ ] **Step 1: Write failing Vitest cases**
  - Assert Mark with 1000 bp and duration 2 yields label `Marked`, magnitude `10%`, duration `2 Turns`.
  - Assert Slow yields magnitude `+10 AP` rather than `+10 AP/tile`.
  - Assert Guarded/Exposed/Hexed compact output omits `incoming`, `healing`, and `pp Accuracy`.
  - Assert duration 0 produces `null`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:
`pnpm --filter @aurevane/web exec vitest run src/components/character/skill-effect-preview.test.ts src/components/character/skill-detail-presentation.test.ts`

Expected: failures for the new compact-summary API/wording.

- [ ] **Step 3: Implement the compact model**
  - Keep `previewEffect(...).explanation` unchanged except where it currently duplicates compact-only vocabulary.
  - Add `compactSkillEffectSummaryParts` in `skill-detail-presentation.ts`.
  - Add `CompactSkillEffectSummary` component with stable classes/data attributes for `label`, `magnitude`, and `duration`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2.

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

Commit message: `feat: add compact combat effect presentation`

---

### Task 2: Technique Preview rows and target display

**Files:**
- Modify: `apps/web/src/components/character/character-skill-build-panel.tsx`
- Modify: `apps/web/src/components/character/character-skill-build-panel.module.css`
- Modify: `apps/web/src/components/character/skill-detail-presentation.ts`
- Modify: `apps/web/src/components/character/skill-detail-presentation.test.ts`
- Create: `apps/web/e2e/technique-preview-layout.pw.ts`

**Interfaces:**
- Consumes: `CompactSkillEffectSummary` from Task 1.
- Produces: `skillCompactRangeDescription(skill)` returning maximum range only, or `N/A` for self.
- Produces: `skillTargetMethodDescription(skill)` returning only `Single`, `Line`, or `Circle`.

- [ ] **Step 1: Add failing unit tests**
  - Range 1–3 renders `3`.
  - Range 0–3 renders `3`.
  - Range 1–1 renders `1`.
  - Self renders `N/A`.
  - Line shape renders `Line`; circle renders `Circle`; single renders `Single`.

- [ ] **Step 2: Add failing presentation/browser assertions**
  - Effects cell has no bullet list.
  - Each effect is a block/row aligned to the right.
  - Magnitude and duration spans expose distinct data attributes/classes.
  - Desktop detail rail keeps each example effect on one line.

- [ ] **Step 3: Run tests and verify RED**

Run:
`pnpm --filter @aurevane/web exec vitest run src/components/character/skill-detail-presentation.test.ts`

Then:
`pnpm --filter @aurevane/web exec playwright test e2e/technique-preview-layout.pw.ts --project=desktop-chromium`

- [ ] **Step 4: Implement the preview layout**
  - Replace the Effects bullet list inside `<dd>` with compact-effect rows.
  - Right-align the effect value container.
  - Use `white-space: nowrap` for desktop compact rows and let the responsive layout widen/stack before wrapping.
  - Add separate magnitude/duration accent classes.
  - Simplify Range and Target Method functions as specified.

- [ ] **Step 5: Re-run focused tests and browser proof**

Expected: all pass.

- [ ] **Step 6: Commit**

Commit message: `feat: streamline Technique preview details`

---

### Task 3: Discipline Management lag and select centering

**Files:**
- Modify: `apps/web/src/components/character/character-discipline-build-panel.tsx`
- Modify: `apps/web/src/components/character/character-discipline-build-panel.module.css`
- Create: `apps/web/src/components/character/character-discipline-build-panel.performance.test.ts`
- Modify: `apps/web/e2e/character-primary-build.pw.ts`
- Modify: `apps/web/e2e/character-secondary-build.pw.ts`

**Interfaces:**
- Produces: `shouldRunAttunementCountdown(open: boolean, remaining: { primary: number; secondary: number }): boolean`.
- Countdown interval exists only when this function returns true.

- [ ] **Step 1: Write failing performance contract tests**
  - closed dialog + nonzero cooldown => false;
  - open dialog + both zero => false;
  - open dialog + either nonzero => true;
  - CSS source no longer contains full-screen `backdrop-filter: blur(`.
  - select/option rules request centered text without replacing the native select.

- [ ] **Step 2: Run the test and verify RED**

Run:
`pnpm --filter @aurevane/web exec vitest run src/components/character/character-discipline-build-panel.performance.test.ts`

- [ ] **Step 3: Implement the timer/backdrop fix**
  - Move interval creation behind `open` + nonzero cooldown guard.
  - Stop updating a value already at zero.
  - Clear interval on close/unmount.
  - Remove backdrop blur while preserving the dark translucent overlay.
  - Add `text-align: center` / `text-align-last: center` and option centering support.

- [ ] **Step 4: Verify unit and authenticated browser flows**

Run:
`pnpm --filter @aurevane/web exec vitest run src/components/character/character-discipline-build-panel.performance.test.ts`

Run:
`pnpm --filter @aurevane/web exec playwright test e2e/character-primary-build.pw.ts e2e/character-secondary-build.pw.ts --project=desktop-chromium`

Expected: pass.

- [ ] **Step 5: Commit**

Commit message: `perf: reduce Discipline Management render cost`

---

### Task 4: Locked lane/card geometry and Attunement hover placement

**Files:**
- Modify: `apps/web/src/components/character/character-arsenal-shell.tsx`
- Modify: `apps/web/src/components/character/character-arsenal-shell.module.css`
- Modify: `apps/web/src/components/character/character-skill-build-panel.module.css`
- Modify: `apps/web/e2e/character-secondary-build.pw.ts`
- Create: `apps/web/e2e/nexus-technique-alignment.pw.ts`

**Interfaces:**
- Consumes: existing Technique/Attunement DOM structure.
- Produces: equal header top/bottom geometry for active and locked Nexus lanes and equal artwork-box top origins in the Technique modal.
- Tooltip remains anchored to the artwork but prefers `left: calc(100% + gap)` on desktop.

- [ ] **Step 1: Write failing Playwright geometry assertions**
  - active and locked Nexus lane header boxes have equal height and top edge;
  - first active artwork and first locked slot top edges differ by <= 1 px;
  - Technique modal active card art and locked card art top edges differ by <= 1 px;
  - Essence/Resonance tooltip opens to the right of the anchor on desktop and remains inside viewport;
  - mobile tooltip remains visible and does not cause horizontal overflow.

- [ ] **Step 2: Run the browser tests and verify RED**

Run:
`pnpm --filter @aurevane/web exec playwright test e2e/nexus-technique-alignment.pw.ts e2e/character-secondary-build.pw.ts --project=desktop-chromium`

- [ ] **Step 3: Implement CSS/markup alignment**
  - Give active and locked lane headers the same minimum block size.
  - Move locked explanatory copy out of the height-critical header rhythm or reserve the same second-line area in both states.
  - Match locked modal card padding/grid rows to live Technique cards.
  - Move desktop Attunement tooltip to the right; preserve mobile override above the anchor.

- [ ] **Step 4: Re-run desktop and mobile proofs**

Run:
`pnpm --filter @aurevane/web exec playwright test e2e/nexus-technique-alignment.pw.ts e2e/character-secondary-build.pw.ts --project=desktop-chromium --project=mobile-chromium`

Expected: pass.

- [ ] **Step 5: Run web quality checks**

Run:
`pnpm --filter @aurevane/web lint && pnpm --filter @aurevane/web typecheck && pnpm --filter @aurevane/web test`

Expected: all pass.

- [ ] **Step 6: Commit**

Commit message: `fix: polish Nexus Technique alignment and previews`
