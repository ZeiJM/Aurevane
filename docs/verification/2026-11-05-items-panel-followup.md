# November 5 Items panel, equipment and consumable followup

Status: source implementation and independent review complete; draft PR handoff, **not deployed**. No hosted schema change, source registration, Item publication, real grant or inventory mutation was performed. The prior Seal + Damage Up release and domain setup are separate completed work.

Authority: [Owner scope](../superpowers/specs/2026-11-05-items-panel-followup.md), [implementation and verification plan](../superpowers/plans/2026-11-05-items-panel-followup.md).

Branch: `agent/items-panel-followup-20261105`. Starting main: `dc6ba0349dc127018044fd59dcc78ed9316f9d61`. Main was refreshed immediately before source finalization and remains at that starting SHA. The draft PR head is the canonical final source; its Git tree is checked against the locally staged, verified tree before branch publication. Configured exact-head remote gates remain required.

## Resulting behavior

- Master searches effective Item Class/Type/Position before pagination. Named-character grants require explicit selection and current Game Owner authority; ordinary staff self-test grants retain their permissions. Account-scoped uncertain receipts survive keyed Item remounts and reloads and retry only the original immutable request.
- Compact Item editor keeps internal order hidden, long fields contained and popup guidance single. Class, Position and Type use the Owner's final terminology. Armor Position changes preserve authored behavior. Gloves keeps its existing stable identity.
- Optional weapon Imbued Techniques use the shared Skill editor and existing pinned equipment Support path; selecting and executing the Support uses its real authored ability, and unequipping restores the previous Basic Support. Inspection separates that technique into its own tab only when available.
- Inventory sorts save immediately, stale/error recovery reads once without action replay, and filters follow Class. Equipment/inventory share cockpit artwork dimensions. Popups expose compact actions and proven stat contributions, empty slots offer applicable owned choices, and Equipped badges/owned counts are clear. Capped Evasion changes use the authoritative current base when available and display percentage points; conditional changes and unavailable base facts are not guessed.
- Optional level, current equipped Discipline and base Core thresholds are enforced by the canonical equip writer and new battle admission. Current loadouts remain manually repairable. The two consumable positions require different Item identities, even across separate stacks.
- A new captured consumption policy spends one actual equipped stock unit on an accepted use, atomically with the battle commit. Rejected actions, previews, retries and delayed effects cannot spend another unit. Remaining stock stays readied; exhaustion clears that stack's assignments and never substitutes another stack. Per-battle use caps reset, owned stock does not. Historical captures keep their prior policy.
- Battle Item artwork and information follow the last selected current consumable. Preview information uses the cockpit style and shows uses plus private owner-visible stock without slot-label clutter. Battle information matches the compact Skill report. Shared summaries wrap rather than clipping or horizontally scrolling.

## Verification evidence

Focused results below are overlapping development/adjacent suites, not additive totals. Native tests mount production components with local transport fixtures; real authority tests use disposable PGlite databases. No signed-in hosted gameplay or human acceptance is claimed.

| Area | Evidence |
| --- | --- |
| Type search | SQL RED for absent type matches; 35 tests GREEN including final plural Consumables alias and pagination/source precedence |
| Target grants | Real SQL Owner/selection/CAS/capacity/deletion/battle/dedup tests; 137 overlapping UI/route/recovery/workspace tests GREEN; actual remount and reload at four widths retain the exact uncertain request |
| Editor and requirements | Native 1440/1366/390/412 edit/save/reload, long text, Class/Type/Position, single help, preserved actions/media/order, custom Discipline and optional requirements clearing; frozen footer reachable without horizontal overflow |
| Inventory | 41 focused/adjacent tests GREEN after the capped Evasion extension; nine native shell sizes plus complete 1366/390/412 action, picker, stock, keyboard, late-response, Support restoration and rejection flows; a focused 1024×576 rerun additionally verifies actual +1%/−1% Evasion Equip/Unequip |
| Imbued Technique | Actual shared editor/parser, authored AP edit, pinned Support execution and restoration; 1366/390 native authoring/reader tab flows |
| Equip authority | 57 focused core, 31 requirements/inventory SQL and 21 adjacent equipment SQL tests GREEN, including actual battle creation rejecting changed requirements without silently unequipping |
| Shared readers | 510 native effect summaries across five actual readers at 1440/1366/390; short line, full parameter/label containment, colors and help preserved; 162 focused tests GREEN |
| Item-engine audit | All 47 effective source/current definitions reviewed; three precise successor candidates; 82 adjacent source/engine tests GREEN, including real Fire-only Kindle versus non-Fire packets and historical scope behavior |
| Battle UI | 138 overlapping focused tests and 63 native PvE/PvP/spectator cases at 1366/390/412 GREEN, including last-selection persistence, shared information, canonical healing, depletion and owner-only stock |
| CI selection | 56 Node planner/self-tests GREEN; new native authoring, Imbued and effect-reader evidence is included in Browser Smoke without removing existing coverage |

The final source review has no remaining Important/Critical findings. Consumption has 71 focused core and 61 SQL checks GREEN, including startup and Reversal fixes; see its [settlement receipt](2026-11-05-consumable-stock.md). Formatting, lint and all eight package typechecks pass. Final package and production/worker build outcomes are recorded below; earlier runs during parallel edits are not the final integration result.

## Local integration gate

