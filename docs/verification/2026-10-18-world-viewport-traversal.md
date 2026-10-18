# World viewport rendering and public-ground traversal — October 18

Status: #937 is live, but Owner acceptance remains OPEN. After release the Owner reports missing Emberreach scenery and a pause when changing direction with click-to-move. The follow-up below is not yet released.

## Release #937 and residual report

PR #937 merged as `1651642978181c7ebe6656cf4120f411b78f3ec8`, with tested tree `94c6e4c7dbfab806b85527ccba954a448163ce32` matching candidate `c04c26d42ff9c3fe2f7804e54b800694a5cafd82`. Exact-head CI 39165587203 attempt 2, Atlas 39165587214 and Browser 39165587223 pass. CI attempt 1 hit the unchanged modular-correction natural-duel 30-second test timeout; the bounded unchanged-head retry passes. Final quality passes 10,216 Vitest plus seven Node checks. Atlas passes 51 cases with 84 skips; Browser passes 353 full Chromium, 73 focused and ten Edge cases with existing skips. No assertion or timeout was weakened.

Production `dpl_EgRJzKnFt2zSCC3UAUHU9po9CP2j` is READY since `2026-10-18T22:30:36.754Z`; exact source, canonical alias and public entry are verified. Signed-in keyboard traversal crosses a legal sector exit and returns/reloads at E861/N332 with resources and preferences preserved. Native terrain confirms an attempted building tile is correctly blocked. The 35% viewport is visually supplied; Online Users appears beneath Welcome back, Archer. The bounded deployment warning/error/fatal scan is empty. These checks did not establish click-turn continuity or physical-phone acceptance.

The Owner's subsequent screenshot shows incomplete Emberreach Countryside at S77-26, E997/N347 (`atlas:76:25`, x9/y4). A fresh canonical projection supplies that viewport; the follow-up reproduces loss of already supplied scene data and a dropped arrival read. Owner acceptance stays open.

## Click-turn and scene continuity follow-up

Branch `agent/world-click-loading-followup-20261018` starts at the #937 merge. Four failing regressions establish:

- A compact command merged into its dispatch-time view rolls back scene hydration and peer clocks delivered while it was pending. Merge the validated compact receipt into the current controller view, retaining newer version/clock blocking authority, including equal-clock accepted authority. The equal-clock regression was observed failing before its repair.
- A movement/arrival hydration requested behind another scene read is discarded. Coalesce that request and re-evaluate it against the current view when the active read finishes, preserving disposal and ordinary movement pacing.
- An older scene is rejected because it omits disconnected far-future route terrain, despite filling the next missing ground. Protect only the contiguous previously supplied route prefix; private visibility and already usable terrain checks remain.
- A partial turn drops the whole segment intersecting the 600 ms preview limit. The reproduced turn stops after about 424 ms, before its timely approval. Retain that segment with an exact capped visual clock, keeping the last fully landed position and authored speed. Late approval samples the held point before removing the cap; hidden time shifts the deadline. The prediction bound stays 600 ms.

Focused controller/motion/scene/movement-receipt checks pass 244 tests, including late approval, an 800 ms first interval, unchanged hydration while held, coalesced viewport/arrival and disposal, hidden time and the exact reported Emberreach position at normal/minimum zoom. The existing slow route-calculation expectation changes from 815 to 800 ms because removing the artificial preview pause restores the authored arrival deadline; no tolerance is widened. Native browser coverage adds actual mouse/touch direction changes with a real compact approval delayed to 550 ms, frame continuity and authoritative arrival. Independent review reproduced two follow-up issues: re-accepting saved authority resets its clock, and skipping a matching compact reply can leave a hydrated pending route capped. Failing controller/motion integration tests now guard both: a separate visual confirmation preserves the already accepted clock and only runs for the latest plan without a queued movement or attack. The native probe now measures the actual rendered traveller point independently of camera smoothing, with raw frame evidence attached. Final independent review reports no remaining Important/Critical finding and independently passes 242 tests across five focused files. The six-file local focused run passes 244. Native execution, whole-source quality and exact-head CI remain pending. Hosted browser observation remains blocked by credential protection after the permitted fresh-document recovery; no bypass is attempted.

## Reproduced causes and changes

