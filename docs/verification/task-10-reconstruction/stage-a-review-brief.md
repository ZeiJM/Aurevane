# Task 10 Stage A combined spec and quality gate

This is the producer subgate for the existing Task10, not whole Task10 completion. One combined reviewer owns this task and its later scoped stages. The complete implementation diff begins at `b83de822171d8f62726bd8b7a668a82d5d39b523`, which contains accepted Staff/current main/Players and no Content product. Do not use HEAD~1. The dispatch pins the actual final HEAD, report and generated review package.

Requirements: read the coordinating `task-10-reconstruction-contract.md` and StageA portion of `task-10-discovery.md` under `.superpowers/sdd/2026-10-10-unified-engine-recovery`. The approved Task10 brief is in the same directory. Consume `docs/verification/task-9-reconstruction/backend-handoff.md`; complete-record actor/caller signatures are in the implementation's `docs/verification/task-10-reconstruction/actor-and-caller-interface.md`. The approved owner brief and current domain specs govern any concrete conflict.

## Binding global constraints, quoted from the approved plan

- Structured definitions determine mechanics; descriptions never create rules. Stable IDs, typed units and explicit effect order are mandatory.
- Do not change unrelated damage formulas, progression, AP economy, movement limits or resource recovery. Preserve current roster balance through Tasks 1–13/3A; Tasks 14–15 design and implement the Owner-authorized final roster rebalance through new immutable versions. Current `armor`/`ward` mean Physical/Mystic Defense, not future equipment Armor.
- Save Draft is not Publish. Publish appends a complete atomic version with optimistic concurrency. Restore copies a complete prior snapshot into a draft, then publishes a new version. UI shows current plus two previous published versions; older referenced snapshots remain physically readable.
- Staff grants belong only to the explicitly selected linked character and are checked for expiry/revocation on every protected server/RPC operation. Single Game Owner and nondelegable powers remain protected. Ambiguous legacy grants fail closed until explicitly bound.
- Administrative battle recovery is durable no contest/no rewards, never ordinary surrender/defeat; identify all affected participants before voiding a shared encounter. Late workers/retries cannot grant rewards or records. Do not invent resource refunds.
- New migrations use `pnpm exec supabase migration new` after CLI help, preserve existing migration files and service-only grants/RLS, and are tested locally/PGlite. Never mutate hosted production during Tasks 1–16. The Owner-authorized final release applies only reviewed necessary hosted changes after acceptance, independent whole-branch review and current-state reconciliation. Preserve `apps/web/vercel.json` Git deployment lock.

Current released combat/Requirements/Blindside behavior and current source outrank superseded illustrative plan clauses. StageA preserves that source and its immutable versions.

## Stage A acceptance surface

Review complete typed record identity/lifecycle, bounded list/read, strict saved drafts and deliberate compatible combat projection; malformed/unknown kinds fail closed. Preserve all legitimate stored combat kinds; reserved Basics stay stored Skills. Future Item/Ascension/Severence drafts must have meaningful finite shapes and specific unsupported publication/runtime blockers. No future inventory/equipment/transformation runtime is promised.

Check real selected-actor/live capability checks and browser denial, original33 + Players4 + Content4 actor inventory, private helper/table ACLs and all14 actual legacy mutation retirements after their real authorization. Complete-record publication reloads the exact saved revision, validates the prospective catalogue, observes CAS/lifecycle/catalogue ABA, appends above every physical version and preserves exact history. Restore intent and attribution are independent, current tombstones cannot resurrect via builtin fallback, and builtin metadata/first edit/duplicate must preserve actual source/current identity without inventing baseline history.

Check indexed active versus retained-history dependencies, bounded Used-by with full archive blocker query, actual implicit builtin E/R consumers, archived reference/link cleanup and transaction rollback. Actual four-table admission guards use shared nonblocking catalogue admission versus exclusive archive, without character-lock inversion. Named40001 retry and archived-reference errors must reach real caller domain outcomes, including Players; no earned/trial/build formula is rewritten. Prepared native two-session schedules and exact whole-state snapshots must exercise both orderings, unrelated admissions and losing-writer rollback.

## Evidence and held work

Use the implementer's exact command ledger, retained RED/GREEN output and current report. Do not repeat passing suites. Additional focused inspection is justified by a specific unresolved concern. Report spec compliance AND task quality, Critical/Important/Minor findings with concrete diff locations, and any requirements that cannot be verified from this diff. The controller resolves cross-task limits explicitly.

Native PostgreSQL physical schedules, final full quality, actual finished editor/browser, physical zoom/device and hosted/human acceptance are separate gates. StageA intentionally retires legacy mutation paths before StageD migrates the actual editor, so it is not an independently deployable UI release. StageB real Discipline/Core/E/R/earned producers, StageC references/media/private presentation and StageD complete compact editor remain held substantive work. This source gate may unlock only the next justified dependency work after native disposition; it cannot mark Task10 or the Master overhaul complete.
