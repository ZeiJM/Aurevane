# Task 11 recovered fix1 — sole combined specification and quality review

Reviewed October 25, 2026. This is the sole replacement scoped review of the recovered repair/integration, not a repeat of the accepted full Task 11 review. No helper/reviewer agents were dispatched.

**SPEC: NOT COMPLIANT pending I1 below. QUALITY: CHANGES REQUIRED.** New findings: **0 Critical / 1 Important / 0 Minor**. Separately retained: **1 inherited Minor**, the Vite native-config warning. Bootstrap repair, operational-browser follow-through and recovery-evidence preservation are addressed within their stated limits. Actual-main ancestry is present, but the combined mobile Technique/eligibility presentation has new breakage.

## Frozen scope and authority

- Workspace: `/workspace/scratch/e5db2ba73c1a/aurevane-master-complete-20261025`.
- Accepted fix base: `0c346614f3f228d2307f3c8b74782d58568e4d02`, accepted tree `610f1ebaf072cd69df3ba3c259f9307d3d73d403`.
- Reviewed HEAD: `b2af6e4ef80cdfa12628a5edc589d78c75daa4c2`, tree `6dd193521a6fa30fb28eed9465c46ad73a5544ce`.
- Source merge: `3e62cad722049bb74005953d32d31fd7bfd1ec2f`, including actual-main parent `14df01a2c42d4cb36bd6c99d21372a1c51084164`. Read-only local ancestry check exits 0. Final checkpoint-to-HEAD changes are report/receipts only.
- Read the original Task 11 brief, recovery brief, fix1 brief, binding global constraints, October 25 report append and prior full-review limits. The newer recovery brief governs main freshness and browser identity. Task 10 remains at 5/5; this is Task 11 repair round 1/5; Task 12 is not accepted by this review.
- Primary package: `master-11-recovery-scoped-0c346614-b2af6e4.diff`, 294250 bytes, SHA256 `ad602d18b20693af5d6a0454932f8f97461b5e032f54d59a1e0eef1bc99d0aab`. Read its remerge repair, all 20 overlap deltas and evidence follow-through in bounded chunks. Verified all 200 manifest paths have identical Git blobs at reviewed HEAD and supplied actual main; their approved unchanged implementation was not broadly re-reviewed.
- Complete fallback package hash/size checked: 3246453 bytes, SHA256 `ada8cd7ddc01f7fb620569e4f086dadf89d39ee70be5aa2b76b32cbf7db9788a`. No need to repeat its full source review. Remote equivalence/fresh-fetch claims are root-supplied evidence, not a remote operation by this reviewer.

All source file references below are relative to the frozen workspace.

## New Important finding

### I1 — Fixed mobile Technique rows obscure shared Skill names behind artwork

**Locations:** `apps/web/src/components/character/character-skill-build-panel.module.css:1504–1536`, especially the two fixed grid rows/hidden overflow and single `minmax(0, 1fr)` card row; preserved eligibility styling at `:1630–1653`. Actual producer: `apps/web/src/components/character/character-skill-build-panel.tsx:650–741`.

The merged mobile layout assumes the compact card has one artwork/name control. Master also adds a second label and select whenever `entry.eligibilityGrants` is present. The new mobile CSS gives the card a single flexible explicit row, keeps artwork at up to 2.6875rem, and constrains the entire Skill grid to two fixed rows. The eligibility label becomes an additional row and consumes space without a mobile budget for the first label's artwork and name. The retained eligibility artwork adjustment only applies at widths >=821px and heights >=601px.

**Reproduction performed once:** mount the actual frozen `CharacterSkillBuildPanel`, its CSS and production global CSS at 390×844, using eight current Vanguard Skill definitions, each with active Vanguard/Lifebinder eligibility grants, an empty loadout and a mixed build. In Chromium **153.0.8010.0**, each card is 117.546875px tall; its selector is 44px tall. The screenshot visibly shows artwork painted across Skill names (including Forceful Strike, Guard Break and Sweeping Strike) and the Eligible Discipline labels. This is not a hypothetical missing test or an assertion inferred solely from CSS. The selectors remain inside their cells and hit-test correctly; do **not** describe this as all selectors being inaccessible. The defect is the obscured Skill identity/overlapping chooser content in a required mobile workflow.

