# Complete Master Panel release acceptance

Owner direction: complete the whole requested scope as one candidate, then one consolidated acceptance batch and one production release after passing. Earlier subsystem passes do not close this checklist. No partial panel deployment. Repair acceptance failures and repeat affected checks; preserve the final candidate identity in all receipts.

## Requirements

| ID | Request | Final acceptance status |
|---|---|---|
| 1 | Editable automatic weather-roll interval, separate from temporary override duration. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 2 | Compact World Environment layout; no unnecessary whole-page desktop scrolling. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 3 | Readable temporary-weather status, local expiry and time remaining. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 4 | Reusable named music library; upload/store songs without immediately assigning them. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 5 | Delete library songs independently from page assignments, handling songs in use explicitly. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 6 | Repair clipped/overlapping page-music list rows and selected state. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 7 | Fixed Music workspace with independently scrolling lists. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 8 | Compact Staff workspace with internally scrolling directory/editor. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 9 | Only the Game Owner may edit default Moderator, Content Staff and Event Staff capabilities; enforce actual server authority and live changes. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 10 | Diagnose/fix slowdown and temporary private-state failures following panel edits, preserving player facts and evidence. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 11 | Consistent panel alignment; Staff identity/roles/status/actions use identical columns. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 12 | Compact, aligned Players search, results and selected-player management. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 13 | Elevation percentages are independent, need not sum to 100; remove total; align validation and actual generation while preserving old captures. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 14 | Compact Combat Rules layout. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 15 | Rule-definition lists open in accessible, scrollable dialogs. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 16 | Plain game terminology, actual names and coherent information hierarchy throughout. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 17 | Remove the separate Game Content Preview pane. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 18 | Remove awkward floating publication/version bar. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 19 | Reorganize Game Content into focused sections; Skills and Resonances have dedicated management subsections with mechanics/text/art/sounds together. Keep the main Discipline tab focused; pairing rows align and use compact controls. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 20 | Show current images beside upload/replacement controls; selected replacement previews update immediately. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 21 | Preview previous saved settings before rollback. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 22 | One Commit Now action saves and publishes complete edits. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 23 | Fix unusable publication controls; errors and unavailable operations explain the actual cause. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 24 | Visible labels use Current and Previous, not numeric versions. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 25 | Media controls live with their relevant content; remove the separate Media tab once covered. Upload, preview/play, replace and remove supported artwork/sounds. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 26 | Audit and repair nonworking editor controls. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 27 | Remove Browse finalized assets if redundant; otherwise give reuse a clear, useful presentation. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 28 | Identity & Relations has its own tab, with readable names and usage lists inline. This supersedes relationship dialogs; rule-definition dialogs remain requested. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 29 | Verify edited names/descriptions reach gameplay, not only the editor. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 30 | Verify disabling content changes actual gameplay availability as intended. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 31 | Check panel actions end to end: write, reopen, authoritative read and intended gameplay effect; success feedback reflects actual outcomes. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 32 | Review Complete compatibility settings, Duplicate and Archive; move useful tools to relevant sections and remove normal-view implementation clutter. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 33 | All parameters, effects, units, limits, conditions, costs, cooldowns, targeting and saved definitions match the actual Skill engine. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 34 | Useful explanations open from a compact circled i; dismiss by Escape/outside click. Remove redundant always-visible subtitles. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 35 | Unchanged permanent authoring commits create no new draft or publication. Retain historical captures and their referenced media; do not erase provenance or player facts. | PARTIAL: unchanged-save no-op implemented; physical older-history retention differs from Owner request |
| 36 | Owner-only activity list shows who changed what and when; automatically clears weekly. Clear the new feed only, preserving immutable gameplay/publication audits. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |
| 37 | Remove Eligible labels and Discipline-source dropdowns from player Skill cards while preserving actual eligibility, grant provenance and mixed-source limits. Future grey Locked presentation is deferred. | Implementation reviewed; local batch evidence recorded; exact-final CI and hosted acceptance pending |

## Explicit discrepancy to resolve before claiming full completion

The Owner requested only current and previous history with older records removed. Current UI hides deeper history, but SQL retains it. Do not mark this requirement complete. Trace current pointers, captured builds/battles, references and provenance dependencies before selecting a safe retention implementation; do not blanket-delete retained definitions.

## Consolidated batch after source freeze

1. Formatting, lint, types, all required unit/service/core/database suites and production build.
2. Actual browser acceptance across all Master sections, Skill consumers, desktop/mobile, short viewports and genuine browser zoom where required. Discovery is not execution.
3. Real authoring write → authoritative readback → gameplay consumers for text, availability, art/audio and mechanical definitions; stale writes, pending edits and rollback remain covered.
4. Independent final review and exact-candidate GitHub required workflows.
5. One compatible application/migration release, canonical production source/readiness and signed-in acceptance evidence. Do not infer gameplay success from deployment readiness.

## Source audit findings

Gameplay publication readers use current catalogue definitions for Skill bodies, and the active Discipline DTO overlays current names/summaries/media while retaining committed mechanical pins. Disabled current Skills remain readable for safe removal, and new equip validates current availability. Commit uses the existing selected-character server authority, revision/CAS locks and atomic publication boundary. Identical restored drafts retain original provenance; unchanged committed bodies are no-ops. Media controls, dedicated content tabs, help dialogs, role defaults and weekly feed are present in the candidate. Source review is not a substitute for the running acceptance batch or signed-in production checks.

The physical-history discrepancy is confirmed in SQL: published definitions have an UPDATE/DELETE rejection trigger, publication/reference/media/attribution tables reference retained versions, and historical consumers resolve exact pinned versions. A blanket purge would require changing this safety contract. Current/Previous UI restriction and no-op saves are implemented; unrestricted deletion is not claimed.
