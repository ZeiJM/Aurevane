# Task10 Stage B fix4 disposition — 2026-10-22

Awaiting the same combined reviewer's scoped re-review. Single implementer; retained round4/5 budget. No C/D work or migration edits.

FixBASE: `24b797b551748dff54d2fb370c12d0e2c525fd67`; tree `f133bc93805d16245739b2bb82bf22f187a2bc79` (verified restored reviewed b801 tree). Main remains `a31029c04c0ef7be9fd08092c6a70f6f086b48b6` at coordinator final fetch; reviewed Next b091 remains reconciled. Exact committed HEAD/tree is reported directly to the coordinator after this commit.

- I1 repaired: retained draft/current/history bodies preserve120/4000; new authoring/readiness still enforces80/240. Shared Core/focus/eligibility validation and exact bytes remain.
- I2 repaired: actual Essence/pair/Core producer names map to safe actionable messages using validated pair details or saved target/partner identity. Core's real inherited SQLSTATE23505 is covered explicitly; unrelated23505 and previous mapper outcomes retain their behavior. No raw SQL diagnostics exposed.
- I3 repaired: production v3 invokes the existing admission mapper. Real PUT/service/adapter coverage proves409 retry,400 archived/invalid current selection and preserved existing error contracts.

Product source changed:

- `packages/game-core/src/content/authored-content.ts`
- `apps/web/src/server/combat/combat-content-categories.ts`
- `apps/web/src/server/master/supabase-combat-content-authoring-store.ts`
- `apps/web/src/server/character/supabase-character-build-repository-v3.ts`

Regression source: new `apps/web/src/server/master/combat-content-discipline-boundaries.test.ts` and `apps/web/src/app/api/character/build/disciplines/admission-route.test.ts`; strengthened actual23505 assertion in `packages/db/src/combat-content-discipline-producers.test.ts` without weakening rollback checks.

Checks: final Web136/9, game-core authored30/1, actual-chain Core/relationship1 (55 filtered), final new regressions33/2; bounded Web types, game-core/DB types, scoped Web/package lint, touched formatting pass. Exact argv, named covering files, output/exits and capture SHA256 are appended in `docs/verification/task-10-reconstruction/report.md` and `verification.jsonl`. No broad/full build, physical/native/browser, hosted write, push, merge or deployment claim. M1 Vite warning remains unsuppressed. Existing source/history/CAS/actor/ACL/mechanics contracts are preserved.

Evidence limitation: two multi-file RED logs later retained only994/995-byte prefixes; original ledger hashes/entries remain unchanged, full outputs were observed, and an explicitly labelled reconstructed transcript is retained separately. The failed integrity command is retained. Two final single-file RED controls were captured into immutable staged gzip artifacts and their checksums match; all other new logs match. The entire pre-fix190074-byte ledger, including original136674-byte prefix and93 appended evidence rows, remains exact. No further replay or artifact investigation is planned. Details and both observed partial hashes are in the main report.

Stop: source acceptance, physical/native/browser gates, later C/D and Task13 remain coordinator/reviewer work. No unresolved product concern identified within I1–I3; the evidence truncation above is an explicit recovery limitation.
