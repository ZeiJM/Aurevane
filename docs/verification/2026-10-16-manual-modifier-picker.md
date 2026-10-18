# Manual modifier picker — implementation checkpoint

Status: reviewed local implementation checkpoint with one scoped fix pass; native interaction acceptance and combat release remain open. No hosted content write, merge or deployment occurred.

## Source and scope

Picker baseline `8b50b7a401db6fa5ed26bc43b5a85cda669fe5f2`; implementation Tasks1–5 through `9cf4d53ffaef631ccc1a218f80b104d53803787a`. One combined read-only review found five Important source defects. Corrective source is `88893b0a0e52e2bf062cd36f24034d609a7db56d`; the final checkpoint also adjusts an existing browser assertion to accept either an omitted or explicit empty attachment list while still requiring exact empty semantics. The implementation uses the existing combat command preparation/commit path, owner-only capture projection, shared information reader and keyboard controller. It adds no endpoint, database migration, persistent selection preference, additional command slot or Release button.

A player can prepare one equipped action/group and exact owned Manual modifiers through a shared footer reader. Preparation clears targeting and never dispatches a forecast, prime or paid command. Existing artwork/key controls proceed with the same pinned references. Free Controlled prime captures the complete set; release uses current authoritative captured references, including an empty set. Quotes expose exact composed AP/MP/HP and visible effective clocks from the existing single preparation. Missing metadata or quote data stays unavailable rather than becoming free.

Both desktop/mobile and PvE/PvP share this controller. Four Skill slots, Essence/Resonance artwork, existing art dimensions, attached-Move overall pricing and automatic Git deployment lock are retained in source; physical browser acceptance is still required.

## Evidence and limits

| Boundary | Evidence | Status |
| --- | --- | --- |
| Owned modifier metadata and selected-group roots |46 core +41 web focused tests at Task1; live producer/full capture, historical optional metadata boundary | Source verified |
| Prepared quote → owner DTO |82 core +20 web Task2 tests; exact4AP/6MP/4HP, shared effective clocks, hidden identity exclusion, single preparation spy | Source verified |
| Stored custom controls → normalized map/Save |16 validation/profile +3 web Task3 tests; exact map, no rewrite on read | Source verified; native capture pending |
| Draft → direct/target/movement/prime intent |82 focused Task4 tests; stale pins/context, exact normalized set, captured-empty authority, plural target invalidation | Source verified; mounted response race pending |
| Picker/controller integration |113 focused tests/7 files at045656 and Task5 completion; scoped ESLint and web types at045712 | Source verified within test coverage; SSR is not native interaction |
| Browser → production controls → real canonical core |Targeted launch045542 failed before assertions: missing Chromium executable. Installer043415 received truncated/invalid ZIP; cloud browser loopback connection refused | Blocked; zero screenshots/assertions passed |
| Full repository check | `pnpm --reporter=append-only check` at88893b0a exits0:7,081 Vitest +7 Node checks, formatting, lint,8 package types and both build tasks; full receipt050538. Final frozen-source run050914 also exits0 at`80aff5173858c186f673d15fd4399a7159038fa4` with the same counts | Passed; native acceptance remains open |
| Combined independent review | One fresh gpt-6-astra/High reviewer over8b50b7a4..9cf4d53f; noCritical,5Important, noadditionalMinor; one fix pass,120 affected tests/7files pass050436, types050444 and lint050503 pass | Source fixes checked within test coverage; native acceptance open |

Final full gate: `20261016T050914546728Z.json`/`.log`, exit0,7,081 Vitest +7 Node checks; format/lint/types/build all pass on80aff517. Subsequent source changes are documentation only and are checked by exact diff. Main29506e293e81abef1b0b8a46099618ab3ae3f0ae and backupf3a7d0bc were rechecked by actual remote refs before backup; main remains an ancestor and the Git deployment lock remainsfalse.

Full logs, command receipts, task briefs, review package and rulings live in `.superpowers/sdd/2026-10-16-manual-modifier-picker/` and are retained in recovery evidence. The native Vite config-loader advisory remains unsuppressed. No browser success, hosted authentication, live gameplay or balance claim follows from unit tests or build output.

