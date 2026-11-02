# Targeting glow, All activation, displacement and Ground controls — November 2

Status: implementation, independent review and full local verification complete; exact-head remote CI pending, not live.

Owner reports: (1) distant recipients add an unrelated attack glow; (2) pure Move actions flash a blue self-target layer while submitting; (3) All-only actions accept only the caster click and occupied tiles have inconsistent tint; (4) Push All drives the caster along facing, potentially into the enemy, and Ground-targeted displacement ignores the selected origin; (5) Ground controls belong inside the Ground effect parameter card.

Aimed actions retain their actual cast footprint, without global recipient expansion. Self-only All activation keeps living recipient tiles available and accepts a deliberate living-unit click as the same self activation, preserving server authority. A shared React-owned tile layer provides uniform occupied and empty-tile colors. A submitted Move has no follow-up self-selection glow; mixed Move/target abilities retain their genuine next targeting step.

New encounters capture an optional displacement-origin policy: explicit Ground anchors repel/pull relative to the chosen point; self Push recoils opposite facing, self Pull follows facing. Other ordinary unit displacement retains its caster origin. Capture the packet origin and self direction once for delayed resolution. Preserve collisions, terrain, Root, summons, actual-distance Chronicle reporting, costs and replay semantics for policy-absent captures. No hosted data/history mutation or migration is authorized.

Ground recipient/duration/animation/preview controls move inside the first applicable Ground effect parameter card. Shared per-field values remain shared, represented once; do not create per-effect values or discard saved settings. Apply across modular abilities, Skills/Essences/Resonances and native Summon Skills.

Verification: failing boundary and submitted-Move tests reproduced six failures before the initial UI fix; All-click negative controls reproduce three failures. Actual-production-component browser checks cover PvE/PvP desktop/mobile, near and far recipients, pending Fleetstep, no incidental command, and exactly one intended command. Preserve existing canonical Move follow-up and authority regressions. Engine tests must cover Push/Pull four directions, Ground-origin selection, All/caster symmetry, blocked routes, preview/commit and delayed/reload parity plus literal historical captures. Editor tests must verify rendered containment, one control set, values/edit roundtrips, hidden non-Ground state and shared adapters. Final candidate requires scoped lint/types/format, full applicable quality gate and all configured exact-head CI before integration. Existing host/database/API/progression paths remain unchanged except explicit new encounter policy capture. Git deployment lock remains false; no new production deployment authorized by these bug reports.

## Handover continuation — Requirements and final gates

- [x] Restore exact 33-file checkpoint on isolated task branch; main remains 1e421722.
- [x] Reproduce Requirements category/preview failures (16 failing regressions; original 37 pass).
- [x] Derive Prerequisite tags versus Automatic activation from existing fields, remove the two redundant event choices, and show activation events in canonical Requirements. Keep historical combined conditions visible and literal; explicit category changes replace only the current draft.
- [x] Repair native Ground card navigation with a real summary click, preserving containment/value/viewport assertions.
- [x] Verify displacement admissions/history/reload and cooldown behavior/counters, native PvE/PvP desktop/mobile parity, then full pnpm check.
- [ ] Independent combined review, exact-head PR and applicable CI; no deployment or hosted mutation.

Verification ruling: the existing approved handover already specifies this design and authorizes implementation. Continue inline without repeating design approval. No stored schema or runtime event enums are changed.

Independent review finding resolved: queued Self/All must retain cast-time facing even after the caster walks. The expanded queued matrix failed before the one-guard correction and all 73 All/displacement tests pass afterward; the reviewer independently confirmed the repair. No deferred findings.

Final local gate: `pnpm check` exit0, 16,045 Vitest + seven Node tests, all formatting/lint/types/build; native 78 targeting +30 canonical +38 Move +18 Support cases pass. Remaining: publish the exact tree/PR and require its applicable remote CI before integration.
