# World click-arrival continuity — October 13, 2026

Status: implemented on `agent/world-arrival-continuity-20261013`, PR #884; not merged or deployed. Current Production remains the verified PR #881 release. The latest revision also incorporates a refined cursor and supersedes the initial cursor proposal in PR #883.

## Distant-click follow-up

The Owner repeated the distant-click/backward-step report while Production still contained the earlier implementation. Further investigation reproduced a separate receipt defect: local preview navigation uses the supplied scene, while server navigation includes the whole known graph. Different search strategies can choose equally legal paths to the same endpoint. An off-path receipt previously routed the portrait back to the older authoritative origin, then replayed that other path.

Off-path reconciliation now finds the known walkable cell containing the visible point and routes toward the furthest loaded confirmed endpoint. It uses only supplied cells/exits and authored costs. It retains the original sector where geometries overlap and refuses to borrow public ground when that source cell is withheld or blocked. Unknown/disconnected relocation still settles at the authoritative position. No route, position or reward is committed by interpolation.

Four further regression cases were seen failing before their respective fixes: an alternate legal confirmation no longer sends the preview backward; the same defect is reproduced using actual server route resolution/projection after private discovery; withheld private source ground cannot be substituted by an overlapping public sector; and a source sector omitted entirely from the new snapshot also fails closed. The last case was identified by review and reproduced in a supplied-snapshot fixture, not through a live server transition. A browser rendering case holds a real command receipt until the bounded preview settles, substitutes another legal path to the same confirmed endpoint/version, samples camera continuity, and verifies final authoritative and visual arrivals. That browser receipt is an explicit rendering fixture; real server route choice is covered separately by the projection integration test.

The cursor is now a 16 × 18 faceted crystal pointer with a thin muted gold outline, deep teal facets and one small glint, with its hotspot at (2, 2). The embedded SVG was rendered and inspected at native size and 4× magnification. It adds no canvas marker, animated overlay or movement handler.

The earlier application head `c7c70be37726a020950201e50b6d82ff5cd7b50b` passed CI `38358562320`, Living Atlas `38358562309` and Browser smoke `38358562316`. Those results do not validate this additional source revision. New exact-source gates are required.

Final follow-up validation: repository-wide `pnpm check` passes on the completed application revision, with 5,067 Vitest cases (2,140 in the web package across 281 files) plus seven Node checks, formatting, lint, eight-package typechecks and production build. The independent reviewer reran all 21 motion/projection cases and approved the final source/terrain guards with no remaining Critical or Important findings. The new browser rendering case compiles and is awaiting the native exact-source browser workflows; it was not run locally or in Production. Current main was refreshed before final publication and did not advance. No migration or deployment was performed at that revision.

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

## Owner release follow-up

The Owner requested darker cursor colours, removal of the town/360-view button, and release of all pending fixes for testing. The crystal cursor retains its 16 × 18 shape and (2, 2) hotspot with deep teal facets, a muted glint and muted gold outline. The World workspace no longer mounts the panorama control/dialog; Settings and Sector/E/N remain. The existing town/countryside rendering guard was updated and observed failing before removal.

The `1051310` CI run `38385135082` passed. The new distant-click browser case passed in Atlas, but run `38385135581` failed because Nearby changed while the mobile presentation check awaited positional row locators. Its layout measurements now use one atomic DOM snapshot, retaining the same identity/action alignment, containment and touch-size assertions. No scenario is removed or skipped for this race. Final-source CI, Living Atlas and full responsive Browser smoke remain required before merge and deployment.

Follow-up local checks: all 25 workspace/motion/projection tests pass after the panorama removal, web typecheck and changed-source ESLint pass, and changed-file formatting/whitespace checks pass. The embedded darker SVG was rendered and inspected at native size and 4×; dimensions/hotspot are unchanged. Required native gates for the final source are pending.
