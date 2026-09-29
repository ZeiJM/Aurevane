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

## Verification boundary

Authenticated browser workflows ran in CI and require a fresh successful run on the corrected candidate. Local Supabase credentials remain unavailable. A complete state-by-state review of every privileged dialog and real-user live multiplayer acceptance are not established by synthetic fixtures or disposable CI accounts.

Vercel deployment remains disabled for all branches in `apps/web/vercel.json`.
