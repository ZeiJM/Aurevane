# World click-arrival continuity — October 13, 2026

Status: implemented on `agent/world-arrival-continuity-20261013`; not merged or deployed. Current Production remains the verified PR #881 release. The smaller magical cursor remains a separate change in PR #883.

The Owner reports intermittent rubberbanding and clicked destinations stopping partway. A bounded signed-in check on the current release reached the intended six-tile destination and returned across the sector edge, with no alert; this does not disprove the intermittent report. It also showed the bounded preview briefly waiting for a delayed confirmation.

## Reproduced defects and changes

- Click routing sampled the motion clock separately before and after route calculation. A route applied after a tile deadline could include a completed prefix and briefly walk backward. Ordinary click routing now uses one timestamp, and preview planning removes completed prefixes before budgeting.
- The preview selected whole authored intervals before shortening the first interval to its actual remainder. On slow terrain, a nearly finished first step consumed the candidate budget and prevented the next eligible step from appearing. Candidate selection now permits the first full interval to be adjusted, then enforces the existing 600 ms preview budget.
- A valid zero-step click during interpolation froze the portrait between tile centres. It now settles smoothly at the clicked current tile centre using the sector's authored pace. A stale route ending at an already reached tile also settles directly rather than revisiting a preceding tile.

These are presentation changes. The submitted destination, server route, minimum authoritative movement timing, collision, discovery, encounter checks and persisted route window are unchanged. Stop remains a distinct authoritative command. Unloaded sectors are excluded from preview candidates.

## Verification

Five new regression cases were observed failing before their respective fixes:

- current-tile click settles from a partial step;
- shortened slow step leaves preview time for the next step and reaches the destination after confirmation, without another pointer action;
- route calculation crossing a 200 ms tile boundary does not backtrack;
- the equivalent 400 ms case resumes at authored pace;
- a completed route prefix does not revisit the preceding tile.

The existing guards retain bounded unconfirmed travel, safe terrain correction, west/east longitude seams, final visual arrival, held-key cadence and release, latest-click ordering, Stop priority and private terrain isolation.

Local verification:

- Repository-wide `pnpm check` passed before the final terminal-prefix edge case was added. After that change, the web package's complete lint, typecheck, test and production build commands were repeated successfully on the final application revision: 2,136 Vitest cases across 280 files and seven Node checks, with no failures.
- Changed-file formatting and `git diff --check` pass. No temporary probe, debug code or unrelated application change remains.
- An independent reviewer approved the final three-file application diff, ran all 17 motion cases and checked whitespace, with no Critical or Important findings.
- The signed-in live checks exercised the existing release only; these changes have not been checked in Production. Local Chromium interaction testing is unavailable because the execution environment blocks the browser's process socket.

Exact-source CI, Living Atlas and responsive Browser smoke results remain required before merge. No human gameplay acceptance or live fix is claimed here. A bounded preview can still pause when confirmation is delayed beyond its permitted budget; this change does not grant unconfirmed movement or promise zero network latency.
