# World click-arrival continuity — October 13, 2026

Status: **LIVE for testing** through PR #884, production `dpl_Giw72hrwPuXeZ4gT6hRMseaLrMyM`, READY `2026-10-13T12:15:10.250Z` (08:15:10 Trinidad) at https://aurevane.vercel.app/game/world. Prior rollback target: `dpl_2HH6uzKfqGspBxP8NdFZKh3wG2KZ` (PR #881). Human gameplay acceptance remains with the Owner. PR #883 is superseded and closed, unmerged.

## Verified release and bounded Production smoke

The Owner explicitly authorized release of all pending fixes for testing, then requested removal of the town/360-view button in this same batch. Final tested source is `afe69bd7d1d1d50d056680cc895cb3eb1548aa28`. Merge `3f7c721dc6f4c41d9c8518d89a87d0104349c194` has the exact tested full tree `bd1b16b4ce4c3155320756ce2ac834cb61586f64` and application subtree `865191caedc167fe7c514d9102308816714490ec`. Refreshed main and the production target are inspected before merge/deploy. One production deployment is explicitly created from that merge with `withLatestCommit:false`; its READY source and canonical alias are verified. No preview, hosted migration or automatic Git deployment is triggered.

All three required exact-source workflows pass:

| Workflow             | Run         | Completed job                               |
| -------------------- | ----------- | ------------------------------------------- |
| CI                   | 38388184717 | Quality 115265053930; database 115265053392 |
| Living Atlas browser | 38388184665 | 115265053526                                |
| Browser smoke        | 38388185392 | 115265844637                                |

Local full `pnpm check` and native CI both pass formatting, lint, eight-package types, **5,067 Vitest plus seven Node checks** and production build. Independent reviews approve the motion/terrain guards and final UI/test delta with no remaining Critical or Important findings. Atlas passes **44 cases / 76 intentional project skips**. Its artifact `11808905047` is downloaded and SHA256 verified as `6abfbdc1ab3621375319751ab1b435c8fb82a7e1f8ea9f5cbc7d6065c30d98ac`; inspected desktop/mobile controls fit and retain Settings/coordinates. Distant-click rendering and effects-off/reduced-motion final-arrival cases pass. Full responsive smoke passes its preliminary checks, **73 focused cases / 21 skips**, **342 full-suite cases / 261 skips**, and **10 Edge cases / two skips**. Native completed logs are checked; no scenario is removed to resolve the Nearby measurement race.

A fresh signed-in Production reload serves the exact deep teal SVG colours, 16×18 size and (2,2) hotspot. View Town and View 360 controls are absent; Settings and the coordinate readout remain. A single ground click reaches E900/N320 in S70-29 from E894/N320 in S69-29, with settled camera 900.5/256.5 and no further pointer action. Return-click sampling records 24 monotonically decreasing camera-X observations over 31–918ms (900.477 to 896.381), with camera-Y fixed at256.5; a subsequent check confirms complete return to camera894.5/256.5 and E894/N320. HP153/153, MP102/102 and XP96/100 are preserved. This bounded live check does not establish every route, every latency condition or human gameplay acceptance. The attempted in-page high-frequency sampler was unavailable in the browser's read-only evaluation scope; the reported samples use documented DOM reads instead. No peer attack, chat or reward claim is performed.

The pre-release long-idle tab carried a temporary travel notice; a fresh reload of the new release clears it, with no actionable alert in the bounded checks. No cause is asserted for that old-tab notice. The returned browser console sample contains extension metadata errors; these are not represented as application errors or as a clean exhaustive console scan. The new deployment's production warning/error/fatal query from READY through `2026-10-13T12:18:32.261Z` returns no entries. This establishes only that checked initial window.

Actual Production screenshot `Aurevane_World_Live_1791893966119.jpg` is captured and inspected. All earlier scenery, water, weather, Nearby, zoom, held-key and battle-return releases remain included. The Owner's latest explicit button-removal request supersedes the prior footer View Town restoration. Server movement/persistence/rewards, minimum authoritative pace, private discovery/collision, bounded 600ms unconfirmed preview and actual 1–2s peer polling remain. No zero-network-latency, live 100-player or phase-closeout claim is made.

The following sections retain the chronological implementation log; their pending statuses precede the verified release above. The documentation-only receipt changes no application bytes and requests no further deployment.

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
