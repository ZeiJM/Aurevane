# Task 11 round 2 — scoped combined re-review

**SPEC: COMPLIANT for the scoped repair. QUALITY: APPROVED.**

**Recovery-I1: ADDRESSED.** New findings: **0 Critical / 0 Important / 0 Minor**. The previously confirmed mobile shared-Skill identity/artwork/eligibility overlap is closed. The **1 inherited Minor** Vite native-config warning and the existing Task13 acceptance obligations remain open. This is not final whole-branch or release approval.

## Scope and frozen identities

Same sole combined reviewer as the preceding recovery review; no helpers or duplicate broad review. Read the round2 brief and report append, applied the original Task11/global constraints and retained the prior accepted source/main boundaries. The archived preceding review is byte-identical to my original report.

- Workspace: `/workspace/scratch/e5db2ba73c1a/aurevane-master-complete-20261025`.
- Fix base: `b2af6e4ef80cdfa12628a5edc589d78c75daa4c2`.
- Reviewed HEAD: `a4ed235e6ba045072b89ac85f506a7263ba80662`; tree `dd1e597b9fcbd3f560d9f1f600f75be0e27d9bec`.
- Source/evidence checkpoint: `7d066ea00225a7fc1069ca64ec91d68c82f68acb`. The final commit changes only `task-11-report.md`.
- Exact fix package: `/workspace/scratch/e5db2ba73c1a/master-11-fix2-b2af6e4-a4ed235.diff`, 214730 bytes, SHA256 `7577fa29aebbf58e8d1c7521b959244477579685b15355b5ac890b61a9549ead`.
- Actual main `14df01a2c42d4cb36bd6c99d21372a1c51084164` remains a local ancestor. Root's remote freshness/backup statements were not independently repeated through remote operations.

Product implementation changes are precisely37 appended CSS lines. The two additional executable files are a regression script and fixture. Remaining changes are reports, archived prior review/reproduction, root bookkeeping and fresh evidence. No component TypeScript, combat authority, eligibility/CAS implementation, migration, lockfile or media privacy source changes occur in this fix.

## Recovery-I1 — ADDRESSED

**Cause and correction.** `apps/web/src/components/character/character-skill-build-panel.module.css:1656–1691` applies only at the existing mobile/short coarse-pointer breakpoint. A Skill grid containing eligibility controls now uses two columns, intrinsic rows and bounded vertical scrolling (`:1658–1665`). Shared cards allocate separate identity and eligibility rows (`:1667–1676`). Names use readable13px wrapped block text (`:1678–1682`); eligibility labels retain distinct light text and their own row structure (`:1684–1686`); selects have a44px minimum (`:1688–1689`). The fix neither removes grant controls nor shrinks the artwork to hide the original overlap. Existing desktop rules are unchanged, as are grids without eligibility controls. The upper chooser can scroll while the lower preview stays in its existing split pane.

**Actual production consumer.** The unchanged `character-skill-build-panel.tsx:650–741` still renders the actual Skill identity and eligibility select. Its `:351–417` submission/reconciliation and `:714–717` selected-grant callback remain unchanged. Thus the repair does not replace the load-bearing selection/capability semantics with fixture behavior. Current mobile tabs, touch preview/explicit Equip and the image-free lower preview remain in the production component.

**Meaningful RED.** Ledger `docs/verification/task-10-reconstruction/verification.jsonl:605` and `t11-fix2-20261025-geometry-red.log.gz` reproduce my finding in the real component: Forceful Strike artwork ends at225.71875px while its name begins at203.515625px at390×844. The selector still hit-tests correctly. I verified that this receipt's CSS source SHA is exactly the fix-base CSS. The earlier line604 missing-navigation-file error is honestly retained as a fixture setup failure and is not counted as product RED.

**Meaningful GREEN.** `apps/web/scripts/technique-eligibility-browser-regression.mjs:91–183` runs390×844,320×740 and844×390, measuring all eight real shared-Skill cards per viewport. It checks artwork/name/eligibility/control separation, every name text rect inside its name box, retained artwork size,44px selector height, control hit target/card containment, and unchanged lower-preview bounds while scrolling. `technique-eligibility-harness.jsx:7–20` supplies eight current Vanguard definitions with two active grants each, including a deliberately long authored identity. The actual component and production CSS are mounted; no substitute chooser is tested.

Final GREEN is ledger615 / `t11-fix2-20261025-geometry-green5.log.gz`: exit0,2026-10-25T06:35:54.322838Z–06:36:02.480561Z, Chromium153.0.8010.0. Its four recorded source hashes match all four committed component/CSS/script/fixture files at reviewed HEAD. The final lint/format receipts also match those four files. The result JSON records24 measured cards, no page errors, and the following minimums in each viewport:

| Viewport | Artwork height | Select height | Art-to-name gap | Name-to-eligibility gap | Label-to-control gap |
| --- | ---: | ---: | ---: | ---: | ---: |
| 390×844 | 41px | 44px | 5px | 15.1875px | 4.59375px |
| 320×740 | 41px | 44px | 5px | 15.1875px | 4.59375px |
| 844×390 | 41px | 44px | 5px | 15.1875px | 4.59375px |

