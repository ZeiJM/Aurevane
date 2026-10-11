# October 9 elemental implementation receipt

Status: Released for testing through PR #854, merge `dedb3d52876b494aaa7bafa916e42d7a5a7ad5b8`; production `dpl_4cv2DhwMGceW5jv6dwCk7Ct5AdSN` is READY at https://aurevane.vercel.app. See [final release evidence](2026-10-09-combat-release.md). Human acceptance remains pending. The details below retain their historical local verification checkpoints.

## Implemented contract

- New PvE, both PvP factories and Master preview pin optional elemental/dynamic Initiative policy1. Absent historical flags retain prior mechanics, definitions and RNG paths.
- Ice positive hostile actual HP loss applies Chilled; Water applies stable wet identity, displayed as Drenched; Storm consumes an existing Conductive charge for its captured bonus and applies one fresh charge after packet settlement. Barriers, misses, resistance, allies and lethal recipients are covered. Authored matching statuses supply tuning/timing without duplicate application; repeated and queued packets cannot consume the new charge again. A later Fire packet clears an earlier queued Chilled/Drenched application in authored order.
- Fire cleanses caster Chilled once at legal commit, even empty, missed or delayed. Single Fire accepts tile intent; area Fire has explicit `ground:true` on direction/activate with a player-facing Enemies/Ground choice. Core rejects that flag for historical or non-Fire Skills. Geometry, range, LOS, elevation, costs and enemy recipients remain authoritative. Ground Fire preserves Airborne immunity; ordinary enemy Fire remains able to hit Airborne.
- Ordinary overlays and persistent ice convert to Steam using the original remaining lifetime, including a single remaining boundary and four-round areas. Converted persistent tiles retain the area schedule and skip its ice entry payload. Base terrain is unchanged. Shared mist is gentle in playable PvE/PvP and spectators, and static under reduced motion.
- Chilled restricts only changed final facing; the current direction remains available. Movement still faces normally. Recruit AI chooses its current direction, PvP timeout completes in that direction, and browser controls allow the turn to finish.
- Drenched reduces active effective Initiative once by10%, including the frozen current-round tempo offset before integer rounding. Pending status does not contribute. Active actor and acted prefix remain fixed, future unacted actors reorder, and the next round sorts after activation/expiry. Persisted acted identities survive JSON restore; death, reaction wrap, terminal completion and deferred/removed summons are covered. Saved base Initiative remains unchanged. Inspectors derive only from viewer-visible statuses; internal active offsets/progress are excluded from public battle projections and event payloads.
- Master exposes Ice and captured elemental duration plus additional Drenched/Conductive Storm bonus percentages. Existing validated potency budget100–5000 basis points (1–50 additional percentage points) is retained; default2000. Duration and potency remain separate. Immutable publish/rollback and Copy Debuffs preserve values and source/application metadata.
- Shared expanded readers, captured battle readers, status help and Manual describe the actual policy, bonus and timing. Authored prose overrides retain canonical elemental explanations. New typed immutable roster versions preserve unrelated powers/costs/cooldowns/geometry.

## Timing and compatibility decisions

Default implicit elemental debuffs are Instant at actual damage settlement and last two affected owner turns, using existing owner-turn-end lifetime. An explicit frozen/wet/conductive timing override remains authoritative: Normal (`next-round`) activates at the following global boundary and Delayed at the second boundary after settled damage, lasting the captured full rounds. No new lifetime framework or timing publication is introduced. Legacy immediate damage `durationTurns:0` remains valid metadata; it means the native two-turn implicit default, unless a matching explicit status supplies a positive captured duration.

The old conditional damage modifier machinery and unlimited-application policy remain unchanged. Drenched and Conductive contribute once each using the greatest active captured application value, irrespective of duplicate stacks; other modifier rules and technical budgets remain authoritative.

Area Fire had no existing unit-versus-Ground discriminator in direction/activate. Root explicitly approved the optional `ground:true` request contract. Unflagged actions retain enemy intent; the flag is validated by the canonical core against the saved policy and Fire definition. The shared UI chooses ordinary player-readable Enemies/Ground. The immutable Fire catalog is not rewritten.

## Immutable current roster