The extended local browser harness mounts production `BattleExperience` and runs real captured canonical preparation/prime/commit. Its pending matrix covers1366×768,1440×900,390×844, PvE/PvP, keyboard/touch, delayed custom M/Shift+M, preparation without dispatch, restored locked primes, exact release references, off-turn reading, artwork bounds, long incompatible rows, and actual settings key capture/Save. Long-list zoom uses explicitly labelled200% Chromium page-scale emulation; true desktop browser zoom remains a separate acceptance gate. The harness is unexecuted, so it may need corrections once a valid browser is available.

Still-open native scenarios include full shortcut/visibility/repeat/outside-click behavior, no-input/terminal/pending states, rapid toggle/use/version timing, source removal in a mounted controller, range-hook late-response invalidation, actual selected-group Resonance targeting/highlighting (mixed Skill regression is implemented but unexecuted), ready-only light, long text/error/empty/history layout and true200% browser zoom. Every gate remains required before picker acceptance/release.

## Combined review and fixes

The reviewer found wrong recovery fallback for attack-first mixed actions, lost read context when choosing a primed/spent action, inner picker width exceeding its measured popover, conflicting paper/dark colors, and Automatic clocks attributed to the root. The first two existing production decisions were extracted unchanged before regression tests;5 real failures at050254 included those decisions, clock SSR and a strict old Essence DTO expectation. The corrected focused run050340 passes32 tests. Expanded exact/mismatched clock-name and affected suite050436 passes120 tests.

Prepared primed/spent actions now retain empty contextual drafts while Controlled availability exclusively supplies the locked set, including empty sets. Recovery derives from the explicitly chosen owned group independently of catalogue menu category. Visible clocks resolve exact public ID/version names; unmatched clocks say Ability. The measured outer popover accepts an explicit640px preference, inner content fills it, and rows/headings use a consistent paper palette. Actual browser bounds and palette checks remain open; CSS-text assertions would not establish rendering.

The initial full gate045744 failed without child diagnostic output. Isolated format050032 and lint050111 pass; direct full tests050125 identify one old strict Essence ownerDTO expectation missing the new safe modifierRoot field. The exact expectation now includes those facts rather than weakening to a partial match. Preserve those failed receipts. Append-only reporter makes the final full gate diagnostic output complete. No second reviewer or duplicate review loop ran.

Pending browser harness now additionally exercises choosing the restored primed root and mixed attack-first recovery, plus inner/outer paper bounds. It is still unexecuted. The existing direct-prime assertion accepts an explicit empty list without permitting attachments.

## Review focus mapping

1. Same-version metadata change/removal: pure draft tests preserve and mark stale references; immediate submission checks compare exact current descriptors. Native timing remains open.
2. Historical/custom M/Shift+M/function keys: parser/service tests preserve previous actions and strict duplicate rejection. Actual settings Save is present in pending harness.
3. Version between selection/use/response: synchronous ref pin validation and authoritative snapshot invalidation, with captured-empty prime precedence. Native race remains open.
4. Hidden Automatic/shared clock: quote tests verify exact total/effective duration without hidden identities/keys/provenance.
5. Long incompatible list: focusable disabled rows, roving keys and list reachability in source; pending long-list200% page-scale harness. Physical/native browser zoom remains open.

## Remaining coordinated release work

The accepted full roster design remains the Task14 authority. Parent Tasks15–16 still require complete immutable application of136 Skills,17 Essences,136 unique Resonances and5 Basics; every implemented gameplay tag needs an executable playable case, and complete class/AI/Level100 balance must be measured. The remaining Master/world scope is unchanged.

Carry the inherited Atlas peer-motion timing failure0.830568 versus<0.75 without relaxing its bound or claiming a root cause. Ground repeated-subset wording and unavailable Manual Resonance passive caption remain deferred before-release findings. Actual editor/card/forecast/effect-popup prose, orange linked effects/values, attached Move, editable Basics, Controlled and targeting must be audited together across real consumers. Reconcile current main/Owner edits and follow the exact-head coordinated release gate before any eventual deployment.

## Recovery