- Full formatting and lint pass; all eight package typechecks pass on the final source.
- The full DB run executed 633 cases: 629 passed, two strict Staff contract assertions needed the new Owner module registered, and two historical tests hit their existing time limits under load.
- After the registry/fixture correction, a serial four-file run passed lifecycle/native Staff 60/60, target grants 13/13, Seal identity 2/2 and five of six historical modular-release cases. The exact inventory remains 48 legacy + 21 workspace + three Owner entrypoints + one private helper, with active-staff and browser denials preserved.
- The one unresolved local failure is the unchanged historical 294-correction publication/rollback test’s 120-second limit (144.413 seconds reported in the serial run). Its test and SQL assets are unchanged and its fixed migration list ends October 18, excluding every new Item migration. No timeout, assertion or required check was weakened. This case is **not claimed passing**; configured exact-head CI remains a readiness gate.
- Full package passes: Core 7,146/7,146; Audio 19/19; Worker 2/2; Realtime 3/3; Validation 107/107. Seven repository Node checks also pass.
- Full Web run: 8,878 passed and five existing 5-second timeouts among 8,883 cases. A serial follow-up covered all five timed-out cases and three adjacent variants in the two unchanged roster files: all eight passed within the original limits (1.045–4.400 seconds), with no source, assertion or timeout changes. Their fixtures have no equipment Skills and use the prior capture path. This is aggregate evidence, not a claim that the entire Web suite passed in one run.
- Across full and focused follow-ups, every exercised Vitest case is verified except the one historical DB timeout above. The complete `pnpm check` is therefore **not claimed green**. Exact-head CI and native CI remain required before readiness.
- `pnpm build` passed both production Web and Worker builds (2/2 tasks); the compiled worker `check:boot` passed in one-shot mode with `worker.ready`. No hosted worker jobs ran.
- The final focused native Arsenal rerun verifies decoded real artwork in the simplified popup and actual +1%/−1% Evasion Equip/Unequip at 1024×576. The image-loader adapter is confined to the disposable native fixture transport; no production image code changed.

## Review findings

Independent authority review found no search/grant SQL issue. UI review found that an uncertain grant could be lost on keyed remount and could be discarded after a retry authentication failure; both were reproduced RED and repaired with account-scoped durable session receipts, explicit same-request retry and native remount/reload coverage.

Whole-branch review found that the new stock settlement trigger initially rejected canonical same-version startup finalization, including automatic startup in PvP and World. The guarded repair now passes actual preactivation → automatic activation → PvE creation with production Tag binding, plus the reviewer’s actual PvP/World probes; forged mechanics, quantities, source identities and startup receipts are rejected. No current production change was made by this source defect. Review also found a Reversal Item bypass: accepted arming committed activation usage without spending stock, and later interception had no settlement hook. The repair consumes once at committed arming (even when authored with zero AP), leaves provisional Controlled preparation free, and never charges again at automatic interception. The real SQL interception test confirms only one unit and one receipt are spent.

## Content and release boundary

[47-Item audit](2026-11-05-item-description-audit.md) and [exact reviewed successor definitions](2026-11-05-item-description-successors.json) preserve the read-only hosted baseline. Emberbrand's Kindle receives explicit Fire scope; Vulnerability Oil and Ward Sigil receive truthful wording. Only those three source definitions advance to v4. Hosted current v3 publications still override source defaults until a separately authorized normal versioned Commit. Source registration conditionally advances the version floor; refresh current revisions, drafts and version floors before publication. Never overwrite an Owner draft or broadly republish unaffected content.

The four additive source migrations cover type search, targeted grants, consumable stock settlement and equip requirements. None has been applied hosted here. A future explicit release must coordinate the verified compatible application, new database contracts/policy admission, guarded source registration and only the reviewed successor publications. Keep Git automatic deployments disabled, preserve the nine retirement guards and both `aurevane-rpg.com` domain hosts, and use the established controlled release procedure. Do not infer release permission from this PR or local build. During a future cutover, hold new battle admission and Item authoring/grants while switching these mutually versioned application/database contracts. Retire old deployment routes and allow the established conservative drain before installing the new policy writer; release admission only after exact policy capture, atomic settlement and preservation postflight pass. Old applications cannot parse the new strict capture fields, while admitting new battles before the writer is installed would incorrectly pin the old non-consuming policy. Preserve already admitted historical/active encounters throughout.

## Owner checklist after a separately authorized release

- [ ] In Master Items, search Weapon, Gloves, Head and Consumables; verify Class/Position/Type and compact fields at your usual window size.
- [ ] Edit optional equip requirements, refresh, and confirm matching/mismatching characters are accepted/rejected both on Equip and new battle entry.
- [ ] Enable a weapon Imbued Technique, author it with the shared Skill editor, select it as Support and use it in battle; unequip afterward and confirm normal Support returns.
- [ ] Try inventory sort/filter/Class changes, empty-slot selection and direct Equip/Unequip. Confirm notices stay local and equipment/stat changes match the action.
- [ ] Confirm both consumable positions accept different Items and reject the same Item even from another stack.
- [ ] Select each consumable in battle: Item artwork/information must follow your latest choice, with round information controls and correct uses/stock.
- [ ] Use a consumable: stock must drop exactly once while remaining equipped; retry/reload must not spend again. At zero, the slot clears and another stack remains unequipped until you equip it manually after battle.
- [ ] Start another battle with remaining stock: battle-use cap resets while stock stays reduced. Check historic battles remain literal.
- [ ] Inspect ordinary and Imbued reports at desktop and phone widths: complete effect parameters, readable labels, no horizontal effect scrolling or duplicate usage/maintenance prose.
- [ ] Check the reviewed Emberbrand Kindle Fire-only behavior and the two corrected descriptions after their specific publications.
