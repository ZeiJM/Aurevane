# Web deployment note

This file intentionally lives inside the web app project root so documentation-only production redeploys are not skipped by Vercel's monorepo unaffected-project optimization.

Runtime behavior is unchanged by this closeout.

PR #817 merged the exact tested tree as `9dab90f3c1bafd8c34118ac5731ea46dc47b224d` and released READY deployment `dpl_4BKzCuaYMTukNMPVA86zfZThKp83` at `2026-10-03T22:14:23.885Z` on https://aurevane.vercel.app/. All eleven applicable workflows pass exact candidate `f509b54923c55b6981b8f33cccbc117113e3dde2`. Browser smoke passes six real-mail recovery cases, 66 focused cases, 312 full Chromium cases and ten Edge cases. UI layout review passes 110 cases plus the directory check; desktop interaction, page fit and representative buildcraft pass 48, eight and 24 cases. Public entry/recovery/Manual/Rules/News responses pass, and the bounded READY-to-verification warning/error/fatal scan is empty. This configuration/docs-only closeout restores the automatic deployment lock without another application release. No database migration or hosted content/Auth setting change.

The preceding effect-tag fixes, beneficial Copy, battle/Nexus readability, watermark/header styling and password recovery remain included. New generated maps apply to new standard battles. Full evidence: `docs/superpowers/verification/2026-10-03-battle-map-preview-readability.md`.