The implementation branch remains separate from the backup-only archive branch. A verifiable exact-source incremental Git bundle from prerequisite8b50b7a4 plus this plan's necessary evidence is prepared for the already-authorized archive with an expected-SHA nonforce update. The preceding picker-plan bundle at archive commitf3a7d0bc supplies that prerequisite; previous bundles remain retained. Archive ancestry never substitutes for implementation ancestry. Preserve both this ledger and the parent recovery ledger for continuation.

## Rulings and deferred items

- use this plan's own receipt runner/ledger instead of parent-plan output directory — executing-plans workspace isolation applies; parent release scope/checkpoints remain authoritative — cost if wrong: recovery needs both named ledgers, preserved in final bundle.
- make only the newly added owner metadata fields optional at the public saved-snapshot type boundary, while live producers always emit them — preserves spec historical compatibility and forces picker to validate new metadata; cost if wrong: old snapshots show unavailable choices instead of manufacturing casts. No test fixture weakening or old preference overwrite. Pure native facts are consumed in the trusted composition native branch, rather than a redundant extra call in native input construction; exact old legality is covered by existing command suites.
- preserve category-era and Items test fixtures as real historical maps by excluding the newly introduced key — prevents a synthesized explicit M conflict from pretending to be old data; cost if wrong: historical fixture coverage would miss a new-format input, covered separately by explicit duplicate-rejection test.
- range-hook memo uses a serialized exact identity-only set to reconstruct its bounded descriptor inside the existing memo — independently recreated equivalent arrays must not continuously refetch; cost if wrong: extra informational forecast request, covered by actual mounted-flow acceptance in Task5.
- exercise actual hook invalidation and native settings capture together with Task5 mounted production interaction/browser harness — this task proves payload/key identity and pure lifecycle now; a mocked React hook would not establish real behavior; cost if wrong: browser interaction remains unverified and milestone cannot be accepted at Task6.
- retain the Task5 implementation and harness as a reviewable checkpoint while native interaction acceptance stays OPEN — the brief explicitly permits concrete unavailable-browser evidence, and source checks cannot replace it; cost if wrong: interaction regressions could remain until the browser gate runs, so no picker acceptance/release claim.
- long-list harness uses real Chromium200% page-scale emulation and labels artifacts accordingly; true desktop browser zoom, full shortcut/visibility/repeat/outside-click matrix, actual hook old-response invalidation, terminal/pending behavior and Resonance highlighting remain acceptance OPEN — no running browser is available to establish those scenarios; cost if wrong: layout/input failures remain possible before release.
- clear transient modifier state centrally on each authoritative snapshot adoption, keeping immediate ref invalidation in the existing controller, rather than adding a set-state layout effect rejected by the enabled React lint rule — all existing snapshot setters use the stable wrapper; cost if wrong: event timing gaps must be caught by the still-open version-race browser gate. Root-list construction stays a bounded pure calculation rather than a compiler-incompatible redundant manual memo.
- fix measured outer picker width and paper palette directly, with real browser bounds assertions added but unexecuted; do not add CSS-text tests that merely mirror implementation — required native rendering is unavailable and reversible CSS does not warrant a second model of layout; cost if wrong: visual/contrast/zoom defects remain possible, so visual acceptance remains OPEN and these changes are not claimed browser-verified.
- inherited Atlas peer timing remains a parent release blocker — this picker does not change world rendering or relax0.75 bound; cost if wrong: integrated release still cannot pass.
- Ground repeated-subset wording remains in the before-release reader audit — no new Ground prose is selected here; cost if wrong: repetitive actual card wording survives until that audit.
- unavailable Manual Resonance Passive caption remains in the before-release reader audit — current selected-group command semantics are fixed separately; cost if wrong: unavailable-reader caption remains misleading until audit.
- complete immutable roster/all-tag/AI-Level100/event-reader work remains parentTasks15–16 — accepted roster design is preserved and no redesign or publication is invented; cost if wrong: this checkpoint cannot represent the complete combat release.
- hosted/authenticated release readiness is unestablished — source-range review and local unit/build evidence cannot prove hosted/native play; cost if wrong: untested live behavior, therefore release gates stay closed.

No additional Minor finding was deferred by the combined reviewer. The inherited Atlas, Ground wording and unavailable Resonance caption findings remain before-release gates as stated above. Native acceptance remains open; retain the evidence workspace for recovery and continuation.
