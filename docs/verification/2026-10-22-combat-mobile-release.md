# Combat independence, passive readiness and mobile layout release

Status: implemented locally; combined verification and production release pending.

Owner authorized completing and deploying this thread's fixes on October 22, 2026. The final layout instruction permits implementation without another concept approval.

## Approved behavior

- Authored Skill Move is independent of ordinary walking in both directions. Keep Skill costs, movement distance, Root, terrain, occupancy and elevation legality.
- Escape/dismissal releases dormant battlefield controls and restores combat shortcuts, retaining active modal reader and text-entry ownership.
- State-based passives trigger when requirements and legal target geometry are satisfied. Preserve costs, cooldowns, limits, current-state target validation and bounded reaction processing. Check intermediate movement tiles and distinguish prerequisite subjects from beneficial effect recipients.
- Discipline Management keeps selected Primary/Secondary side by side above the scrolling choices, with a compact bottom preview.
- Technique Management scales choices to make room for the bottom preview. Remove duplicated preview images at every breakpoint; retain chooser artwork and all mechanical information.
- Tighten existing Sparring Yard, PvP, Arena Queue and Spectate pages; add no recent-battles feature.
- Mobile battle and spectation use compact chrome, side-by-side character rails, a fitted board and a lower preview/cockpit/Chronicle reader. The footer toggle opens and scrolls that lower area to Chronicle while header, rails, board and footer remain fixed. Collapsing restores the cockpit. Preserve desktop behavior.

## Local evidence

- Existing Battle Hall baseline passed seven viewport sizes using Chromium headless shell 1194. Full Chrome failed its process-singleton socket initialization; default Playwright browser download was unavailable. The headless shell successfully executes native rendering/interaction guards.
- New Hall regression first failed the compact-header requirement at 320×568. Current guard passes seven existing viewport/control cases and all four sections at three phone sizes, including popup and action reachability.
- Focused combat tests and game-core typecheck passed; final game-core suite passed 197 files / 5,600 tests. Related web movement/UI tests passed 65 cases, Master authoring passed ten cases. Earlier stale assertions expecting Skills to consume walking were corrected; ordinary walking assertions remain. Five additional cases protect walking AP from nested readiness/event passives and modifiers; independent reproduction now finishes with 80 AP after one 20 AP step.
- Publication consistency regression caught a stale 13-definition payload. Regenerated publication/rollback now use all 130 exact candidate definitions and inventory136; immutable history, unrelated pointers, drafts and policy are guarded.
- Final native battle guard passes 24 mobile scenarios plus three desktop baselines across PvE/PvP/spectators, including 9/12/15-column boards, long Chronicles, phone landscape, minimum usable reader/board area, fixed geometry, complete viewport/footer containment, End Turn reachability, Inspect and retained pill control shapes/popovers. Management passes12 original plus8 independently checked panel/viewport combinations. Independent combat/mobile reviews have no remaining Important/Critical findings.
- All30 canonical Skill Move browser cases and existing ally/summon inspection flows pass. Basic Move reader retains ordinary walking limits; attached Move readers, Master hints and Manual explain independent movement.
- Complete web suite passes403 files /6,413 Vitest cases plus7 Node checks. Database rerun passes25 files /210 cases with two workers; ordinary web typecheck passes. Audit reports no known vulnerabilities. The combined local gate encountered an8GiB memory ceiling and is being checked with bounded resources; separate passing suites do not imply the combined command passed.
- Exact-source CI exposed two stale browser expectations. Native readers now independently check Skill Move and ordinary walking text. Simple Requirements now saves and reloads the requirements-met default, verifies that switching activation preserves a legal target binding, and explicitly selects the triggering effect target independently of its requirement target; all22 native browser cases pass locally.
- Publication and publication-plus-pointer-rollback rehearsals both passed inside a top-level rollback; live history1110/current294/token remain unchanged.
- Initial combined check passed formatting/lint/types and the game-core suite, but a database test worker exited unexpectedly after24 files/195 tests; no failed assertion was reported. A resource-bounded complete rerun is in progress. Exact-source CI, actual publication and deployed-source smoke remain release gates. Do not infer completion from this checkpoint.

## Release boundary

Use the reviewed Next.js16.4.1 / matching eslint patch from PR #968; the prior16.3.8 dependency blocks the production security gate. Keep Vercel Git deployment disabled. Reconcile fresh main and preserve concurrent Staff/Players and World work without claiming that this thread completes those workstreams.

Deploy the verified readiness-capable application before content publication. Publication appends130 immutable versions: current294 / Resonances136 / history1110→1240 / drafts0 / timing policy8. Refresh the catalogue token and verify complete before/after JSONB against all130 candidate records. Rollback changes only current pointers and retains all history; historical captures continue to require a compatible application.

No schema migration is introduced by this thread. Signed-in hosted, physical-device, multiplayer/load and Owner gameplay acceptance must be reported separately from local native fixtures and CI.
