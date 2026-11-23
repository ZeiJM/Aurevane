# November 5 Items production release

Verified live for Owner testing at https://aurevane-rpg.com on November 5, 2026. Items, Master edits and new battles are reopened. Refresh the game and start a new battle for the new consumption policy. Human gameplay acceptance remains open.

## Source and application

PR #1017 merged as `6fafa6608a4ac4ec3185d9ed3c220d591c3d743f`, identical to the tested feature tree `85fc5b22b1f28f51b6701ea31721b95824f663ca`. All 19 source workflows passed on `657b10a87964fa9b7741504db2d24b0ab634c7ac`, including the full quality gate and native Browser smoke. The historical DB timeout passed CI at its unchanged limit. PRs #1013 and #1016 were reconciled and merged as release documentation only; final application source is `0fd6cb6144da1624e88d3c58a24f224693f541b2`, tree `02f4e9429d466fad8a78f36efdf4f38d222b0a85`.

One staged Production build, `dpl_D79wgdgrFWWjf3kom6sfypujPk6F`, was verified READY and promoted without rebuilding. Both canonical home responses identify that deployment. Automatic Git deployments and custom-domain auto-assignment remain disabled. The Supabase Git integration's existing remote/local migration-history mismatch remains a separate recorded failure; it was not bypassed by rewriting history. The four reviewed changes were installed through guarded additive migrations.

## Protected cutover and database

The temporary hold covered new admission, equipment and Master authoring while existing battle command routes stayed available. Retirement was verified at 14:57:00.345143 UTC; the 1,950-second drain ended at 15:29:30.345143 UTC. The database confirmed the deadline passed and zero older client transactions before DDL. All four reviewed migration bodies remain byte-exact inside preservation wrappers. Guards retain existing function owners/ACLs, unrelated function bodies and all rows of 12 protected tables, including inventory, characters, builds, drafts, publications, sources and frozen battles. A connector transport problem delayed stock installation; absence/rollback was confirmed before the compact equivalent guard wrapper succeeded. No constraints, test limits or authority gates were weakened.

Hosted migrations: `20261105153401_item_type_search`, `20261105153417_targeted_item_grants`, `20261105163328_consumable_item_stock_settlement` and `20261105163403_item_equip_requirements`. See the [exact SQL and hash map](release-assets/2026-11-05-items-release-progress.json).

The ordinary initializer had already registered the three reviewed source v4 successors. Exact bodies and current revisions were verified, and the normal trusted Commit RPC published Emberbrand, Vulnerability Oil and Ward Sigil Scroll at v5 in one transaction with fresh catalogue tokens and revision checks. Exact readback passes. All prior immutable versions, unrelated records/publications, three Owner drafts, inventory, characters and frozen battles passed preservation guards. No other Item was republished; no real grant or test stock mutation was issued.

## Postflight and availability

Safe production checks confirm capture schema2 with consumption policy1 and exact owned quantity3, current Item version5, fail-closed configured equip requirements, private helper/table protections and the enabled settlement trigger. No consumption receipts were created by release probes. Actual accepted stock consumption, miss/retry/Controlled/Reversal/delayed/terminal cases and requirements were covered by the pre-release core/SQL/native suites, not fabricated as hosted gameplay evidence.

All 16 canonical/authority/retirement safety probes pass: 14 exact expected statuses, plus two obsolete custom-domain header/query pins returning the verified current deployment instead of503. Neither old pin returned retired code. Old host/cookie retirement is503; current home/Manual are200, guest Items/Master pages redirect, private APIs deny guests, unsupported battle GET is405, current pins work, and www redirects308. The initial deployment-specific error/fatal scan from16:34:03 through16:39:45.521 UTC is empty.

Only temporary hold `45a07761-caca-49ad-9017-a665fb051017` was removed. All nine original retirement identities and both custom hosts remain under routing version `78132fc0-e779-4dda-bf7b-7ea8c5773e28`. The new Item behavior is open for testing; no further application build is needed for this documentation receipt.

Use the [Owner checklist](2026-11-05-items-panel-followup.md#owner-checklist-after-a-separately-authorized-release), including distinct consumables, stock decrement/exhaustion and manual re-equip, cap reset, Imbued Support restoration, equip requirements, editor persistence and full effect summaries. No physical-device, multiplayer feel, signed-in hosted gameplay, sustained-load acceptance or Phase5 closure is claimed.
