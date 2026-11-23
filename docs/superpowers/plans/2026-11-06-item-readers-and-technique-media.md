# Item readers and technique media implementation plan

> For agentic workers: use subagent-driven-development or executing-plans task by task.

**Goal:** Implement Nick's November 6 equipment, characteristics, replacement comparison and imbued-artwork refinements.
**Architecture:** Extend existing Item readers/authoring, role media and Support lane. Keep QP and action AP distinct and retain immutable battle capture.
**Tech Stack:** React/TypeScript/CSS Modules, existing finalized media, Vitest/Playwright, additive PostgreSQL validation.
**Spec:** docs/superpowers/specs/2026-11-06-item-readers-and-technique-media.md

## Global constraints
- No hosted writes/deployment. Preserve every configured gate and old immutable body.
- Use existing finalized image upload/security; no arbitrary artwork URLs or browser secrets.
- Preserve image size, eight positions, 100 QP, server authority, keyboard/touch controls and history.

## Review focus
- Swapping two-handed equipment removes both occupied hand contributions.
- Neutral/conditional/Evasion comparisons remain honest.
- QP never replaces execution AP; technique tab and battle reports retain AP.
- Technique media survives editor replacement/toggle, validation, Commit and captured projection.
- Eight-slot Support lane fits desktop and remains operable on touch.

### Task 1: Equipment readers and QP authoring
Files: character-items TSX/module CSS/test, item-details TSX/test, item-report-tabs TSX/test, runtime-item-editor TSX/test, equipment-stat-presentation TS/test, arsenal-items browser regression.
- [ ] Pin requested outside-label/corner-stock/QP report behavior with focused regressions (red observed).
- [ ] Implement local reader changes, QP editor label and conditional replacement summary using existing authoritative projections.
- [ ] Run scoped Vitest, Web types/lint/format, actual nine-size shell and desktop/mobile interactions.

### Task 2: Independent technique artwork
Files: Item definition/parser/tests, existing additive Item SQL validator and DB migration test; finalized Item technique editor/test, public Item presentation, battle equipment projection/log reader, Nexus and Support artwork readers; four default source successors and registry.
- [ ] Add a strictly validated optional image-only technique media slot, leaving absent historical values literal.
- [ ] Reuse finalized media upload and pending-state propagation in technique Media tab, preserving fields on choose/toggle/edit.
- [ ] Carry role-specific image through all current/captured readers; attack retains weapon image.
- [ ] Add four exact immutable source8 successors; parent supplies approved raster assets under /media/art/items/techniques/ and registry IDs item.<weapon-id>.technique.art.v1. Other sources unchanged.
- [ ] Prove grammar/ACL/finalized-media checks, authoring roundtrip, role distinction and historical fallback. Run focused adjacent tests and types.

### Task 3: Technique Manager lane
Files: character-skill-build-panel TSX/CSS and support-action tests; focused browser fixture.
- [ ] Match Support lane to Discipline eight-column sizing, append imbued option beside Invocation and correct placeholder count.
- [ ] Remove separate Details button and explanatory sentence; retain ordinary preview and selection on desktop/touch.
- [ ] Check nine desktop/mobile dimensions and atomic Support selection regressions.

### Task 4: Integration and source handoff
- [ ] Review each task and final combined diff independently; fix concrete findings.
- [ ] Refresh main, reconcile overlapping changes, validate focused/adjacent tests, types, ESLint, format and relevant native browser coverage.
- [ ] Record exact results/limitations, commit scoped branch and create reviewable PR with configured CI; no production claims for this followup.

### Task 5: Range Up, combined release
- [ ] Extend ordinary versioned tag grammar, registry, Master fields and reports with Range Up tile strength and duration; use panel-controlled delayed timing.
- [ ] Apply range bonus consistently in preview/target legality/AI/commit for Attack, Utility and Recovery skills including Basic Attacks and imbued techniques.
- [ ] Exclude consumables, Target All, self-only, movement, area sizes and minimum ranges; retain historical captured rules.
- [ ] Add focused positive/negative/boundary/timing/stacking/history regression coverage and additive DB registration as required. Independently review combined source and required full applicable CI.
- [ ] Include Task5 with Tasks1–4 in ONE controlled release authorized by Nick. Do not release earlier subset separately.

Task5 scope supersession: implement BOTH Range Up and Range Down TAGS, both in delayed category; no standalone Range Down skill. Shared parameters, scope exclusions, net stacking and minimum-range safety require positive/negative/combined regressions.
