# Master Panel refinements — consolidated Owner requests

Approved implementation scope: Nick's October 26 feedback and instruction to consolidate and make the changes. Existing engine and selected-character authority remain the implementation foundation. Guiding principle: useful administrative power, clear language and efficient UI; remove redundant controls rather than adding administrative ceremony.

## Consolidated acceptance list

1. Editable automatic weather-roll interval, separate from temporary override duration.
2. Compact World Environment layout; no unnecessary whole-page desktop scrolling.
3. Readable temporary-weather status, local expiry and time remaining.
4. Reusable named music library; upload/store songs without immediately assigning them.
5. Delete library songs independently from page assignments, handling songs in use explicitly.
6. Repair clipped/overlapping page-music list rows and selected state.
7. Fixed Music workspace with independently scrolling lists.
8. Compact Staff workspace with internally scrolling directory/editor.
9. Only the Game Owner may edit default Moderator, Content Staff and Event Staff capabilities; enforce actual server authority and live changes.
10. Diagnose/fix slowdown and temporary private-state failures following panel edits, preserving player facts and evidence.
11. Consistent panel alignment; Staff identity/roles/status/actions use identical columns.
12. Compact, aligned Players search, results and selected-player management.
13. Elevation percentages are independent, need not sum to 100; remove total; align validation and actual generation while preserving old captures.
14. Compact Combat Rules layout.
15. Rule-definition lists open in accessible, scrollable dialogs.
16. Plain game terminology, actual names and coherent information hierarchy throughout.
17. Remove the separate Game Content Preview pane.
18. Remove awkward floating publication/version bar.
19. Reorganize Game Content into focused sections; Skills and Resonances have dedicated management subsections with mechanics/text/art/sounds together. Keep the main Discipline tab focused; pairing rows align and use compact controls.
20. Show current images beside upload/replacement controls; selected replacement previews update immediately.
21. Preview previous saved settings before rollback.
22. One Commit Now action saves and publishes complete edits.
23. Fix unusable publication controls; errors and unavailable operations explain the actual cause.
24. Visible labels use Current and Previous, not numeric versions.
25. Media controls live with their relevant content; remove the separate Media tab once covered. Upload, preview/play, replace and remove supported artwork/sounds.
26. Audit and repair nonworking editor controls.
27. Remove Browse finalized assets if redundant; otherwise give reuse a clear, useful presentation.
28. Identity & Relations has its own tab, with readable names and usage lists inline. This supersedes relationship dialogs; rule-definition dialogs remain requested.
29. Verify edited names/descriptions reach gameplay, not only the editor.
30. Verify disabling content changes actual gameplay availability as intended.
31. Check panel actions end to end: write, reopen, authoritative read and intended gameplay effect; success feedback reflects actual outcomes.
32. Review Complete compatibility settings, Duplicate and Archive; move useful tools to relevant sections and remove normal-view implementation clutter.
33. All parameters, effects, units, limits, conditions, costs, cooldowns, targeting and saved definitions match the actual Skill engine.
34. Useful explanations open from a compact circled i; dismiss by Escape/outside click. Remove redundant always-visible subtitles.
35. Unchanged permanent authoring commits create no new draft or publication. Retain historical captures and their referenced media; do not erase provenance or player facts.
36. Owner-only activity list shows who changed what and when; automatically clears weekly. Clear the new feed only, preserving immutable gameplay/publication audits.
37. Remove Eligible labels and Discipline-source dropdowns from player Skill cards while preserving actual eligibility, grant provenance and mixed-source limits. Future grey Locked presentation is deferred.

## Design and implementation decisions

- Reuse the existing React/Next application, typed engine editors, SQL/RPC authority and immutable encounter captures. Do not rebuild another content engine or weaken permissions to make buttons clickable.
- Desktop: bounded shell and workspace; fixed navigation/action areas; independent list/detail scrolling. Responsive small screens and real browser zoom retain accessible controls and reasonable scrolling instead of shrinking text or clipping content.
- Single Commit Now uses a server-owned complete-record operation, stale revision checks and the existing validated publication boundary. No caller-defined actor or SQL. Publication failures never claim success.
- Current/Previous is the presentation model. Nick's older-history deletion wording was not clarified; retain immutable records referenced by battles/builds and show only the latest previous rollback choice. Physical deletion is excluded from this implementation pending an explicit retention decision.
- Existing selected-character authority, protected Game Owner root, live expiry/revocation and special grants remain enforced. Role defaults are persisted and checked by protected operations, not merely hidden UI.
- Existing historical battles retain their captured mechanics. Disabling a Discipline must not destroy character selections or make account entry unusable; the UI must explain the scope of availability changes.
- Media storage and type validation remain server-owned. Existing built-in art/audio must preview as well as new uploads. Reusable music is a separate named library, with explicit handling for assignments when deleting.
- Performance changes require evidence. Initial production logs show Nexus failures at discipline_build; root cause, actual query timing and concurrency are investigated before choosing a repair.
- No unrelated roadmap implementation. Git auto deployment lock remains in place. This request authorizes implementation and verification; any later production deployment must satisfy the existing explicit release gate.

## Verification

Use focused RED→GREEN regressions per behavior, adjacent service/SQL authority tests, actual rendered desktop/mobile/zoom checks, and full repository quality at final integration because this spans persistence, permissions, shared UI and gameplay consumers. Retain configured native CI requirements; discovery is not execution. Record unavailable hosted/human checks plainly. Review the complete branch independently before completion.
