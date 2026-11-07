# Item preview corrections production release

Verified live for Owner testing at https://aurevane-rpg.com on November 7, 2026 at 6:35 a.m. Trinidad time.

The Imbued Technique tab shows its own artwork. Basic and imbued Support previews show short purpose text that can be edited in Master. Equipment and inventory names wrap at word boundaries. The replacement comparison names the equipment being removed, and the compact slot picker places stock beside the name and hides choices outside the available QP budget.

## Application verification

PR #1023 merged as `3efadd14ff7bb17d9b4dc4beb1990e8e7040dad2`. The merge has the same tree as the tested PR. The required PR and main application checks passed. Full Quality passed 7,171 Core, 651 Database and 8,951 Web tests and the production build. Browser coverage passed the nine-size Item layout checks, technique image changes and Master authoring roundtrip, followed by 16 repeated authoring, 383 Chromium and 12 Edge cases with the configured skips. One Browser retry followed cancellation during artifact upload. One main Discipline authority retry followed a runner port conflict. The separate Supabase Preview integration reports the existing migration-history mismatch.

One production build `dpl_CBPxHC4kMSnbSmRYsGNfKFTTexJT` serves the verified source. The deployment and domain assignment locks were verified during the controlled release.

## Content and production verification

After all 25 retirement and hold probes passed, the database clock recorded retirement at `2026-11-07 10:00:08.422549+00` and the 1,950-second drain ended at `2026-11-07 10:32:38.422549+00`. The fresh post-drain check found zero older client transactions, exact predecessors and zero targeted Owner drafts.

The reviewed additive description grammar was installed as hosted migration `20261107103304`. The independently reviewed transaction registered the four audited source10 bodies. Emberbrand, Stormcaller Staff and Twinfang Blade received purpose-only publication11 successors through ordinary Commit CAS. Tower Shield uses source10 fallback. All twelve preservation checks passed. Readback confirmed the exact current and historical bodies, artwork, requirements and QP values, private grammar ACL, stock protections and global timing policy11.

The temporary hold was removed. Nine retirement guards and both custom hosts were verified. All 21 final production probes passed, including the four exact WebP assets, current deployment markers, private guest API responses and retired pins. The initial error and fatal log scan had zero matches.

[Machine release record](release-assets/2026-11-07-item-preview-corrections-release-progress.json) · [Reviewed transaction](release-assets/2026-11-07-item-preview-corrections-register-and-publish.sql) · [Independent SQL review](release-assets/2026-11-07-item-preview-corrections-sql-review.md)

These checks use full CI and read-only production probes. Owner gameplay acceptance remains open.