| Skill ID | Previous | Current | Typed damage |
| --- | ---: | ---: | --- |
| `frostweaver.ice-lance` | 5 | 6 | ice |
| `frostweaver.shatter` | 5 | 6 | ice |
| `frostweaver.ice-line` | 5 | 6 | ice |
| `frostweaver.brittle-ice` | 4 | 5 | ice |
| `stormsinger.arc-spark` | 5 | 6 | storm |
| `stormsinger.lightning-line` | 5 | 6 | storm |
| `stormsinger.static-burst` | 6 | 7 | storm |
| `stormsinger.thunderclap` | 4 | 5 | storm |
| `stormsinger.static-drain` | 5 | 6 | storm |
| `stormsinger.conductive-bolt` | 5 | 6 | storm |
| `tidecaller.water-lance` | 5 | 6 | water |
| `tidecaller.undertow` | 4 | 5 | water |
| `tidecaller.flood-line` | 6 | 7 | water |
| `tidecaller.crushing-wave` | 4 | 5 | water |

Root's read-only hosted check found no current publication pointers for Frostweaver, Tidecaller or Stormsinger. The static appended versions therefore reach those current definitions without deleting/replacing Owner overrides. No migration or content-pointer activation is required for the inspected DB state. Recheck before production if pointers change. Existing published timing policy version7 has no elemental status override and is preserved.

## TDD and defects found

Retained logs under `/tmp/oct9-elemental/` document RED before the corresponding changes:

- `elemental-red.log`: unknown Ice, missing default statuses, Fire Ground/caster cleanse, Chilled final-facing restriction.
- `initiative-red.log`, `round-boundary-red.log`, `round-reaction-red.log`: future reorder, pending activation before next-round selection and reaction knockout ordering.
- `persistent-red.log`, `short-ice-red.log`: persistent conversion and single-boundary life preservation.
- `delayed-red.log`: old/new Conductive across queued packets.
- `last-edge-red.log`, `restore-red.log`: generic damage0 versus explicit duration, terminal ordering and malformed queued metadata.
- `ui-red.log`, `timing-reader-red.log`, `captured-reader-red.log`: editor, shared mist, exact saved timing and authored prose/captured tuning.
- `area-intent-red.log`, `area-intent-validation-red.log`: current Single empty Fire geometry and explicit area Ground intent. The validation fixture initially expected a throw; the existing parser correctly returns null for rejection and its assertion was corrected.
- `mixed-packet-red.log`: later Fire clears earlier implicit applications.
- Browser failure/diagnostic logs identified the actual current Single empty-Ground rejection. The executable discovery failure was environment setup; the retained next diagnostic isolated a real core error, which is now covered by core and browser regressions.

## Verified checks

- `pnpm --filter @aurevane/game-core test`:144 files,2644 tests passed.
- `pnpm --filter @aurevane/web test`:250 files,1785 Vitest tests plus7 Node checks passed, exit0.
- `pnpm --filter @aurevane/validation test`:9 files,72 tests passed.
- Core and web typecheck passed, including Next route type generation.
- `pnpm exec eslint 'packages/**/*.{ts,tsx}'` and full web lint passed with zero warnings.
- Focused elemental/order/roster/recruit suite:4 files/52 tests passed before the final two edge regressions; final full core includes both additional regressions.
- Actual Chromium command: `AV_CHROMIUM_EXECUTABLE=/tmp/aurevane-headless/chrome-headless-shell-linux64/chrome-headless-shell AV_ELEMENTAL_EVIDENCE_DIR=/tmp/oct9-elemental/browser-evidence pnpm --filter @aurevane/web exec node scripts/battle-elemental-browser-regression.mjs`:24 cases,0 page errors. Covers12 Steam normal/reduced-motion desktop/mobile PvE/PvP/spectator;4 empty Single Fire commits;4 area Fire Ground-versus-enemy Airborne commands;4 successful Chilled current-facing end turns. Twelve screenshots are in `/tmp/oct9-elemental/browser-evidence`. Desktop PvE and reduced-motion mobile spectator screenshots were visually inspected.
- Prettier check of all owned code passed; `git diff --check` passed. The final timeout fixture was formatted afterward.
- Final explicit Chilled PvP timeout integration:23 elemental tests passed (22 previously verified plus the timeout case). The first attempt lacked PvP timeout tracking resources; the fixture was corrected using existing `createPvpQualityResources`, with no product change. Its dedicated result is `timeout-green.log`. The full core run above preceded this final assertion; root’s combined gate includes it. Core typecheck was clean after introducing the test.

