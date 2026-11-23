## Fix round 4/5 — bounded native selector hypothesis and failure-preserving cleanup

FIX_BASE is `3a791c060efda502f8f5cb03dc052a5aefaefb9c`, tree `61d2718f84c35e4f32c86ee4abe5c50985de7ff9`. Status remains **DONE_WITH_CONCERNS** pending the existing reviewer's scoped gate and a new exact-source native browser run. This round does not establish that N5 is fixed or close Task9.

### Actual failure and limits of diagnosis

Root's completed native browser run39488302754/job118854414411 on remote `aa971de38eae662caf95c2bb12309e1068298c87` maps to this FIX_BASE. Both Players repetitions exceeded the unchanged300000ms test limit; six other early Master/Staff/combat-keyboard cases passed. Each Players error also reports `browserContext.close: Target page, context or browser has been closed` in the nested finally, masking the first blocked call. The sanitized native log is retained by root as `native-fix3-browser-failure.log`.

The downloaded compact artifact12296227434 has SHA256 `49a2ce632b71333726115efd08d8fa11ad2458066efad53e4afefa0b362f3303`. It contains all five initial Players layouts for both repetitions and two error contexts. Both final snapshots show1XP, the successful Correction saved status, and the Core Stats & XP group still selected. Thus the first actual XP edit succeeded; subsequent Discipline/recovery/PvP success is not established.

The next source boundaries are the XP SQL assertion, protected API read, Discipline choice derivation and the first group selector. The original native first blocking action cannot be proved from these snapshots. The actual trace is unavailable: root reports the796459888-byte diagnostics artifact exceeds the connector's512MiB download cap, and the alternate artifact also exceeds that cap. No trace was inspected, no first API-read success is inferred, and cleanup is not presented as the stall's cause.

The bounded hypothesis is the exact wrapping-label selector. The actual Players form nests option text inside its labels; all three selects use exact `getByLabel`, which compares that text. The passing Staff native harness already uses exact combobox role/name for the same wrapping-select pattern and documents why. The final snapshot independently identifies a combobox named Correction group. This supports changing the selector but does not prove that it caused this native timeout. The controller authorized this minimal hypothesis test without new dependencies or browser fallbacks.

### Scoped change

Players uses exact combobox role/name for Correction group, Primary and Secondary. Each selection asserts one match and its resulting value. The first group also retains an explicit initial-source assertion. Named Playwright steps distinguish the XP SQL assertion, each protected read, and group selection. All four Discipline correction cases, command payload checks, buildVersion/XP checks, denials, actual PvE and two-participant/spectator recovery assertions remain. The300000ms limit is unchanged.

The local fixture cleanup now attempts the acquired Owner release and awaits every owned-context close. With an existing failure it reports cleanup errors and allows the exact original exception to propagate. Without a primary failure it throws an AggregateError containing every cleanup error; cleanup cannot turn a failed proof into success. No acquired grant means no role mutation. The strict existing Owner isolation, returned actual auth IDs, original33+4 authority inventory, backend, migrations and gameplay remain unchanged.

The existing `combat-release-reader-screens` artifact includes only the Players `trace.zip` glob in addition to its existing files. No new workflow, test slice, timeout, retry, serialization, dependency or product route was added. If the next native run fails, its first action should remain visible and the scoped traces should be retrievable without the entire diagnostic archive.

### Verification and handoff

The cleanup RED extracted the original nested-finally cleanup into the testable fixture boundary before changing it. Two tests failed for the observed exception masking and lost Owner-release error; two normal/never-acquired cleanup cases passed. After the fix, all four pass. These are fixture lifecycle tests with explicit failing close/SQL callbacks, not actual browser or PostgreSQL execution. The native failed E2E remains the selector RED; no local selector GREEN is claimed.

Exact cwd, argv, UTC start/end, exit and raw output are in `fix4-*.log`, with hashes in `fix4-evidence-manifest.json` and appended verification records. Touched lint, Web types, formatting and two-repetition Playwright discovery all exited0. Discovery is not browser execution. Local pinned Chromium, Docker and psql remain absent; no download retry or substitute browser was attempted. The existing Vite CommonJS/native-config warning is retained.

Root separately reports exact aa971de3 native quality and database success (11953Vitest/633files plus7Node, types/lint/two builds and physical Players races) and UI-layout success. Those results remain tied to their original head and are not newly executed evidence for this repair. No passing broad suite was repeated. Root owns source publication and the fresh native gate; this implementer performed no hosted action, push, merge or deployment and did not unpause Task10.

Self-review found only the four intended source/test/workflow paths plus scoped evidence. Fresh-main diagnosis/edit checks returned `b7ba1e7b3e8b850c53f0d15842c96aecc50ae160`, already an ancestor. Final freshness at20:40UTC returned the same main, and the recorded deployment lock remains `b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f`. Deferred Minors remain unchanged. The next acceptance boundary is actual native progression beyond the named API/selector steps through every retained recovery assertion.