Evidence: `/workspace/scratch/e5db2ba73c1a/task11-review-technique-eligibility-390.png` (SHA256 `499dbac0c084e9d50219b7b395cd05a87bb20f683b64fd795027ec2beec5bf5b`). Root independently viewed and confirmed the visible overlap. This is the interaction between changed main layout and preserved Master eligibility, not a broad review finding against unchanged main, and not the separate inherited desktop Nexus artwork gate.

**Requested correction:** explicitly budget the artwork/name and eligibility control together in the mobile card, or use an equally clear reachable eligibility placement compatible with the approved mobile split pane. Preserve real current eligibility choices, selected-choice submission, touch preview/equip behavior and CAS. Add a meaningful actual-component mobile check with populated eligibility grants; ensure names, artwork and the eligibility control do not overlap. Retain the newer mobile tabs and image-free lower preview. Do not shrink/remove the identity or control merely to fit an empty legacy fixture.

The existing `character-skill-build-reconciliation.test.tsx:87–137` checks static markup for one shared Skill; it cannot establish this CSS geometry. The current-main management browser fixture supplies legacy entries without `eligibilityGrants` (`apps/web/scripts/management-mobile-browser-regression.mjs:39–44`). The nine operational browser cases cover Rules/World/Music, not this integration boundary.

## Numbered recovery gaps

### 1. Native bootstrap — ADDRESSED

`apps/web/src/lib/master-panel-access.ts:1–9` is exactly the pure supplied-snapshot membership predicate. `master-panel-shell.tsx:7–8` imports the runtime predicate from that client-safe module and keeps server types type-only. `server/master/staff-access.ts:1–4` retains `import 'server-only'` and imports/reexports the same function; `:234–249` still rereads live access before checking protected capability. Store `supabase-staff-access-store.ts:1–3,183–197` retains the server-only/RPC boundary. No SQL authorization or selected-character implementation changes occur in the repair.

The standalone fixture previously imported an RSC presentation component into a browser bundle while substituting its authenticated shell boundary. Therefore this was a fixture import-graph failure, not proof the legitimate production RSC import was invalid. The extraction removes that unnecessary runtime dependency without a server-only shim. `master-panel-shell.test.tsx:1–14,32–51` removes the blanket mock and denies privileged navigation to an Owner label with an empty effective-capability snapshot.

Ledger `docs/verification/task-10-reconstruction/verification.jsonl:588–590`: the unit RED fails before tests at server-only; the browser RED logs the same first boundary and unchanged 30000ms heading timeout; GREEN records 24 shell/live-access/store/handler cases. The access test's live revocation/expiry control remains at `staff-access.test.ts:59`. This establishes preserved source boundaries and focused test behavior, not physical SQL/hosted authorization acceptance.

### 2. Actual-main integration — NOT ADDRESSED completely

Actual-main ancestry and the four actual textual conflict resolutions are correct; the stale older-main-only requirement is superseded. The callback repair is real: `character-skill-build-panel.tsx:351–388` accepts `nextEligibility` second, incorporates it into no-op detection, validates selection and includes it with expected build version/idempotency key; the selected eligibility callback at `:714–717` passes the new choice as that second argument. Authoritative-response reconciliation and failure rollback remain at `:391–417`. Removal of obsolete routine success-message text does not drop the eligibility argument.

Other conflict boundaries retain both contracts: `battle-experience.tsx:3–9` keeps finalized-artwork and new mobile/contextual imports; Chronicle test `battle-log-chronicle.test.tsx:934–971` keeps configured activation/recorded-result coverage and mobile artwork identity; World `workspace.module.css:1050–1079` keeps compact conditions plus aligned tab counters. `world-workspace.tsx:574–575` still renders those conditions.

