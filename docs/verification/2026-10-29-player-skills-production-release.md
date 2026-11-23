# Master editors and Account portraits — production release

Status: **LIVE for Owner testing** at https://aurevane.vercel.app/master. Refresh the app and start a new battle for new captured definitions. Owner hands-on, audio, physical-device, multiplayer and sustained-load acceptance remain open.

## Verified application

All 14 configured workflows and their applicable jobs passed on exact head `e721d465c125614a18f59a5a9663e4674a743f2a`. Actual Browser smoke execution `123784681111` and UI layout review `123784579096` passed, including the formerly blocked native zoom and portrait workflows. Central quality, security and database execution also passed. Earlier successor failures are historical, not release evidence.

PR #991 merged as `c0996fe959a843f52f378feee28bddeadcfead5a`. Fresh main was the unchanged baseline before merge. The merge and tested head have identical tree `54e2a13f6b422d2d29c02ecb6a9b7cf0f8aaa510`, independently confirmed by GitHub comparison and local Git fetch/tree readback.

One Git-backed Production deployment was created: `dpl_8vhURf84Goyo6tzkvk7wtsHJ3pPU`, https://aurevane-azewbbh8a-zeijms-projects.vercel.app. It became READY at `2026-10-30T00:43:39.008Z`. Its source matches the merge exactly, and the canonical hostname independently resolves to this deployment after explicit promotion. Git automatic deployments remain disabled; automatic custom-domain assignment was disabled before building. No Preview or second build was created.

The shared editor, media, targeting, requirements and writing changes, Players labels, Combat Rules cleanup, direct empty relationship creation, and repeatable Account portrait choices are released. Scope and development evidence are in [the implementation receipt](2026-10-29-player-skills-cleanup.md).

## Guarded database update

The repeatable-default-portrait setter was applied before promotion. Its predecessor SHA256 `9ffc9a73566e94698f5203eb1fc2d21a8e91c8e2f70561ce84b1f9f4fbe15de2` matched. A transaction held the relevant tables while comparing every existing character/profile row and all public/private function bodies and authority metadata. The expected setter body alone changed; owner, security settings and ACL remain unchanged. No player's portrait was changed as a release probe, and no disposable SQL fixture ran on production.

Independent postflight confirms successor SHA256 `e071943b4386d565c1d6b73ff0f75494d70562640166e9924d698d77d718ceea`. Anonymous/authenticated execution remains denied; service-role execution remains allowed. Canonical migration `20261029194636_repeatable_default_portrait_choice` stores the exact repository source, SHA256 `41c5b0e0ac196d64176cb773532915da9da7392bc140610b48c6ed6c8c120aca`. The API execution initially recorded guarded wrapper version `20261030004242`; its single history entry was subsequently normalized with an exact expected-source guard. A stalled response was read back before retrying; no duplicate application occurred. The three pre-existing Security WARN groups remain the same.

## Routing and live checks

Routing version `eea9bd0c-01cc-4ebd-906a-19653c2a806d` preserves all nine rules from `5d1c322f-4e5b-48b1-9528-f1513ac65bf6`. Only the candidate hosts and deployment ID were added to four compatible-host/pin allowlists, with every other route field checked before promotion.

Both canonical and unique hosts return 200 for account entry, Manual, Rules and News. Unsigned Master navigation reaches account entry; protected access GET returns 401. POST-only moderation/content/portrait endpoints return 405 to GET, as their implemented method contract requires. The compatible new deployment query pin serves the app; the retired baseline pin still returns 503. Account entry includes Sign in and does not show account-services-unavailable. These are gateway checks, not signed-in Owner acceptance.

Bounded deployment-specific error/fatal scans from READY and again from `2026-10-30T01:15:53Z` through `01:19:08Z` returned no logs.

## Chilled publication

After verified application promotion, all seven full current definitions and their authoring/history metadata were freshly read with an external catalogue CAS token. The deterministic offline binder accepted every exact baseline, with no target draft or drift. The reviewed transaction published six Cinderweaver Skills and Phoenix Wake Essence together: eleven removal nodes now explicitly use Conditional Cleanse, Chilled only, Self.

Independent postflight compares all seven complete private definitions and all seven public catalogue definitions exactly with the reviewed candidates. Current versions are Blistering Heat 9, Cinder Bolt 10, Ember Line 11, Flame Burst 12, Flashfire 7, Scorch 7 and Phoenix Wake 9. Each target is revision 3 and draft sequence 1. The binder recognizes the entire published state as an exact no-op retry; it was not executed a second time.

Postflight totals are 1,281 immutable versions, 298 current publications, 364 records and two drafts. Owner activity since the earlier PR #988 receipt accounts for the changed baseline; that older count was not imposed on current data. The publication transaction verifies preservation of all prior immutable history, other publications/records/drafts/attribution and timing-policy history. Field Remedy and Dawn's Oath v8 were not republished. Historical battle captures remain unchanged.

## Documentation follow-through

PR #990 records the earlier PR #988 release and requires no new application deployment. Its AGENTS conflict with PR #991 is resolved by preserving both records and placing current PR #991 authority first. The earlier operational receipt is explicitly historical. Only documentation differs from the deployed application source; required checks run on the refreshed documentation head before merge. No Phase 5 closure follows from this release.

Machine receipt: [release evidence](release-assets/2026-10-29-player-skills-production-release.json).
