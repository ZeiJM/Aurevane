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
Authenticated CI: pending PR publication.

The changed browser journeys use the new single-input contract while retaining persistence, damage/effects, summon scheduling, victory rewards, keyboard handoff and modal boundaries. Training journeys retain explicit-start, stop, elapsed-time, server-frozen reward and claim assertions.

Automated fit and interaction checks are evidence, not visual acceptance. Exact reference fidelity across every subview/empty/locked/editor state and Owner visual acceptance remain open. No merge or deployment is authorized by this record.

## Media provenance

New terrain/background sources and runtime derivatives are recorded in `content/media-candidates/battle-task7/provenance.json` and `content/art-requests/ART-BATTLE-007.md`. They depict existing terrain rules; they introduce no new terrain mechanics. Existing approved portrait/scene assets retain their provenance.