## Ownership and remaining gate

Prior product checkpoint b1734f9 and root commits c248c59/7f54c7f are preserved. Root's E2E/checklist/plan/spec files are excluded from this implementation commit. The requested one-line playable Ground E2E correction was made for root and remains excluded. Suppress is not implemented in this task. No privileged DB, auth, SMTP, dependency or deployment mutation was performed.

No open design blocker remains. Root must run the combined repository `pnpm check`, independent review, exact-head CI and release-source/deployment verification after Suppress. Actual browser fixtures test production components and canonical local commits; they do not claim signed-in hosted gameplay or Owner acceptance. Live publication-pointer evidence was provided by root and must be considered current only at its read time.


## Independent review fix round 1

The two Important findings in `/tmp/oct9-elemental/task-review-report.md` were reproduced and corrected after checkpoint `cfb6197`.

1. Normal/Delayed current-policy Fire now retains captured affected tiles even with no eligible unit recipients, and activation reaches the existing environmental settlement. Empty Ground, entirely missed recipients and Airborne-only recipients are covered across JSON restore. Surviving ordinary ice converts with one boundary remaining; four-round persistent ice converts with two boundaries remaining at Delayed activation. Expired ice is not recreated or extended. Caster Chilled clears once at the legal commit, with no second cleanse during activation and no unit damage for these empty payloads. Historical absent elemental policy retains the previous queue behavior.
2. Explicit/implicit elemental statuses reconcile by resolved recipient identity within the original command. Only overlapping explicit recipient applications defer to positive damage settlement; nonoverlapping explicit recipients retain their authored timing. Matching tuning, timing tag and source origin are captured per recipient for pending damage. The original single captured application field remains supported for saved payload compatibility. A 35% primary-unit Conductive authored before, after or between affected-unit Storm packets produces one fresh 35% charge after all command packets settle; it cannot boost another packet in that command. Mixed recipient sets keep the other recipient's native 20% default where no explicit tuning applies. Restored settlement validates recipient keys, status identity and source metadata.

Focused TDD command:

```text
pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-elemental-damage.test.ts
```

- `review-1-fire-red.log`: five newly added regressions failed; 23 existing tests passed. `review-1-fire-green.log`: all 28 passed after retaining Fire tile payloads.
- `review-1-identity-red.log`: seven identity/order/restore/mixed-set regressions failed; 28 existing tests passed. `review-1-identity-green.log`: all 35 passed after recipient-based reconciliation.
- `review-1-focused.log`: all 39 tests passed after additional per-recipient tuning, timing/origin and malformed JSON capture coverage, including the restored delayed between-packets order. An additional timing fixture initially used an unregistered tag; it was corrected to the existing registered `wet` tag. This fixture correction did not change product timing policy.
- Final `pnpm --filter @aurevane/game-core test`: 144 files, 2661 tests passed, exit 0 (`review-1-core.log`). This run follows the final type narrowing changes and includes all 39 elemental regressions.
- Final `pnpm --filter @aurevane/game-core typecheck`: passed, exit 0 (`review-1-types.log`). Type checking caught recipient-union/fixture inference issues; those were corrected before the final core run.
- `pnpm exec eslint packages/game-core/src/combat/actions-legacy.ts packages/game-core/src/combat/combat-elemental-damage.test.ts`: passed, exit 0 (`review-1-lint.log`).
- `pnpm exec prettier --check packages/game-core/src/combat/actions-legacy.ts packages/game-core/src/combat/combat-elemental-damage.test.ts`: passed, exit 0 (`review-1-format.log`). `git diff --check`: passed.

No reader, UI, validation package, hosted state, migration, dependency or deployment changes were made in this fix round. Root's uncommitted Owner checklist correction is excluded. Suppress remains a separate sequential task. The earlier browser evidence was not rerun for this core-only fix; root owns scoped re-review and the later combined repository/browser/exact-head release gates. No open implementation blocker remains for the two review findings.
