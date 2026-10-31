# Editor help and field layout release

Status: **LIVE for Owner testing**, October 31, 2026.

PR #998 head `bdcbf92356b56bc663faedc2435404f90c396217` passes all eight applicable workflows and 14 jobs, including hosted desktop/mobile browser checks. Main was unchanged before the expected-head merge `b7a1e4290061815b0f1a8a7a9c9c84c47305b624`; its tree equals the locally tested tree `67a5223ab162a12df9a074cc2de8cbd8a849b9ad`. Local full quality passes 13,902 Vitest tests, seven Node checks, formatting/lint/types and the production build. Independent source review found no blocker.

Target Method reports omit the information button. Editor help sits beside explicit field labels, outside input labels. Numeric inputs/dropdowns have bounded widths, Move destination and distance use a responsive row, and the tag picker keeps help with its selected label. Native coverage checks geometry, compact Move width, Escape/focus restoration and the absent report button while retaining save/authority checks. Definitions, draft callbacks, compatibility and historical delivery metadata remain unchanged.

One Git-backed Production build `dpl_HQ4TTgVouY4QFkzjZVyCBQzgzf7o` reached READY and was explicitly promoted. The canonical alias identifies that exact deployment and merge. All 14 staged and 19 live probes pass, covering public pages, sign-in redirects, protected access and read-only Moderation denials, current header/query/cookie pins, old pins/hosts, cookie clearing and representative portrait hashes. The initial deployment-specific error/fatal scan is empty. The first draft probe used GET for the POST-only Moderation endpoint; the corrected read-only POST probe returns the expected 401 without an application change.

Transition routing `282a572c-3b27-44c3-969f-1913a5519964` allowed old/new compatible hosts and IDs. Final version `1f990d98-00a2-4e2f-a740-3a524bb90e64` retains all nine retirement rules and permits only canonical/team aliases and the new compatible unique/Git hosts and ID. Automatic Git deployment remains locked. No Preview, database migration, content publication or Owner data/history/progression mutation occurred.

Refresh https://aurevane.vercel.app/master to test the current changes. Signed-in Owner, physical-device and gameplay acceptance remain open. New tag-editor requests are collection only until the Owner explicitly says to start; this receipt does not authorize their implementation. No second deployment is required for this documentation.

[Machine-readable receipt](release-assets/2026-10-31-editor-help-layout-production.json).
