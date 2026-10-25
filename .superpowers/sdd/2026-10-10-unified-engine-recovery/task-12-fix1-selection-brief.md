# Task12 fix round1/5 — Event identity and readable audience

Read archived stage-12-review-20261025.md and this brief first. Same sole implementer, no helpers. Same Task12brief/addendum bind. FixBASE is reviewed dd62fd6aaa9579e3df145abc2dba524835123f4f. Root merged coordinator docs after freeze at3b96a0814; the only difference from reviewedproduct is controller-resume doc, ledger455879bytes retained exactly against remote410347prefix. Root now appends review/ruling/brief only. Do not reset any docs/evidence.

Full feedback, verbatim:

### I1 — Loading another event retains the previous event's live-action handle and approval

**Important; SPEC and QUALITY.** `apps/web/src/components/master/events/event-builder-client.tsx:230–253`, new saved-event selection at `:406–420`, cancellation at `:346–360`.

The new saved-event picker calls `loadWorkspace(eventKey)`, which replaces the definition and version state but never clears or rebinds `scheduledRun`, `productionConfirmed`, or `previewResult`. These values belong to the event being left. The UI can therefore display event B while enabling Unschedule for a run created under event A, using confirmation made before B was selected. Independently, confirming publication for A and choosing B leaves B's Publish action already confirmed. The ordinary field-edit path clears confirmation, but the new selection path bypasses it.

A focused actual-production-component browser probe reproduced the cross-event path, using the existing explicit HTTP fixture on Chromium 153.0.8010.0:

1. Load `event.ready`, generate its preview, and schedule it.
2. Check the consequential-action confirmation, then select `event.stale` from Saved events.
3. The displayed Event key is `event.stale`, confirmation is still checked, and Unschedule is enabled.
4. Clicking Unschedule emits `operation: cancel-scheduled`, `runId: 22222222-2222-4222-8222-222222222222`, `expectedStateVersion: 1`, `confirmed: true` — the prior `event.ready` run.
5. Opening Preview still shows the earlier preview without requesting a preview of B.

The fixture intentionally has no cancellation implementation; the emitted request and UI state prove the client defect, not a physical database cancellation. In production the normal server authority/CAS checks do not prevent this when the operator is authorized for A and its state remains 1: both target and expected version are valid, but they do not match the event the UI presents for confirmation.

**Required correction:** make event identity replacement reset confirmation and preview, and clear or explicitly bind the scheduled-run handle to its owning event. Apply the same rule to New Event and manual identity changes; do not allow a prior event's action handle to remain operable under a new identity. A focused regression should cover A→B after confirmation and after scheduling, and assert that no cancellation of A can be emitted from B's controls. If deliberately retaining a cross-event run handle, the UI must explicitly identify that run/event and require a fresh corresponding confirmation; silent retention is not acceptable.

Probe retained outside the checkout: `/workspace/scratch/e5db2ba73c1a/task12-review-selection-probe.mjs`. Its command exited 0 and printed the reproduced incorrect state/request. This was a new focused check, not a rerun of the reported suite.

### M1 — The supported audience reference still displays a raw key, and region suggestions are offered for every scope kind

**Minor; SPEC and QUALITY.** `apps/web/src/components/master/events/event-builder-client.tsx:591–611` and audience display near `:501–509`; live-list scope presentation at `apps/web/src/components/master/events/event-operations-client.tsx:363`.

The new scope field supplies a region datalist but remains an unrestricted raw-key input. After selection, the field and audience summary display `verdant-expanse`, rather than the available readable region name. Moreover, `list="event-region-refs"` applies to node and cohort scopes too, so those audiences are offered region identifiers with no distinction. The frozen desktop screenshot confirms the ordinary authoring flow shows the raw key. This falls short of Owner 19's readable reference pickers and clear affected audience, although it does not itself establish an authorization bypass.

**Required correction:** use the known region labels in the selected control and audience summaries, preserving the key internally. Only offer references appropriate to the selected scope type. For node/cohort references without a real resolver/catalogue, explicitly identify the custom/unresolved draft reference and its supported limits instead of presenting region suggestions as those audiences. Do not invent reference data or an executor.


## Bounded execution
I1 is technically confirmed by actual production-component probe; close it before source acceptance. Include the explicitly required readable-audience M1 correction in this same identity/scope control wave; it is recorded as a Minor/spec miss, not a new independent fixloop or reason to extend the cap. Preserve publication/history semantics and runtime/authority. No invented node/cohort/actor resolver. Use actual knownWorldregion names with canonical keys internal; distinguish unresolved custom scopes and actual supported limits.

Apply identity replacement safety to saved-event loads, NewEvent and manual key changes; don't let scheduledAapproval/preview/actions operate underB. Clear or bind relevant transientstate to actual owning identity, preserving real draftBaseVersion, validBfreshconfirmation and deliberate schedule/cancel behavior. Avoid adding a backendcontract merely to compensate for staleUI unless actualservicebug is demonstrated. No unrelated SQL/kernel/emergency/reward change.

Turn observed A→B path into meaningful permanent actualcomponent RED/GREEN guard in the existing eventworkspacebrowserfixture/script: after confirmation/schedulingA switchtoB/New/manualidentity, oldconfirmationunchecked, oldpreviewabsent, oldAcancellationcannotemit fromBcontrols; then verify freshtargetBoperations useB's realhandle/version/confirmation. Cover readable knownregionselection+summary, scopekind change hasappropriate controls/options and unresolved limits. Preserve existing complete three-layout workflows, staleDraftBase retention, no sideeffectpreview, reasonfree/CASpayload/keyboard/touch and geometry. No forcedclick/skips/raisedtimeouts/assertionweakening.

Run focused affected checks (actual browser, applicableunit/types/lint/format); no fullpnpmcheck or unaffectedSQLcounterfactual repeat for a UI-onlyrepair. Append same task-12-report.md and exact fresh rawgzip receipts preserving455879bytes/alloldartifacts. Explicitly report covering test command and output; commit coherent/freeze, askrootdirect-main freshness beforefinal. Rootbackup/oneSAMEreviewerscopeddd62..newHEAD. Task12round1/5, Task11acceptedround2/5 and Task10cap5/5 unchanged. Task13/notlivegates remain, don'tstart13.