Follow-up native checkpoint: source `9e859f435ce980b2a30e28a2c702f9a58395b54e` passes exact-head CI 39175008030, including 10,232 Vitest plus seven Node checks, worker boot, source cleanliness and database authority. Local full quality also exits zero. Atlas 39175008007 passes 53 cases and skips 86; both new pointer-turn cases fail their setup assertion because the second pointer arrives after two tiles, before the intended partial-turn assertion can execute. The earlier head's unrelated 5-second unlimited-DoT CI timeout passed locally (12 tests) and does not recur on this head. No combat test or timeout changes.

All four exact-position Emberreach normal/minimum-zoom desktop/phone captures pass and are visually inspected: surrounding land is present; the visible minimum-zoom water edge is coherent. Full artifact 12154392903 is downloaded and SHA256 verified as `9f3e98b8c62440bc7f064782acf1c05b6525b99afc32b981f41e579ac1c03c40` (247,137,808 bytes). The pointer fixture now pauses Playwright's visual clock, performs the first real mouse/touch action, advances 75 ms, performs the real turn while paused, and retains the actual server replies behind gates. It observes 550 ms of rendered traveller movement, delivers the real approval before the unchanged 600 ms cap, checks continuing movement across the cap, resumes normal time and verifies canonical arrival. This is controlled visual timing, not a hosted latency measurement. Independent review finds no Important/Critical fixture issue; fresh-head native verification remains required.

- Pointer picking searched only the navigation/peer sectors even when additional charted public ground was visibly rendered. A visible walkable target outside those sectors produced no walk intent. Picking now uses the rendered public terrain for pointer destinations; keyboard routing retains navigation terrain and the server still approves all walks. Private/withdrawn scenery remains excluded.
- Five separately rendered scenery image sheets invalidated all ground layers when they finished loading. One recorded late load rebuilt thirteen ground layers. Only the terrain sheet now invalidates the ground cache; every image still requests a draw.
- Public scenery used fixed 1296×944 dimensions and a fixed sector neighborhood, leaving gaps on larger/taller stages. Authenticated full scene reads now accept bounded viewport dimensions (maximum 3840×2160), and projection supplies intersecting charted public scenery at minimum zoom, bounded to 512 scenery sectors. The authoritative navigation/peer scene remains at most 25 sectors.
- Mount, resize and zoom check minimum-zoom coverage. A viewport change during an existing scene request is coalesced and rechecked after that request completes, using the latest dimensions. Already supplied coverage and disposal do not trigger a replay. Scene reads remain independent of the authority command queue.

No migration, artwork, movement duration, private discovery rule, collision rule or 600 ms unconfirmed prediction bound changes.

## Regression evidence

Observed failing tests before their fixes: visible public cell ignored; late scenery image recreated ground caches; large viewport uncovered; viewport GET dimensions not forwarded; viewport refresh incorrectly selected compact presence; resize during a pending scene request dropped the second extent.

Focused regression suites cover canonical scenery pointer intent and withdrawn scenery, each image load, desktop/4K/tall-phone projection coverage, authenticated query clamping, compact-presence compatibility, coalesced pending resize and disposal. The controller suite passes 29 tests after the resize repair, including restoring a previously covered larger viewport while a smaller read is active. Independent review found the resize race; no other Important/Critical issue was reported.

Native browser coverage adds an actual 2560×1440 resize, bounded full-scene response, 35% zoom and click on rendered walkable ground beyond the peer snapshot, followed by a server-approved route receipt. Existing delayed-scene browser intercepts include viewport query strings. Local Chromium installation failed because its download was truncated; this native case must run in CI.

## Whole-candidate local gate

Frozen `pnpm check` exits 0: formatting, lint, generated routes/types, 9,212 Vitest tests, seven Node checks and production builds. Independent follow-up confirms the resize finding closed and reruns all 29 controller tests successfully. No production release is claimed by these local checks.

## First native run

Exact source `6932f2d6c11b840939935890028bd1a3565ecaa4` passes CI quality and database checks (run 39151345737). Living Atlas run 39151345715 passes all 50 pre-existing cases; the new large-viewport case passes its coverage, pointer click and server route-approval assertions, then fails its cleanup because it looks for a removed Stop travel button. Cleanup now uses the supported focused-map Escape command and asserts its successful stop receipt and empty route. No movement assertion or timeout is relaxed.

