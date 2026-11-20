# PR 1045 release verification

## Verified application checkpoint

Application revision `c378b9b7529b619f7e83d0aa478dafd16207c894` and its proposed
merge into `ef46423c5e4c88566f4970607943efc12157eead` both had tree
`cfa8caea6b2662ea38592b7b77f4dc10eadf2433`. All fourteen hosted workflows passed.
Verify the exact successor including the release guard before merging.

- [Browser Smoke](https://github.com/ZeiJM/Aurevane/actions/runs/44649049262)
  passed 467 responsive Chromium cases and the final 12 Edge cases.
- [Living Atlas](https://github.com/ZeiJM/Aurevane/actions/runs/44649049204)
  passed 19 authenticated story and wardrobe cases and 119 Atlas cases. The current-tree
  screenshot review covered final save warning, wardrobe and dialogue on desktop and
  emulated mobile Chromium, Event authoring, coastal arrivals and weather.
- [World timing](https://github.com/ZeiJM/Aurevane/actions/runs/44649049346)
  passed all 60 desktop cases and three mobile crowd cases. The 40 moving-peer
  observations recorded nine to seventeen visible steps.
- [CI](https://github.com/ZeiJM/Aurevane/actions/runs/44649049210) passed the full
  quality and local Supabase database gates. Physical-device and human acceptance remain open.

## Guarded migration

The canonical baseline was `ef46423c5e4c88566f4970607943efc12157eead` on Vercel
project `prj_ZmH66I1zyOARUt8OXdTl7CN9r18d`, deployment
`dpl_4N3VcdK8tjJU24gXUJ6ST89WXW2K`. Production Supabase had 265 ledger entries
through `20261118171500`. None of the ten PR1045 sources were installed. Refresh the
canonical deployment and ledger before any Production operation.

`apply-aurevane-pr1045.py` pins the verified ledger digest and the source hash
of each migration from the exact PR delta. Its transaction confirms preservation
of characters, existing appearance fields, World and ferry state, NPC and Event
state, and cron. It verifies the ten ledger inserts and new function grants before
commit. The only expected existing-row backfill counts the saved and pending
sprite designs. On a database rebuilt from the 257 canonical predecessor files,
the transaction passed the saved-sprite regression, rejected replay, and rolled
back a deliberately injected change to player XP.

Use **PR 1045 Production migrations** from verified merged main in the existing
protected Production environment. Run `plan` with the exact merged source. For
`apply`, additionally attest the exact READY staged Production source after
checking the project, target and source in Vercel. Keep automatic Git deployment
disabled. Smoke and promote that one build only after preflight and application
checks pass. The procedure applies no earlier migration and changes no cron or
content publication.

## Recovery gate

The live PR #1044 media handler reads sprite versions 1–3. Invoking the exact route
source locally proved it returns 404 for a version 4 portrait, icon and atlas.
A prototype retaining the six changed appearance renderer and manifest modules
reproduced the candidate's output for all fifteen assets tested across versions
1–4. This proves the media path only. Verify full Account and World behavior against
the migrated schema and new saved state before accepting a recovery build. In
particular, the new SQL moves ferry admission and landing coordinates. Check
existing trips, the old and new boarding projections, and return travel on any
recovery source. Preserve the migration ledger and all saved designs.

## Combined release with PR #1046

Nick authorized one rollout of the merged PR #1045 and draft PR #1046 together.
The live predecessor and the 265-entry migration baseline above were confirmed
again before preparing the combined candidate. The rollout candidate is the
reviewed merge of PR #1046. The earlier staged deployment
`dpl_7UThh6RBxbWNt7n4ZepmJ321PJpa` was built from an earlier source. Both earlier
stages are recorded in the [Vercel support case](https://vercel.com/zeijms-projects/~/support/cases/CSE_01HYtwwN5tqH0g85).

The existing protected workflow is now **PR 1045 and 1046 Production
migrations**. It verifies the full source delta back to the live predecessor,
the existing migration ledger fingerprint and all twelve ordered file hashes.
The ten original hashes remain pinned. The additional files are
`20261120100000_event_objective_deadlines.sql` and
`20261120101000_expanded_painted_wardrobe.sql`. The guarded transaction checks
the additional private function grants and preserves event drafts and published
definitions alongside the original player, World, event, ferry and cron state.
The apply dispatch attests the exact staged deployment ID and its merged source.

Before applying, verify successful current-candidate and applicable merged-main
checks. Review native authenticated wardrobe, Event, NPC dialogue, ferry and
World evidence. Check the exact combined staged Production URL serves normal
responses on the home page, static assets, World entry and v3, v4 and v5
appearance media. Reconfirm the canonical deployment and current ledger and
run the protected read-only plan for the same merged SHA.

The canonical predecessor's media reader supports v1–v3. The earlier staged
PR #1045 reader supports through v4. Recovery after new designs or timed
events have been saved requires application source compatible with v5,
persisted Event deadlines, and the migrated ferry schema. Rehearse that
recovery on a disposable migrated database before promotion. Retain the data
and migration ledger in a recovery, including active and pending sprite designs.

## Verified Production release on November 20, 2026

PRs #1045 and #1046 went live together at 12:29 p.m. Trinidad time. The
deployed source is `834b011a8e8788064b47f892427bd364d524cbe8`, with tested
tree `811a2ad0e9d31983f9e6d1c9628a80d64c12eb2a`. All 14 PR workflows and
eight applicable main workflows passed. Hosted automated tests exercised the
signed-in wardrobe, NPC dialogue and World/ferry flows on desktop Chromium and
mobile emulation. [Living Atlas](https://github.com/ZeiJM/Aurevane/actions/runs/44732393858)
and [Browser Smoke](https://github.com/ZeiJM/Aurevane/actions/runs/44732393959)
retain the candidate evidence.

A project-level Vercel rule returned 503 for the exact staging hostname
because the hostname was absent from the retirement allowlist. Routing version
`f40213c6-2121-43e1-b029-90e07d2828b8` added the exact candidate hostname
while the canonical aliases still served #1044. The staged root, favicon, World,
CSS and representative v3, v4 and v5 media returned HTTP 200 afterward. Include
the next verified exact staging hostname in this rule before testing future
production builds. Retain the existing host and pin restrictions and verify the
canonical alias before publishing the retirement rules for a cutover.

The [read-only plan](https://github.com/ZeiJM/Aurevane/actions/runs/44753445712)
verified the exact combined hashes. The [guarded apply](https://github.com/ZeiJM/Aurevane/actions/runs/44773508783)
recorded all 12 migrations atomically and verified preservation of player
state, established recipes and cron. The Production ledger moved from 265
entries through `20261118171500` to 277 through `20261120101000`.
The production-read smoke repeated successfully after the migration and before
promotion.

Vercel promoted the same build, `dpl_4U6SWTGVmGxMWedu7H7KQJgFghB9`.
The [deployment](https://vercel.com/zeijms-projects/aurevane/4U6SWTGVmGxMWedu7H7KQJgFghB9)
serves the canonical World and Account routes and the legacy site alias. Home,
favicon, CSS and sampled v3, v4 and v5 media returned HTTP 200 after cutover.
Routing version `d2356e41-a5ca-4e64-a094-5bd4ee385bfd` preserved all nine
rules and rotated the exact host and pin allowlists. Both #1044 direct hosts
returned the intended retirement response. No error or fatal logs matched the
initial post-promotion window. The existing Vercel support case was closed at
12:31 p.m. after verification.

The disposable PostgreSQL rehearsal preserved 169 table snapshots, rejected
replay, rolled back an injected player XP change and verified that recovery
source tree `f2545af05f7623cbca4105055dc5cbdef5671368` can read v5 designs and
timed Events and retain the migrated ferry behavior. This recovery evidence is
source-level. Signed-in Production gameplay and physical-device playtesting
remain open. The previous production deployment is incompatible with newly
saved character designs and must stay retired.
