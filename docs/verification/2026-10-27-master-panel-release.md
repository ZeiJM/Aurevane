# Master Panel workspace — production testing handoff

October 27, 2026. Live for Owner testing at <https://aurevane.vercel.app/master>. Refresh the game before testing. This is automated release evidence, not human acceptance.

## Release identity

- [PR #984](https://github.com/ZeiJM/Aurevane/pull/984), tested head `e5f6ec43b0ee53446b229ec0cbbfca7974c0fdc4`.
- Actual CI checkout `9f661514411e09d0b5c35b88057f0384d4dacfe6`, candidate and production merge share tree `74af1e34b405fd059f2bef89713890d5a30292f6`.
- Merge `0895e0b76adbe7805cd7b9c4559dc5eb117fcb09`; parents are previous main `d20bb6c079cc6d8210426d0bbcb482aae01eed71` and the tested head. No concurrent source reconciliation was needed; #983 sizing is preserved.
- One production deployment, `dpl_3VF7cNextXyhMffHL5F38hkTTCE6`; no preview. Actual build logs confirm checkout `0895e0b`, and canonical lookup agrees with READY and the intended source.
- App READY at20:24:36.897UTC. Master hold removed at21:00:34.958UTC, **17:00:34 Trinidad**.
- Previous live baseline was `d20bb6c` / `dpl_5MNszWLhSQXrJC9ub7zLzWWXNGhM`. Its unique/git hosts and old pins are retired.
- Git automatic deployments remain disabled. This subsequent receipt changes documentation only and does not require another app deployment.

## Actual completed verification

All **19 workflows** succeeded on the tested head. They comprise25successful individual check rows plus the skipped Supabase Preview integration row; check rows are not extra workflows. Quality passes13,186Vitest tests, formatting, lint, all configured types, production build and worker boot. The prior local AI timeout concern is closed by the complete passing CI suite.

The [completed Browser smoke run](https://github.com/ZeiJM/Aurevane/actions/runs/40553696822), actual execution job122366322776, passes all standalone component stages and these native suites:

| Suite                                   | Passed | Configured skips |
| --------------------------------------- | -----: | ---------------: |
| Repeated Master authoring and authority |     16 |                0 |
| Full desktop/laptop/mobile Chromium     |    376 |              284 |
| Edge keyboard and Support Actions       |     10 |                2 |

The660Chromium and12Edge discovered entries are not passed-test totals. Native coverage includes authenticated selected-character authority, genuine browser zoom, layout, publication and recovery. Local development selections overlap and are not added to these totals.

## Protected cutover and database proof

Master pages/APIs were held with503/no-store while ordinary entry remained available. The app was upgraded first. The existing five retirement rules were preserved; four project-wide rules then allowed only the four actual current hosts and exact current header/query/cookie deployment IDs. All18pre-upgrade HTTP probes passed, including cookie clearing and rejection of old hosts and arbitrary old pins.

Final verified retirement was followed by the conservative1950-second drain, from20:26:13.268UTC through20:58:43.268UTC. At20:58:54.598UTC the live database reported zero pre-retirement client transactions. Canonical source/READY and the unchanged10-rule version were rechecked before DDL.

One successful `master_workspace_atomic_coordinator` submission applied the four unchanged canonical migrations. The193616-byte wrapper has SHA256 `4bff868d7b510ca5fad5600397e6fa04af1c09a43c8ad491d8ebf7903c759904`. It asserts30full predecessor function hashes, protects durable rows and unrelated function bodies/owners/ACLs in a consistent transaction snapshot, converts role defaults once and verifies canonical history. No authored catalogue, player grants, bans, stat edits or gameplay fixtures were issued as release probes.

Independent postflight matches all53changed/new function bodies, owners and ACLs; all four original migration-source digests match. There are zero unsafe custom40001domain RAISEs. All five new private tables have RLS and deny anonymous/authenticated direct reads. Four real anonymous REST RPC probes return401/42501, verifying API-cache recognition and denial. Role defaults are revision2: Moderator→Moderation, Content Staff→Game Content, Event Staff→Events.

The new private RLS/no-policy informational findings are expected because access is through protected server RPCs. Security WARN groups remain the same three existing kinds; no new warning group was introduced. Performance remains informational; the four newly created unused-index findings are not load evidence or a reason to remove indexes.

Only the hold was removed. The nine retirement rules remain active as `ddc515c7-378c-43fd-b53e-e0f4b9edc7d8`. All16post-opening host/pin checks pass; entry and Manual return200, actual `/master/combat-content` redirects anonymous users to `/`, access API returns401, and an unauthenticated read-only Moderation POST search returns401. The bounded deployment-specific error/fatal scan since app readiness is empty. Initial probe assumptions were corrected to use the actual content path, POST-only moderation method and exact five-new-table inventory; no runtime repair was needed.

Machine receipts: [production-release.json](master-panel-20261027/production-release.json). The earlier implementation/source review and requirement map remain in [the workspace ledger](2026-10-27-master-panel-workspace.md).

## Delivered scope and limits

The compact responsive workspace, continuous content browser, account-scoped refresh recovery, contextual Details, full named Skill/relationship popup editors, real media previews, explicit account Discipline grants, one-relationship override, page-based role defaults, Moderation, stable Players/allocation corrections, combined Events menu, wider Combat Rules timing list, compact Music and Usage & Balance are released. Integrated tests also found and repaired lost baseline reversions during pending saves, missing new-Skill associations and popup-close/save races.

- YouTube watch-page URLs remain unsupported for background audio. The panel rejects them accurately; upload audio or use a direct audio URL.
- Authoring History/rollback is removed. Immutable definitions still required by saved builds, captures, media and provenance remain stored; no physical purge is claimed.
- Weekly battle analytics collect only qualified new production receipts. Legacy provenance and AI-by-Discipline matchups remain unavailable; current roster/equip metrics are separate from actual battle usage.
- Owner save→reopen→gameplay testing, subjective layout acceptance, physical devices, multiple real players and sustained load/performance acceptance remain open. Passing automated checks is not proof every lag symptom is resolved.

Future releases must stage a compatible candidate and allow **both its hosts and deployment ID** before promotion. Preserve the old-reader retirement guards and never restore an incompatible reader after exceptional publication. No P5 closure follows from this release.

## Remaining Aurevane work, prioritized

1. **Owner panel acceptance:** test current saved text/art/audio and enabled-state effects in fresh gameplay, Skill/relationship edits, grants/revocation, role pages, Moderation and legal stat correction. These are implemented fixes awaiting hands-on acceptance. Reproduce any remaining lag before choosing another fix.
2. **World map stability:** unresolved loading stalls, valid ground reported unavailable, blocked traversal and direction-change cases need live reproduction. Existing UI, heartbeat, scenery/cache and earlier arrival fixes are shipped baselines, not missing implementations.
3. **Neighbour presence and remote motion:** validate arrival/departure/reconnect and delayed frames with multiple real players. [#933](https://github.com/ZeiJM/Aurevane/pull/933) is closed unmerged as superseded. [#970](https://github.com/ZeiJM/Aurevane/pull/970) is merged diagnostic/fixture work; it does not prove all live motion reports are resolved.
4. **Rare click-to-move pause:** capture the remaining specific interruption and correlate request/approval, animation-callback and render timings. Earlier three-step/arrival fixes have shipped; this residual symptom remains unverified.
5. **Measured performance:** investigate request duplication, long-tail navigation/render work and concurrent load under [#439](https://github.com/ZeiJM/Aurevane/issues/439). Keep repaired persistence/no-op/conflict paths; sustained-load acceptance remains open.
6. **P5 and later roadmap:** finish W2 navigation/destination clarity, W3 NPC dialogue/quests/services/authored places, W4 power-choice/eligibility clarity, Drift and playtest sign-off. [NPC #765](https://github.com/ZeiJM/Aurevane/pull/765) remains draft with dependency reconciliation; [settlements #681](https://github.com/ZeiJM/Aurevane/pull/681) remains draft pending matching reviewed paintings; [creative #373](https://github.com/ZeiJM/Aurevane/pull/373) is a separate unmerged package. Later work includes co-op/parties, expeditions/bosses/loot, ranked seasons/tournaments, content/equipment, social/guild/economy systems, art/audio and alpha security/exploit/load gates. Existing solo traversal, duels/spectation, base roster, profiles and presence are already delivered foundations.

This is remaining-work reporting, not implementation of those later systems. Repository/issue states were freshly read on October27 for the handoff.
