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

## First authenticated candidate and corrections

PR #778 candidate `93fb65da79da122cafc545c0c71dcbb47ad67d8f` passed CI, Attribute Allocation, Profile Skill Build, Essence Build, Resonance Build, Representative Buildcraft and Desktop page fit. Desktop experience and UI layout review exposed concrete failures before release:

- Document-wide rail identity locators matched the active rail and a hidden streamed SSR payload. Locators now scope to the active shell; a separate document-wide visible identity count continues to catch real duplicate UI.
- At 1536×614, permanent-title review overflowed the main pane by 40px. Review now replaces the draft editor with the exact final preview, permanent-choice checkbox and Edit/Confirm actions. Edit restores the draft. Strict no-scroll assertions remain.
- Training's compact planner overflowed by 4px and its Start action extended past the panel. Compact duration-card padding and row spacing recover space while retaining 14px descriptions and 44px actions. Strict overflow and action containment assertions remain.
- An early-stop test incorrectly expected no report. Migration `20260821170500_passive_training_partial_stop.sql` authoritatively freezes a proportional pending report on stop; the test now checks stop → report → claim and separately checks completed training. No production reward or claim logic changed.
- Mobile selected-skill grid tracks now reserve the same minimum widths as their contents, preventing group overlap inside the existing horizontal command scroller. Geometry checks cover group separation and actual artwork sizes.

Independent review of these eight changed files found no blockers and passed 21 focused tests across five files. The corrected candidate's full local `pnpm check` exited 0 again: formatting, lint, types, 3,043 Vitest tests, seven Node checks and Production builds. `git diff --check` also passed. Fresh authenticated browser CI remains required before release.

## Second authenticated candidate

Candidate `b0143c922f4f26041fb4ef27750cf3445ac57961` passed eight applicable workflows, including Desktop experience (48 passed / 27 skipped) and Desktop page fit (eight passed / seven skipped). UI layout review passed 99 / skipped 50 and failed only the 1536×614 title-review no-scroll assertion; its separate directory invocation passed one / skipped two. Training's compact idle JSON now records zero main/panel overflow and its actions fully inside the planner. Early-stop and completed-report claim journeys pass.

Replacing the title editor with review did not remove the outer 40px overflow. The follow-up targets the Titles scene's inherited percentage height inside the shell's implicit-auto-row grid: scoped automatic height with stretching, preserving type sizes and controls. This remains a layout hypothesis until strict authenticated geometry passes. The Title fit helper now saves actual main/scene/workspace sizing and viewport captures before asserting, so any failure is inspectable rather than omitting the failing state. No fit threshold or overflow assertion was relaxed.

The title sizing follow-up passed the full local `pnpm check` (3,043 Vitest tests, seven Node checks, formatting/lint/types and Production builds). Independent review found no blockers in the scoped CSS/diagnostic changes; `git diff --check` passed. The browser run for the superseded candidate is not completion evidence for this revision.

## Measured Title content correction

Candidate `7fbcce6a89bed0cf3511304aeee3709c6a14e1b7` again passed eight workflows; UI layout review passed 99 / skipped 50 and failed the same single short-window title check. The new captures disprove the outer-height hypothesis: the scene correctly fits its 487.281px shell track, but the workspace's intrinsic 468.906px content exceeds its 393.047px content track. The portrait column consists of a 312.047px editor, 118.078px Future Distinctions card and an obsolete global 16px gap. Workspace/root bottoms reach 622.313/610.922px beyond the 582px footer boundary; the screenshot visibly clips the Future text. Scroll positions are zero and the 44px actions are visible, so this is actual content overflow.

The follow-up moves the future informational area into a compact full-width note below both editors, shortens portrait guidance while retaining formats, square cropping, 128–4096px dimensions, 8MB static / 12MB GIF limits, direct ImgBB links and built-in portrait restoration, and removes only the obsolete global Titles gap override. The component owns its spacing; the disproved outer-height change is reverted. The existing strict fit journey also saves the blank portrait through the real API, requires HTTP 200 and inline success feedback, then measures the short viewport again.

Independent review found no blockers and passed both focused title tests. Training captures for short idle/active/report states confirm zero main and panel overflow, contained panels/actions, 44px controls and 14px descriptions. Fresh local and authenticated candidate gates remain required for the measured Title correction.

The measured content correction passed a fresh full local `pnpm check` with exit 0: formatting, lint, types, 3,043 Vitest tests, seven Node checks and Production builds. The authoritative current main remains `1e7140b729c12e7be22f0eaf3d50699398b7dbb8`; the strict authenticated layout and full browser gates remain pending for this revision.