Reviewed automatic overlap groups: the two browser helpers retain new requirements-met/independent Skill Move expectations while preserving Basic walking wording; battle selected-skills/command use the new contextual reader with captured reports and finalized media; Chronicle model adds recorded source identity without discarding configured presentation; arsenal and Discipline panel retain Master current-identity/profile behavior under new presentation; ability detail differentiates Basic Move from Skill Move; command preparation/commit keeps independent allowance and readiness/AP reservation alongside retained event metadata; definition validation adds state-readiness rules without removing accepted Tag parsing; action-economy uses the new shared status-content module while retaining its Master paths; map test retains configured-cycle coverage; lockfile takes newer main Zod while retaining accepted direct sharp. Focused 183-case core and 158-case web coverage supports these boundaries, with the stale artwork expectation correction documented below.

**However I1 makes this gap NOT ADDRESSED as a whole.** The merged mobile Technique CSS does not preserve the usable Master eligibility presentation. No other new Critical/Important issue was found in the scoped source review.

### 3. Browser follow-through — ADDRESSED within the delegated local scope

`master-operations-browser-regression.mjs:59–85` only substitutes explicit session/navigation/storage boundaries, not server-only or production editors/player. The shell stub adds scrolling; `master-operations-harness.jsx:120–125` mounts actual SettingsScene for the Audio workspace. This remains a deliberately supplied shell, not full authenticated-shell acceptance.

Script `:105–111` logs the selected executable and actual browser; `:115–169` retains all three viewports, horizontal-overflow/reason-copy checks, Rules search/sort/Used-by interactions and World save payload/37-minute expiry; `:170–218` retains custom-page playback under Global silence, native playing/loop flag, same-source/currentTime/no-emptied checks, preview pause/resume and reset to Global silence. The changed combobox lookup is more specific; no force click, skipped operational case, increased timeout or weakened assertion appears. Screenshot and page-error checks remain `:220–227`.

Ledger `:592`/its raw log records all nine successful Rules/World/Music cases at 1366×768, 390×844 and CSS150%, on Chromium153. This is real local browser execution, not the old compile-only claim. It does not establish real200%, pinned151/headless-shell1234, physical devices, full authenticated shell, durable upload or two native loop crossings. Report `task-11-report.md:81–83,89–91` preserves those limits. I1 is outside those nine cases and is not contradicted by their success.

### 4. Evidence/recovery and original CLI gap — recovery/disclosure ADDRESSED; original CLI evidence NOT ADDRESSED

`task-11-report.md:73,83,85,89–91` candidly records lost unbacked a570/screenshots, fresh bounded reproduction, unchanged task caps, failure receipts, overlapping test counts and the original migration CLI procedural gap. No replacement migration or retimestamping appears in this range. This review does not upgrade the unsupported original CLI-creation claim.

Independent read-only verification established:

- Original ledger at accepted base is exactly371335bytes; HEAD starts with identical bytes, SHA256 `8179c946ebcb269bb3d57eece167960a83d1423b8d2bfbc4a0c6a4c583d6f48b`.
- Accepted base contains496 gzip artifacts; recovered pre-merge b4545ffc contains508. All508 recovered artifacts have unchanged Git blobs at HEAD and all decompress successfully. Thus the report's496/508 distinction is real, not an inventory contradiction.
- All19 new receipt artifacts, ledger lines585–603, decompress and match their recorded compressed-file SHA256. All nine retained PNGs match the final-integrity receipt hashes.
- The source checkpoint-to-final commit changes evidence/report only. `apps/web/vercel.json` still disables automatic Git deployment for all branches.

No hosted migration, roster publication, deployment or final acceptance follows from these facts.

## Existing verification reused

Read exact argv/timestamps/exits from ledger585–603 and corresponding decompressed raw outputs. Failed missing-browser install/default launch and server-only bootstrap receipts remain; none was relabelled. Successful focused runs:24 access/shell cases;183 core cases; nine operational browser cases; one configured-cycle map case with138 explicitly unselected cases; Web/core types and targeted lint/format/whitespace. The first web integration run is **157 pass /1 fail** out of158; the sole failure is the obsolete MP Recovery SVG fallback expectation. The corrected test retains invalid-media-key fallback validation and expects approved main's WebP (`battle-skill-presentation.test.ts:230–239`); its seven-case rerun passes. These are overlapping receipts, not164 unique web tests or a clean original run.

