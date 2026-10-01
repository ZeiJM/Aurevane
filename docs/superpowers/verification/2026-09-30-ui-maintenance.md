# Owner UI maintenance verification

Owner-local date: 30 September 2026. Branch: `agent/ui-polish-owner-20261001`. Base: `1e7140b729c12e7be22f0eaf3d50699398b7dbb8`.

The Owner explicitly requested all supplied UI fixes and authorized merge/deploy once ready in this continuing work item. This maintenance does not reopen a phase or change server mechanics, schema, combat content, progression or rewards. Vercel deployments remain locked while verification runs.

## Changes

- Removed Titles, Audio and Controls duplicates from the rail; Account retains access and Audio opens its existing settings page.
- Removed the duplicate portrait/title display summary; desktop editors share full width with a shallow heading and the permanent title confirmation remains inline. Phone editors stack naturally.
- Training plans, current activity and the single pending report are always inline. Desktop uses three bounded columns; phone layouts remain readable. All report fields/claim semantics are preserved.
- Battle Hall removes its redundant AI arena banner and orders AI Battles, PVP - Direct, PVP - Matchmaking (coming soon), Spectate.
- Nexus adds Back to the Loadout chooser; centers technique and locked content; moves Active beside Essence/Resonance names. Discipline swapping uses slot cards and an eligible scrollable library, preserves authoritative preview/confirmation, and clears Secondary correctly. Atlas tabs are removed from this swapping window; independent Atlas/Mastery services remain intact.
- Profile removes the duplicate identity card and presents Primary, Secondary and available personal titles as themed tags. There is no assigned-special-title source in current contracts; none is fabricated. Profile popovers use readable dark text.
- Shared level-up/reset attribute layouts center the character name and clearly separate all six stat cards.
- Portrait loading reserves neutral space until saved cosmetic data resolves, retaining the intentional built-in fallback after unavailable cosmetic data.
- Playable battle headers center the AP/timer row; standard action artwork matches authored Skill framing using approved source assets. Timer, command, shortcut and mutation behavior is unchanged.
- AI/PvP Victory/Defeat/Draw results use parchment, outcome accents and readable stats/log/actions; surrender dialogs share larger readable panels and distinct stay/confirm actions.

## Verification boundary

Focused behavioral regressions observed the intended failures before fixes. Independent review ran 27 tests across eight affected files and found no concrete authority/persistence regression. Review identified a Titles test that could hide scrolling; it was strengthened to inspect initial and permanent-review states without scrolling.

The local Chromium download returned an invalid archive and no local browser or disposable Supabase runtime is available. Component fixtures do not substitute for authenticated verification. Fresh exact-candidate CI is required for rendered geometry, interactions, persistence, and full Chromium/Edge flows. No follow-up release or production gameplay acceptance is claimed at this stage.

## Local candidate gate

The final integrated `pnpm check` exited 0: formatting, lint, TypeScript, 3,043 Vitest tests across seven tested packages, seven Node checks, and Production builds. The exact patched pnpm fallback install was preserved by setting `pnpm_config_verify_deps_before_run=false` for local execution only; no repository/CI configuration changed. The final helper selector refinement separately passed TypeScript, lint, formatting and diff checks.

Independent review's mobile sizing finding was corrected by reserving sufficient selected-card track width for full-size frames while preserving the existing local mobile command-row scrolling. The rendered geometry guard compares standard commands to actual Skill/Essence/Resonance artwork and excludes locked future placeholders. Browser discovery remains 444 cases across three projects; fresh authenticated CI must validate these dimensions before release.
