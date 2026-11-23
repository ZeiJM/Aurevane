# November 3 combat and Quality Point Items release

**Live for Owner testing:** https://aurevane.vercel.app. Refresh and start a fresh battle. Complete a pending/active battle before reopening Items if the one-time starter delivery is deferred. All human acceptance remains unchecked in the [96-case checklist](2026-11-03-owner-combat-items-checklist.md).

## Source and deployment

- PR [#1008](https://github.com/ZeiJM/Aurevane/pull/1008), merge `0af2782adea552ad7d2b18f7159fb8200356ab24`.
- Tested head `1f180ceec0643ef44f384247a75adf599b303c4e`; merge has the identical tree `d3fe7ef81ec77fd722ddd29f1b9a7efc0d005e60`.
- Exactly one Production build: `dpl_DQpfKyFbeNKXEMxBqAMHnh76dfkE`, READY, actual Git source verified against that merge. Unique host: `aurevane-2nz6k8lco-zeijms-projects.vercel.app`.
- The existing build was explicitly promoted without rebuilding. Canonical alias readback names the same deployment.
- Maintenance observed at 21:09:15.486 UTC; removed by routing promotion at 21:21:29.485 UTC (17:21 Trinidad), approximately 12 minutes 14 seconds. All nine original retirement rule identities remain; only the temporary maintenance rule was removed. Compatible host/pin allowlists name the new release.
- Git automatic deployments remain disabled in `apps/web/vercel.json`. Automatic domain assignment was explicitly disabled again after promotion; the normalized project response does not expose that field for independent readback.

## Delivered behavior

The combined release includes Barrier damage-event activation, Self/Anyone damage and uniform damaging tile colors, Move elevation/LOS in shared Range & Area editors, battle/round usage limits, automatic image fitting, current support artwork, exact captured Summon skill names and owner accent colors. Reckless/Fortified default pairs and whole-ability Requirements are corrected, repeated Tag teaching text is deduplicated, and fresh Open Wound applies Bleed.

Items use six equipment positions with a hard server-validated 100-QP cap. Six inventory categories each hold 40 positions, with Gear stacks of one and other stacks up to 99. Weapons supply Basic Attack; a granted Support competes for the existing slot. Held supplies appear under singular Item after Basic Attack, with thumbnails, AP, uses and the shared information reader. Uses refill in a new battle without consuming owned quantities. Two-handed gear occupies both hands. The [47-item reference](2026-11-03-starter-items-reference.md) lists every starter, its QP, art, effects, AP and uses, including Movement +1/+2 boots and a 50-QP two-handed sword.

Master Item editing, versioned media/publication, audited selected-character test grants, ownership checks, equipment battle locks and frozen captures are included. Later CI corrections cover Guided Fundamentals with equipped actions, pinned Item timing, Combat Rules Stat Bonus dependencies, normal Basic Support changes for future battles, aligned Arsenal headers and post-commit Players focus. Shops, currency, crafting and companion mechanics are future work; noncombat sample items demonstrate their categories.

## Verification

All 20 configured exact-head workflows completed successfully. Central CI [41698373254](https://github.com/ZeiJM/Aurevane/actions/runs/41698373254) passed 16,397 Vitest checks, seven Node checks, formatting, lint, eight-package types and the production build. Browser [41698373236](https://github.com/ZeiJM/Aurevane/actions/runs/41698373236) passed 16 repeated authority cases, 383 Chromium cases and 12 Edge cases; 286 Chromium and two Edge configured skips are recorded as skips. Battle Session DB passed 17 actual PostgreSQL Item admission/starter/catalogue/nested-loadout race schedules and authenticated HTTP coverage. UI passed 1+110+1 cases with 61+2 configured skips. Atlas passed 55 cases with 86 configured skips.

Two unchanged-source attempts required bounded retries: UI failed before tests on an occupied disposable database port; Atlas initially recorded seven positive motion samples against its existing nine-sample requirement, while measured displacement, speed, direction and projection bounds remained valid. One evidence-reviewed retry of each passed. Initial failures remain in the [machine-readable receipt](release-assets/2026-11-03-combat-items-production.json) and [implementation decisions](2026-11-03-combat-items-decisions.md); no threshold, timeout or assertion was relaxed. Human performance acceptance remains open.

All 112 staged probes and all 112 canonical probes passed: 96 exact-source media hashes (94 Item art/thumbnail files plus Pilfer and Invocation v02), public entry/Manual, guest redirects, three unauthorized API denials and compatible/retired deployment pin cases. The Master probe used a harmless read-list POST; unsupported GET is not an authorization test. These are live public/guest probes, distinct from signed-in CI and unchecked human live gameplay.

The initial deployment-scoped warning/error/fatal log scan from 21:07:00 to 21:22:02.909 UTC returned no matching logs. This bounded scan is not a sustained-load or human acceptance claim.

## Applied migrations

All eleven exact reviewed source files were applied individually, with source SHA-256 and existing content/history guards. Hosted timestamps differ from source versions; the pre-existing migration-history drift was not repaired or broadly pushed.

| Source version | Migration                                    | Hosted version |
| -------------- | -------------------------------------------- | -------------- |
| 20261103060943 | automatically_fit_finalized_content_images   | 20261103211034 |
| 20261103075225 | quality_point_item_inventory                 | 20261103211155 |
| 20261103085413 | passive_stat_bonus_tag_identity              | 20261103211159 |
| 20261103093018 | item_service_authoring_adapters              | 20261103211202 |
| 20261103100949 | item_unavailable_reads_and_nested_lock_order | 20261103211204 |
| 20261103110843 | battle_equipment_admission                   | 20261103211206 |
| 20261103120305 | item_domain_conflict_codes                   | 20261103211208 |
| 20261103121351 | battle_creation_frozen_replay                | 20261103211210 |
| 20261103130149 | discipline_item_lock_order                   | 20261103211212 |
| 20261103133837 | starter_item_initialization                  | 20261103211214 |
| 20261103173639 | preserve_saved_support_during_battles        | 20261103211216 |

All 201 prior migration-history rows retain their exact row hashes; the resulting history has 212 rows. Four new private tables have RLS enabled and no direct anon/authenticated/service-role table privileges. Sixteen public functions are service-only; eleven private helpers are not exposed. All 27 expected function signatures exist, and all 17 existing ownership/ACL/search-path/security-definer tuples are preserved.

## Deliberate current publications

One guarded transaction called the normal trusted Commit operation for all fourteen reviewed records after checking current bodies, revisions, floors, highest versions, absence of drafts, actual Owner authority and a fresh catalogue token. Exact current definitions, versions and revisions were read back afterward; the operation was not replayed after an ambiguous tool response.

| Record                             | Version |
| ---------------------------------- | ------- |
| basic.invocation                   | 6 → 7   |
| bastion.stalwart-strike            | 6 → 7   |
| cinderweaver.scorch                | 7 → 8   |
| essence.aetherist.aether-nova      | 9 → 10  |
| essence.farstrider.deadeye-barrage | 7 → 8   |
| frostweaver.brittle-ice            | 8 → 9   |
| frostweaver.shatter                | 9 → 10  |
| ravager.desperate-execution        | 7 → 8   |
| ravager.open-wound                 | 7 → 8   |
| shadehand.execution-cut            | 8 → 9   |
| stormsinger.conductive-bolt        | 9 → 10  |
| tidecaller.crushing-wave           | 8 → 9   |
| wildwarden.close-quarry            | 7 → 8   |
| wildwarden.pursuit-shot            | 6 → 7   |

Thirteen records correct effect-level Requirements, including removing Open Wound’s same-effect Bleed gate. Invocation changes only its artwork selection to use the new generic sigil default; its icon/audio/VFX and gameplay are preserved. Pilfer already used the default selection, so its new versioned default image required no extra content publication. Old uploaded assets and history remain stored.

The post-publication audit scanned 303 active publications and found zero remaining effect-level Requirements violations. All 1,453 original immutable versions retain their exact aggregate hash; fourteen new versions bring the total to 1,467. All three unrelated drafts retain their exact hash; the 304 physical publication pointers retain their count. The atomic publication guard also preserved unrelated records/pointers, old attribution, timing policy and timing history.

## Existing operational notes and remaining acceptance

Supabase advisor comparison introduces no WARN or ERROR group. RLS-without-policy INFO increases from 84 to 88 for the four deliberately private tables; unused-index INFO increases from 21 to 22 for the new inventory identity index; unindexed foreign-key INFO stays 56. The three pre-existing warnings remain: [mutable search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [authenticated definer execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Existing Realtime access is preserved; no unrelated settings or warning cleanup was included.

Human gameplay, balance, art preference, physical-device, listening, multiplayer feel and sustained-load checks remain open. No Phase 5 closure is claimed. Use the [complete checklist](2026-11-03-owner-combat-items-checklist.md), [starter reference](2026-11-03-starter-items-reference.md), [decisions](2026-11-03-combat-items-decisions.md), and [literal chronological rulings](2026-11-03-combat-items-rulings.json).
