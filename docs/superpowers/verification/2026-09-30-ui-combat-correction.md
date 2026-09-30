# UI and combat correction — candidate verification

Date: 30 September 2026. Branch: `agent/approved-ui-combat-correction-20260930`.

The Owner approved the correction specification and directed implementation of the original layouts and refined battle concept. This is a non-deploying candidate. Vercel Git deployments remain disabled. No production data, publication or migration was changed.

## Scope

The accepted [specification](../specs/2026-09-30-ui-combat-correction.md) and [plan](../plans/2026-09-30-ui-combat-correction.md) cover the nineteen original concept boards in `AUREVANE-UI-HANDOVER-2026-09-30.zip` and the newer approved battle image `exec-49f88d50-6ac0-4054-8df4-9e5928f8b2c5.png`. Structural correction includes account/character entry; Haven; Profile/attributes/editing; Loadout/Nexus/management; World; Hall; Training; Settings; public information; Master workspaces; battle/spectator/results. The portrait sheets are preserved through the existing onboarding collection.

Gameplay remains server-authoritative. The cockpit has Inspect, Move 1, Basic Attack 2, Guard 3, fixed Skill slots 4–7, Essence/Resonance 8, future Severance/Ascension 9, and Space facing/end-turn. Recovery remains secondary. Selection requests a forecast without mutation; a subsequent single target input executes through the existing version/idempotency boundary.

## Local evidence

- Two earlier integrated `pnpm check` runs passed, including production builds. Before the final fixes, 3,026 tests passed across all seven tested packages. Fresh final-candidate verification is recorded below; earlier builds do not certify later edits.
- The independent whole-branch review found four material gaps: generic-modal suppression, selection while execution is pending, late execution after unmount, and migration collisions in custom bindings. Each received a failing regression and a passing fix. Selected-card precedence and summon labels were also corrected.
- A browser fixture mounted the actual route boundary, shared presentation bundle, PvE/PvP enhancements and spectator component. Thirty-six viewport/arena combinations passed: 1366×768, 1440×900, 1920×1080 and 390×844; widths 9/12/15; PvE/PvP/spectator. All boards retained seven square rows and a constant tile scale across widths within each mode/viewport. The desktop terrain key fit after a real route-level clipping failure was corrected.
- Nineteen browser interaction cases passed in that fixture: arming without mutation; unit/self/ground/empty targeting; one click or directional input; key-repeat suppression; Skill details and surrender modals; informational slots 8/9; distinct Space presses; invalid forecasts; pending selection lock; unmount cleanup; nonlocal PvP turns; read-only spectation. A separate defensive-Skill target-color failure was reproduced and fixed.
- Actual-component fixtures covered thirteen ordinary screens at the three desktop sizes and mobile. Current desktop document/main overflow checks passed. These fixtures use representative synthetic props and do not prove authentication or persistence. Explicit collection/editor scroll areas remain accessible.
- Reference comparison exposed additional structural gaps in Training, Profile and Nexus. Training now uses radio duration selection plus one explicit Start action above current status on the scene's right; an empty report is expandable, while earned reports keep their actual claim controls. Profile uses a compact identity card over the scene, portrait at right and the stat sheet below. Nexus retains the left Discipline column and right Skill/attunement/power panels over its scene. Three invalid scene URLs were corrected.
- Playwright discovery is a parse/configuration check, not execution. The authenticated journeys must run in the disposable CI stack.

Browser fixture API responses are deterministic read-only test projections, with mocked mutation responses for boundary inspection. They do not certify real AP spending, database persistence, AI turns, clocks, rewards or multiplayer transport. Those remain covered by the existing authenticated suites and require fresh CI on this candidate.

Representative screenshots and measured outputs are in [the verification directory](2026-09-30-ui-combat-correction/). The ordinary-page fixture compiler was corrected to preserve CSS URLs before the saved screenshots were captured.

## Final-candidate checks and remaining acceptance