The full failed-run artifact 12145867058 is downloaded and SHA256 verified as `d836e21b76482eeed06df531162f581b75b7b1b13e85d9c606912d3ca4eed924`; the large-viewport approval capture is inspected. Compact artifact 12145682813 verifies as `fd68af3280021f816a0ead8150c9196052d40a638a812541d6644bc672e000ad`. The synthetic high-DPI/lower-CPU phone case records 15 ms sampled frame p95 after warming (70 ms initial baseline), 101 peers and 103 scenery sectors; these are native synthetic samples, not hosted or human performance acceptance.

## Remaining release gates

- Exact-head CI, Living Atlas and complete Browser smoke.
- Merge the verified source and explicitly deploy its merged SHA to the existing production project; confirm READY, canonical alias and public entry health.
- Signed-in hosted movement/resize and physical phone/human acceptance remain separate from native test results. No zero-lag, 60 FPS, multiplayer-load or full-overhaul completion claim is made.


## Verified candidate and current-main reconciliation

Candidate `905ad2c8984f5cc63e58b3c9ad29522a7ed95b0f` passes all three workflows: CI 39153118885; Living Atlas 39153118882 (51 passed, 84 existing/project skips); Browser smoke 39153118888 (353 full Chromium, 73 focused and 10 Edge passes, with documented skips). The corrected large-viewport case passes in both native runs. Final Atlas artifact 12146785105 is downloaded, SHA256 verified as `10e7fabced38efc99b54f046dc4b9392d31c279fdbb87afcd49143eac622a032`, and desktop/phone delayed-scenery captures are inspected. The synthetic high-DPI/lower-CPU phone sample records 14 ms warmed frame p95 with 101 peers and 103 scenery sectors.

Before release, main advances to `ebfa6933fe76b67aee204a7969e58effd360e45f` through the separately verified modular correction release #936 and receipt #938. No World application or browser-test file overlaps. The sole merge conflict is the additive TASKS.md introduction; both progress entries are retained. The combined candidate requires fresh quality and native CI before release. The new live modular release must remain included.

## Combined-source timing failure and split-read repair

Combined candidate `7d64a289c29a03886161daba7cf7904bbe85beb2` passes CI 39163519880 and the local full quality gate (10,212 Vitest plus seven Node checks). Unrestricted local parallel checks exhaust the 8 GB container; `VITEST_MAX_WORKERS=1 TURBO_ENV_MODE=loose pnpm check` completes successfully without changing assertions or timeouts.

Atlas run 39163519827 attempt 1 passes 50 cases and fails the existing both-moving peer continuity assertion: one 2.255-tile discontinuity. Its full artifact 12150475837 is downloaded and SHA256 verified as `c0c17f7f97623a4308749cc00a69901424e08806619a551f1df4877e2b63f87f`. Trace inspection and independent review establish a real split-read race: a full scene reads owned version 5, a movement commit advances it to 6, and the scene registration detects that mismatch. The old fallback serializes a partial legacy peer list and disables live presence. Its older scene geometry also rejects a later valid version-6 live receipt with a different authorized sector set. The omitted peer returns after roughly 1,048 ms, beyond the existing 750 ms reappearance history, and jumps forward. Animation frames continue during the absence; this is not evidence of a slow individual canvas paint.

The repository now rejects this exact owned/scene version mismatch before serializing peers and retries the read once with fresh ownership and the same viewport. A second mismatch returns the existing stale-version error; permission, unavailable-data and genuine empty-scene cases do not retry. Full command presentation and idempotent replay use the same bounded reader; the retry never repeats a mutation. Compact movement approvals remain independent of presentation. No peer-authorization guard, prediction bound, disappearance privacy behavior or browser assertion is relaxed.

New regressions first fail on the old implementation (version 5 returned instead of 6; persistent mismatches incorrectly resolve), then pass with current registered peers and retained viewport coverage. Adjacent repository/controller/live-presence suites pass 109 tests, including genuine peer removal, v1 compatibility and exactly zero/one writes on replay/new-command presentation retry. Fresh whole-candidate review, quality and exact-head native gates remain required after this repair. The bounded unchanged-head Atlas diagnostic rerun does not certify the repaired source.
