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

Production remains pending. Record the full recovery rehearsal, main verification,
staged build, protected migration receipt, canonical promotion and health here.
