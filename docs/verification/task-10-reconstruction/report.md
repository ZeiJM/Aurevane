# Task 10 reconstruction — Stage A in progress

BASE `924551bf8be31ff717b6053365996beddc97d76a`, tree `71d18774c9405dae976d46c3a3634d301b69b5fd`; fresh main `b7ba1e7b3e8b850c53f0d15842c96aecc50ae160` remains an ancestor. Accepted Task 9 backend handoff consumed. One implementer; root owns independent review/publication.

## First source checkpoint (incomplete)

The first additive migration introduces record identity/lifecycle, monotonic record/draft revisions, saved-only publication, private attribution, retained physical history and version floor, draft-only restore with independent fresh restore intent, bounded list/read, idempotent create/duplicate, links and actual Used-by queries. Four exact selected-actor RPCs use the existing live content capability assertion; all four reject actual browser-role invocation. Catalogue CAS now observes draft/lifecycle changes and retains the latest actual global timing reader.

Six focused actual-all-migrations PGlite tests first failed (missing complete-record API), then passed. PGlite uses only platform fixtures plus the approved unavailable scheduler/LZ4 storage substitutions. This is not native PostgreSQL concurrency or browser evidence. Scoped DB types first exposed one test-result type error; the corrected run passes. No full suite or release acceptance is claimed.

This checkpoint is NOT Stage A complete or safe to deploy independently. Remaining Stage A work includes strict noncombat envelopes and compatible projection/nonresurrection readers, actual shared nonblocking admission guards and caller retry mapping (including Players), complete saved-record server/store/handler contracts, reference indexing/atomic create-with-parent, old RPC retirement with complete caller/inventory migration, deeper attribution/CAS/floor/archive race regression coverage, and final scoped verification. Current intermediate SQL accepts only the identity envelope; publication's full semantic validation must be integrated through the server before acceptance. Stage B/C/D remain locked.

No hosted access, push, merge or deployment performed. Deployment lock unchanged. New migration created using pinned CLI 2.114.0 after `migration new --help`.
