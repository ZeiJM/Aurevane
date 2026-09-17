# Roster deletion-dialog accessibility continuation

## Scope

Continue the saved Creation source tree `659e79ac0e3d48f22bd411ca0eaf4c4db2d2ac54`
(the previous package calls its local-only commit `9c3b4d0`). The shared upstream
roster baseline is `c893d8ca8dacc82080f9e9e2fdf7954649f0387c`, source tree
`6f96ecd1c886b458428e51ce3620e5782abf0e46`. Both trees were reconstructed and
matched exactly before editing. The local reconstruction history is synthetic;
it is not an assertion that these new local commits exist on GitHub.

This is a bounded accessibility fix for the existing character/account deletion
warnings, including the pending-account warning. It is not a new visual direction,
new deletion API, change to eligibility, or change to grace-period timing.

## Reproduced defects and fix

On the saved candidate, Shift+Tab from the character confirmation input focused
Delete Account behind the overlay. Escape did not dismiss the warning. A local
real-component browser test recorded both failures before implementation.

`CharacterDeletionDialog` now opens a native modal dialog, blocks background
interaction, contains Tab/Shift+Tab among enabled inputs and buttons, and restores
focus and the preceding document scroll setting on dismissal. When every control
is disabled during a request, focus moves to the panel and remains contained.
Escape and backdrop dismissal do nothing during that request. Dismissing a
pending-account warning never cancels its server-owned deletion countdown.

Expanded tests caught a second defect during implementation: backdrop mousedown
could steal focus after unmount. Cancelling its default action before dismissal
keeps focus restoration intact. The regression is preserved, not weakened.

The original deletion/cancellation handlers, payloads, countdown, cooldown, slot
copy and slot order logic remain unchanged. No server, API, schema, game-core or
Vercel deployment configuration is changed by this accessibility increment.

## Verification boundary

The supplemental browser suite uses the real edited React components, application
CSS, registered portraits and existing domain constructor. React Strict Mode is
enabled. It renders permitted local source bytes in memory, without a web origin.
Next image/navigation and AccountMenu are explicit fixture stand-ins. Roster records
are synthetic component props; failed transport responses are simulated. These are
not authenticated application screenshots, actual account-deletion trials, or a
Next production build.

The suite covers 52 parameterized cases: 12 dialog/viewport combinations, 8 pending
request/viewport combinations, 28 roster-state/viewport combinations and 4 Creation
three-step checks. Sizes are 1366x768, 1024x576, 390x844 and 320x740. It checks
normal/pending warnings, both tab directions, Escape/backdrop rules, focus return,
modal geometry, scroll restoration, disabled controls, unchanged outgoing intent,
empty/full/locked/Prestige/cooldown/deletion-pending states, fallback after malformed
image data, all 40 Creation portraits and step/backtracking behavior. Final exact
local commit results belong to the package's verification report, not this note.

The authenticated `character-roster-dialog-layout-regression.pw.ts` guard is added
to the existing UI workflow. It uses disposable local Supabase, injects one failed
response, and also exercises actual account scheduling/cancellation. It has NOT
been run here. Existing creation/deletion and other UI regression files are retained.

## Execution blocker and integration

Current GitHub discovery exposes read actions, not source-write actions. The prior
publish attempt was separately denied by safety checks; no alternative route was
used to bypass it. This runtime has Node 22, not the locked Node 24, lacks the app's
installed dependency/database stack, and cannot resolve the npm registry. Browser
navigation to localhost is also blocked by its administrator policy; no browser
policy or network setting was changed. In-memory fixtures do not certify a network
path.

The next gate is full locked-dependency validation and the genuine authenticated
workflow in a permitted development environment. Review/resolve publishing
permission separately. Do not interpret this package or a generic continue as
permission to bypass the prior denial, reset shared history, or deploy.

Main was re-read unchanged at `3d8a4d25cb897d0f9ce4871c6972e5d7107d68b0` during this
continuation. Deliberate main/UI reconciliation, full candidate and integrated
checks, remaining HQ audit, portrait quality and Owner acceptance remain open.
No remote branch update, merge, Production data mutation or deployment occurred.
