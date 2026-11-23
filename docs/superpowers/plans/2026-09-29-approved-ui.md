# Approved UI implementation

Goal: implement the Owner-approved full interface while retaining authoritative gameplay.
Architecture: existing Next/React routes and domain services, one shared presentation shell, route-scoped CSS and registered compressed media. No new dependencies or database migration.
Spec: docs/superpowers/specs/2026-09-29-approved-ui.md
Global constraints: isolated agent branch; no deployment; auth/capabilities/state authority intact; legacy records readable; square media; accessible responsive overflow.
Review focus: active-session redirects, public/master shell restrictions, portrait reference compatibility, mobile modal reachability, combat parity and retained editor operations.

## Task 1: Shared frame and destinations

Files: shell components, roaming Haven/Loadout routes, character select/create redirects, Profile Current Path.
Interfaces: server-selected character feeds the rail; session restrictions remain authoritative. Haven uses existing story/news data, no new daily reward API.
Verify: navigation and presentation tests; selected-character route regression; typecheck.
Commit: feat(ui): add Haven and unified compact game frame.

## Task 2: Art and identity

Files: media registry, portrait options, creation and account/selection CSS.
Interfaces: append new portrait refs, preserve legacy refs; no guessed stats.
Verify: media/creation validation and rendering; exact square production derivatives.
Commit: feat(ui): apply approved adventure art and character identity.

## Task 3: Complete surface redesign

Files: shared theme, Profile/Nexus/world/training/settings/public/Master CSS and composition, battle shared presentation and Hall.
Interfaces: all current interactions retain handlers and services. Matchmaking is informational Coming Soon.
Verify: browser desktop/mobile login, representative fixture flows, full test suite and pnpm check.
Commit: feat(ui): redesign game and Master workspaces.

## Task 4: Verification and handover

Review branch with one fresh reviewer; inspect current main for concurrent changes; fix material findings; rerun affected gates; record actual evidence and limitations. No deploy or merge.