All24 select-center hit tests are true. I visually inspected the long-name screenshots `t11-fix2-20261025-green5/geometry-390-7.png`, `geometry-320-7.png` and `geometry-844-7.png`. The portrait screenshots clearly separate artwork, full wrapped name, label and control. The short landscape chooser uses scrolling; its selector-focused screenshot does not show an entire tall card simultaneously. Neither the evidence nor this verdict promises that every card is fully on screen at once.

**Real interaction preservation.** Script `:184–260` verifies native tap previews without submitting, explicit Equip sends the chosen grant, changing an equipped grant submits the changed choice, five successful calls carry expectedBuildVersion1–5 and distinct idempotency keys, four Skills block a fifth, and a supplied409 response restores the committed grant with expectedVersion6. Support/Discipline selected tabs and image-free preview remain checked. The fixture at `technique-eligibility-harness.jsx:28–56` supplies only HTTP responses and version-conflict behavior; the actual component constructs payloads and reconciles responses. This proves the browser-side contract, not a physical database CAS implementation.

No forced clicks, skipped final scenarios, increased timeout or removed geometry assertion appear in the final guard. The failed follow-through receipts preserve actual harness problems: optional builtin names, uppercase rendered capacity text, and a fifth-card focus requirement. Reading the displayed identity, matching capacity case-insensitively and tapping the fifth card's real control correct those fixture assumptions without weakening the original overlap guard. The landscape diagnostic records a28.796875px select; the final CSS fixes its height rather than lowering the44px assertion.

## Quality and preservation

The CSS remedy addresses the actual intrinsic-height problem and is limited to the affected mobile grid. It retains authored names, choice controls and artwork rather than relying on clipping. The extra upper-pane scrolling is explicit, bounded and covered against lower-preview movement. No changes to the four-Skill capacity, selected-grant payload, idempotency, current/pinned definitions, server-only security, media ACLs or private Accuracy projection are introduced.

The browser guard combines layout measurements with actual interactions and conflict recovery, rather than mirroring the CSS implementation. It uses existing project fixture conventions and leaves production state handling untouched. Desktop was not rerun in this repair; the new rule is restricted to the existing mobile media condition, so the brief's adjacent-desktop requirement does not introduce a changed desktop boundary here. The separate inherited desktop Nexus64px acceptance issue remains assigned to Task13.

No new Critical, Important or Minor breakage was found in this fix's source/evidence. The previously open recovery integration gap is closed by this repair; earlier bootstrap and Rules/World/Music conclusions remain valid within their previously documented limits. Original full-stage dependency I1–I4/M1 are not reopened. Task11 remains round2/5; Task10 remains capped5/5.

## Evidence integrity and checks performed

I reused the recorded tests; **no suites or browser runs were rerun by this reviewer**, and no additional runtime probe was necessary. Read the full changed implementation/guard/fixture, relevant bookkeeping/report changes and all16 decompressed receipt outputs; parsed the full manifest and results rather than repeating their large JSON text. Performed read-only hashes, Git identities/ancestry/object inventory and clean-status checks. No source/index/HEAD mutation, ledger edit, remote or hosted operation occurred.

Independent verification:

- Fix-base ledger prefix is exactly388384bytes, byte-for-byte preserved, SHA256 `a618117d032563fe3bd8f50320d71a280685fc9b1ba515c50de7d98c6abdfb28`.
- All716 prior tracked evidence files from root's preserved docs checkpoint `ad37be3d2`, excluding the appended ledger, still match their original Git blobs.
- All16 new raw-log files, ledger604–619, decompress and match their compressed SHA256. Initial failed receipts remain present.
- All91 image/result artifacts match the manifest hashes. The manifest/integrity receipt checked15 preceding receipts; adding its own receipt correctly produces16 total.
- Passing browser, final format and final lint source hashes match reviewed HEAD. Earlier unit/typecheck receipts predate final CSS/harness edits; their recorded production component TypeScript hash still matches HEAD, and no production TypeScript was changed. They are not misrepresented as final-browser-source executions.
- Existing focused reconciliation:3 passed. Web typecheck: passed. Final affected ESLint with max-warnings0, Prettier and whitespace: passed. The inherited Vite warning remains visible in the unit log.
- Repository status is clean; source-checkpoint-to-HEAD delta is report-only.

The final browser command is recorded exactly in ledger615:

```sh
corepack pnpm --filter @aurevane/web exec env AV_CHROMIUM_EXECUTABLE=/tmp/av-chromium-current/chromium AV_TECHNIQUE_ELIGIBILITY_EVIDENCE_DIR=../../docs/verification/task-10-reconstruction/t11-fix2-20261025-green5 node scripts/technique-eligibility-browser-regression.mjs
```

## Remaining limits and out-of-scope work

This is bounded local Chromium153 browser evidence, not exact pinned151/headless-shell1234 CI, physical-phone acceptance, real200% browser zoom or full authenticated-shell acceptance. Navigation/image transport and HTTP are fixture boundaries. It does not establish physical DB/hosted CAS, authorization, storage durability or current roster/history reconciliation.

Keep the original migration CLI creation/help procedural gap disclosed; no replacement/retimestamped migration was introduced. Retain final13's full-repository/whole-branch review, Nexus artwork/geometry, Basic contrast, two-loop native playback, live World cadence, original builtin baseline restore, P34/prepared-startup/staged-roster and other previously recorded acceptance gates. No unrelated issue is newly asserted from this scoped review, and no hosted migration/publication/deployment is authorized or implied by approval.