Final local check: `pnpm check` passed on the candidate after the interaction and Training/Profile/Nexus fixes: formatting, lint, all typechecks, 3,027 tests (893 web, 2,005 game-core, 45 validation, 62 database, 17 audio, three realtime, two worker) and production builds. `git diff --check` passed. Playwright discovered 441 tests in 72 files.
Authenticated CI on the first published head (`0d11a0a8`, draft PR #775): CI, Skill Engine, Essence Build, Resonance Build, Profile Skill Build, Shared Build Snapshots and Attribute Allocation passed. Six browser/layout workflows failed. Most failed at the shared character-provisioning helper's obsolete exact “Haven” heading. The public entry test still assumed a CSS background instead of the real scene image; creation tests still required stacked attributes and gallery-before-name, and a 1366×768 creation action exceeded the viewport by seven pixels. These failures prompted selector/structural-assertion corrections and a smaller short-desktop creation spacing rule. A fresh authenticated run is required for the follow-up head; the initial failures do not prove downstream gameplay passed.

The changed browser journeys use the new single-input contract while retaining persistence, damage/effects, summon scheduling, victory rewards, keyboard handoff and modal boundaries. Training journeys retain explicit-start, stop, elapsed-time, server-frozen reward and claim assertions.

Automated fit and interaction checks are evidence, not visual acceptance. Exact reference fidelity across every subview/empty/locked/editor state and Owner visual acceptance remain open. No merge or deployment is authorized by this record.

## Media provenance

New terrain/background sources and runtime derivatives are recorded in `content/media-candidates/battle-task7/provenance.json` and `content/art-requests/ART-BATTLE-007.md`. They depict existing terrain rules; they introduce no new terrain mechanics. Existing approved portrait/scene assets retain their provenance.

## Follow-up layout and browser correction

Hall now has the full scenic backdrop, compact mode tabs and a lower stone arena workspace. Staff has the reference's directory/detail two-column structure with existing authority and audit operations. Audio now has separate Volume settings and Now playing panels backed by the existing route music player, with actual track/progress and pause/resume. Two-channel volume persistence remains intact. Manual pause survives volume changes, visibility return and general audio-unlock gestures. Local Chromium exercised pause/resume, actual media time progression, volume application and the pause/volume boundary, with and without forced autoplay. A durable authenticated Audio journey was added to the layout suite.

Extended actual-component fixtures covered Hall, Audio, Rules, News and the Staff/Music/Event Master workspaces at 1366×768, 1440×900, 1920×1080 and 390×844. Desktop document/main overflow checks passed; Rules reading and Master editor regions retain intentional internal scrolling. Hall and Staff fixtures were regenerated after their structural corrections. Public empty News and sparse Master collections reflect actual data rather than fabricated reference entries.

The final follow-up `pnpm check` passed formatting, lint, all typechecks, 3,027 unit tests and production builds. Playwright discovery now lists 444 tests in 73 files. Fresh CI and remaining exact visual acceptance are still open.

## Third candidate: authenticated-CI findings and production-style verification

Authenticated CI on follow-up head `d0627a91` completed eight successful workflows (CI, Skill Engine, Essence Build, Resonance Build, Profile Skill Build, Shared Build Snapshots, Attribute Allocation and Living Atlas Browser). UI Layout Review, Desktop Experience, Representative Buildcraft, Browser Smoke and Desktop Page Fit failed. These results certify that head only; a fresh run is required after the following fixes.

The failed Controls journey exposed a real compatibility bug: category-era persisted keybind maps were rejected by the player-profile row schema before migration. The row now migrates them before strict validation. A failing-then-passing regression covers preserved custom keys, new fixed slots and rejection of invalid key codes. No database migration or persisted-row rewrite is needed.

Creation now structurally follows its original reference: gallery and Gender at left, selected portrait and Name at right; the scenic left panel remains through Discipline selection and Review, with Discipline choices and six starting-attribute rows in the right workspace. Short-desktop spacing keeps the primary action reachable. Profile's stat sheet has bounded internal scrolling, avoiding overlap with Reset Attributes; mobile restores XP and HP/MP because its rail hides those fields. Nexus exposes the actual committed Discipline labels and unambiguous accessible names on its selection controls. Character selection restores subtle ambient motion with reduced-motion support. The final Hall format sweep reproduced a short-desktop Flexible Teams panel growing over the mode tabs; its grid row and maximum height are now bounded, preserving tab hit-testing and the setup fields' internal scroll area.

The battle fixture was expanded to load every production root stylesheet and the actual nested battle-route styles. This reproduced three real legacy-style collisions: a hidden spectator key, shrunken header labels and an oversized PvP forecast portrait that displaced the board. Obsolete battle override imports were removed; remaining historical portrait, busy-state and mobile rules now exclude the unified presentation. Shared clock portals work without the old command target and at mobile sizes. Victory dialogs support Escape and return focus to their opener. These are presentation and input-boundary fixes; gameplay authority is unchanged.

Browser assertions were reconciled with the accepted structures and fixed Skill slots while preserving attribute persistence, battle mutations, effects, rewards, full parameter inspection and server-owned build behavior. PvP test cleanup preserves the original failure rather than masking it with a teardown timeout. No authenticated full-suite success is claimed from fixture checks or discovery.

Fresh third-candidate `pnpm check` passed formatting, lint, typechecks, 3,028 tests (893 web, 2,005 game-core, 46 validation, 62 database, 17 audio, three realtime, two worker) and production builds. Playwright discovers 444 tests across 73 files. Eight additional PvE/PvP utility cases pass across desktop and mobile, covering visible clocks, readable labels, Map Key/Victory parity, Escape dismissal, spectator utilities and busy-state board fit. Fresh final fixtures pass 36 battle geometry combinations, 19 combat interaction cases and 36 Creation/Hall state combinations at six sizes. The Hall sweep selects every PvP format before opening Spectate. All three Creation steps have zero page overflow at 1366×768, 1440×900 and 1920×1080. Smaller desktop windows retain reachable controls through page scrolling. Measurements are retained with the candidate screenshots. Profile Reset Attributes is reachable at six viewport sizes, including 1366×768, 1280×720 and mobile.

Authenticated CI must run on the newly published exact tree. Owner visual acceptance remains open. This record does not authorize merge or deployment.
