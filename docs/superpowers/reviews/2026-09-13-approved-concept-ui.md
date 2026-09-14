# AUREVANE approved concept implementation review

The implementation continues the approved 29-screen concept suite on
`agent/approved-concept-ui`, based on main `af32213`. The supplied Spectator Battle
reference is pixel-identical to concept 13. The current game data and mechanics,
rather than illustrative values in the concepts, remain authoritative.

## Artwork and presentation

The shared frame uses ink navy, moonstone content surfaces, serif titles, fine gold
rules and teal controls. The original dark fantasy city, cloister, courtyard and
archive assets contain scenery rather than people. Character art remains in
portrait and unit slots. Compressed runtime assets and generation provenance are
in `apps/web/public/media/art/concept-ui/`.

The implementation covers the profile and build dialogs, Atlas/mastery, pure and
mixed skill selection, attributes, training states, Battle Hall modes, lobby,
playable and spectator battles, results/logs, Adventurers and public profiles,
roster, three creation steps, portrait/title settings, controls, login and public
News/Manual/Rules pages. News retains its actual empty state and article template.

## Integration corrections

- Removed obsolete portrait/title grid and public-profile square-crop overrides
  so the owning component layouts can display the approved portrait composition.
- Restored light text on the dark training hero and readable category text on
  pale public information panels.
- Corrected the battle command/skill rows so the selected skills remain inside
  the deck, with readable labels and costs.
- Narrow viewports now select the mobile battle layout independently of mouse
  capability. The existing inspection popup remains available to fine pointers.
- One-on-one playable battles use tall portrait rails; larger teams retain their
  compact stack. Courtyard scenery appears behind the actual grid without
  replacing terrain, targeting or state overlays.
- Removed the obsolete absolute-positioned session-link rule that displaced the
  battle brand over the board. The brand now stays within its masthead.
- Spectator teams flank the central battlefield, with the existing chat/log tabs
  beneath it. Completed matches retain full history; active matches use the real
  turn number for their four-turn window.

## Verification boundary

Browser review uses the actual application components in an isolated development
fixture, with representative local data and adapters for Next navigation and
server data. It does not publish a route or weaken production authorization.
Backend mutations, account authentication and multiplayer transport were not
exercised against a live backend in this environment.

Desktop review uses 1366×768. Mobile review uses 390×844, with additional 320/375
checks for the shell and character screens. Reviewed screen groups have no
horizontal document overflow. Long forms, guides and mobile battle controls
scroll vertically.

| Area                   | Rendered checks                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Character headquarters | Portrait, stats, separate four-skill loadout and build signature; Discipline, Atlas, Skill and Attribute dialogs  |
| Account and creation   | Roster, all three creation steps, portrait/title columns, controls and login                                      |
| Training and social    | Idle/active/completed training, live/all directory toggle, class filter and public profile dialog                 |
| Public information     | News empty state, Manual hub and articles, Atlas guide and Rules                                                  |
| Battle                 | AI/PvP desktop and mobile geometry, selected skill containment, labels, inspection, lobby and result/log surfaces |

## Final evidence

`pnpm check` passed after the final implementation: formatting, lint, typecheck,
tests and production build. This includes 1,033 game-core tests, 396 web Vitest
tests plus six PV-1 Node tests. Focused battle checks and independent source
review passed. Browser inspection confirmed a square 9:7 spectator grid at
446.66×347.39 pixels, 48-pixel match context, portrait rails and bottom log dock
at 1366×768. At 390 pixels, both rosters remain above the board and the chat/log
tabs and Inspect dialog work. Playable inspection also works at 850 pixels.

The last refreshed main remains `af32213a0ee06ced3480ad2d13df6d72d3add6d2`;
there was no concurrent main change to reconcile. No server, database or game-core
source changed. Live backend flows and GitHub's database/browser workflows were
not run in this environment.

GitHub publication is blocked: automatic approval review rejected the push to
the public repository because explicit authorization for that publication was
not present. No push, pull request, merge or deployment succeeded. The complete
source patch, original concept references, preview and handover are packaged
for review and continuation.
