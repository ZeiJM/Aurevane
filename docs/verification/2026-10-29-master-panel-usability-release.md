# Master Panel usability — production release

Status: **LIVE for Owner testing** at https://aurevane.vercel.app/master. The Master hold was removed at 2026-10-29T05:11:27.167Z. Automated release checks pass; Owner hands-on, independent listening, physical-device, multiplayer and sustained-load acceptance remain open.

## Verified source and quality

- [PR #986](https://github.com/ZeiJM/Aurevane/pull/986) merged as `32c8b10fb64fd4fb40bbf5e33741af4e99cdf74b`. Production deployment `dpl_GwdeeomzR6G79nqUBD8SU58JcPSF` is READY and the canonical alias points to it.
- The merge tree `8cca34099b0d5ee41c240a20509f64202766676e` exactly matches tested PR head `47c1e4762d82d64b08a5a64a6baa1c801db67786`. All 20 configured exact-head workflows pass.
- Central quality passes 13,464 Vitest tests plus 7 Node checks, complete types/lint/format and a 74-page production build. Actual native execution passes 16 repeated authoring/authority cases, 376 Chromium cases with 284 configured skips and 10 Edge cases with 2 configured skips.
- Git automatic deployments remain disabled. One Git-backed Production build was created; no Preview or minimal file-upload bootstrap was used. Automatic domain assignment is disabled; this release was explicitly promoted.

## Database and protected cutover

The nine unchanged canonical migrations in the [candidate inventory](2026-10-28-master-panel-usability-candidate.json) were applied in one atomic `master_usability_atomic_coordinator` migration (`20261029042805`). The 176,968-byte coordinator SHA256 is `1a8fbccd29a6d3f41827a84557c85f45122475f68b0cf6ec5d20d70b020b98d9`. It checks all expected predecessors, protects existing durable data and unrelated functions, permits only the reviewed 49 Tag identity metadata changes and verifies canonical source history. No authored text publication, gameplay fixture, ban, player stat edit or current-content conversion was issued as a release probe.

Independent postflight matches all 24 changed/new function bodies, owners and ACLs and all 9 canonical migration-source hashes. Both new private navigation tables have RLS and deny direct anonymous, authenticated and service-role table access. Three anonymous REST probes verify that the new character-slot, account-ban and navigation RPCs are recognized by the API cache and denied with 401/42501. Existing Security WARN groups remain unchanged; informational private-RLS/index findings are not performance acceptance.

Master pages/APIs were held with 503/no-store while the public account-entry page remained available. The first 1950-second request drain ran from 2026-10-29T03:55:20.555667+00:00 to 2026-10-29T04:27:50.555667+00:00, followed by a zero-old-client-transaction check. Additive database staging preceded the new app because it uses the new character-slot reader. Compatible candidate hosts AND its deployment ID were allowed before promotion.

After source/READY and 15 held-candidate checks, the exact new deployment was promoted. The old unique/Git hosts and old header/query/cookie pins were retired, with cookie clearing. All 23 retirement probes pass. The final 1950-second old-reader drain ran from 2026-10-29T04:36:18.310972+00:00 to 2026-10-29T05:08:48.310972+00:00, followed by another zero-old-client-transaction check. Only the temporary Master hold was removed; the nine retirement rules remain active as `d19d3cc5-dcf1-434d-a5d2-2160dafd9d83`.

Final checks pass account entry, Manual/Rules/News, Master authentication redirects, access and read-only Moderation API denials, current and retired deployment pins, representative first/last MP3/OGG byte delivery and an old built-in SFX 404. The deployment-specific scan since READY recorded two `STALE_VERSION` content-admission retry errors on `/game/loadout` at 04:34:47 UTC during cutover. The fresh bounded error/fatal scan since Master reopening is empty. These observations do not establish authenticated gameplay acceptance. A real cloud browser renders the production account-entry UI. It has no signed-in Owner session, so production Owner UI acceptance is not claimed.

## Delivered scope and remaining acceptance

The shared six-section ability editor, compact exact effect tags and independent recipients, one shared aim with mixed Ground/unit delivery, full Skill/Essence/Resonance authoring, central full/short tag wording, artwork defaults/custom uploads, neutral 153-group sound pool, new/template Skills with an authoritative eight-Skill cap, reviewed Discipline deletion, current Primary base/name propagation, numeric editing, coordinated Player corrections, active bans, navigation/staff/weather controls and collected-week balance charts are released. Old built-in SFX, their registry/fallback and generators are removed; finalized custom audio and explicit silence remain supported. The detailed requirement map and historical development evidence remain in the [execution receipt](2026-10-27-master-panel-usability.md).

Retained executable definitions, captures and audit/provenance needed by saved gameplay remain stored. New-format conversion and replacement of retained Resonance sequence mechanics are explicit editor operations. YouTube watch pages are not direct audio files. No Phase 5 closure follows from this release.

Next priorities remain Owner panel acceptance, then live reproduction of World loading/traversal interruptions, neighbouring-player presence/remote motion, the rare click-to-move pause and measured concurrent performance. Existing World fixes and native tests do not establish physical-device or multiplayer timing acceptance. See the [prioritized handover](2026-10-27-master-panel-release.md#remaining-aurevane-work-prioritized).

Machine receipts: [production release](master-panel-usability-20261029/production-release.json), [function/source contracts](master-panel-usability-20261029/migration-contracts.json), [local coordinator proof](master-panel-usability-20261029/coordinator-local-proof.json).
