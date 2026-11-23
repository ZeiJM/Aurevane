# Ground authoring, contact scope and animation feedback

**Owner requirements:** November 2 screenshots and follow-ups in this conversation. Ground effects are persistent without an opt-in checkbox; duration, animation and recipient choices live in Effects beside the Ground parameters. No Ground-targeted effect means no persistent controls. An Instant cast shows its active field immediately and clears the completed orange aim. Offer 20 distinct looping presets and allow everyone/enemies/allies/caster-based standing recipients.

**Design:** Reuse the shared canonical/native Ground profile and stable entry links. Normalize only explicit current authoring/save paths to persistent defaults (2 rounds, Arcane pulse), retaining saved values and explicit timing. New optional `placementTimingVersion: 1` defaults the whole field to Instant placement when profile timing is omitted, preserving the existing immediate active-contact rules and paired Damage/DoT settlement; historical absence retains its saved/global fallback. New optional `targetTeams` is one of `all`, `all-except-self`, `enemies`, `allies`, `allies-except-self`, `self`. Explicit scopes control authoritative standing/entry/reapplication relative to the caster; historical absence retains inherited filters. Allies and everyone include the caster; explicit caster-inclusive Ground Damage may affect the caster. Ordinary requirements and contact budgets still apply.

The authored animation preset controls the field material, with effect identity icons/labels retained. Preserve `embers`, `frost`, `arcane-pulse`; add `water`, `ripples`, `lightning`, `poison`, `healing`, `sand`, `wind`, `vines`, `shadow`, `lava`, `rain`, `snow`, `holy-light`, `void`, `runes`, `crystals`, `spores`. These are procedural CSS/SVG animations in the existing shared layer, including reduced-motion handling and preview/runtime parity.

## Constraints

- Preserve original captures, immutable content/history, explicit delayed/next-round timing and historical absent-field behavior.
- Do not reinterpret unsupported/malformed raw drafts or widen Ground-only, Controlled, Summon, All-entry or requirement contracts.
- A deliberate removal of the last Ground tag clears its obsolete dependencies; merely rendering an old draft does not mutate it.
- Preserve one contact per logical effect type per character own-turn cycle, overlap rules, source-only effects, barriers, eligibility, existing clocks, Steam conversion and privacy.
- Pre-cast legal orange reach remains; successful Ground commit clears the completed aim. Failed commands retain valid targeting feedback.
- No hosted database mutation, catalogue publication, merge or deployment is included.

## Work and verification

- [ ] Pure authoring defaults, explicit current save normalization and Effects-only controls, across canonical/native Skills and Summons; no checkbox and no non-Ground controls.
- [ ] Optional profile timing/scope types, strict validation, capture and authoritative contact semantics; current Instant, delayed and historical matrix; source-relative recipient and reload/privacy tests.
- [ ] Twenty stable presets with distinct materials/motion, actual selected-preset rendering, marker/overlap/Steam/pending/reduced-motion guards and native visual checks.
- [ ] Verify actual database contract before proposing a migration. SQL presently stores combat JSON after server TypeScript validation; add actual PGlite round-trip/ACL/history evidence if no database change is required.
- [ ] Focused TDD and adjacent authoring/runtime tests; native desktop/mobile Instant Ground cast, selection/reset and animation checks where practical. Full `pnpm check` once the combined tree is stable because authoritative Ground contact changes.
- [ ] Refresh main, reconcile PR #1003 overlaps, obtain independent final review, verify the published tree and publish the assembled follow-ups through PR #1003.

**Isolation:** `agent/ground-persistence-animation-feedback` in the separate Ground worktree, based on main `91e9e0ed847fd74a9fd0532c52560cdc24c22095`. The prior Endure/Reversal/targeting/narration batch is PR #1003 at `fbb56f8171bac6594957ac2f33a6332c2d2e5895` and remains undeployed.

## Review-driven corrections

The initial placement draft split fields by individual effect timing. Independent review demonstrated that this breaks the existing percentage DoT dependency on actual paired hostile Damage. The final design changes only new field placement defaults: marker1 + omitted explicit field timing places one complete profile instantly. Existing active-contact delivery remains immediate; no new cross-field ledger, proof, queue or allocator is introduced. Explicit delayed fields and historical missing-marker behavior remain literal. Actual current Burn/Poison/Bleed captures cover hit, miss, Barrier, basis, reload and contact-limit cases.

Review also caught optional Fire unit casts being disarmed merely because they support a Ground alternative; only an actual Ground cast/new field now clears completed aim. Native mixed groups and retained Resonance Ground packets are rejected at current authoring while historical readers retain their contract. Protected browser assertions retain exact public-key, scope, activation, reload and cleanup checks.

The completed Ground patch will be assembled with the existing PR #1003 Endure/Reversal/narration fixes, own-caster Covert history confirmation and the exhaustive utility targeting regression audit. One final combined quality gate will validate that tree.

Final assembled verification: `pnpm check` passes 15,984 Vitest tests, seven Node tests, format/lint/types and production build; shared command-feedback and 76 targeting Chromium cases pass. See `docs/verification/2026-11-02-battle-support-feedback.md`. Source only, not live.
