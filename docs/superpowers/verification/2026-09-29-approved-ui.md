# Approved UI redesign verification — 2026-09-29

Candidate branch: `agent/approved-aurevane-ui`.
Base and refreshed main: `f82f8176fead0024572bfa53f497430602740880`.
No merge, deployment, database migration, or combat-content publication is included.

## Delivered scope

The approved magical adventure presentation covers account entry, character selection/creation, Haven, Profile/reset, Loadout/Nexus, travel, Battle Hall, training, settings, titles, public reading, Master workspaces, shared dialogs, and shared PvE/PvP/spectator presentation. Haven becomes the post-selection destination and owns Current Path. The compact shared rail is omitted from onboarding and active battle/spectation. Header/footer/navigation remain fixed while content scrolls.

Creation offers twelve square portraits for each of Male and Female; existing portrait references remain valid. Items and matchmaking remain informational Coming Soon surfaces. Direct PvP, existing skill parameters/effects, authoritative services, Master permissions and editing operations are retained.

## Automated checks

`pnpm check` passed after the final battle-frame overflow change: formatting, lint, package type checks, tests, and production builds. Test totals: audio 17, validation 41, worker 2, realtime 3, database 62, game-core 2,002, web 854, and web Node tests 7 — 2,988 tests total. `git diff --check` passed.

Focused coverage includes navigation and shell presentation, rail-free active battle, roaming session redirects, portrait compatibility/media registration, and Haven recovery when optional persistence is unavailable. Existing browser tests were updated for the approved navigation and layout contracts; gameplay assertions remain in place.

## Rendered checks

Local Chromium rendered actual components using temporary synthetic fixtures at desktop and mobile sizes. Reviewed account entry, selection, creation, Profile, reset, Haven, Loadout, Nexus, discipline/technique management, world, Battle Hall/matchmaking, training, audio, controls, Master combat content, and PvE/PvP/spectator layouts. Verified square media, visible parameter/effect details, compact rail, responsive dialog reachability, and fixed frame behavior. Mobile battle-header position remained at zero before and after scrolling the content area.

Temporary fixture routes and their derived development types were removed before the final quality gate. Browser tooling was installed outside the repository and introduced no project dependency changes.

## Independent review

A fresh reviewer identified two material issues: battle dropdown controls inheriting the large gameplay-art size, and optional Current Path persistence blocking Haven. Both were corrected. The review found no concrete authorization bypass, legacy portrait incompatibility, or removed skill-parameter/effect renderer.

## Authenticated CI follow-up

The initial draft PR ran against CI's disposable Supabase environment. CI, Profile Skill Build, Essence Build, Resonance Build and Attribute Allocation passed. Browser suites exposed both outdated presentation assertions and actual UI defects; the candidate is not yet accepted as release-ready.

Corrections preserve the gameplay assertions: controls/title surfaces now use readable stone tokens; mobile controls no longer inherit the desktop height cap; battle information buttons no longer intercept action-button clicks; closed discipline tooltips no longer expand Nexus horizontally. The dedicated PvP lobby now has opposing character cards and a central VS marker, retaining format selection, ready, leave, key and start operations.

Browser contracts now target the actual compact rail/mobile dock and fixed footer, approved account imagery, portrait count and stone palette. Duplicate identity selectors are scoped. Test-account confirmation normalizes email case. Travel, combat legality, action submission, saved builds and parameter/effect assertions remain in place.

The corrected candidate passed the full local `pnpm check` again (formatting, lint, types, 2,988 tests and production builds). `git diff --check` passed.

Synthetic Chromium checks confirmed mobile action clicks, a 980px Nexus without horizontal overflow, a fully expanded mobile controls list, and reachable lobby actions. Desktop/mobile versus-lobby screenshots were reviewed. These checks do not replace authenticated CI outcomes.

The next authenticated run passed CI, Profile Skill Build, Essence Build, Resonance Build, Attribute Allocation, Desktop page fit and Representative Buildcraft. Remaining browser findings prompted a second follow-up: validate the actual login background rather than its hidden lazy image, retain same-origin navigation after sign-in in the resume test, verify Titles' solid stone material, improve Techniques label contrast, and bound the globe inside the fixed desktop/laptop content frame. The globe defect came from a retired Profile height rule matching the World page's hidden legacy identity card; the correction overrides only the World container. A new Atlas assertion checks that the viewport itself fits inside main content.

Local Chromium confirmed globe fit at 1440×900, 980×1000 and 1366×576, with the natural mobile world layout retained. Visible Techniques labels measured at least 11px and 4.8:1 contrast. All existing lobby formats passed desktop, 390px and 360px control-reachability/overflow checks. The full local `pnpm check` passed again after fixture removal: formatting, lint, types, 2,988 tests and production builds. A fresh exact-candidate authenticated run is still required after this follow-up.

The second follow-up passed ten of eleven authenticated workflows, including Living Atlas browser, UI layout review, Desktop experience and Desktop page fit. The full Browser smoke run remains pending. Its previous partial run exposed six stale test contracts: Master overview entry, scoped Master navigation, soft Loadout-to-Nexus navigation, two generated names containing disallowed digits, and a deferred summon queue absent from the public player projection. The test follow-up retains the existing gameplay assertions; the summon queue is now checked against the persisted snapshot in CI's disposable database. No production service, schema or combat rule changes are included in that follow-up.

The full Browser smoke run then completed with 239 passed, 190 intentionally skipped and three failures: Nexus lane alignment and the same live summon-display defect at desktop/laptop sizes. The other six corrected journeys passed. Nexus now reserves equal header space, and modal placeholders match the 64px square gameplay artwork; the modal assertion follows the approved stacked Discipline groups. Local Chromium reproduced the 16.55px mismatch before the correction and confirmed equal 48px headers and aligned slots afterward.

The summon state was persisted correctly, including the deferred initiative queue. The shared playable battle component built its participant map from the initial snapshot, so a newly committed summon had no displayed token until reload. It now derives the map from the current battle state for both PvE and PvP. Local replays of the recorded disposable-CI action through the real component and PvP live-state event showed the live token and preserved Inspect abilities and 5/5-turn lifetime. Combat rules, content parameters and persistence are unchanged. Fresh continuation replays passed for both the PvE action and the PvP live-state event, with the summon token and Inspect abilities/lifetime retained. Nexus again measured equal 48px headers, identical slot positions and 64×64 artwork. Temporary replay fixtures and generated development types were removed before final validation. Exact-candidate CI must pass again after these corrections.

## Verification boundary

Authenticated browser workflows ran in CI and require a fresh successful run on the corrected candidate. Local Supabase credentials remain unavailable. A complete state-by-state review of every privileged dialog and real-user live multiplayer acceptance are not established by synthetic fixtures or disposable CI accounts.

Vercel deployment remains disabled for all branches in `apps/web/vercel.json`.
