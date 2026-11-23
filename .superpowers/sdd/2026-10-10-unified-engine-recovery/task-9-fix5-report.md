## Fix round 5/5 — scope the observed no-op alert; retain the open native quality gate

FIX_BASE is `88f85ab98efd26dcb1a155de94a0cc8e884b180a`, tree `86cc25c88ed780baa7220d84e13cb09491c435ea`. This is the final bounded repair round. **DONE_WITH_CONCERNS:** the exact alert failure is addressed in source, but fresh native browser acceptance and native quality N4 remain OPEN. Neither is waived by the local diagnostics.

### Observed browser failure and surgical change

Native remote `05aba4f4`, Browser39494343945/job118875348742, passed six other early cases and failed both Players repetitions at the no-op text assertion. The locator `getByRole('alert')` matched both the intended `<p role="alert">Choose a different Primary or Secondary.</p>` and Next's empty `__next-route-announcer__` div. The product's actual no-op message was correct. This is a concrete harness selector collision, not a backend failure.

Both compact native traces were inspected for action/error metadata only. The XP SQL assertions completed in126.21/156.51ms, protected API reads in96.27/50.68ms and Discipline group selections in69.59/47.58ms. Thus the prior300000ms stall was not present in this run; cleanup did not mask the new assertion. Trace summaries and hashes are retained without private request/response payloads or raw browser traces. Root retains the compact artifact12298477046, SHA256 `c4444b0019189ad66c9d277e71930253e8755e0e3cda39881f2e2b9aa928bcb0`.

The E2E now locates the form containing the exact Correction group control, requires exactly one alert within that form, and asserts the same complete no-op text. It does not select the first arbitrary alert, filter by the desired text, or remove the no-op guard. Inspection of every retained assertion found no other unscoped alert lookup in this E2E. Next's announcer has role alert, so no evidence justified changing the separate status assertions. All four Discipline corrections, outgoing command/buildVersion/XP checks, protected denials, PvE recovery and two-participant/spectator PvP recovery remain untouched. No timeout, retry, workflow, product, migration or authority change is included.

The completed native two-match failures are the actual RED. Local browser execution remains unavailable; discovery is not selector GREEN. Root owns the new exact-source native run and the existing reviewer's scoped gate.

### N4 recurrence and focused CPU evidence

Native quality39494344271/job118875350136 failed the unchanged Edgedancer/Wildwarden corrected-earned-build natural-turn test at30428ms against its30000ms limit; the opposite orientation passed at23122ms. Web reported6258 passed/1 failed, including all four cleanup tests. Types/lint/style passed; Node checks and builds were not reached. The earlier complete aa971de3 native quality pass on unchanged combat source remains historical evidence, not a pass for this failed run.

One narrow run selected only these two orientations with Node's CPU profiler. The actual publication/admission/AI/command path passed2 tests with322 skipped, tests28.70s/run30.36s, with the original timeout, seed12345, three-round/real-terminal rule and120-command guard intact. Temporary phase-timing probes were used during diagnosis and then restored byte-for-byte; their console counters were not present in the captured output, so no wall-clock phase conclusions are claimed from them. The conclusions below use the retained CPU profile's sampled call ancestry.

Of30329.37ms sampled runtime, `playLegalRosterDuel` accounted for27914.29ms inclusive and `chooseBuildAwareRecruitAiDecision` for26692.72ms. `createLegalRosterDuel` accounted for39.47ms. Nested authoritative work included22282.13ms in `validateCombatAbilityState` and17065.74ms in `parseAbilityDefinition`. Inclusive figures overlap and cannot be added; profiling can affect timing, and these are local samples rather than native runner measurements. The dominant cost is actual AI candidate simulation/validation, not fixture construction. Publication is already memoized. Raw CPU profile SHA256 is `a985296d271da660965d73398efde7f030eaac6c1a88e09dcb0631390b6a4802`; the compressed profile and derived summary are retained.

No narrow fixture-performance repair was justified. The controller accepted this conclusion: do not widen validation/caching scope, alter gameplay, increase timeout, or repeat a broad suite. Both instrumented files match FIX_BASE again, and the final source diff contains no combat changes. The native quality gate stays OPEN for the final frozen run; an isolated local pass does not establish native reliability or erase the failure.

### Verification, self-review and handoff

Exact argv/cwd/UTC start/end/exit/output records and hashes accompany the evidence. Touched E2E lint and Web types passed. The initial formatting check found the new chained locator needed wrapping and stopped before discovery; that failed log is retained. Formatting was corrected, the follow-up check passed, and Playwright discovered both full native repetitions. No local Chromium, native PostgreSQL or broad quality run is claimed. The existing Vite native-config/CommonJS warning remains visible.

Self-review confirms only one E2E assertion scope changed, plus bounded evidence/reports. Fresh-main preflight returned `b7ba1e7b3e8b850c53f0d15842c96aecc50ae160`, already an ancestor; the final21:09UTC fetch returned the same main and the deployment lock remains `b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f`. No helpers, hosted action, source push, merge or deployment occurred. Deferred Minors, all33+4 authority checks, strict acquired-Owner cleanup and Task10 pause are preserved. Root owns remaining native acceptance and explicit adjudication of any residual failure after this final repair round.
