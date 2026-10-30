# Automatic Damage Authoring Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this bounded task inline.

**Goal:** Current edited Skill, Essence and Resonance ordinary damage automatically uses its Physical/Mystic family, existing standard Skill Power formula and matching Defense.

**Architecture:** A pure shared authoring projection writes the existing typed scaling and defense fields at current HTTP/record boundaries before draft preview/save/publication. Historical captures and runtime materialization retain their exact fields. Reserved Basic definitions, Vengeance, self damage, costs and periodic damage retain their existing semantics.

**Tech Stack:** TypeScript, React, Vitest.

**Spec:** Owner's October 30 screenshot requests (Defense kind and Damage scaling), relayed in the parent task; existing formula in `docs/COMBAT.md`.

## Global Constraints

- No production writes, automatic catalogue republishing, migrations or reinterpretation of immutable captures.
- Family comes from the canonical behavior's attackFamily; native Skills use their existing Physical/Mystic tags.
- Use existing standardSkillDamageScaling (2500 basis points) once; no new formula.
- Changes remain on `agent/automatic-damage-defense-20261029`.

## Review Focus

- Missing family must produce actionable validation, never an implicit Physical default in canonical behavior.
- An edited family changes both offensive source and Defense together.
- Essence nested/top-level ability and Resonance share the same projection.
- Self costs, Vengeance and already captured definitions remain exact.
- Preview, persisted readback and settlement must agree.

## Task 1: Shared authoring projection and controls

- [x] Add failing regressions for hidden controls, family derivation, mixed-family behaviors, idempotence and retained captures.
- [x] Run tests and confirm missing normalization/control removal is the failure.
- [x] Add `apps/web/src/lib/combat-damage-authoring.ts`; wire category parsing, current HTTP handler and editable draft presentation to it.
- [x] Remove selectable defense and scaling controls from `skill-effect-editor.tsx`.
- [x] Add validation guidance for ordinary external canonical damage lacking attack classification/family.
- [x] Verify new/edit/save/readback, physical/mystic preview versus settlement, special effects and historical captures.

## Verification map

Focused: shared projection, effect editor, categories, authoring service/preview and record workflow tests. Adjacent: canonical runtime, command composition, damage scaling, stat-driven settlement and native Skill/Essence/Resonance coverage. Run scoped ESLint, Prettier and TypeScript. Lower-level historical publication services and validators remain exact. Root owns final combined `pnpm check` and configured release/browser gates; no claim of browser, database or release acceptance from this local subtask. World, portrait/media and progression changes are outside this surgical authoring boundary.

- [x] Refresh main; inspect final diff; commit the bounded result and return exact evidence to parent.

## Local verification receipt

- Baseline effect editor/category/service checks: 152 passed.
- Failing-first proof: nine automatic-formula/control failures, then seven facing failures and two saved-draft bypass failures before their respective fixes.
- Final full web command `pnpm --filter @aurevane/web test`: 514 files / 7,352 Vitest tests plus seven Node checks passed. Added Pierce/mixed-family cases also pass in the final focused 15-case automatic-authoring file.
- Historical cohort/current HTTP boundary checks: 1,212 passed without changing historical cohort assertions or fixtures. Record/category/editor/workflow selection: 95 passed; final automatic/saved-draft selection: 29 passed before the additional mixed-family case.
- Core adjacent behavior/command/scaling/settlement/facing selection: 200 passed.
- Web `tsc --noEmit`, changed-web-file ESLint with zero warnings, Prettier and `git diff --check` pass.
- Fresh `origin/main` remains `2ed45e7950117c5d11073c2c2b3530ec4c4a1c42`; no upstream reconciliation needed.
- Lower-level publication/validation remains exact for historical approved cohorts. New current HTTP/record authoring has no scaling-zero bypass. Existing utility damage groups require the editor's Attack purpose and Physical/Mystic family before current publication.
- No local browser, database, build, production publication or deployment acceptance is claimed. Root owns combined quality/build/browser/release gates and the central AGENTS/ROADMAP/Manual ledger updates.