The pre-merge testing receipts identify the then-HEAD b4545ffc while the merged/repair working tree was uncommitted. They do not individually provide an immutable hash of each intermediate working tree. Final source, remerge diff and evidence-only follow-through were inspected; this remains an evidence-provenance limit, not fabricated exact-head CI.

## Inherited Minor and cannot-verify groups

- **Inherited M2:** `apps/web/vitest.config.ts:1` native-loader warning is still visible in successful raw Web logs. Keep Task13 follow-through; it was not suppressed and is not a new repair defect.
- Exact pinned native CI, physical phones, real browser200%, complete authenticated shell, and existing two-loop player/Basic contrast gates remain unverified here.
- Physical PostgreSQL/full historical migration chain, selected-character expiry/revocation under deployed RLS/RPC, hosted storage and asset durability remain separate checks. Source preservation is not live proof.
- Original migration CLI-help/new output remains unavailable; do not generate a replacement to manufacture historical evidence.
- Live World shortest-cycle cadence/map visual transition under real refresh scheduling remains open; the saved-duration/expiry fixture and selected map tint test do not cover that complete flow.
- Full production route coverage, upload permissions, current roster/history/pointers and exact retained battle snapshots are not physically inventoried by this review. No rebalance or publication is accepted here.
- Final whole-branch Task13 review/check, Nexus artwork/geometry, original builtin baseline restore, P34/prepared-startup/staged-roster and other recorded integration gates remain open. No new broad out-of-scope defect is asserted; the mobile I1 is within this merge's changed boundary.

## Reviewer actions and reproducible narrow check

No suites were rerun. Read-only source/package/log/hash/Git ancestry/object/status checks were performed. A first integrity helper used an incorrect relative parent path and stopped before artifact verification; it was corrected and completed. No source/index/HEAD mutation, ledger edit, remote or hosted operation occurred. Repository status remained clean after the narrow check.

The one allowed focused runtime check addressed the unanswered mobile eligibility/layout concern. It derives only the setup from the existing management browser fixture, mounts the actual component/global CSS, supplies eight real Skill definitions with eligibility data and performs DOM geometry/hit-target observation plus one screenshot. It does not execute that script's original suite loops. The fixture HTTP response is supplied; no persistence claim is made.

Exact command (cwd = frozen workspace):

```sh
AV_CHROMIUM_EXECUTABLE=/tmp/av-chromium-current/chromium node /workspace/scratch/e5db2ba73c1a/task11-review-technique-eligibility.mjs
```

Exit0; actual Chromium153.0.8010.0. A successful observational command does not mean the pictured layout passed. No page error was printed. Files:

- Script: `/workspace/scratch/e5db2ba73c1a/task11-review-technique-eligibility.mjs`, SHA256 `9f24fbdd2e3a8d2c2c5cf9e5790d389563958468460e8ddca9ee6b72adad2c57`.
- Output: `/workspace/scratch/e5db2ba73c1a/task11-review-technique-eligibility-output.txt`, SHA256 `57954c19b916d76cd9f5a1905d1da8b0d4b5b4ae498a720993406425d1c99379`. This is a faithful transcription of the displayed command stdout into a file after execution, not a contemporaneously redirected receipt or a rerun.
- Screenshot: `/workspace/scratch/e5db2ba73c1a/task11-review-technique-eligibility-390.png`, hash above. Visually inspected through the image viewer.

The source grid measured top180.8125/bottom419.421875, height238.609375, overflow hidden. Both four-card rows measured117.546875px/card. First-row select bounds251.453125–295.453125; second-row372.515625–416.515625. All eight select-center hits returned the expected select. Screenshot evidence, rather than those select measurements alone, establishes obscured names/artwork overlap.

**Disposition:** Repair I1 within the same sole implementation stream, then review that bounded correction and its evidence. Full Task11's previously accepted I1–I4/M1 dependency corrections are not reopened; this report's I1 is a new recovery-integration finding. No final whole-branch/release approval is given.
