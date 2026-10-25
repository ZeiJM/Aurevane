# Hosted builtin restore preflight — 2026-10-23

Actual read-only Supabase query at01:15UTC, projectluazfeupwfgnilohfsya. The connector is currently usable for read-only SQL; no browser fallback or hosted mutation was needed. Transaction explicitly read only and rolled back. This does not claim that later migration apply calls are usable.

| Basic identity | Physically retained published versions |
| --- | --- |
| basic.guard |2|
| basic.move |2|
| basic.recover |2,3|
| basic.recover.mp |2,3|
| unarmed.basic |2|

Whole existing history has1110immutable version rows across294content keys. These are live read-only counts, not an empty reset fixture. Original Basicv1 is absent from physical history for all five. The previous private current catalogue also has these Basics current at2/3, but final release must freshly re-read pointers/definitions/metadata rather than assume that earlier payload unchanged. Only stable public identity/version counts are recorded in the accompanying hosted-basic-history-inventory-20261023.json; no user identity, attribution, definitions, token or private player state is included.

Frozen D source ebf7feb056653653a30a04cb63d8bd75ecee0007 still has the restore mutation select only app_private.combat_content_versions and raise COMBAT_CONTENT_VERSION_NOT_FOUND when absent. ReadRecord adds builtinDefinition only while no stored current pointer exists; it does not turn a missing physical builtin baseline into a restorable historical snapshot. builtinCombatContentEntries supplies the current installed fallback catalogue and explicitly seeds metadata, not invented publication history. Exact known prior builtin definitions remain available through retained runtime paths; Task13 must verify the relevant exact source and not substitute a later current definition for an older requested version.

Ruling: The inherited builtin restore boundary is a real Owner section14 gap, confirmed on actual hosted history. Task13 must implement the smallest authoritative restore-to-draft path for exact available builtin baseline definitions, including all five Basicv1 originals, with honest system/source provenance and full hidden/text/media configuration. Do not synthesize historical human publication rows, republish the roster, reset catalogue pointers or weaken exact-version guards. Existing stored histories and all deeper pins remain unchanged. Why: after first editing a live builtin, the operator must be able to restore its original supported snapshot; a warning that it is unavailable does not finish that workflow. Cost if wrong: an additional bounded restore interface/migration and focused/physical tests, reversible before release; no gameplay balance change is authorized.

Carry this as a required Task13 history integration repair. Task10 cap remains5/5, and this does not reopen D or expand11/12. No full-Master/history acceptance or live release until the required restore chain is implemented and independently reviewed. Test real existing-current/no-physical-v1 starting state, all5 independent Basic choices, stale revision/forged source/selected actor denials, complete restore→draft→new publication/new encounter and unchanged old captures/deep rows. Preserve original human attribution where it exists and identify a builtin/system source honestly where no human publication exists. Native PostgreSQL evidence must accompany source controls.

Hosted Content migrations remain unapplied. Players20261020181057 remains previously applied; do not reapply. No catalogue reset, current-pointer update, roster publication or deployment occurred.
